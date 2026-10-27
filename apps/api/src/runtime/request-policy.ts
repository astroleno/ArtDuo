import { createHmac, randomUUID } from "node:crypto";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { isIP } from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { publicOrigins, readProjectModelEnvironment, runtimeDirectories } from "./environment";

type Environment = Record<string, string | undefined>;
export class RuntimeLimitError extends Error {
  constructor(public readonly code: string, public readonly status = 429, public readonly retryAfter = 60) { super(code); this.name = "RuntimeLimitError"; }
}

function integer(environment: Environment, key: string, fallback: number, max: number): number {
  const value = environment[key] === undefined ? fallback : Number(environment[key]);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new TypeError(`Invalid ${key}`);
  return value;
}
export function runtimePolicy(rootDir: string, environment = readProjectModelEnvironment(rootDir)) {
  const directories = runtimeDirectories(rootDir, environment);
  const publicMode = environment.ARTDUO_PUBLIC_MODE === "1";
  if (publicMode) {
    publicOrigins(environment);
    if (environment.ARTDUO_TRUSTED_PROXY_HEADER !== "x-real-ip" || (environment.ARTDUO_REQUEST_SALT?.length ?? 0) < 32) throw new TypeError("Public mode requires a trusted proxy header and private request salt");
  }
  return { ...directories, publicMode,
    concurrency: integer(environment, "ARTDUO_MODEL_CONCURRENCY", 3, 16),
    dailyRequests: integer(environment, "ARTDUO_MODEL_DAILY_REQUESTS", 200, 100_000),
    dailyTokens: integer(environment, "ARTDUO_MODEL_DAILY_TOKENS", 1_000_000, 100_000_000),
    visitorRequests: integer(environment, "ARTDUO_VISITOR_REQUESTS_PER_MINUTE", 8, 1000),
    salt: environment.ARTDUO_REQUEST_SALT ?? "local-only",
  };
}

interface Ledger {
  schemaVersion: 1; day: string; requests: number; reservedTokens: number;
  leases: Array<{ id: string; expiresAt: number }>;
  visitors: Record<string, { start: number; count: number }>;
}

function readLedger(filename: string, now: number): Ledger {
  const day = new Date(now).toISOString().slice(0, 10);
  let ledger: Ledger;
  if (!existsSync(filename)) return { schemaVersion: 1, day, requests: 0, reservedTokens: 0, leases: [], visitors: {} };
  try {
    const raw = readFileSync(filename, "utf8");
    if (raw.length > 2_000_000) throw new Error("oversized ledger");
    ledger = JSON.parse(raw);
    if (ledger.schemaVersion !== 1 || !/^\d{4}-\d{2}-\d{2}$/u.test(ledger.day)
      || !Number.isSafeInteger(ledger.requests) || ledger.requests < 0 || !Number.isSafeInteger(ledger.reservedTokens) || ledger.reservedTokens < 0
      || !Array.isArray(ledger.leases) || ledger.leases.some(lease => typeof lease.id !== "string" || !Number.isFinite(lease.expiresAt))
      || !ledger.visitors || typeof ledger.visitors !== "object" || Array.isArray(ledger.visitors)) throw new Error("invalid ledger");
  } catch { throw new RuntimeLimitError("runtime-state-unavailable", 503); }
  ledger.leases = ledger.leases.filter(lease => lease.expiresAt > now);
  ledger.visitors = Object.fromEntries(Object.entries(ledger.visitors).filter(([, item]) => item && Number.isFinite(item.start) && Number.isSafeInteger(item.count) && item.count > 0 && now - item.start < 60_000));
  if (ledger.day < day) { ledger.day = day; ledger.requests = 0; ledger.reservedTokens = 0; }
  return ledger;
}

/** Atomic local-volume accounting. This supports one deployed instance, not a distributed fleet. */
async function transact<T>(state: string, mutate: (ledger: Ledger) => T, now = Date.now()): Promise<T> {
  mkdirSync(state, { recursive: true, mode: 0o700 });
  const lock = path.join(state, "request-policy.lock"), filename = path.join(state, "request-policy.json");
  const token = randomUUID();
  let descriptor: number | undefined;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { descriptor = openSync(lock, "wx", 0o600); writeFileSync(descriptor, JSON.stringify({ pid: process.pid, token })); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const before = statSync(lock);
        const owner = JSON.parse(readFileSync(lock, "utf8"));
        if (now - before.mtimeMs > 30_000 && Number.isInteger(owner.pid) && owner.pid > 0) {
          let alive = true;
          try { process.kill(owner.pid, 0); } catch (error) { alive = (error as NodeJS.ErrnoException).code !== "ESRCH"; }
          if (!alive && statSync(lock).ino === before.ino) unlinkSync(lock);
        }
      } catch { /* An active or malformed lock is not ours to remove. */ }
      await delay(10);
    }
  }
  if (descriptor === undefined) throw new RuntimeLimitError("runtime-state-busy", 503, 2);
  const temporary = `${filename}.${token}.tmp`;
  try {
    const ledger = readLedger(filename, now);
    const result = mutate(ledger);
    writeFileSync(temporary, JSON.stringify(ledger), { flag: "wx", mode: 0o600 });
    renameSync(temporary, filename);
    return result;
  } finally {
    closeSync(descriptor);
    try { if (existsSync(temporary)) unlinkSync(temporary); } finally {
      try { if (JSON.parse(readFileSync(lock, "utf8")).token === token) unlinkSync(lock); } catch { /* Never unlink a replacement lock. */ }
    }
  }
}

export async function acquireProviderPermit(rootDir: string, input: { requestBytes: number; maxOutputTokens: number; kind: string; model: string }, environment = readProjectModelEnvironment(rootDir)) {
  const policy = runtimePolicy(rootDir, environment);
  if (!Number.isSafeInteger(input.requestBytes) || input.requestBytes < 1 || input.requestBytes > 150_000
    || !Number.isSafeInteger(input.maxOutputTokens) || input.maxOutputTokens < 1 || input.maxOutputTokens > 4096) throw new RuntimeLimitError("model-request-too-large", 413);
  const started = Date.now(), id = randomUUID();
  // UTF-8 byte count is deliberately conservative for input, plus the explicit
  // provider output limit. Reservations are not described as measured usage.
  const reservedTokens = input.requestBytes + input.maxOutputTokens;
  await transact(policy.state, ledger => {
    if (ledger.requests >= policy.dailyRequests || ledger.reservedTokens + reservedTokens > policy.dailyTokens) throw new RuntimeLimitError("model-daily-budget-reached", 429, 3600);
    if (ledger.leases.length >= policy.concurrency) throw new RuntimeLimitError("model-concurrency-reached", 429, 5);
    ledger.requests++; ledger.reservedTokens += reservedTokens;
    ledger.leases.push({ id, expiresAt: started + 65_000 });
  }, started);
  const directory = path.join(policy.state, "provider-events"); mkdirSync(directory, { recursive: true, mode: 0o700 });
  const log = path.join(directory, `${new Date(started).toISOString().slice(0, 10)}.jsonl`);
  appendFileSync(log, JSON.stringify({ id, event: "reserved", at: new Date(started).toISOString(), ...input, reservedTokens }) + "\n", { mode: 0o600 });
  let finished = false;
  return { async finish(outcome: { status: "ok" | "error"; firstTokenMs?: number }) {
    if (finished) return;
    finished = true;
    await transact(policy.state, ledger => { ledger.leases = ledger.leases.filter(lease => lease.id !== id); });
    appendFileSync(log, JSON.stringify({ id, event: "finished", at: new Date().toISOString(), durationMs: Date.now() - started, ...outcome }) + "\n", { mode: 0o600 });
  } };
}

/** The reverse proxy must replace x-real-ip; untrusted forwarding chains are rejected. */
export async function enforceVisitorLimit(rootDir: string, headers: Pick<Headers, "get">, scope: "curation" | "narrative" | "explanation" | "handwriting", environment = readProjectModelEnvironment(rootDir)): Promise<void> {
  const policy = runtimePolicy(rootDir, environment);
  if (!policy.publicMode) return;
  const ip = headers.get("x-real-ip")?.trim();
  if (!ip || !isIP(ip)) throw new RuntimeLimitError("trusted-client-address-required", 503);
  const now = Date.now();
  const key = createHmac("sha256", policy.salt).update(`${new Date(now).toISOString().slice(0, 10)}:${scope}:${ip}`).digest("hex");
  await transact(policy.state, ledger => {
    const entry = ledger.visitors[key] ?? { start: now, count: 0 };
    if (entry.count >= policy.visitorRequests || Object.keys(ledger.visitors).length >= 5000 && !ledger.visitors[key]) throw new RuntimeLimitError("visitor-rate-limit", 429);
    ledger.visitors[key] = { ...entry, count: entry.count + 1 };
  }, now);
}
