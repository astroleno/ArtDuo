export class InMemoryIdempotencyStore<T> {
  private readonly store = new Map<string, T>();

  private assertKey(key: string): string {
    const normalized = key.trim();
    if (!normalized) {
      throw new TypeError("Idempotency key is required");
    }

    return normalized;
  }

  get(key: string): T | undefined {
    return this.store.get(this.assertKey(key));
  }

  set(key: string, value: T): T {
    this.store.set(this.assertKey(key), value);
    return value;
  }

  getOrSet(key: string, build: () => T): T {
    const normalized = this.assertKey(key);
    const existing = this.store.get(normalized);
    if (existing !== undefined) {
      return existing;
    }

    const value = build();
    this.store.set(normalized, value);
    return value;
  }

  clear(): void {
    this.store.clear();
  }
}
