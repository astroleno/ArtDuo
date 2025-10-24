/**
 * 混合检索服务
 * 实现三层检索架构：向量粗召回 → 元数据精筛 → LLM精排
 */

import { HierarchicalNSW } from 'hnswlib-node';

// 配置
const CONFIG = {
  vectorSize: 384,
  maxResults: 100,
  topCandidates: 30,
  finalResults: 9
};

/**
 * 数据质量权重配置
 */
const QUALITY_WEIGHTS = {
  excellent: 1.0,
  good: 0.9,
  basic: 0.7,
  minimal: 0.5
};

/**
 * 情绪分类映射
 */
const EMOTION_KEYWORDS = {
  joy: ['joy', 'happiness', 'celebration', 'delight', 'glee', 'jubilation'],
  sadness: ['sadness', 'melancholy', 'grief', 'sorrow', 'despair', 'mourning'],
  love: ['love', 'romance', 'passion', 'affection', 'tenderness', 'devotion'],
  fear: ['fear', 'anxiety', 'terror', 'dread', 'panic', 'horror'],
  anger: ['anger', 'rage', 'fury', 'wrath', 'ire', 'indignation'],
  surprise: ['surprise', 'amazement', 'wonder', 'astonishment', 'shock'],
  disgust: ['disgust', 'revulsion', 'repulsion', 'aversion', 'loathing'],
  contemplation: ['contemplation', 'meditation', 'reflection', 'thought', 'pondering'],
  awe: ['awe', 'reverence', 'wonder', 'amazement', 'admiration'],
  peace: ['peace', 'serenity', 'tranquility', 'calm', 'stillness']
};

/**
 * 混合检索服务类
 */
export class HybridSearchService {
  private fullIndex: HierarchicalNSW | null = null;
  private emotionIndexes: Map<string, HierarchicalNSW> = new Map();
  private embeddings: any[] = [];
  private isInitialized = false;

  /**
   * 初始化检索服务
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('🔧 初始化混合检索服务...');
      
      // 加载向量数据
      await this.loadEmbeddings();
      
      // 加载全量索引
      await this.loadFullIndex();
      
      // 加载情绪分类索引
      await this.loadEmotionIndexes();
      
      this.isInitialized = true;
      console.log('✅ 混合检索服务初始化完成');
      
    } catch (error) {
      console.error('❌ 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 加载向量数据
   */
  private async loadEmbeddings() {
    // 这里应该从实际的数据源加载
    // 暂时使用模拟数据
    this.embeddings = [];
    console.log('📊 向量数据加载完成');
  }

  /**
   * 加载全量索引
   */
  private async loadFullIndex() {
    try {
      this.fullIndex = new HierarchicalNSW('cosine', CONFIG.vectorSize);
      // 这里应该从实际文件加载索引
      // this.fullIndex.readIndexSync('path/to/full.hnsw');
      console.log('📚 全量索引加载完成');
    } catch (error) {
      console.warn('⚠️ 全量索引加载失败，将使用降级方案');
    }
  }

  /**
   * 加载情绪分类索引
   */
  private async loadEmotionIndexes() {
    for (const emotion of Object.keys(EMOTION_KEYWORDS)) {
      try {
        const emotionIndex = new HierarchicalNSW('cosine', CONFIG.vectorSize);
        // 这里应该从实际文件加载情绪索引
        // emotionIndex.readIndexSync(`path/to/${emotion}.hnsw`);
        this.emotionIndexes.set(emotion, emotionIndex);
        console.log(`🎭 ${emotion} 情绪索引加载完成`);
      } catch (error) {
        console.warn(`⚠️ ${emotion} 情绪索引加载失败`);
      }
    }
  }

  /**
   * 第一层：向量粗召回
   */
  private async vectorRoughRecall(query: string, emotion?: string): Promise<any[]> {
    console.log(`🔍 第一层：向量粗召回 - "${query}"`);
    
    try {
      // 生成查询向量
      const queryVector = this.generateQueryVector(query);
      
      let results: any[] = [];
      
      // 优先使用情绪分类索引
      if (emotion && this.emotionIndexes.has(emotion)) {
        const emotionIndex = this.emotionIndexes.get(emotion)!;
        const { neighbors, distances } = emotionIndex.searchKnn(queryVector, CONFIG.maxResults);
        
        results = neighbors.map((neighbor, index) => ({
          id: `emotion-${neighbor}`,
          similarity: 1 - distances[index],
          source: 'emotion-index',
          emotion
        }));
        
        console.log(`✅ 情绪索引检索完成: ${results.length} 个结果`);
      }
      
      // 如果情绪索引结果不足，使用全量索引
      if (results.length < CONFIG.maxResults && this.fullIndex) {
        const { neighbors, distances } = this.fullIndex.searchKnn(queryVector, CONFIG.maxResults);
        
        const fullResults = neighbors.map((neighbor, index) => ({
          id: `full-${neighbor}`,
          similarity: 1 - distances[index],
          source: 'full-index'
        }));
        
        // 合并结果，去重
        const existingIds = new Set(results.map(r => r.id));
        const newResults = fullResults.filter(r => !existingIds.has(r.id));
        results = [...results, ...newResults];
        
        console.log(`✅ 全量索引检索完成: ${newResults.length} 个新结果`);
      }
      
      // 按相似度排序，取前100个
      results.sort((a, b) => b.similarity - a.similarity);
      return results.slice(0, CONFIG.maxResults);
      
    } catch (error) {
      console.error('❌ 向量粗召回失败:', error);
      return [];
    }
  }

  /**
   * 第二层：元数据精筛
   */
  private async metadataFiltering(candidates: any[], filters: any = {}): Promise<any[]> {
    console.log(`🔍 第二层：元数据精筛 - ${candidates.length} 个候选`);
    
    try {
      let filtered = [...candidates];
      
      // 数据质量过滤
      if (filters.qualityLevel) {
        filtered = filtered.filter(candidate => {
          const artwork = this.embeddings.find(e => e.id === candidate.id);
          return artwork && artwork.qualityLevel === filters.qualityLevel;
        });
      }
      
      // 艺术类型过滤 (优先painting)
      if (filters.preferPainting) {
        filtered = filtered.filter(candidate => {
          const artwork = this.embeddings.find(e => e.id === candidate.id);
          return artwork && (
            artwork.medium?.toLowerCase().includes('painting') ||
            artwork.classification?.toLowerCase().includes('painting')
          );
        });
      }
      
      // 年代过滤
      if (filters.dateRange) {
        filtered = filtered.filter(candidate => {
          const artwork = this.embeddings.find(e => e.id === candidate.id);
          if (!artwork || !artwork.dateBegin) return true;
          
          const year = parseInt(artwork.dateBegin);
          return year >= filters.dateRange.min && year <= filters.dateRange.max;
        });
      }
      
      // 文化过滤
      if (filters.culture) {
        filtered = filtered.filter(candidate => {
          const artwork = this.embeddings.find(e => e.id === candidate.id);
          return artwork && artwork.culture?.toLowerCase().includes(filters.culture.toLowerCase());
        });
      }
      
      // 数据质量权重调整
      filtered = filtered.map(candidate => {
        const artwork = this.embeddings.find(e => e.id === candidate.id);
        const qualityWeight = artwork ? QUALITY_WEIGHTS[artwork.qualityLevel as keyof typeof QUALITY_WEIGHTS] || 0.5 : 0.5;
        
        return {
          ...candidate,
          weightedSimilarity: candidate.similarity * qualityWeight,
          qualityLevel: artwork?.qualityLevel || 'unknown'
        };
      });
      
      // 按加权相似度排序
      filtered.sort((a, b) => b.weightedSimilarity - a.weightedSimilarity);
      
      console.log(`✅ 元数据精筛完成: ${filtered.length} 个结果`);
      return filtered.slice(0, CONFIG.topCandidates);
      
    } catch (error) {
      console.error('❌ 元数据精筛失败:', error);
      return candidates.slice(0, CONFIG.topCandidates);
    }
  }

  /**
   * 第三层：LLM精排 (模拟)
   */
  private async llmRanking(candidates: any[], query: string): Promise<any[]> {
    console.log(`🔍 第三层：LLM精排 - ${candidates.length} 个候选`);
    
    try {
      // 这里应该调用实际的LLM API进行评分
      // 暂时使用模拟评分
      const rankedCandidates = candidates.map(candidate => ({
        ...candidate,
        llmScore: Math.random() * 10, // 模拟LLM评分
        finalScore: candidate.weightedSimilarity * 0.7 + Math.random() * 0.3
      }));
      
      // 按最终评分排序
      rankedCandidates.sort((a, b) => b.finalScore - a.finalScore);
      
      console.log(`✅ LLM精排完成: ${rankedCandidates.length} 个结果`);
      return rankedCandidates.slice(0, CONFIG.finalResults);
      
    } catch (error) {
      console.error('❌ LLM精排失败:', error);
      return candidates.slice(0, CONFIG.finalResults);
    }
  }

  /**
   * 生成查询向量
   */
  private generateQueryVector(query: string): number[] {
    // 简化的查询向量生成
    // 实际应该使用与训练时相同的向量化器
    const vector = new Array(CONFIG.vectorSize).fill(0);
    const words = query.toLowerCase().split(' ');
    
    words.forEach((word, i) => {
      const index = (word.charCodeAt(0) + i) % CONFIG.vectorSize;
      vector[index] = 1.0;
    });
    
    return vector;
  }

  /**
   * 检测情绪
   */
  private detectEmotion(query: string): string | null {
    const queryLower = query.toLowerCase();
    
    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
      if (keywords.some(keyword => queryLower.includes(keyword))) {
        return emotion;
      }
    }
    
    return null;
  }

  /**
   * 执行混合检索
   */
  async search(query: string, filters: any = {}): Promise<any[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    console.log(`🚀 开始混合检索: "${query}"`);
    const startTime = Date.now();
    
    try {
      // 检测情绪
      const emotion = this.detectEmotion(query);
      if (emotion) {
        console.log(`🎭 检测到情绪: ${emotion}`);
      }
      
      // 第一层：向量粗召回
      const candidates = await this.vectorRoughRecall(query, emotion);
      
      // 第二层：元数据精筛
      const filtered = await this.metadataFiltering(candidates, filters);
      
      // 第三层：LLM精排
      const results = await this.llmRanking(filtered, query);
      
      const endTime = Date.now();
      console.log(`✅ 混合检索完成: ${results.length} 个结果，耗时 ${endTime - startTime}ms`);
      
      return results;
      
    } catch (error) {
      console.error('❌ 混合检索失败:', error);
      return [];
    }
  }

  /**
   * 获取检索统计信息
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      embeddingsCount: this.embeddings.length,
      emotionIndexesCount: this.emotionIndexes.size,
      hasFullIndex: !!this.fullIndex
    };
  }
}

// 导出单例实例
export const hybridSearchService = new HybridSearchService();
