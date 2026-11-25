import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createExperienceMetricsLimiter, metricsSource } from "../../lib/experience-metrics-limit";
import { POST } from "../../app/api/experience/metrics/route";
import { experienceObservability, experienceObservabilityDirectory, readExperienceObservability } from "../../lib/experience-observability";

test("metrics buckets tolerate normal traffic, refill predictably and cap the instance", () => {
  let now = 0;
  const limiter = createExperienceMetricsLimiter(() => now);
  for (let i = 0; i < 20; i++) assert.equal(limiter.take("shared"), undefined);
  assert.equal(limiter.take("shared"), 2);
  now = 1_999;
  assert.equal(limiter.take("shared"), 1);
  now = 2_000;
  assert.equal(limiter.take("shared"), undefined);
  assert.equal(limiter.take("shared"), 2);
  const normal = createExperienceMetricsLimiter(() => now);
  for (let visit = 0; visit < 10; visit++) {
    for (let phase = 0; phase < 3; phase++) assert.equal(normal.take("shared"), undefined);
    now += 6_000;
  }
  const global = createExperienceMetricsLimiter(() => now);
  for (let i = 0; i < 60; i++) assert.equal(global.take(`source-${i}`), undefined);
  assert.equal(global.take("new-source"), 1);
  now += 200;
  assert.equal(global.take("new-source"), undefined);
});

test("bounded metrics buckets expire and arbitrary forwarding headers never select a local bucket", () => {
  let now = 0;
  const limiter = createExperienceMetricsLimiter(() => now, 2);
  assert.equal(limiter.take("one"), undefined);
  assert.equal(limiter.take("two"), undefined);
  assert.equal(limiter.take("overflow"), 2);
  now = 120_000;
  assert.equal(limiter.take("overflow"), undefined);
  const environment = { ARTDUO_PUBLIC_MODE: "1", ARTDUO_TRUSTED_PROXY_HEADER: "x-real-ip", ARTDUO_REQUEST_SALT: "s".repeat(32) };
  const forwarded = new Headers({ "x-forwarded-for": "192.0.2.11", "x-real-ip": "192.0.2.12" });
  assert.equal(metricsSource(forwarded, {}), "shared");
  assert.equal(metricsSource(forwarded, { ...environment, ARTDUO_REQUEST_SALT: "untrusted" }), "shared");
  assert.equal(metricsSource(new Headers({ "x-forwarded-for": "192.0.2.11" }), environment), "shared");
  const trusted = metricsSource(forwarded, environment);
  assert.match(trusted, /^[a-f0-9]{64}$/u);
  assert.equal(trusted, metricsSource(forwarded, environment));
  assert.notEqual(trusted, metricsSource(new Headers({ "x-real-ip": "192.0.2.13" }), environment));
});

test("the actual route returns 429 and no extra aggregate sample after the burst", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "artduo-metrics-limit-"));
  const keys = ["ARTDUO_OBSERVABILITY", "ARTDUO_STATE_DIR", "ARTDUO_PUBLIC_MODE"] as const;
  const previous = keys.map(key => process.env[key]);
  try {
    process.env.ARTDUO_OBSERVABILITY = "1";
    process.env.ARTDUO_STATE_DIR = directory;
    delete process.env.ARTDUO_PUBLIC_MODE;
    const request = () => new Request("http://127.0.0.1:4973/api/experience/metrics", { method: "POST",
      headers: { origin: "http://127.0.0.1:4973", "content-type": "application/json" },
      body: JSON.stringify({ phase: "enter-to-first-artwork-actionable", bucket: 1 }) });
    const responses = await Promise.all(Array.from({ length: 21 }, () => POST(request())));
    assert.equal(responses.filter(reply => reply.status === 204).length, 20);
    const limited = responses.find(reply => reply.status === 429);
    assert.match(limited?.headers.get("Retry-After") ?? "", /^[12]$/u);
    await experienceObservability()!.flush();
    const { totals } = await readExperienceObservability(experienceObservabilityDirectory()!);
    assert.equal(totals.timings["enter-to-first-artwork-actionable"]!.n, 20);
  } finally {
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index];
    });
    await rm(directory, { recursive: true, force: true });
  }
});
