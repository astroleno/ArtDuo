// 艺术作品缓存系统
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class ArtworkCache {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

  private generateKey(prefix: string, ...params: string[]): string {
    return `${prefix}:${params.join(':')}`;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  set(key: string, data: any, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry || this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  // Met Museum API 缓存
  cacheMetSearchResult(query: string, result: any): void {
    const key = this.generateKey('met_search', query);
    this.set(key, result, 30 * 60 * 1000); // 30 minutes for search results
  }

  getMetSearchResult(query: string): any | null {
    const key = this.generateKey('met_search', query);
    return this.get(key);
  }

  cacheMetArtworkDetail(objectId: string, detail: any): void {
    const key = this.generateKey('met_detail', objectId);
    this.set(key, detail, 24 * 60 * 60 * 1000); // 24 hours for artwork details
  }

  getMetArtworkDetail(objectId: string): any | null {
    const key = this.generateKey('met_detail', objectId);
    return this.get(key);
  }

  // Rijks Museum API 缓存
  cacheRijksSearchResult(query: string, result: any): void {
    const key = this.generateKey('rijks_search', query);
    this.set(key, result, 30 * 60 * 1000); // 30 minutes for search results
  }

  getRijksSearchResult(query: string): any | null {
    const key = this.generateKey('rijks_search', query);
    return this.get(key);
  }

  cacheRijksArtworkDetail(objectNumber: string, detail: any): void {
    const key = this.generateKey('rijks_detail', objectNumber);
    this.set(key, detail, 24 * 60 * 60 * 1000); // 24 hours for artwork details
  }

  getRijksArtworkDetail(objectNumber: string): any | null {
    const key = this.generateKey('rijks_detail', objectNumber);
    return this.get(key);
  }

  // GLM API 缓存
  cacheGLMResponse(prompt: string, response: any): void {
    const key = this.generateKey('glm_response', this.hashPrompt(prompt));
    this.set(key, response, 60 * 60 * 1000); // 1 hour for GLM responses
  }

  getGLMResponse(prompt: string): any | null {
    const key = this.generateKey('glm_response', this.hashPrompt(prompt));
    return this.get(key);
  }

  private hashPrompt(prompt: string): string {
    // Simple hash function for prompts
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  // Clear expired entries
  cleanup(): void {
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache statistics
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const artworkCache = new ArtworkCache();

// Cleanup cache every hour
setInterval(() => {
  artworkCache.cleanup();
}, 60 * 60 * 1000);