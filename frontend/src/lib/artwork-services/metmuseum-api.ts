// Met Museum API 服务组件
import { Artwork, ArtworkService, ArtworkServiceResponse, CurationInfo } from './types';
import { artworkCache } from '../cache/artwork-cache';

export class MetMuseumAPIService implements ArtworkService {
  private serviceName = 'MetMuseumAPI';
  private baseUrl = 'https://collectionapi.metmuseum.org/public/collection/v1';
  private lastRequestTime = 0;
  private minRequestInterval = 100; // 最小请求间隔100ms，确保不超过80请求/秒
  
  /**
   * 请求频率控制 - 确保不超过Met Museum API的80请求/秒限制
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      console.log(`⏱️ Met Museum API频率控制: 等待${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      console.log('🔍 检查Met Museum API服务可用性...');
      
      // 应用频率控制
      await this.rateLimit();
      
      // 测试API连接
      const response = await fetch(`${this.baseUrl}/search?q=test&hasImages=true`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ArtDuo/1.0'
        },
        signal: AbortSignal.timeout(5000) // 5秒超时，快速失败
      });
      
      const isAvailable = response.ok;
      console.log('📡 Met Museum API可用性:', isAvailable);
      return isAvailable;
    } catch (error) {
      console.error('❌ Met Museum API服务检查失败:', error);
      return false;
    }
  }

  async searchArtworks(emotion: string, userInput?: string, llmAnalysis?: any): Promise<ArtworkServiceResponse> {
    console.log('🎨 Met Museum API服务 - 搜索作品:', emotion, userInput);

    try {
      // 转换为英文关键词
      const searchQuery = this.buildSearchQuery(emotion, userInput, llmAnalysis);
      console.log('🔍 搜索查询:', searchQuery);

      // 检查缓存
      const cachedResult = artworkCache.getMetSearchResult(searchQuery);
      if (cachedResult) {
        console.log('📦 使用缓存的搜索结果:', searchQuery);
        return cachedResult;
      }

      // 应用频率控制
      await this.rateLimit();

      // 搜索作品
      const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(searchQuery)}&hasImages=true`;
      console.log('📡 搜索URL:', searchUrl);

      const searchResponse = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ArtDuo/1.0'
        },
        signal: AbortSignal.timeout(5000) // 5秒超时，快速失败
      });

      if (!searchResponse.ok) {
        throw new Error(`搜索API响应错误: ${searchResponse.status} ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();
      console.log('📡 搜索响应:', searchData);
      
      if (!searchData.objectIDs || searchData.objectIDs.length === 0) {
        console.log('⚠️ 没有找到作品');
        return {
          success: false,
          artworks: [],
          curation: {
            theme: emotion,
            description: '',
            emotionCurve: [],
            totalWorks: 0
          },
          source: 'api'
        };
      }
      
      // 获取作品详情 - 平衡速度与数量，获取更多作品
      const maxResults = Math.min(searchData.objectIDs.length, 50); // 最多获取50个作品
      const artworks = await this.fetchArtworkDetails(searchData.objectIDs.slice(0, maxResults));
      console.log('✅ 成功获取', artworks.length, '个作品');

      const result = {
        success: true,
        artworks,
        curation: {
          theme: emotion,
          description: `这是来自大都会艺术博物馆的${artworks.length}件作品，展现了"${emotion}"这一主题的艺术表达。`,
          emotionCurve: this.generateEmotionCurve(emotion, artworks),
          totalWorks: artworks.length
        },
        source: 'api'
      };

      // 缓存搜索结果
      artworkCache.cacheMetSearchResult(searchQuery, result);
      console.log('💾 缓存搜索结果:', searchQuery);

      return result;
    } catch (error) {
      console.error('❌ Met Museum API服务调用失败:', error);
      throw error;
    }
  }

  private async fetchArtworkDetails(objectIDs: number[]): Promise<Artwork[]> {
    const batchSize = 5; // 并发请求数量
    const batches = [];

    // 将请求分批
    for (let i = 0; i < objectIDs.length; i += batchSize) {
      batches.push(objectIDs.slice(i, i + batchSize));
    }

    console.log(`📦 分${batches.length}批获取作品详情，每批最多${batchSize}个请求`);

    const allArtworks: Artwork[] = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`🎯 处理第${batchIndex + 1}/${batches.length}批: ${batch.length}件作品`);

      // 批内并发执行
      const batchPromises = batch.map(async (id: number) => {
        try {
          const idStr = id.toString();

          // 检查缓存
          const cachedDetail = artworkCache.getMetArtworkDetail(idStr);
          if (cachedDetail) {
            console.log('📦 使用缓存的作品详情:', id, cachedDetail.title);
            return cachedDetail;
          }

          console.log('🔍 获取作品详情，ID:', id);

          const detailResponse = await fetch(`${this.baseUrl}/objects/${id}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'ArtDuo/1.0'
            },
            signal: AbortSignal.timeout(10000) // 10秒超时
          });

          if (!detailResponse.ok) {
            throw new Error(`作品详情API响应错误: ${detailResponse.status} ${detailResponse.statusText}`);
          }

          const detail = await detailResponse.json();
          console.log('📸 作品详情获取成功:', detail.title, '图片URL:', detail.primaryImage);

          // 处理图片URL
          let imageUrl = detail.primaryImage;
          if (!imageUrl || imageUrl === '') {
            imageUrl = detail.additionalImages && detail.additionalImages.length > 0
              ? detail.additionalImages[0]
              : 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop&auto=format&q=80';
          }

          const artwork = {
            id: detail.objectID.toString(),
            title: detail.title || '未知作品',
            artist: detail.artistDisplayName || '未知艺术家',
            year: detail.objectDate || '未知年代',
            medium: detail.medium || '未知材质',
            dimensions: detail.dimensions || '未知尺寸',
            imageUrl: imageUrl,
            description: detail.culture || detail.period || '这是一件来自大都会艺术博物馆的珍贵作品。',
            museum: '大都会艺术博物馆',
            license: 'CC0'
          };

          // 缓存作品详情
          artworkCache.cacheMetArtworkDetail(idStr, artwork);
          console.log('💾 缓存作品详情:', id, artwork.title);

          return artwork;
        } catch (error) {
          console.error(`获取作品${id}详情失败:`, error);
          return null;
        }
      });

      // 等待当前批次完成
      const batchResults = await Promise.all(batchPromises);
      const validArtworks = batchResults.filter(artwork => artwork !== null) as Artwork[];
      allArtworks.push(...validArtworks);

      console.log(`✅ 批次${batchIndex + 1}完成: ${validArtworks.length}件作品`);

      // 批次间添加适当的延迟（比原来的100ms短，因为我们现在并发请求）
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms批间延迟
      }
    }

    console.log(`✅ 所有批次完成: 总共获取${allArtworks.length}件作品`);
    return allArtworks;
  }

  private generateEmotionCurve(emotion: string, artworks: Artwork[]): number[] {
    const baseCurves = {
      '孤独': [0.2, 0.1, 0.3, 0.4, 0.2, 0.1, 0.3, 0.5, 0.4],
      '平静': [0.5, 0.6, 0.5, 0.4, 0.5, 0.6, 0.5, 0.4, 0.5],
      '激动': [0.9, 0.7, 0.8, 0.9, 0.6, 0.8, 0.9, 0.7, 0.8],
      '忧郁': [0.2, 0.1, 0.3, 0.4, 0.2, 0.1, 0.3, 0.5, 0.4],
      '喜悦': [0.8, 0.9, 0.7, 0.8, 0.9, 0.8, 0.7, 0.8, 0.9],
      '沉思': [0.3, 0.4, 0.2, 0.3, 0.5, 0.4, 0.3, 0.2, 0.4],
      'lonely': [0.2, 0.1, 0.3, 0.4, 0.2, 0.1, 0.3, 0.5, 0.4],
      'calm': [0.5, 0.6, 0.5, 0.4, 0.5, 0.6, 0.5, 0.4, 0.5],
      'excited': [0.9, 0.7, 0.8, 0.9, 0.6, 0.8, 0.9, 0.7, 0.8],
      'melancholy': [0.2, 0.1, 0.3, 0.4, 0.2, 0.1, 0.3, 0.5, 0.4],
      'joy': [0.8, 0.9, 0.7, 0.8, 0.9, 0.8, 0.7, 0.8, 0.9],
      'contemplative': [0.3, 0.4, 0.2, 0.3, 0.5, 0.4, 0.3, 0.2, 0.4]
    };

    let curve = baseCurves[emotion as keyof typeof baseCurves] || [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    
    // 根据实际作品数量调整曲线长度
    if (artworks.length < 9) {
      curve = curve.slice(0, artworks.length);
    } else if (artworks.length > 9) {
      const extendedCurve = [];
      for (let i = 0; i < artworks.length; i++) {
        extendedCurve.push(curve[i % curve.length]);
      }
      curve = extendedCurve;
    }
    
    return curve;
  }

  private buildSearchQuery(emotion: string, userInput?: string, llmAnalysis?: any): string {
    // 基于LLM分析结果构建搜索查询，使用英文关键词
    const emotionMap: { [key: string]: string } = {
      '孤独': 'lonely solitude isolation',
      '快乐': 'happy joy cheerful',
      '悲伤': 'sad melancholy sorrow',
      '愤怒': 'angry rage fury',
      '恐惧': 'fear afraid terror',
      '爱': 'love romantic affection',
      '希望': 'hope optimistic future',
      '绝望': 'despair hopeless desperate',
      '平静': 'peaceful calm serene',
      '激动': 'excited energetic dynamic',
      '忧郁': 'melancholy blue sad',
      '神秘': 'mysterious mystical enigmatic'
    };
    
    let query = emotionMap[emotion] || emotion;
    
    if (llmAnalysis?.search_keywords && llmAnalysis.search_keywords.length > 0) {
      // 使用LLM推荐的关键词
      query = llmAnalysis.search_keywords.join(' ');
    }
    
    if (userInput && userInput !== emotion) {
      query += ` ${userInput}`;
    }

    // 对于Met Museum API，只使用第一个关键词，避免多关键词搜索返回空结果
    const firstKeyword = query.split(' ')[0];
    return firstKeyword.trim();
  }
}
