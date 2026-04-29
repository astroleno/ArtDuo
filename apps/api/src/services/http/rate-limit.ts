export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: string;
}

export interface InMemoryRateLimitOptions {
  limit?: number;
  windowMs?: number;
}

interface Bucket {
  count: number;
  resetAtMs: number;
}

export class InMemoryRateLimit {
  private readonly buckets = new Map<string, Bucket>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(options: InMemoryRateLimitOptions = {}) {
    this.limit = options.limit ?? 2;
    this.windowMs = options.windowMs ?? 60_000;
  }

  check(key: string, now = new Date()): RateLimitResult {
    const normalized = key.trim() || "anonymous";
    const nowMs = now.getTime();
    const existing = this.buckets.get(normalized);

    if (!existing || nowMs >= existing.resetAtMs) {
      const resetAtMs = nowMs + this.windowMs;
      this.buckets.set(normalized, { count: 1, resetAtMs });
      return {
        allowed: true,
        remaining: Math.max(this.limit - 1, 0),
        resetAt: new Date(resetAtMs).toISOString(),
      };
    }

    if (existing.count >= this.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(existing.resetAtMs).toISOString(),
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: Math.max(this.limit - existing.count, 0),
      resetAt: new Date(existing.resetAtMs).toISOString(),
    };
  }

  clear(): void {
    this.buckets.clear();
  }
}
