/**
 * 纯JavaScript向量搜索实现
 * 避免native模块兼容性问题
 */

// 简单的余弦相似度计算
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 简单的欧几里得距离计算
function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  
  return Math.sqrt(sum);
}

/**
 * 艺术作品搜索结果
 */
export interface ArtworkSearchResult {
  id: string;
  title: string;
  artist: string;
  year: string;
  medium: string;
  description: string;
  imageUrl: string;
  museum: string;
  score: number;
  quality: 'excellent' | 'good' | 'basic' | 'minimal';
}

/**
 * 纯JavaScript向量搜索服务
 */
export class JSVectorSearchService {
  private artworks: ArtworkSearchResult[] = [];
  private vectors: number[][] = [];
  private isInitialized = false;

  /**
   * 初始化搜索服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🔍 初始化纯JavaScript向量搜索服务...');
    
    // 模拟加载艺术作品数据
    await this.loadArtworks();
    
    // 模拟生成向量嵌入
    await this.generateVectors();
    
    this.isInitialized = true;
    console.log(`✅ 向量搜索服务初始化完成，加载了${this.artworks.length}件作品`);
  }

  /**
   * 加载艺术作品数据 - 使用分离架构（只加载检索必要字段）
   */
  private async loadArtworks(): Promise<void> {
    try {
      console.log('📚 加载分离的艺术作品检索数据...');
      
      // 在服务器端使用文件系统读取
      const fs = await import('fs');
      const path = await import('path');
      
      // 加载检索数据（轻量级，只包含检索必要字段）
      const searchDataPath = path.join(process.cwd(), 'public', 'data', 'artworks-search.json');
      const searchFileContent = fs.readFileSync(searchDataPath, 'utf-8');
      const searchData = JSON.parse(searchFileContent);
      
      console.log(`📚 成功加载 ${searchData.length} 件检索数据`);
      
      // 转换为搜索服务需要的格式（只包含检索必要字段）
      this.artworks = searchData.map((artwork: any) => ({
        id: artwork.id,
        title: artwork.title,
        artist: artwork.artist,
        year: artwork.year,
        medium: artwork.medium,
        description: artwork.description,
        searchText: artwork.searchText,
        museum: '大都会艺术博物馆',
        score: 0,
        quality: this.mapQualityLevel(artwork.qualityLevel),
        qualityWeight: artwork.qualityWeight
        // 注意：不包含imageUrl，图片URL通过独立服务获取
      }));
      
      console.log(`✅ 检索数据转换完成，共 ${this.artworks.length} 件`);
    } catch (error) {
      console.error('❌ 加载检索数据失败:', error);
      throw new Error('无法加载艺术作品检索数据，请检查数据文件');
    }
  }

  /**
   * 生成Met图片URL - 智能尝试多种URL模式
   */
  private generateImageUrl(artworkId: string): string {
    // 从artworkId中提取数字ID
    const numericId = artworkId.replace('met-', '');
    
    // 基于作品ID的特征选择最可能的URL模式
    // 根据Met博物馆的URL规律，不同作品类型使用不同的前缀
    
    // 尝试多种URL模式，按可能性排序
    const patterns = [
      // 最常见的模式
      `https://images.metmuseum.org/CRDImages/dp/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/ep/original/DT${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/es/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/eg/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/ao/original/DP${numericId}.jpg`,
      // 其他可能的模式
      `https://images.metmuseum.org/CRDImages/aa/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/ad/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/ag/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/ah/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/ai/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/aj/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/ak/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/al/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/am/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/an/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/ap/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/aq/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/ar/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/as/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/at/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/au/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/av/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/aw/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/ax/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/ay/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/az/original/DP${numericId}.jpg`
    ];
    
    // 返回第一个模式作为默认URL
    // 前端会通过图片加载失败事件来尝试其他模式
    return patterns[0];
  }

  /**
   * 映射质量等级
   */
  private mapQualityLevel(qualityLevel: string): 'excellent' | 'good' | 'basic' | 'minimal' {
    switch (qualityLevel) {
      case 'excellent': return 'excellent';
      case 'good': return 'good';
      case 'basic': return 'basic';
      case 'minimal': return 'minimal';
      default: return 'basic';
    }
  }


  /**
   * 生成向量嵌入
   */
  private async generateVectors(): Promise<void> {
    try {
      console.log('🧮 加载真实向量嵌入数据...');
      
      // 在服务器端使用文件系统读取
      const fs = await import('fs');
      const path = await import('path');
      
      // 构建向量数据文件路径
      const embeddingsPath = path.join(process.cwd(), 'public', 'data', 'artworks-embeddings.json');
      
      // 读取文件内容
      const fileContent = fs.readFileSync(embeddingsPath, 'utf-8');
      const embeddingsData = JSON.parse(fileContent);
      
      console.log(`🧮 成功加载 ${embeddingsData.length} 个向量嵌入`);
      
      // 创建向量映射
      const vectorMap = new Map();
      embeddingsData.forEach((item: any) => {
        vectorMap.set(item.id, item.vector);
      });
      
      // 为每个艺术作品分配对应的向量
      this.vectors = this.artworks.map(artwork => {
        const vector = vectorMap.get(artwork.id);
        if (vector && Array.isArray(vector)) {
          return vector;
        } else {
          throw new Error(`未找到作品 ${artwork.id} 的向量数据`);
        }
      });
      
      console.log(`✅ 向量嵌入数据加载完成，共 ${this.vectors.length} 个向量`);
    } catch (error) {
      console.error('❌ 加载向量数据失败:', error);
      throw new Error('无法加载向量嵌入数据，请检查数据文件');
    }
  }


  /**
   * 搜索相似作品
   */
  async search(query: string, limit: number = 30): Promise<ArtworkSearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log(`🔍 搜索查询: "${query}"`);
    
    // 生成查询向量
    const queryVector = this.generateQueryVector(query);
    
    // 计算相似度
    const results = this.artworks.map((artwork, index) => {
      const similarity = cosineSimilarity(queryVector, this.vectors[index]);
      return {
        ...artwork,
        score: similarity
      };
    });

    // 按相似度排序
    results.sort((a, b) => b.score - a.score);
    
    // 返回前N个结果
    const topResults = results.slice(0, limit);
    
    console.log(`✅ 找到${topResults.length}件相似作品，最高相似度: ${topResults[0]?.score.toFixed(3)}`);
    
    return topResults;
  }

  /**
   * 生成查询向量
   */
  private generateQueryVector(query: string): number[] {
    const vector = new Array(384).fill(0);
    const text = query.toLowerCase();
    
    // 基于查询文本生成向量
    for (let i = 0; i < text.length && i < 384; i++) {
      vector[i] = text.charCodeAt(i) / 128.0 - 1;
    }
    
    // 添加一些随机性
    for (let i = 0; i < 384; i++) {
      vector[i] += (Math.random() - 0.5) * 0.1;
    }
    
    return vector;
  }

  /**
   * 根据情绪标签搜索
   */
  async searchByEmotion(emotion: string, limit: number = 30): Promise<ArtworkSearchResult[]> {
    // 情绪关键词映射
    const emotionKeywords: Record<string, string[]> = {
      'joy': ['happy', 'cheerful', 'bright', 'colorful', 'celebration'],
      'sadness': ['melancholy', 'dark', 'somber', 'quiet', 'reflective'],
      'anger': ['dramatic', 'intense', 'bold', 'confrontational', 'powerful'],
      'fear': ['mysterious', 'dark', 'uncertain', 'shadowy', 'unknown'],
      'love': ['romantic', 'tender', 'warm', 'intimate', 'affectionate'],
      'exploration': ['curious', 'adventurous', 'discovery', 'journey', 'unknown']
    };

    const keywords = emotionKeywords[emotion] || [emotion];
    const query = keywords.join(' ');
    
    return this.search(query, limit);
  }
}

// 导出单例实例
export const jsVectorSearchService = new JSVectorSearchService();
