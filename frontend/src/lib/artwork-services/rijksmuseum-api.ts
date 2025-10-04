// Rijks Museum API 服务组件
// 基于官方文档: https://data.rijksmuseum.nl/docs/
import { Artwork, ArtworkService, ArtworkServiceResponse, CurationInfo } from './types';
import { fetchClient } from '@/lib/utils/fetch-client';

export class RijksMuseumAPIService implements ArtworkService {
  private serviceName = 'RijksMuseumAPI';
  private searchBaseUrl = 'https://www.rijksmuseum.nl/api/nl/collection';
  private httpBaseUrl = 'https://id.rijksmuseum.nl';
  private iiifBaseUrl = 'https://lh3.googleusercontent.com/iiif';
  private apiKey: string;

  constructor() {
    // 尝试从多个来源读取API密钥
    this.apiKey = this.loadApiKey();
    if (!this.apiKey) {
      console.warn('⚠️ Rijks Museum API 密钥未配置');
      console.warn('⚠️ 请设置环境变量: NEXT_PUBLIC_RIJKS_API_KEY 或在 env.local.json 中配置 rijks_api_key');
    }
    console.log('🔑 Rijks API 密钥状态:', this.apiKey ? '已配置' : '未配置');
  }

  private loadApiKey(): string {
    // 1. 尝试从环境变量读取
    let apiKey = process.env.NEXT_PUBLIC_RIJKS_API_KEY || process.env.RIJKS_API_KEY || '';
    
    // 2. 尝试从 env.local.json 读取
    if (!apiKey) {
      try {
        const fs = require('fs');
        const path = require('path');
        // 依次尝试多个常见路径，兼容不同运行cwd
        const candidatePaths = [
          path.join(process.cwd(), 'env.local.json'),
          path.join(process.cwd(), 'frontend', 'env.local.json'),
          path.resolve('env.local.json'),
          path.resolve('frontend', 'env.local.json')
        ];
        for (const p of candidatePaths) {
          if (fs.existsSync(p)) {
            try {
              const envData = JSON.parse(fs.readFileSync(p, 'utf8'));
              apiKey = envData.NEXT_PUBLIC_RIJKS_API_KEY || envData.rijks_api_key || '';
              console.log(`🔑 尝试从文件加载 Rijks API 密钥: ${p} -> ${apiKey ? '已找到' : '未找到'}`);
              if (apiKey) break;
            } catch (e) {
              console.warn('⚠️ 解析 env.local.json 失败:', p, e);
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ 读取 env.local.json 失败:', error);
      }
    }
    
    return apiKey;
  }

  async isAvailable(): Promise<boolean> {
    try {
      console.log('🔍 检查Rijks Museum API服务可用性...');
      
      if (!this.apiKey) {
        console.log('❌ Rijks Museum API 密钥未配置');
        return false;
      }

      // 测试API连接 - 直接使用fetch避免fetchClient的错误处理
      const testUrl = `${this.searchBaseUrl}?key=${this.apiKey}&q=test&imgonly=true`;
      
      console.log('🌐 测试Rijks API连接:', testUrl);
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ArtDuo/1.0'
        },
        // 放宽超时，避免网络抖动导致误判
        signal: AbortSignal.timeout(15000) // 15秒超时
      });
      
      const isAvailable = response.status >= 200 && response.status < 300;
      console.log(`📡 Rijks Museum API可用性: ${isAvailable} (状态: ${response.status})`);
      
      if (isAvailable) {
        // 验证返回的数据格式
        try {
          const data = await response.json();
          const hasArtObjects = data.artObjects && Array.isArray(data.artObjects);
          console.log(`📊 Rijks API数据验证: ${hasArtObjects ? '✅' : '❌'} (作品数: ${data.count || 0})`);
          // 只要响应成功就认为可用，具体作品为空不影响“可用性”
          return true;
        } catch (jsonError) {
          console.warn('⚠️ Rijks API返回数据格式异常:', jsonError);
          // 返回200但解析失败也视为可用，避免频繁误判
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Rijks Museum API服务检查失败:', error);
      return false;
    }
  }

  async searchArtworks(emotion: string, userInput?: string, llmAnalysis?: any): Promise<ArtworkServiceResponse> {
    console.log('🎨 Rijks Museum API服务 - 搜索作品:', emotion, userInput);
    
    if (!this.apiKey) {
      throw new Error('Rijks Museum API 密钥未配置');
    }

    try {
      // 构建搜索查询
      const searchQuery = this.buildSearchQuery(emotion, userInput, llmAnalysis);
      console.log('🔍 搜索查询:', searchQuery);
      console.log('🔍 原始情绪:', emotion);

      // 第一步：调用Search API获取作品ID列表
      console.log('🔍 开始搜索Rijks作品，查询:', searchQuery);
      const searchIds = await this.searchCollection(searchQuery);
      console.log('🔍 搜索结果:', searchIds.length, '个作品ID');
      
      if (!searchIds || searchIds.length === 0) {
        console.log('⚠️ Rijks API搜索没有找到作品');
        return {
          success: false,
          artworks: [],
          curation: {
            theme: emotion,
            description: '',
            emotionCurve: [],
            totalWorks: 0
          },
          source: 'rijks'
        };
      }

      // 第二步：获取作品详细信息（主路径）
      const artworks = await this.fetchArtworkDetailsFromSearch(searchIds.slice(0, 25));
      console.log('✅ 详情路径获取', artworks.length, '个作品');

      // 兜底：如果详情路径为0，则直接用搜索列表构建最简作品（基于 webImage/headerImage）
      let finalArtworks: Artwork[] = artworks;
      if (finalArtworks.length === 0) {
        console.log('🔁 详情为空，使用搜索结果直接构建作品条目');
        finalArtworks = await this.buildArtworksDirectlyFromSearch(searchIds.slice(0, 25));
        console.log('✅ 搜索直构获取', finalArtworks.length, '个作品');
      }

      return {
        success: true,
        artworks: finalArtworks,
        curation: {
          theme: emotion,
          description: `这是来自荷兰国家博物馆的${finalArtworks.length}件作品，展现了"${emotion}"这一主题的艺术表达。`,
          emotionCurve: this.generateEmotionCurve(emotion, finalArtworks),
          totalWorks: finalArtworks.length
        },
        source: 'rijks'
      };
    } catch (error) {
      console.error('❌ Rijks Museum API服务调用失败:', error);
      console.error('❌ 错误详情:', error instanceof Error ? error.message : String(error));
      console.error('❌ 错误堆栈:', error instanceof Error ? error.stack : 'No stack');
      throw error;
    }
  }

  // 直接基于搜索结果构建作品（不依赖详情接口）
  private async buildArtworksDirectlyFromSearch(objectIds: string[]): Promise<Artwork[]> {
    const results: Artwork[] = [];
    for (const id of objectIds) {
      try {
        const detailUrl = `${this.searchBaseUrl}/${id}?key=${this.apiKey}`;
        const resp = await fetch(detailUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json', 'User-Agent': 'ArtDuo/1.0' },
          signal: AbortSignal.timeout(10000)
        });
        if (!resp.ok) {
          console.warn('⚠️ 直构细节获取失败，跳过ID:', id, resp.status, resp.statusText);
          continue;
        }
        const data = await resp.json();
        if (data && data.artObject) {
          const ao = data.artObject;
          const imageUrl = ao.webImage?.url || ao.headerImage?.url || '';
          if (!imageUrl) {
            console.warn('⚠️ 无图片，跳过ID:', id);
            continue;
          }
          const artwork: Artwork = {
            id,
            title: ao.title || '未知作品',
            artist: ao.principalOrFirstMaker || '未知艺术家',
            year: ao.dating?.presentingDate || '未知年代',
            medium: ao.materials?.[0] || ao.techniques?.[0] || '未知材质',
            dimensions: ao.dimensions?.[0]?.value ? `${ao.dimensions[0].value} ${ao.dimensions[0].unit || ''}` : '未知尺寸',
            imageUrl,
            description: ao.plaqueDescriptionDutch || ao.plaqueDescriptionEnglish || '这是一件来自荷兰国家博物馆的珍贵作品。',
            museum: '荷兰国家博物馆',
            license: 'Rijksmuseum API',
          };
          results.push(artwork);
        }
      } catch (e) {
        console.warn('⚠️ 直构获取异常，跳过ID:', id, e instanceof Error ? e.message : String(e));
      }
    }
    return results;
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

    // 对于Rijks API，只使用第一个关键词，避免多关键词搜索返回空结果
    const firstKeyword = query.split(' ')[0];
    return firstKeyword.trim();
  }

  private async searchCollection(query: string): Promise<string[]> {
    try {
      // 使用正确的 Rijks API 搜索格式
      // 提升每次返回数量，优先取有图结果
      const searchUrl = `${this.searchBaseUrl}?key=${this.apiKey}&q=${encodeURIComponent(query)}&imgonly=true&ps=20`;
      console.log('📡 搜索URL:', searchUrl);

      // 直接使用fetch，避免fetchClient的重试机制可能的问题
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ArtDuo/1.0'
        },
        signal: AbortSignal.timeout(10000) // 10秒超时
      });

      if (!response.ok) {
        throw new Error(`Rijks API搜索失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📡 搜索响应:', data);
      console.log('📡 搜索响应数据量:', data.count || 0);
      console.log('📡 搜索响应作品数组长度:', data.artObjects ? data.artObjects.length : 0);

      // 提取作品ID列表
      let objectIds: string[] = [];
      if (data.artObjects && Array.isArray(data.artObjects)) {
        data.artObjects.forEach((artObject: any) => {
          if (artObject.objectNumber) {
            objectIds.push(artObject.objectNumber);
          }
        });
      }

      console.log('📋 找到作品ID:', objectIds.length, '个');
      console.log('📋 作品ID列表:', objectIds.slice(0, 5)); // 显示前5个ID
      // 若首轮为空，进行一次宽松降级：仅 imgonly=true，不带查询词
      if (objectIds.length === 0) {
        const fallbackUrl = `${this.searchBaseUrl}?key=${this.apiKey}&imgonly=true&ps=20`;
        console.log('🔁 宽松降级重试，无查询词:', fallbackUrl);
        const fbResp = await fetch(fallbackUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json', 'User-Agent': 'ArtDuo/1.0' },
          signal: AbortSignal.timeout(10000)
        });
        if (fbResp.ok) {
          const fbData = await fbResp.json();
          if (fbData.artObjects && Array.isArray(fbData.artObjects)) {
            objectIds = fbData.artObjects
              .filter((o: any) => !!o.objectNumber)
              .map((o: any) => o.objectNumber)
              .slice(0, 20);
            console.log('🔁 降级重试命中作品ID:', objectIds.length);
          } else {
            console.log('🔁 降级重试返回无 artObjects');
          }
        } else {
          console.log('🔁 降级重试响应失败:', fbResp.status, fbResp.statusText);
        }
      }
      return objectIds;
    } catch (error) {
      console.error('❌ 搜索作品失败:', error);
      console.error('❌ 错误详情:', error instanceof Error ? error.message : String(error));
      console.error('❌ 错误堆栈:', error instanceof Error ? error.stack : 'No stack');
      // 返回空数组而不是抛出错误，让其他服务继续工作
      return [];
    }
  }

  private async fetchArtworkDetailsFromSearch(objectIds: string[]): Promise<Artwork[]> {
    // 使用正确的详情API获取作品数据
    const artworks: Artwork[] = [];
    
    for (const id of objectIds) {
      try {
        console.log('🔍 获取作品详情，ID:', id);
        
        // 使用正确的 Rijks API 获取作品详情
        const detailUrl = `${this.searchBaseUrl}/${id}?key=${this.apiKey}`;
        const response = await fetchClient.get(detailUrl);
        const data = response.data;
        
        if (data.artObject) {
          const artwork = this.parseRijksData(data.artObject, id);
          artworks.push(artwork);
          console.log('✅ 成功解析作品:', artwork.title);
        } else {
          console.warn(`未找到作品数据: ${id}`);
        }
      } catch (error) {
        console.error(`获取作品${id}详情失败:`, error);
      }
    }
    
    return artworks;
  }

  private async fetchArtworkDetails(objectIds: string[]): Promise<Artwork[]> {
    const artworkPromises = objectIds.map(async (id: string) => {
      try {
        console.log('🔍 获取作品详情，ID:', id);
        
        // 使用正确的 Rijks API 获取作品详情
        const detailResponse = await fetch(`${this.searchBaseUrl}/${id}?key=${this.apiKey}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'ArtDuo/1.0'
          }
        });
        
        if (!detailResponse.ok) {
          throw new Error(`作品详情API响应错误: ${detailResponse.status} ${detailResponse.statusText}`);
        }
        
        const detail = await detailResponse.json();
        console.log('📸 作品详情获取成功:', detail.artObject?.title || '未知作品');
        
        // 解析 Rijks API 数据
        return this.parseRijksData(detail.artObject, id);
      } catch (error) {
        console.error(`获取作品${id}详情失败:`, error);
        return null;
      }
    });
    
    const artworks = await Promise.all(artworkPromises);
    return artworks.filter(artwork => artwork !== null) as Artwork[];
  }

  private parseRijksData(data: any, id: string): Artwork {
    // 解析 Rijks API 格式的数据
    const title = data.title || '未知作品';
    const artist = data.principalOrFirstMaker || '未知艺术家';
    const year = data.dating?.presentingDate || data.dating?.year || '未知年代';
    const medium = data.materials?.[0] || data.techniques?.[0] || '未知材质';
    const dimensions = data.dimensions?.[0] || '未知尺寸';
    const description = data.plaqueDescriptionDutch || data.plaqueDescriptionEnglish || '这是一件来自荷兰国家博物馆的珍贵作品。';
    
    // 使用 Rijks API 提供的图片URL
    const imageUrl = data.webImage?.url || data.headerImage?.url || this.generateIIIFImageUrl(data, id);
    
    return {
      id,
      title,
      artist,
      year,
      medium,
      dimensions,
      imageUrl,
      description,
      museum: '荷兰国家博物馆',
      license: 'CC0'
    };
  }

  private parseLinkedArtData(data: any, id: string): Artwork {
    // 解析Linked Art JSON格式的数据
    const title = this.extractValue(data, ['title', 'label', 'name']) || '未知作品';
    const artist = this.extractValue(data, ['maker', 'creator', 'artist']) || '未知艺术家';
    const year = this.extractValue(data, ['dating', 'date', 'year']) || '未知年代';
    const medium = this.extractValue(data, ['materials', 'medium', 'technique']) || '未知材质';
    const dimensions = this.extractValue(data, ['dimensions', 'size']) || '未知尺寸';
    
    // 生成IIIF图像URL
    const imageUrl = this.generateIIIFImageUrl(data, id);
    
    // 提取描述信息
    const description = this.extractValue(data, ['description', 'summary', 'note']) || 
                      `这是一件来自荷兰国家博物馆的珍贵作品，展现了丰富的艺术价值。`;

    return {
      id: id,
      title: title,
      artist: artist,
      year: year,
      medium: medium,
      dimensions: dimensions,
      imageUrl: imageUrl,
      description: description,
      museum: '荷兰国家博物馆',
      license: 'CC0'
    };
  }

  private extractValue(data: any, keys: string[]): string | null {
    for (const key of keys) {
      if (data[key]) {
        if (typeof data[key] === 'string') {
          return data[key];
        } else if (Array.isArray(data[key]) && data[key].length > 0) {
          return data[key][0];
        } else if (typeof data[key] === 'object' && data[key].value) {
          return data[key].value;
        }
      }
    }
    return null;
  }

  private generateIIIFImageUrl(data: any, id: string): string {
    // 尝试从数据中提取IIIF信息
    if (data.iiif && data.iiif.image) {
      return data.iiif.image;
    }
    
    // 生成默认的IIIF URL
    // 基于Rijks Museum的IIIF服务
    return `${this.iiifBaseUrl}/iiif/${id}/full/800,/0/default.jpg`;
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
}
