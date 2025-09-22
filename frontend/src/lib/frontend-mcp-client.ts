/**
 * 前端MCP客户端 - 直接调用MCP服务
 * 支持浏览器环境下的MCP调用
 */

export interface MCPRequest {
  jsonrpc: string;
  id: string;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: string;
  id: string;
  result?: any;
  error?: {
    code: number | string;
    message: string;
    details?: any;
    data?: any;
  };
}

export interface Artwork {
  id: string;
  title: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  imageUrl: string;
  museum: string;
  license: string;
  confidence?: number;
}

export interface MCPSearchResult {
  success: boolean;
  artworks: Artwork[];
  totalFound: number;
  source: 'mcp' | 'fallback';
  executionTime: number;
}

export class MCPClientError extends Error {
  code: string;
  status?: number;
  details?: unknown;

  constructor(code: string, message: string, options?: { status?: number; details?: unknown }) {
    super(message);
    this.code = code;
    this.status = options?.status;
    this.details = options?.details;
  }
}

export class FrontendMCPClient {
  private mcpServerUrl: string;
  private timeout: number;

  constructor() {
    // MCP服务器地址 - 使用Next.js API路由作为代理
    this.mcpServerUrl = process.env.NEXT_PUBLIC_MCP_SERVER_URL || 
                       '/api/mcp'; // 使用Next.js API路由
    this.timeout = 30000; // 30秒超时
  }

  // 检查MCP服务是否可用
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(this.mcpServerUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5秒超时检查
      });
      return response.ok;
    } catch (error) {
      console.warn('MCP服务不可用:', error);
      return false;
    }
  }

  // 搜索艺术作品
  async searchArtworks(
    emotion: string, 
    userInput?: string, 
    llmAnalysis?: any
  ): Promise<MCPSearchResult> {
    const startTime = Date.now();

    try {
      // 构建搜索查询
      const searchQuery = this.buildSearchQuery(emotion, userInput, llmAnalysis);
      console.log('🔍 MCP搜索查询:', searchQuery);

      // 调用MCP搜索，传递LLM分析结果
      const searchResponse = await this.callMCPServer('search-museum-objects', {
        query: searchQuery,
        llm_analysis: llmAnalysis, // 传递LLM分析结果给MCP
        limit: 50 // 限制搜索结果数量
      });

      if (!searchResponse.result) {
        throw new Error('MCP搜索无结果');
      }

      // 解析搜索结果
      const objectIDs = this.parseObjectIDs(searchResponse.result);
      console.log('📋 找到对象ID:', objectIDs.length, '个');

      if (objectIDs.length === 0) {
        return {
          success: true,
          artworks: [],
          totalFound: 0,
          source: 'mcp',
          executionTime: Date.now() - startTime
        };
      }

      // 获取详细信息（限制数量以避免超时）
      const limitedIDs = objectIDs.slice(0, 20); // 限制为20个
      const artworks = await this.getArtworksWithLimit(limitedIDs, llmAnalysis);

      const executionTime = Date.now() - startTime;
      console.log('✅ MCP搜索完成:', artworks.length, '件作品，耗时:', executionTime, 'ms');

      return {
        success: true,
        artworks,
        totalFound: objectIDs.length,
        source: 'mcp',
        executionTime
      };

    } catch (error) {
      console.error('❌ MCP搜索失败:', error);

      if (error instanceof MCPClientError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new MCPClientError('MCP_SEARCH_FAILED', message, {
        details: { emotion, userInput, llmAnalysis }
      });
    }
  }

  // 构建搜索查询
  private buildSearchQuery(emotion: string, userInput?: string, llmAnalysis?: any): string {
    const keywords: string[] = [];

    // 优先使用LLM分析的关键词
    if (llmAnalysis?.search_keywords?.length > 0) {
      keywords.push(...llmAnalysis.search_keywords);
      console.log('🔍 使用LLM分析关键词:', llmAnalysis.search_keywords);
    }

    // 添加推荐艺术家
    if (llmAnalysis?.recommended_artists?.length > 0) {
      keywords.push(...llmAnalysis.recommended_artists);
      console.log('🎨 使用推荐艺术家:', llmAnalysis.recommended_artists);
    }

    // 添加用户输入
    if (userInput && userInput !== emotion) {
      keywords.push(userInput);
    }

    // 添加情绪关键词
    keywords.push(emotion);

    // 去重并限制长度
    const uniqueKeywords = [...new Set(keywords)].slice(0, 5);
    console.log('🔍 最终搜索关键词:', uniqueKeywords);
    return uniqueKeywords.join(' ');
  }

  // 解析对象ID
  private parseObjectIDs(result: any): number[] {
    try {
      if (typeof result === 'string') {
        // 尝试从文本中提取数字ID
        const matches = result.match(/\d+/g);
        if (matches) {
          const ids = matches.map(Number);
          // 如果第一个数字看起来像数量（小于等于总数），则跳过它
          if (ids.length > 1 && ids[0] <= ids.length) {
            return ids.slice(1);
          }
          return ids;
        }
        return [];
      } else if (Array.isArray(result)) {
        return result.map(Number);
      } else if (result.objectIDs && Array.isArray(result.objectIDs)) {
        return result.objectIDs.map(Number);
      }
      return [];
    } catch (error) {
      console.error('解析对象ID失败:', error);
      return [];
    }
  }

  // 限制并发获取艺术作品详情
  private async getArtworksWithLimit(objectIDs: number[], llmAnalysis?: any): Promise<Artwork[]> {
    const artworks: Artwork[] = [];
    const concurrencyLimit = 3; // 限制并发数
    const delay = 500; // 每次请求间隔

    for (let i = 0; i < objectIDs.length; i += concurrencyLimit) {
      const batch = objectIDs.slice(i, i + concurrencyLimit);
      
      const batchPromises = batch.map(async (objectID) => {
        try {
          const artwork = await this.getArtworkDetails(objectID);
          if (artwork) {
            // 计算置信度
            artwork.confidence = this.calculateConfidence(artwork, llmAnalysis);
            return artwork;
          }
        } catch (error) {
          console.warn(`获取作品详情失败 (ID: ${objectID}):`, error);
        }
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      const validArtworks = batchResults.filter(Boolean) as Artwork[];
      artworks.push(...validArtworks);

      // 添加延迟避免请求过快
      if (i + concurrencyLimit < objectIDs.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // 按置信度排序
    artworks.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    return artworks.slice(0, 9); // 返回前9个最佳结果
  }

  // 获取单个作品详情
  private async getArtworkDetails(objectID: number): Promise<Artwork | null> {
    try {
      const response = await this.callMCPServer('get-museum-object', {
        objectID: objectID
      });

      if (!response.result) {
        return null;
      }

      return this.convertMCPArtworkFromText(response.result);
    } catch (error) {
      console.error(`获取作品详情失败 (ID: ${objectID}):`, error);
      return null;
    }
  }

  // 转换MCP文本结果为Artwork对象
  private convertMCPArtworkFromText(text: string): Artwork | null {
    try {
      console.log('🔄 转换MCP作品文本:', text);
      
      // 尝试解析JSON
      if (text.startsWith('{') && text.endsWith('}')) {
        const data = JSON.parse(text);
        console.log('📋 解析JSON数据:', data);
        return this.convertMCPArtworkFromJSON(data);
      }

      // 从文本中提取信息
      const lines = text.split('\n');
      const artwork: Partial<Artwork> = {};

      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();

        switch (key.toLowerCase()) {
          case 'title':
            artwork.title = value;
            break;
          case 'artist':
          case 'artist name':
            artwork.artist = value;
            break;
          case 'date':
          case 'year':
            artwork.year = value;
            break;
          case 'medium':
            artwork.medium = value;
            break;
          case 'dimensions':
            artwork.dimensions = value;
            break;
          case 'description':
            artwork.description = value;
            break;
          case 'museum':
            artwork.museum = value;
            break;
        }
      }

      // 生成ID和默认值
      if (artwork.title) {
        const result = {
          id: `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: artwork.title || '未知作品',
          artist: artwork.artist || '未知艺术家',
          year: artwork.year || '未知年代',
          medium: artwork.medium || '未知材质',
          dimensions: artwork.dimensions || '未知尺寸',
          description: artwork.description || '暂无描述',
          imageUrl: this.generateImageUrl(artwork.title || 'artwork'),
          museum: artwork.museum || '大都会艺术博物馆',
          license: 'Public Domain'
        };
        console.log('✅ 转换结果:', result);
        return result;
      }

      return null;
    } catch (error) {
      console.error('❌ 转换MCP作品失败:', error);
      return null;
    }
  }

  // 转换MCP JSON结果为Artwork对象
  private convertMCPArtworkFromJSON(data: any): Artwork {
    console.log('🔄 转换JSON数据:', data);
    
    const result = {
      id: `mcp-${data.objectID || Date.now()}`,
      title: data.title || '未知作品',
      artist: data.artistDisplayName || data.artist || '未知艺术家',
      year: data.objectDate || data.period || '未知年代',
      medium: data.medium || '未知材质',
      dimensions: data.dimensions || '未知尺寸',
      description: data.description || data.culture || data.period || '暂无描述',
      imageUrl: data.primaryImage || this.generateImageUrl(data.title || 'artwork'),
      museum: '大都会艺术博物馆',
      license: 'Public Domain'
    };
    
    console.log('✅ JSON转换结果:', result);
    return result;
  }

  // 生成图片URL
  private generateImageUrl(title: string): string {
    // 使用Met Museum的真实艺术作品图片
    const imageMap: Record<string, string> = {
      '向日葵': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
      '睡莲': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
      '舞蹈': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
      '春': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
      '星夜': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
      '日出': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
      '花园': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
      '节日': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
      '阳光': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
      '呐喊': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
      '孤独的树': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
      '夜巡': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
      '沉思者': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
      '孤独的街道': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
      '月光': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
      '荒原': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
      '孤独的船': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
      '夜晚': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg'
    };
    
    // 如果找到匹配的标题，返回对应的图片
    if (imageMap[title]) {
      return imageMap[title];
    }
    
    // 否则使用Met Museum的默认图片
    return 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg';
  }

  // 计算置信度
  private calculateConfidence(artwork: Artwork, llmAnalysis?: any): number {
    let confidence = 0.5; // 基础置信度

    if (!llmAnalysis) {
      return confidence;
    }

    const searchKeywords = llmAnalysis.search_keywords || [];
    const recommendedArtists = llmAnalysis.recommended_artists || [];

    // 检查标题匹配
    const titleLower = artwork.title.toLowerCase();
    for (const keyword of searchKeywords) {
      if (titleLower.includes(keyword.toLowerCase())) {
        confidence += 0.2;
      }
    }

    // 检查艺术家匹配
    const artistLower = artwork.artist.toLowerCase();
    for (const artist of recommendedArtists) {
      if (artistLower.includes(artist.toLowerCase())) {
        confidence += 0.3;
      }
    }

    // 检查描述匹配
    const descriptionLower = artwork.description.toLowerCase();
    for (const keyword of searchKeywords) {
      if (descriptionLower.includes(keyword.toLowerCase())) {
        confidence += 0.1;
      }
    }

    return Math.min(1.0, confidence);
  }

  // 调用MCP服务器
  private async callMCPServer(method: string, params?: any): Promise<MCPResponse> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      method,
      params
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.mcpServerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      const rawText = await response.text();
      let payload: any = null;

      if (rawText) {
        try {
          payload = JSON.parse(rawText);
        } catch (parseError) {
          console.error('❌ MCP响应解析失败:', parseError, rawText);
        }
      }

      if (!response.ok) {
        const errorCode = payload?.error?.code ?? `HTTP_${response.status}`;
        throw new MCPClientError(String(errorCode), `MCP服务器错误: ${response.status} ${response.statusText}`, {
          status: response.status,
          details: payload ?? rawText
        });
      }

      if (payload?.error) {
        const errorCode = payload.error.code ?? 'MCP_ERROR';
        throw new MCPClientError(String(errorCode), payload.error.message || 'MCP返回错误', {
          status: response.status,
          details: payload.error.details ?? payload.error.data ?? payload.error
        });
      }

      if (!payload || typeof payload !== 'object') {
        throw new MCPClientError('MCP_INVALID_RESPONSE', 'MCP返回了无效的数据', {
          status: response.status,
          details: rawText
        });
      }

      return payload;
    } catch (error) {
      if (error instanceof MCPClientError) {
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new MCPClientError('MCP_TIMEOUT', 'MCP请求超时', { status: 504 });
      }

      console.error('MCP调用失败:', error);
      throw new MCPClientError('MCP_CALL_FAILED', error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// 导出单例实例
export const frontendMCPClient = new FrontendMCPClient();
