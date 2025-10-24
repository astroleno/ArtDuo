// 作品缓存系统 - 用于优化API调用性能
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // 过期时间（毫秒）
}

export interface CacheStats {
  hits: number;
  misses: number;
  expired: number;
  size: number;
}

export class ArtworkCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stats: CacheStats = { hits: 0, misses: 0, expired: 0, size: 0 };
  private cleanupInterval: NodeJS.Timeout | null = null;

  // 缓存TTL配置
  private readonly TTL_CONFIG = {
    met_search: 60 * 60 * 1000,      // 1小时 - Met搜索结果
    met_artwork: 24 * 60 * 60 * 1000, // 24小时 - Met作品详情
    rijks_search: 30 * 60 * 1000,    // 30分钟 - Rijks搜索结果
    rijks_artwork: 12 * 60 * 60 * 1000, // 12小时 - Rijks作品详情
    llm_response: 7 * 24 * 60 * 60 * 1000, // 7天 - LLM响应
    keyword_generation: 24 * 60 * 60 * 1000 // 24小时 - 关键词生成
  };

  constructor() {
    // 启动定期清理任务
    this.startCleanup();
  }

  /**
   * 生成缓存键
   */
  private generateKey(prefix: string, params: any): string {
    const paramString = JSON.stringify(params);
    return `${prefix}:${Buffer.from(paramString).toString('base64')}`;
  }

  /**
   * 检查缓存条目是否过期
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        this.stats.expired++;
        this.stats.size--;
      }
    }
  }

  /**
   * 启动定期清理
   */
  private startCleanup(): void {
    // 每5分钟清理一次过期缓存
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * 获取缓存数据
   */
  get<T>(prefix: string, params: any): T | null {
    const key = this.generateKey(prefix, params);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.expired++;
      this.stats.size--;
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * 设置缓存数据
   */
  set<T>(prefix: string, params: any, data: T, ttl?: number): void {
    const key = this.generateKey(prefix, params);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.getDefaultTTL(prefix)
    };

    // 如果键已存在，先删除
    if (this.cache.has(key)) {
      this.stats.size--;
    }

    this.cache.set(key, entry);
    this.stats.size++;
  }

  /**
   * 获取默认TTL
   */
  private getDefaultTTL(prefix: string): number {
    switch (prefix) {
      case 'met_search': return this.TTL_CONFIG.met_search;
      case 'met_artwork': return this.TTL_CONFIG.met_artwork;
      case 'rijks_search': return this.TTL_CONFIG.rijks_search;
      case 'rijks_artwork': return this.TTL_CONFIG.rijks_artwork;
      case 'llm_response': return this.TTL_CONFIG.llm_response;
      case 'keyword_generation': return this.TTL_CONFIG.keyword_generation;
      default: return 60 * 60 * 1000; // 默认1小时
    }
  }

  /**
   * Met Museum API 缓存方法
   */
  getMetSearchResult(query: string) {
    return this.get('met_search', { query });
  }

  cacheMetSearchResult(query: string, data: any) {
    this.set('met_search', { query }, data, this.TTL_CONFIG.met_search);
  }

  getMetArtworkDetail(objectId: string) {
    return this.get('met_artwork', { objectId });
  }

  cacheMetArtworkDetail(objectId: string, data: any) {
    this.set('met_artwork', { objectId }, data, this.TTL_CONFIG.met_artwork);
  }

  /**
   * Rijks Museum API 缓存方法
   */
  getRijksSearchResult(query: string) {
    return this.get('rijks_search', { query });
  }

  cacheRijksSearchResult(query: string, data: any) {
    this.set('rijks_search', { query }, data, this.TTL_CONFIG.rijks_search);
  }

  getRijksArtworkDetail(objectId: string) {
    return this.get('rijks_artwork', { objectId });
  }

  cacheRijksArtworkDetail(objectId: string, data: any) {
    this.set('rijks_artwork', { objectId }, data, this.TTL_CONFIG.rijks_artwork);
  }

  /**
   * LLM 响应缓存方法
   */
  getLLMResponse(prompt: string, model: string = 'glm-4.5-air') {
    return this.get('llm_response', { prompt, model });
  }

  cacheLLMResponse(prompt: string, data: any, model: string = 'glm-4.5-air') {
    this.set('llm_response', { prompt, model }, data, this.TTL_CONFIG.llm_response);
  }

  /**
   * 关键词生成缓存
   */
  getKeywordGeneration(emotion: string, userInput?: string) {
    return this.get('keyword_generation', { emotion, userInput });
  }

  cacheKeywordGeneration(emotion: string, data: any, userInput?: string) {
    this.set('keyword_generation', { emotion, userInput }, data, this.TTL_CONFIG.keyword_generation);
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 计算缓存命中率
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, expired: 0, size: 0 };
  }

  /**
   * 销毁缓存实例
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// 创建全局缓存实例
export const artworkCache = new ArtworkCache();

// 默认导出
export default ArtworkCache;