import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";

const SOURCE_BURST = 20;
const SOURCE_PER_MINUTE = 30;
const INSTANCE_BURST = 60;
const INSTANCE_PER_MINUTE = 300;
const BUCKET_CAPACITY = 512;
const IDLE_TTL_MS = 120_000;

interface Bucket { tokens: number; at: number; lastSeen: number }

function refill(bucket: Bucket, now: number, burst: number, perMinute: number) {
  bucket.tokens = Math.min(burst, bucket.tokens + Math.max(0, now - bucket.at) * perMinute / 60_000);
  bucket.at = now;
}

export function createExperienceMetricsLimiter(now = () => performance.now(), capacity = BUCKET_CAPACITY) {
  const buckets = new Map<string, Bucket>();
  const global: Bucket = { tokens: INSTANCE_BURST, at: now(), lastSeen: now() };
  let pruneAt = 0;
  const retry = (remaining: number, perMinute: number) => Math.max(1, Math.ceil((1 - remaining) * 60 / perMinute));
  return {
    take(source: string): number | undefined {
      const time = now();
      if (time >= pruneAt || buckets.size >= capacity && !buckets.has(source)) {
        for (const [key, bucket] of buckets) if (time - bucket.lastSeen >= IDLE_TTL_MS) buckets.delete(key);
        pruneAt = time + 15_000;
      }
      let bucket = buckets.get(source);
      if (!bucket) {
        if (buckets.size >= capacity) return 2;
        bucket = { tokens: SOURCE_BURST, at: time, lastSeen: time };
        buckets.set(source, bucket);
      }
      refill(bucket, time, SOURCE_BURST, SOURCE_PER_MINUTE);
      refill(global, time, INSTANCE_BURST, INSTANCE_PER_MINUTE);
      bucket.lastSeen = time;
      if (bucket.tokens < 1 || global.tokens < 1) {
        return Math.max(retry(bucket.tokens, SOURCE_PER_MINUTE), retry(global.tokens, INSTANCE_PER_MINUTE));
      }
      bucket.tokens--;
      global.tokens--;
      return undefined;
    },
  };
}

const state = globalThis as typeof globalThis & { artduoMetricsLimiter?: ReturnType<typeof createExperienceMetricsLimiter>; artduoMetricsSalt?: Buffer };

export function metricsSource(headers: Pick<Headers, "get">, environment: Record<string, string | undefined> = process.env): string {
  // The existing public runtime requires the reverse proxy to replace this header.
  if (environment.ARTDUO_PUBLIC_MODE !== "1" || environment.ARTDUO_TRUSTED_PROXY_HEADER !== "x-real-ip"
    || (environment.ARTDUO_REQUEST_SALT?.length ?? 0) < 32) return "shared";
  const address = headers.get("x-real-ip")?.trim();
  if (!address || !isIP(address)) return "shared";
  const salt = state.artduoMetricsSalt ??= randomBytes(32);
  return createHmac("sha256", salt).update(address).digest("hex");
}

export function limitExperienceMetrics(headers: Pick<Headers, "get">): number | undefined {
  const limiter = state.artduoMetricsLimiter ??= createExperienceMetricsLimiter();
  return limiter.take(metricsSource(headers));
}
