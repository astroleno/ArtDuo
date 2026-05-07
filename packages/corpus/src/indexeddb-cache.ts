export interface BrowserCacheStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
}

interface IndexedDbRequest<T = unknown> {
  result?: T;
  error?: unknown;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}

interface IndexedDbOpenRequest extends IndexedDbRequest<IndexedDbDatabase> {
  onupgradeneeded: (() => void) | null;
}

interface IndexedDbObjectStore {
  get(key: string): IndexedDbRequest;
  put(value: unknown, key: string): IndexedDbRequest;
}

interface IndexedDbTransaction {
  objectStore(name: string): IndexedDbObjectStore;
}

interface IndexedDbDatabase {
  objectStoreNames: {
    contains(name: string): boolean;
  };
  createObjectStore(name: string): unknown;
  transaction(name: string, mode: "readonly" | "readwrite"): IndexedDbTransaction;
}

export interface IndexedDbFactory {
  open(name: string, version: number): IndexedDbOpenRequest;
}

export interface IndexedDbBrowserCacheOptions {
  indexedDB?: IndexedDbFactory;
  dbName?: string;
  storeName?: string;
  version?: number;
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

function getGlobalIndexedDb(): IndexedDbFactory | undefined {
  const value = (globalThis as { indexedDB?: IndexedDbFactory }).indexedDB;
  return value;
}

function requestToPromise<T>(request: IndexedDbRequest<T>): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error instanceof Error ? request.error : new Error("IndexedDB request failed"));
  });
}

function openDatabase(input: {
  indexedDB: IndexedDbFactory;
  dbName: string;
  storeName: string;
  version: number;
}): Promise<IndexedDbDatabase> {
  return new Promise((resolve, reject) => {
    const request = input.indexedDB.open(input.dbName, input.version);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (database && !database.objectStoreNames.contains(input.storeName)) {
        database.createObjectStore(input.storeName);
      }
    };
    request.onsuccess = () => {
      if (!request.result) {
        reject(new Error("IndexedDB open succeeded without a database result"));
        return;
      }

      resolve(request.result);
    };
    request.onerror = () => reject(request.error instanceof Error ? request.error : new Error("IndexedDB open failed"));
  });
}

class IndexedDbBrowserCache implements BrowserCacheStore {
  private readonly indexedDB: IndexedDbFactory;
  private readonly dbName: string;
  private readonly storeName: string;
  private readonly version: number;
  private databasePromise: Promise<IndexedDbDatabase> | undefined;

  constructor(options: Required<IndexedDbBrowserCacheOptions>) {
    this.indexedDB = options.indexedDB;
    this.dbName = options.dbName;
    this.storeName = options.storeName;
    this.version = options.version;
  }

  private database() {
    this.databasePromise ??= openDatabase({
      indexedDB: this.indexedDB,
      dbName: this.dbName,
      storeName: this.storeName,
      version: this.version,
    });

    return this.databasePromise;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const database = await this.database();
    const store = database.transaction(this.storeName, "readonly").objectStore(this.storeName);

    return requestToPromise<T>(store.get(key) as IndexedDbRequest<T>);
  }

  async set<T>(key: string, value: T): Promise<void> {
    const database = await this.database();
    const store = database.transaction(this.storeName, "readwrite").objectStore(this.storeName);

    await requestToPromise(store.put(value, key));
  }
}

export function createIndexedDbBrowserCache(options: IndexedDbBrowserCacheOptions = {}): BrowserCacheStore {
  const indexedDB = options.indexedDB ?? getGlobalIndexedDb();

  if (!indexedDB) {
    throw new Error("IndexedDB is not available in this runtime");
  }

  return new IndexedDbBrowserCache({
    indexedDB,
    dbName: options.dbName ?? "artduo-release-cache",
    storeName: options.storeName ?? "release-shards",
    version: options.version ?? 1,
  });
}
