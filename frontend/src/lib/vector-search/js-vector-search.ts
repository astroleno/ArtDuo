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
   * 加载艺术作品数据
   */
  private async loadArtworks(): Promise<void> {
    // 模拟从本地数据加载艺术作品
    this.artworks = [
      {
        id: "437133",
        title: "Garden at Sainte-Adresse",
        artist: "Claude Monet",
        year: "1867",
        medium: "Oil on canvas",
        description: "A beautiful garden scene by Monet, capturing the essence of nature and light.",
        imageUrl: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop&auto=format&q=80",
        museum: "大都会艺术博物馆",
        score: 0,
        quality: 'excellent'
      },
      {
        id: "729644",
        title: "In proof of true love, a watercarrier skeleton arguing with a woman",
        artist: "José Guadalupe Posada",
        year: "ca. 1890–1896",
        medium: "Type-metal engraving and letterpress on blue paper",
        description: "A dramatic scene showing the complexity of human relationships.",
        imageUrl: "https://images.metmuseum.org/CRDImages/dp/original/DP865112.jpg",
        museum: "大都会艺术博物馆",
        score: 0,
        quality: 'good'
      },
      {
        id: "436155",
        title: "The Rehearsal of the Ballet Onstage",
        artist: "Edgar Degas",
        year: "ca. 1874",
        medium: "Oil colors freely mixed with turpentine",
        description: "Capturing the grace and movement of ballet dancers in rehearsal.",
        imageUrl: "https://images.metmuseum.org/CRDImages/ep/original/DT1565.jpg",
        museum: "大都会艺术博物馆",
        score: 0,
        quality: 'excellent'
      },
      {
        id: "671456",
        title: "Chrysanthemums in the Garden at Petit-Gennevilliers",
        artist: "Gustave Caillebotte",
        year: "1893",
        medium: "Oil on canvas",
        description: "A peaceful garden scene with chrysanthemums, showing the beauty of nature.",
        imageUrl: "https://images.metmuseum.org/CRDImages/ep/original/DP341200.jpg",
        museum: "大都会艺术博物馆",
        score: 0,
        quality: 'good'
      },
      {
        id: "436241",
        title: "Cows Crossing a Ford",
        artist: "Jules Dupré",
        year: "1836",
        medium: "Oil on canvas",
        description: "A pastoral scene of cows crossing a ford, representing rural life.",
        imageUrl: "https://images.metmuseum.org/CRDImages/ep/original/DP232030.jpg",
        museum: "大都会艺术博物馆",
        score: 0,
        quality: 'basic'
      },
      {
        id: "437422",
        title: "Charity",
        artist: "Guido Reni",
        year: "ca. 1630",
        medium: "Oil on canvas",
        description: "A classical representation of charity, showing compassion and care.",
        imageUrl: "https://images.metmuseum.org/CRDImages/ep/original/DT10776.jpg",
        museum: "大都会艺术博物馆",
        score: 0,
        quality: 'excellent'
      },
      {
        id: "206965",
        title: "Longcase astronomical regulator",
        artist: "Ferdinand Berthoud",
        year: "ca. 1768–70",
        medium: "Case: oak veneered with ebony and brass",
        description: "A precision astronomical clock, representing scientific advancement.",
        imageUrl: "https://images.metmuseum.org/CRDImages/es/original/DP336058.jpg",
        museum: "大都会艺术博物馆",
        score: 0,
        quality: 'good'
      },
      {
        id: "544320",
        title: "Stela of the Steward Mentuwoser",
        artist: "未知艺术家",
        year: "ca. 1944 B.C.",
        medium: "Limestone, paint",
        description: "An ancient Egyptian stela, representing historical significance.",
        imageUrl: "https://images.metmuseum.org/CRDImages/eg/original/DP322064.jpg",
        museum: "大都会艺术博物馆",
        score: 0,
        quality: 'basic'
      },
      {
        id: "200668",
        title: "Sabine Houdon (1787–1836)",
        artist: "Jean Antoine Houdon",
        year: "1788",
        medium: "White marble on gray marble socle",
        description: "A marble sculpture, representing classical beauty and craftsmanship.",
        imageUrl: "https://images.metmuseum.org/CRDImages/es/original/DP242660.jpg",
        museum: "大都会艺术博物馆",
        score: 0,
        quality: 'excellent'
      }
    ];
  }

  /**
   * 生成向量嵌入
   */
  private async generateVectors(): Promise<void> {
    // 为每件作品生成模拟向量嵌入
    this.vectors = this.artworks.map(artwork => {
      // 基于作品特征生成模拟向量
      const vector = new Array(384).fill(0);
      
      // 基于标题、艺术家、描述等生成特征向量
      const text = `${artwork.title} ${artwork.artist} ${artwork.description}`.toLowerCase();
      
      // 改进的特征提取：使用词频和语义特征
      const words = text.split(/\s+/);
      const wordFreq: Record<string, number> = {};
      
      // 计算词频
      words.forEach(word => {
        if (word.length > 2) { // 过滤短词
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      });
      
      // 基于词频生成向量
      let vectorIndex = 0;
      for (const [word, freq] of Object.entries(wordFreq)) {
        if (vectorIndex < 384) {
          // 使用词频和词长度作为特征
          vector[vectorIndex] = Math.min(freq / 10, 1) * (word.length / 20);
          vectorIndex++;
        }
      }
      
      // 添加情绪相关特征
      const emotionKeywords = ['happy', 'joy', 'beautiful', 'light', 'bright', 'colorful', 'nature', 'garden', 'peaceful'];
      emotionKeywords.forEach((keyword, index) => {
        if (text.includes(keyword) && vectorIndex < 384) {
          vector[vectorIndex] = 0.8; // 高权重
          vectorIndex++;
        }
      });
      
      // 添加艺术风格特征
      const styleKeywords = ['impressionist', 'classical', 'modern', 'contemporary', 'sculpture', 'painting'];
      styleKeywords.forEach((keyword, index) => {
        if (text.includes(keyword) && vectorIndex < 384) {
          vector[vectorIndex] = 0.6; // 中等权重
          vectorIndex++;
        }
      });
      
      // 归一化向量
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      if (magnitude > 0) {
        for (let i = 0; i < vector.length; i++) {
          vector[i] = vector[i] / magnitude;
        }
      }
      
      return vector;
    });
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
