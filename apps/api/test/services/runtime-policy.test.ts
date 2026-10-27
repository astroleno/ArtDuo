import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { acquireProviderPermit, enforceVisitorLimit, RuntimeLimitError, runtimePolicy } from "../../src/runtime/request-policy";
import { publicOrigins, runtimeDirectories } from "../../src/runtime/environment";

const request = { requestBytes: 100, maxOutputTokens: 100, kind: "intent", model: "fixture" };
const limited = (code: string) => (error: unknown) => error instanceof RuntimeLimitError && error.code === code;

test("dual public origins are explicit HTTPS origins and keep the existing model ceilings", () => {
  const env = { ARTDUO_PUBLIC_MODE: "1", ARTDUO_PUBLIC_ORIGIN: "https://aitoshuu.me", ARTDUO_PUBLIC_ORIGINS: "https://tongye.me, https://aitoshuu.me/",
    ARTDUO_STATE_DIR: "/var/lib/artduo", ARTDUO_REQUEST_SALT: "a".repeat(40), ARTDUO_TRUSTED_PROXY_HEADER: "x-real-ip" };
  assert.deepEqual(publicOrigins(env), ["https://aitoshuu.me", "https://tongye.me"]);
  const policy = runtimePolicy("/tmp/artduo", env);
  assert.deepEqual([policy.concurrency, policy.dailyRequests, policy.dailyTokens, policy.visitorRequests], [3, 200, 1_000_000, 8]);
  for (const origin of ["http://tongye.me", "https://tongye.me/ArtDuo", "https://user@tongye.me", "https://tongye.me?x", "null", ""]) {
    assert.throws(() => runtimePolicy("/tmp/artduo", { ...env, ARTDUO_PUBLIC_ORIGINS: origin }));
  }
});

test("concurrent callers share a durable limit, release leases, and keep the spent budget across restarts", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-runtime-"));
  const env = { ARTDUO_STATE_DIR: root, ARTDUO_MODEL_CONCURRENCY: "2", ARTDUO_MODEL_DAILY_REQUESTS: "3" };
  try {
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => acquireProviderPermit(root, request, env)));
    const successes = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof acquireProviderPermit>>> => result.status === "fulfilled");
    assert.equal(successes.length, 2);
    assert.ok(results.filter(result => result.status === "rejected").every(result => limited("model-concurrency-reached")((result as PromiseRejectedResult).reason)));
    await Promise.all(successes.map(result => result.value.finish({ status: "ok" })));
    const third = await acquireProviderPermit(root, request, { ...env }); await third.finish({ status: "error" });
    const ledger = JSON.parse(readFileSync(path.join(root, "request-policy.json"), "utf8"));
    assert.equal(ledger.requests, 3); assert.equal(ledger.reservedTokens, 600); assert.deepEqual(ledger.leases, []);
    await assert.rejects(acquireProviderPermit(root, request, { ...env }), limited("model-daily-budget-reached"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("token reservations fail closed on budget exhaustion or damaged accounting", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-token-budget-"));
  const env = { ARTDUO_STATE_DIR: root, ARTDUO_MODEL_DAILY_TOKENS: "250" };
  try {
    const permit = await acquireProviderPermit(root, request, env); await permit.finish({ status: "ok" });
    await assert.rejects(acquireProviderPermit(root, request, env), limited("model-daily-budget-reached"));
    writeFileSync(path.join(root, "request-policy.json"), "broken");
    await assert.rejects(acquireProviderPermit(root, request, env), limited("runtime-state-unavailable"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("public mode needs persistent storage and a trusted address; visitor records never store the raw IP", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-visitor-limit-"));
  const env = { ARTDUO_STATE_DIR: root, ARTDUO_PUBLIC_MODE: "1", ARTDUO_PUBLIC_ORIGIN: "https://art.example", ARTDUO_REQUEST_SALT: "a".repeat(40), ARTDUO_TRUSTED_PROXY_HEADER: "x-real-ip", ARTDUO_VISITOR_REQUESTS_PER_MINUTE: "2" };
  try {
    assert.throws(() => runtimeDirectories(root, { ARTDUO_PUBLIC_MODE: "1" }), /persistent/);
    assert.throws(() => runtimeDirectories(root, { ARTDUO_STATE_DIR: path.join(root, "public", "state") }), /public assets/);
    assert.throws(() => runtimePolicy(root, { ...env, ARTDUO_PUBLIC_ORIGIN: "http://art.example" }), /HTTPS/);
    await assert.rejects(enforceVisitorLimit(root, new Headers({ "x-real-ip": "203.0.113.7, 127.0.0.1" }), "curation", env), limited("trusted-client-address-required"));
    const headers = new Headers({ "x-real-ip": "203.0.113.7" });
    await enforceVisitorLimit(root, headers, "curation", env); await enforceVisitorLimit(root, headers, "curation", env);
    await assert.rejects(enforceVisitorLimit(root, headers, "curation", env), limited("visitor-rate-limit"));
    await enforceVisitorLimit(root, new Headers({ "x-real-ip": "203.0.113.8" }), "curation", env);
    const saved = readFileSync(path.join(root, "request-policy.json"), "utf8");
    assert.ok(!saved.includes("203.0.113"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
