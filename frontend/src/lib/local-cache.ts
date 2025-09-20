/**
 * 本地缓存系统 - 使用IndexedDB存储搜索结果和LLM响应
 * 支持离线使用和性能优化
 */

export interface CacheItem<T = any> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
  version: string;
}

export interface ArtworkCache {
  emotion: string;
  userInput?: string;
  artworks: any[];
  analysis: any;
  curation: any;
  timestamp: number;
}

export interface LLMCache {
  prompt: string;
  response: any;
  timestamp: number;
}

export class LocalCache {
  private dbName = 'ArtDuoCache';
  private version = 1;
  private db: IDBDatabase | null = null;
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24小时过期

  // 初始化数据库
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('IndexedDB初始化失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB初始化成功');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 创建对象存储
        if (!db.objectStoreNames.contains('artworks')) {
          const artworkStore = db.createObjectStore('artworks', { keyPath: 'key' });
          artworkStore.createIndex('emotion', 'emotion', { unique: false });
          artworkStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('llm_responses')) {
          const llmStore = db.createObjectStore('llm_responses', { keyPath: 'key' });
          llmStore.createIndex('prompt', 'prompt', { unique: false });
          llmStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('mcp_results')) {
          const mcpStore = db.createObjectStore('mcp_results', { keyPath: 'key' });
          mcpStore.createIndex('query', 'query', { unique: false });
          mcpStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        console.log('✅ IndexedDB对象存储创建成功');
      };
    });
  }

  // 确保数据库已初始化
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('数据库初始化失败');
    }
    return this.db;
  }

  // 生成缓存键
  private generateKey(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.join(':')}`;
  }

  // 存储艺术作品缓存
  async cacheArtworks(
    emotion: string, 
    userInput: string | undefined, 
    artworks: any[], 
    analysis: any, 
    curation: any
  ): Promise<void> {
    try {
      const db = await this.ensureDB();
      const key = this.generateKey('artworks', emotion, userInput || '');
      
      const cacheItem: CacheItem<ArtworkCache> = {
        key,
        data: {
          emotion,
          userInput,
          artworks,
          analysis,
          curation,
          timestamp: Date.now()
        },
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CACHE_EXPIRY,
        version: this.version.toString()
      };

      const transaction = db.transaction(['artworks'], 'readwrite');
      const store = transaction.objectStore('artworks');
      await this.promisifyRequest(store.put(cacheItem));
      
      console.log('💾 艺术作品缓存已保存:', key);
    } catch (error) {
      console.error('保存艺术作品缓存失败:', error);
    }
  }

  // 获取艺术作品缓存
  async getCachedArtworks(emotion: string, userInput?: string): Promise<ArtworkCache | null> {
    try {
      const db = await this.ensureDB();
      const key = this.generateKey('artworks', emotion, userInput || '');
      
      const transaction = db.transaction(['artworks'], 'readonly');
      const store = transaction.objectStore('artworks');
      const result = await this.promisifyRequest<CacheItem<ArtworkCache>>(store.get(key));
      
      if (result && result.expiresAt > Date.now()) {
        console.log('📦 从缓存获取艺术作品:', key);
        return result.data;
      } else if (result) {
        // 缓存已过期，删除
        await this.deleteCache('artworks', key);
      }
      
      return null;
    } catch (error) {
      console.error('获取艺术作品缓存失败:', error);
      return null;
    }
  }

  // 存储LLM响应缓存
  async cacheLLMResponse(prompt: string, response: any): Promise<void> {
    try {
      const db = await this.ensureDB();
      const key = this.generateKey('llm', this.hashString(prompt));
      
      const cacheItem: CacheItem<LLMCache> = {
        key,
        data: {
          prompt,
          response,
          timestamp: Date.now()
        },
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CACHE_EXPIRY,
        version: this.version.toString()
      };

      const transaction = db.transaction(['llm_responses'], 'readwrite');
      const store = transaction.objectStore('llm_responses');
      await this.promisifyRequest(store.put(cacheItem));
      
      console.log('💾 LLM响应缓存已保存:', key);
    } catch (error) {
      console.error('保存LLM响应缓存失败:', error);
    }
  }

  // 获取LLM响应缓存
  async getCachedLLMResponse(prompt: string): Promise<any | null> {
    try {
      const db = await this.ensureDB();
      const key = this.generateKey('llm', this.hashString(prompt));
      
      const transaction = db.transaction(['llm_responses'], 'readonly');
      const store = transaction.objectStore('llm_responses');
      const result = await this.promisifyRequest<CacheItem<LLMCache>>(store.get(key));
      
      if (result && result.expiresAt > Date.now()) {
        console.log('📦 从缓存获取LLM响应:', key);
        return result.data.response;
      } else if (result) {
        // 缓存已过期，删除
        await this.deleteCache('llm_responses', key);
      }
      
      return null;
    } catch (error) {
      console.error('获取LLM响应缓存失败:', error);
      return null;
    }
  }

  // 存储MCP搜索结果缓存
  async cacheMCPResults(query: string, results: any): Promise<void> {
    try {
      const db = await this.ensureDB();
      const key = this.generateKey('mcp', this.hashString(query));
      
      const cacheItem: CacheItem = {
        key,
        data: {
          query,
          results,
          timestamp: Date.now()
        },
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CACHE_EXPIRY,
        version: this.version.toString()
      };

      const transaction = db.transaction(['mcp_results'], 'readwrite');
      const store = transaction.objectStore('mcp_results');
      await this.promisifyRequest(store.put(cacheItem));
      
      console.log('💾 MCP结果缓存已保存:', key);
    } catch (error) {
      console.error('保存MCP结果缓存失败:', error);
    }
  }

  // 获取MCP搜索结果缓存
  async getCachedMCPResults(query: string): Promise<any | null> {
    try {
      const db = await this.ensureDB();
      const key = this.generateKey('mcp', this.hashString(query));
      
      const transaction = db.transaction(['mcp_results'], 'readonly');
      const store = transaction.objectStore('mcp_results');
      const result = await this.promisifyRequest<CacheItem>(store.get(key));
      
      if (result && result.expiresAt > Date.now()) {
        console.log('📦 从缓存获取MCP结果:', key);
        return result.data.results;
      } else if (result) {
        // 缓存已过期，删除
        await this.deleteCache('mcp_results', key);
      }
      
      return null;
    } catch (error) {
      console.error('获取MCP结果缓存失败:', error);
      return null;
    }
  }

  // 删除缓存
  private async deleteCache(storeName: string, key: string): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      await this.promisifyRequest(store.delete(key));
    } catch (error) {
      console.error('删除缓存失败:', error);
    }
  }

  // 清理过期缓存
  async cleanExpiredCache(): Promise<void> {
    try {
      const db = await this.ensureDB();
      const storeNames = ['artworks', 'llm_responses', 'mcp_results'];
      
      for (const storeName of storeNames) {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const index = store.index('timestamp');
        
        const range = IDBKeyRange.upperBound(Date.now() - this.CACHE_EXPIRY);
        const request = index.openCursor(range);
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
      }
      
      console.log('🧹 过期缓存清理完成');
    } catch (error) {
      console.error('清理过期缓存失败:', error);
    }
  }

  // 获取缓存统计信息
  async getCacheStats(): Promise<{
    totalItems: number;
    totalSize: number;
    storeStats: Record<string, { count: number; size: number }>;
  }> {
    try {
      const db = await this.ensureDB();
      const storeNames = ['artworks', 'llm_responses', 'mcp_results'];
      const storeStats: Record<string, { count: number; size: number }> = {};
      let totalItems = 0;
      let totalSize = 0;

      for (const storeName of storeNames) {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const count = await this.promisifyRequest<number>(store.count());
        
        // 估算大小（简单计算）
        const size = count * 1024; // 假设每个项目1KB
        
        storeStats[storeName] = { count, size };
        totalItems += count;
        totalSize += size;
      }

      return { totalItems, totalSize, storeStats };
    } catch (error) {
      console.error('获取缓存统计失败:', error);
      return { totalItems: 0, totalSize: 0, storeStats: {} };
    }
  }

  // 清空所有缓存
  async clearAllCache(): Promise<void> {
    try {
      const db = await this.ensureDB();
      const storeNames = ['artworks', 'llm_responses', 'mcp_results'];
      
      for (const storeName of storeNames) {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        await this.promisifyRequest(store.clear());
      }
      
      console.log('🗑️ 所有缓存已清空');
    } catch (error) {
      console.error('清空缓存失败:', error);
    }
  }

  // 工具方法：将IDBRequest转换为Promise
  private promisifyRequest<T = any>(request: IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // 工具方法：字符串哈希
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }
}

// 导出单例实例
export const localCache = new LocalCache();
