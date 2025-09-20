// Met Museum API 服务组件
import { Artwork, ArtworkService, ArtworkServiceResponse, CurationInfo } from './types';

export class MetMuseumAPIService implements ArtworkService {
  private serviceName = 'MetMuseumAPI';
  private baseUrl = 'https://collectionapi.metmuseum.org/public/collection/v1';
  
  async isAvailable(): Promise<boolean> {
    try {
      console.log('🔍 检查Met Museum API服务可用性...');
      
      // 测试API连接
      const response = await fetch(`${this.baseUrl}/search?q=test&hasImages=true`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ArtDuo/1.0'
        }
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
      // 搜索作品
      const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(emotion)}&hasImages=true`;
      console.log('📡 搜索URL:', searchUrl);
      
      const searchResponse = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ArtDuo/1.0'
        }
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
      
      // 获取作品详情
      const artworks = await this.fetchArtworkDetails(searchData.objectIDs.slice(0, 9));
      console.log('✅ 成功获取', artworks.length, '个作品');
      
      return {
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
    } catch (error) {
      console.error('❌ Met Museum API服务调用失败:', error);
      throw error;
    }
  }

  private async fetchArtworkDetails(objectIDs: number[]): Promise<Artwork[]> {
    const artworkPromises = objectIDs.map(async (id: number) => {
      try {
        console.log('🔍 获取作品详情，ID:', id);
        
        const detailResponse = await fetch(`${this.baseUrl}/objects/${id}`, {
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
        console.log('📸 作品详情获取成功:', detail.title, '图片URL:', detail.primaryImage);
        
        // 处理图片URL
        let imageUrl = detail.primaryImage;
        if (!imageUrl || imageUrl === '') {
          imageUrl = detail.additionalImages && detail.additionalImages.length > 0 
            ? detail.additionalImages[0] 
            : 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop&auto=format&q=80';
        }
        
        return {
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
      } catch (error) {
        console.error(`获取作品${id}详情失败:`, error);
        return null;
      }
    });
    
    const artworks = await Promise.all(artworkPromises);
    return artworks.filter(artwork => artwork !== null) as Artwork[];
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
