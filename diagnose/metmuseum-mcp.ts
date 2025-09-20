// Met Museum MCP 服务组件
import { Artwork, ArtworkService, ArtworkServiceResponse, CurationInfo } from './types';

export class MetMuseumMCPService implements ArtworkService {
  private serviceName = 'MetMuseumMCP';
  
  async isAvailable(): Promise<boolean> {
    try {
      console.log('🔍 检查Met Museum MCP服务可用性...');
      
      // 尝试调用MCP服务来检查可用性
      const testResult = await this.callMCPServer('list-departments', {});
      return testResult !== null;
    } catch (error) {
      console.error('❌ Met Museum MCP服务检查失败:', error);
      return false;
    }
  }

  async searchArtworks(emotion: string, userInput?: string, llmAnalysis?: any): Promise<ArtworkServiceResponse> {
    console.log('🎨 Met Museum MCP服务 - 搜索作品:', emotion, userInput);
    
    try {
      // 构建搜索查询 - 优先使用LLM分析结果
      const searchQuery = this.buildSearchQuery(emotion, userInput, llmAnalysis);
      console.log('🔍 MCP搜索查询:', searchQuery);
      
      // 第一步：只获取作品ID列表（轻量级搜索）
      const searchResult = await this.callMCPServer('search-museum-objects', {
        q: searchQuery,
        hasImages: true,
        title: false
      });
      
      if (!searchResult || !searchResult.content) {
        console.log('⚠️ MCP搜索没有返回结果');
        return this.createEmptyResponse(emotion);
      }
      
      // 解析搜索结果获取objectIDs
      const objectIDs = this.parseSearchResult(searchResult.content);
      if (objectIDs.length === 0) {
        console.log('⚠️ MCP搜索没有找到作品ID');
        return this.createEmptyResponse(emotion);
      }
      
      console.log(`🔍 找到 ${objectIDs.length} 个作品ID，开始获取详情...`);
      
      // 第二步：渐进式获取作品详情（避免并发风暴，按置信度筛选）
      const artworks = await this.getArtworksWithLimit(objectIDs, emotion, 9);
      
      console.log('✅ MCP服务成功获取', artworks.length, '个作品');
      
      return {
        success: true,
        artworks,
        curation: {
          theme: emotion,
          description: `通过智能语义搜索，为您找到了${artworks.length}件与"${emotion}"相关的艺术作品。这些作品来自大都会艺术博物馆的珍贵收藏。`,
          emotionCurve: this.generateEmotionCurve(emotion, artworks),
          totalWorks: artworks.length
        },
        source: 'mcp'
      };
    } catch (error) {
      console.error('❌ Met Museum MCP服务调用失败:', error);
      throw error;
    }
  }

  private buildSearchQuery(emotion: string, userInput?: string, llmAnalysis?: any): string {
    // 优先使用LLM分析结果中的搜索关键词
    if (llmAnalysis && llmAnalysis.search_keywords && llmAnalysis.search_keywords.length > 0) {
      console.log('🧠 使用LLM分析的关键词:', llmAnalysis.search_keywords);
      const primaryKeyword = llmAnalysis.search_keywords[0];
      return userInput ? `${primaryKeyword} ${userInput}` : primaryKeyword;
    }
    
    // 回退到默认关键词映射
    const emotionKeywords: { [key: string]: string[] } = {
      '孤独': ['lonely', 'solitude', 'isolation', 'melancholy'],
      '平静': ['calm', 'peaceful', 'serene', 'tranquil'],
      '激动': ['excited', 'dynamic', 'energetic', 'passionate'],
      '忧郁': ['melancholy', 'sad', 'blue', 'gloomy'],
      '喜悦': ['joy', 'happy', 'cheerful', 'bright'],
      '沉思': ['contemplative', 'thoughtful', 'meditative', 'reflective']
    };
    
    const keywords = emotionKeywords[emotion] || [emotion];
    const baseQuery = keywords[0]; // 使用第一个关键词作为主要搜索词
    
    return userInput ? `${baseQuery} ${userInput}` : baseQuery;
  }

  private calculateConfidence(emotion: string, artwork: Artwork): number {
    // 计算作品与情绪的相关性置信度
    const emotionKeywords: { [key: string]: string[] } = {
      '孤独': ['lonely', 'solitude', 'isolation', 'melancholy', 'alone', 'sad', 'blue'],
      '平静': ['calm', 'peaceful', 'serene', 'tranquil', 'quiet', 'still', 'gentle'],
      '激动': ['excited', 'dynamic', 'energetic', 'passionate', 'intense', 'vibrant'],
      '忧郁': ['melancholy', 'sad', 'blue', 'gloomy', 'dark', 'mournful'],
      '喜悦': ['joy', 'happy', 'cheerful', 'bright', 'colorful', 'lively'],
      '沉思': ['contemplative', 'thoughtful', 'meditative', 'reflective', 'deep']
    };
    
    const keywords = emotionKeywords[emotion] || [emotion];
    const title = artwork.title.toLowerCase();
    const description = artwork.description.toLowerCase();
    const artist = artwork.artist.toLowerCase();
    
    let score = 0;
    let totalChecks = 0;
    
    // 检查标题中的关键词
    for (const keyword of keywords) {
      totalChecks++;
      if (title.includes(keyword)) {
        score += 3; // 标题匹配权重最高
      }
    }
    
    // 检查描述中的关键词
    for (const keyword of keywords) {
      totalChecks++;
      if (description.includes(keyword)) {
        score += 2; // 描述匹配权重中等
      }
    }
    
    // 检查艺术家名称中的关键词
    for (const keyword of keywords) {
      totalChecks++;
      if (artist.includes(keyword)) {
        score += 1; // 艺术家匹配权重较低
      }
    }
    
    // 计算置信度百分比
    const maxScore = totalChecks * 3; // 最大可能分数
    const confidence = maxScore > 0 ? (score / maxScore) * 100 : 0;
    
    return Math.min(confidence, 100); // 限制在100%以内
  }

  private parseSearchResult(content: string): number[] {
    try {
      // 从搜索结果中提取objectIDs
      // 搜索结果格式通常是："Total objects found: 54\nObject IDs: 436532, 789578, 436840, 438722,..."
      const lines = content.split('\n');
      const objectIDsLine = lines.find(line => line.includes('Object IDs:'));
      
      if (objectIDsLine) {
        const idsString = objectIDsLine.split('Object IDs:')[1].trim();
        return idsString.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      }
      
      return [];
    } catch (error) {
      console.error('❌ 解析搜索结果失败:', error);
      return [];
    }
  }

  private async getArtworksWithLimit(objectIDs: number[], emotion: string, maxResults: number = 9): Promise<Artwork[]> {
    const artworks: Artwork[] = [];
    const limit = 2; // 减少并发数，避免超时
    const minConfidence = 30; // 最低置信度阈值
    
    console.log(`🔍 开始渐进式获取作品，目标数量: ${maxResults}，最低置信度: ${minConfidence}%`);
    
    for (let i = 0; i < objectIDs.length && artworks.length < maxResults; i += limit) {
      const batch = objectIDs.slice(i, i + limit);
      console.log(`📦 处理批次 ${Math.floor(i/limit) + 1}，作品ID: ${batch.join(', ')}`);
      
      const batchPromises = batch.map(async (objectID) => {
        try {
          const startTime = Date.now();
          const objectDetail = await this.callMCPServer('get-museum-object', {
            objectId: objectID,
            returnImage: false
          });
          const fetchTime = Date.now() - startTime;
          
          if (objectDetail && objectDetail.content) {
            const artwork = this.convertMCPArtworkFromText(objectDetail.content);
            const confidence = this.calculateConfidence(emotion, artwork);
            
            console.log(`✅ 作品 ${objectID}: ${fetchTime}ms, 置信度: ${confidence.toFixed(1)}% - ${artwork.title}`);
            
            return { artwork, confidence, fetchTime };
          }
          return null;
        } catch (error) {
          console.error(`❌ 获取作品 ${objectID} 详情失败:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      // 过滤并排序结果
      const validResults = batchResults
        .filter(result => result !== null)
        .filter(result => result.confidence >= minConfidence)
        .sort((a, b) => b.confidence - a.confidence); // 按置信度降序排列
      
      // 添加到结果中
      for (const result of validResults) {
        if (artworks.length < maxResults) {
          artworks.push(result.artwork);
          console.log(`🎯 已选择作品 ${artworks.length}/${maxResults}: ${result.artwork.title} (置信度: ${result.confidence.toFixed(1)}%)`);
        }
      }
      
      // 如果已经找到足够的作品，提前结束
      if (artworks.length >= maxResults) {
        console.log(`🎉 已找到足够的作品，提前结束搜索`);
        break;
      }
      
      // 添加延迟避免请求过于频繁
      if (i + limit < objectIDs.length) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
    
    console.log(`📊 最终结果: 找到 ${artworks.length} 个高质量作品`);
    return artworks;
  }

  private convertMCPArtworkFromText(content: string): Artwork {
    // 从文本内容中解析作品信息
    // 格式：Title: Sunflowers\nArtist: Vincent van Gogh\n...
    const lines = content.split('\n');
    const artwork: any = {};
    
    for (const line of lines) {
      const [key, value] = line.split(':').map(s => s.trim());
      if (key && value) {
        switch (key.toLowerCase()) {
          case 'title':
            artwork.title = value;
            break;
          case 'artist':
            artwork.artist = value;
            break;
          case 'medium':
            artwork.medium = value;
            break;
          case 'dimensions':
            artwork.dimensions = value;
            break;
          case 'primary image url':
            artwork.imageUrl = value;
            break;
        }
      }
    }
    
    return {
      id: Math.random().toString(),
      title: artwork.title || '未知作品',
      artist: artwork.artist || '未知艺术家',
      year: '未知年代',
      medium: artwork.medium || '未知材质',
      dimensions: artwork.dimensions || '未知尺寸',
      imageUrl: artwork.imageUrl || 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop&auto=format&q=80',
      description: '这是一件来自大都会艺术博物馆的珍贵作品。',
      museum: '大都会艺术博物馆',
      license: 'CC0'
    };
  }

  private createEmptyResponse(emotion: string): ArtworkServiceResponse {
    return {
      success: false,
      artworks: [],
      curation: {
        theme: emotion,
        description: '',
        emotionCurve: [],
        totalWorks: 0
      },
      source: 'mcp'
    };
  }

  private async callMCPServer(toolName: string, args: any): Promise<any> {
    try {
      console.log('📡 调用MCP服务器，工具:', toolName, '参数:', args);
      
      // 使用Python MCP客户端调用MCP服务
      const { spawn } = require('child_process');
      
      return new Promise((resolve, reject) => {
        // 创建Python脚本来调用MCP服务
        const pythonScript = `
import asyncio
import json
import sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def call_mcp_tool():
    server = StdioServerParameters(
        command="npx",
        args=["-y", "metmuseum-mcp"]
    )
    
    try:
        async with stdio_client(server) as (read, write):
            async with ClientSession(read, write) as session:
                result = await session.call_tool("${toolName}", arguments=${JSON.stringify(args)})
                print(json.dumps({
                    "success": True,
                    "content": result.content[0].text if result.content else "",
                    "isError": result.isError
                }))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))

asyncio.run(call_mcp_tool())
        `;
        
        const pythonProcess = spawn('python', ['-c', pythonScript], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true
        });
        
        let output = '';
        let errorOutput = '';
        
        pythonProcess.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });
        
        // 设置超时
        const timeout = setTimeout(() => {
          pythonProcess.kill();
          reject(new Error('MCP服务调用超时'));
        }, 30000);
        
        pythonProcess.on('close', (code: number) => {
          clearTimeout(timeout);
          console.log('📥 Python MCP输出:', output);
          console.log('📥 Python MCP错误输出:', errorOutput);
          
          if (code === 0) {
            try {
              const result = JSON.parse(output.trim());
              console.log('📥 解析结果:', result);
              
              if (result.success) {
                console.log('✅ MCP服务调用成功');
                resolve(result);
              } else {
                console.error('❌ MCP服务调用失败:', result.error);
                reject(new Error(result.error));
              }
            } catch (parseError) {
              console.error('❌ MCP服务返回数据解析失败:', parseError);
              console.error('❌ 原始输出:', output);
              reject(parseError);
            }
          } else {
            console.error('❌ Python MCP进程失败，退出码:', code);
            console.error('❌ 错误输出:', errorOutput);
            reject(new Error(`Python MCP进程失败: ${errorOutput}`));
          }
        });
        
        pythonProcess.on('error', (error: Error) => {
          clearTimeout(timeout);
          console.error('❌ Python MCP进程错误:', error);
          reject(error);
        });
      });
    } catch (error) {
      console.error('❌ MCP服务调用异常:', error);
      throw error;
    }
  }

  private convertMCPArtwork(mcpArtwork: any): Artwork {
    return {
      id: mcpArtwork.objectID?.toString() || mcpArtwork.id || Math.random().toString(),
      title: mcpArtwork.title || '未知作品',
      artist: mcpArtwork.artistDisplayName || mcpArtwork.artist || '未知艺术家',
      year: mcpArtwork.objectDate || mcpArtwork.year || '未知年代',
      medium: mcpArtwork.medium || '未知材质',
      dimensions: mcpArtwork.dimensions || '未知尺寸',
      imageUrl: mcpArtwork.primaryImage || mcpArtwork.imageUrl || 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop&auto=format&q=80',
      description: mcpArtwork.culture || mcpArtwork.period || mcpArtwork.description || '这是一件来自大都会艺术博物馆的珍贵作品。',
      museum: '大都会艺术博物馆',
      license: 'CC0'
    };
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
