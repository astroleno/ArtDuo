export interface BrowserCacheStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
}

class InMemoryBrowserCache implements BrowserCacheStore {
  private readonly values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
  }
}

export function createInMemoryBrowserCache(): BrowserCacheStore {
  return new InMemoryBrowserCache();
}
