/**
 * 向量索引管理服务
 * 负责加载和管理HNSW索引
 */

import { HierarchicalNSW } from 'hnswlib-node';
import fs from 'fs';
import path from 'path';

// 配置
const CONFIG = {
  vectorSize: 384,
  indexesDir: 'data/met/indexes',
  embeddingsDir: 'data/met/embeddings',
  fullIndexFile: 'full.hnsw',
  emotionIndexDir: 'by-emotion',
  embeddingsFile: 'artworks-embeddings.json'
};

/**
 * 向量索引管理类
 */
export class VectorIndexManager {
  private fullIndex: HierarchicalNSW | null = null;
  private emotionIndexes: Map<string, HierarchicalNSW> = new Map();
  private embeddings: any[] = [];
  private isLoaded = false;

  /**
   * 加载所有索引
   */
  async loadAllIndexes(): Promise<void> {
    if (this.isLoaded) return;

    try {
      console.log('🔧 开始加载向量索引...');
      
      // 加载向量数据
      await this.loadEmbeddings();
      
      // 加载全量索引
      await this.loadFullIndex();
      
      // 加载情绪分类索引
      await this.loadEmotionIndexes();
      
      this.isLoaded = true;
      console.log('✅ 所有索引加载完成');
      
    } catch (error) {
      console.error('❌ 索引加载失败:', error);
      throw error;
    }
  }

  /**
   * 加载向量数据
   */
  private async loadEmbeddings(): Promise<void> {
    try {
      const embeddingsPath = path.join(process.cwd(), CONFIG.embeddingsDir, CONFIG.embeddingsFile);
      
      if (!fs.existsSync(embeddingsPath)) {
        throw new Error(`向量数据文件不存在: ${embeddingsPath}`);
      }
      
      const data = JSON.parse(fs.readFileSync(embeddingsPath, 'utf8'));
      this.embeddings = data;
      
      console.log(`📊 向量数据加载完成: ${this.embeddings.length} 个向量`);
      
    } catch (error) {
      console.error('❌ 向量数据加载失败:', error);
      throw error;
    }
  }

  /**
   * 加载全量索引
   */
  private async loadFullIndex(): Promise<void> {
    try {
      const indexPath = path.join(process.cwd(), CONFIG.indexesDir, CONFIG.fullIndexFile);
      
      if (!fs.existsSync(indexPath)) {
        console.warn('⚠️ 全量索引文件不存在，跳过加载');
        return;
      }
      
      this.fullIndex = new HierarchicalNSW('cosine', CONFIG.vectorSize);
      this.fullIndex.readIndexSync(indexPath);
      
      console.log('📚 全量索引加载完成');
      
    } catch (error) {
      console.error('❌ 全量索引加载失败:', error);
      this.fullIndex = null;
    }
  }

  /**
   * 加载情绪分类索引
   */
  private async loadEmotionIndexes(): Promise<void> {
    const emotionIndexDir = path.join(process.cwd(), CONFIG.indexesDir, CONFIG.emotionIndexDir);
    
    if (!fs.existsSync(emotionIndexDir)) {
      console.warn('⚠️ 情绪索引目录不存在，跳过加载');
      return;
    }
    
    const emotions = ['joy', 'sadness', 'love', 'fear', 'anger', 'surprise', 'disgust', 'contemplation', 'awe', 'peace'];
    
    for (const emotion of emotions) {
      try {
        const emotionIndexPath = path.join(emotionIndexDir, `${emotion}.hnsw`);
        
        if (!fs.existsSync(emotionIndexPath)) {
          console.warn(`⚠️ ${emotion} 情绪索引文件不存在，跳过`);
          continue;
        }
        
        const emotionIndex = new HierarchicalNSW('cosine', CONFIG.vectorSize);
        emotionIndex.readIndexSync(emotionIndexPath);
        
        this.emotionIndexes.set(emotion, emotionIndex);
        console.log(`🎭 ${emotion} 情绪索引加载完成`);
        
      } catch (error) {
        console.error(`❌ ${emotion} 情绪索引加载失败:`, error);
      }
    }
    
    console.log(`✅ 情绪分类索引加载完成: ${this.emotionIndexes.size} 个索引`);
  }

  /**
   * 获取全量索引
   */
  getFullIndex(): HierarchicalNSW | null {
    return this.fullIndex;
  }

  /**
   * 获取情绪索引
   */
  getEmotionIndex(emotion: string): HierarchicalNSW | null {
    return this.emotionIndexes.get(emotion) || null;
  }

  /**
   * 获取所有情绪索引
   */
  getAllEmotionIndexes(): Map<string, HierarchicalNSW> {
    return this.emotionIndexes;
  }

  /**
   * 获取向量数据
   */
  getEmbeddings(): any[] {
    return this.embeddings;
  }

  /**
   * 根据ID获取作品信息
   */
  getArtworkById(id: string): any | null {
    return this.embeddings.find(artwork => artwork.id === id) || null;
  }

  /**
   * 根据索引获取作品信息
   */
  getArtworkByIndex(index: number): any | null {
    return this.embeddings[index] || null;
  }

  /**
   * 搜索全量索引
   */
  searchFullIndex(queryVector: number[], k: number = 10): { neighbors: number[], distances: number[] } {
    if (!this.fullIndex) {
      throw new Error('全量索引未加载');
    }
    
    return this.fullIndex.searchKnn(queryVector, k);
  }

  /**
   * 搜索情绪索引
   */
  searchEmotionIndex(emotion: string, queryVector: number[], k: number = 10): { neighbors: number[], distances: number[] } {
    const emotionIndex = this.getEmotionIndex(emotion);
    if (!emotionIndex) {
      throw new Error(`${emotion} 情绪索引未加载`);
    }
    
    return emotionIndex.searchKnn(queryVector, k);
  }

  /**
   * 获取索引统计信息
   */
  getStats() {
    return {
      isLoaded: this.isLoaded,
      embeddingsCount: this.embeddings.length,
      hasFullIndex: !!this.fullIndex,
      emotionIndexesCount: this.emotionIndexes.size,
      availableEmotions: Array.from(this.emotionIndexes.keys())
    };
  }

  /**
   * 检查索引健康状态
   */
  async healthCheck(): Promise<{ status: string, details: any }> {
    try {
      const stats = this.getStats();
      
      if (!stats.isLoaded) {
        return { status: 'not_loaded', details: stats };
      }
      
      if (!stats.hasFullIndex && stats.emotionIndexesCount === 0) {
        return { status: 'no_indexes', details: stats };
      }
      
      if (stats.embeddingsCount === 0) {
        return { status: 'no_embeddings', details: stats };
      }
      
      return { status: 'healthy', details: stats };
      
    } catch (error) {
      return { status: 'error', details: { error: error.message } };
    }
  }

  /**
   * 重新加载索引
   */
  async reload(): Promise<void> {
    console.log('🔄 重新加载索引...');
    
    this.fullIndex = null;
    this.emotionIndexes.clear();
    this.embeddings = [];
    this.isLoaded = false;
    
    await this.loadAllIndexes();
  }
}

// 导出单例实例
export const vectorIndexManager = new VectorIndexManager();
