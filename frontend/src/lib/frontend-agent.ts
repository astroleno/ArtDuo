/**
 * 纯前端Agent - 智能艺术策展系统
 * 实现4阶段状态机：planning → searching → judging → complete
 */

import { frontendLLMClient, OpenAIMessage } from './frontend-llm-client';
import { frontendMCPClient, MCPClientError } from './frontend-mcp-client';
import { localCache } from './local-cache';

// Agent状态定义
export type AgentState = 'idle' | 'planning' | 'searching' | 'judging' | 'complete' | 'error';

// 艺术作品接口
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
  llmScore?: number;
  llmReason?: string;
}

// LLM分析结果
export interface LLMAnalysis {
  emotion_analysis: string;
  art_styles: string[];
  search_keywords: string[];
  recommended_artists: string[];
  curation_strategy: string;
}

// 策展结果
export interface CurationResult {
  theme: string;
  description: string;
  emotionCurve: number[];
  totalWorks: number;
}

// Agent执行结果
export interface AgentResult {
  success: boolean;
  artworks: Artwork[];
  curation: CurationResult;
  analysis: LLMAnalysis;
  source: 'mcp' | 'api' | 'fallback';
  executionTime: number;
}

class AgentError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// 前端Agent类
export class FrontendAgent {
  private state: AgentState = 'idle';
  private startTime: number = 0;
  private listeners: ((state: AgentState, data?: any) => void)[] = [];

  // 状态监听器
  onStateChange(callback: (state: AgentState, data?: any) => void) {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // 更新状态并通知监听器
  private updateState(newState: AgentState, data?: any) {
    this.state = newState;
    console.log(`🤖 Agent状态变更: ${newState}`, data);
    this.listeners.forEach(callback => callback(newState, data));
  }

  // 获取当前状态
  getState(): AgentState {
    return this.state;
  }

  // 主要执行方法
  async execute(emotion: string, userInput?: string): Promise<AgentResult> {
    this.startTime = Date.now();
    this.updateState('planning');

    try {
      // 初始化缓存
      await localCache.init();

      // 检查缓存
      const cachedResult = await localCache.getCachedArtworks(emotion, userInput);
      if (cachedResult) {
        console.log('📦 使用缓存结果');
        const executionTime = Date.now() - this.startTime;
        const result: AgentResult = {
          success: true,
          artworks: cachedResult.artworks,
          curation: cachedResult.curation,
          analysis: cachedResult.analysis,
          source: 'mcp',
          executionTime
        };
        this.updateState('complete', result);
        return result;
      }

      // Phase 1: LLM分析生成计划
      console.log('🧠 Phase 1: 开始LLM分析...');
      const analysis = await this.generateAnalysis(emotion, userInput);
      this.updateState('planning', { analysis });

      // Phase 2: 搜索艺术作品
      console.log('🔍 Phase 2: 开始搜索艺术作品...');
      this.updateState('searching');
      const artworks = await this.searchArtworks(emotion, userInput, analysis);

      // Phase 3: LLM智能判定
      console.log('⚖️ Phase 3: 开始LLM智能判定...');
      this.updateState('judging');
      const judgedArtworks = await this.judgeArtworks(artworks, analysis);

      // Phase 4: 生成最终策展结果
      console.log('🎨 Phase 4: 生成策展结果...');
      const curation = await this.generateCuration(emotion, judgedArtworks, analysis);

      const executionTime = Date.now() - this.startTime;
      const result: AgentResult = {
        success: true,
        artworks: judgedArtworks,
        curation,
        analysis,
        source: 'mcp', // 暂时标记为mcp，后续会根据实际调用情况更新
        executionTime
      };

      // 缓存结果
      await localCache.cacheArtworks(emotion, userInput, judgedArtworks, analysis, curation);

      this.updateState('complete', result);
      return result;

    } catch (error) {
      console.error('❌ Agent执行失败:', error);

      if (error instanceof AgentError) {
        this.updateState('error', {
          code: error.code,
          message: error.message,
          details: error.details
        });
        throw error;
      }

      const fallbackError = error instanceof Error ? error : new Error('Unknown agent error');
      this.updateState('error', {
        code: 'AGENT_UNKNOWN_ERROR',
        message: fallbackError.message
      });
      throw fallbackError;
    }
  }

  // Phase 1: LLM分析生成计划
  private async generateAnalysis(emotion: string, userInput?: string): Promise<LLMAnalysis> {
    const analysisPrompt = `你是一位专业的艺术策展人。用户输入了情绪关键词"${emotion}"${userInput ? `，并补充说明："${userInput}"` : ''}。

请分析这个情绪主题，并生成一个智能搜索策略来找到相关的艺术作品。请考虑：

1. 情绪分析：这个情绪的核心特征是什么？
2. 艺术风格：哪些艺术风格最能表达这种情绪？
3. 关键词策略：应该搜索哪些英文关键词来找到相关作品？
4. 艺术家推荐：哪些艺术家擅长表达这种情绪？

请以JSON格式返回分析结果：
{
  "emotion_analysis": "情绪分析",
  "art_styles": ["风格1", "风格2"],
  "search_keywords": ["关键词1", "关键词2"],
  "recommended_artists": ["艺术家1", "艺术家2"],
  "curation_strategy": "策展策略说明"
}`;

    // 检查LLM缓存
    const cachedAnalysis = await localCache.getCachedLLMResponse(analysisPrompt);
    if (cachedAnalysis && this.isValidAnalysis(cachedAnalysis)) {
      console.log('📦 使用LLM分析缓存');
      return cachedAnalysis;
    }

    const messages: OpenAIMessage[] = [
      {
        role: 'system',
        content: '你是一位专业的艺术策展人，擅长分析情绪主题并制定智能搜索策略。'
      },
      {
        role: 'user',
        content: analysisPrompt
      }
    ];

    try {
      console.log('🔗 开始调用LLM API...');
      const response = await frontendLLMClient.chat(messages, {
        model: process.env.NEXT_PUBLIC_GLM_MODEL || 'glm-4.5',
        temperature: 0.7,
        max_tokens: 800
      });

      console.log('📥 LLM API响应:', response);
      console.log('📥 LLM响应结构:', {
        choices: response.choices?.length,
        firstChoice: response.choices?.[0],
        message: response.choices?.[0]?.message,
        content: response.choices?.[0]?.message?.content
      });
      
      const analysisText = response.choices[0]?.message?.content || '{}';
      console.log('📝 LLM原始文本:', analysisText);
      console.log('📝 LLM原始文本长度:', analysisText.length);
      
      if (!analysisText || analysisText.trim() === '{}' || analysisText.trim().length < 10) {
        throw new AgentError(
          'ANALYSIS_EMPTY',
          '请更具体地描述你的情绪或场景，以便生成策展分析。',
          { reason: 'LLM_EMPTY_RESPONSE' }
        );
      }
      
      // 清理markdown格式的JSON
      let cleanText = analysisText;
      if (cleanText.includes('```json')) {
        cleanText = cleanText.replace(/```json\s*/, '').replace(/\s*```$/, '');
      }
      if (cleanText.includes('```')) {
        cleanText = cleanText.replace(/```\s*/, '').replace(/\s*```$/, '');
      }
      
      console.log('🧹 清理后的文本:', cleanText);
      const analysis = JSON.parse(cleanText);
      console.log('🧠 LLM分析结果:', analysis);

      if (!this.isValidAnalysis(analysis)) {
        throw new AgentError(
          'ANALYSIS_EMPTY',
          '请更具体地描述你的情绪或场景，以便生成策展分析。',
          { reason: 'INVALID_ANALYSIS', analysis }
        );
      }

      // 缓存LLM响应
      await localCache.cacheLLMResponse(analysisPrompt, analysis);

      return analysis;

    } catch (error) {
      if (error instanceof AgentError) {
        throw error;
      }

      console.error('❌ LLM分析失败:', error);
      console.error('❌ 错误详情:', error instanceof Error ? error.message : String(error));

      throw new AgentError(
        'LLM_ANALYSIS_FAILED',
        '分析服务暂时不可用，请稍后再试。',
        { emotion, userInput, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Phase 2: 搜索艺术作品
  private async searchArtworks(emotion: string, userInput?: string, analysis?: LLMAnalysis): Promise<Artwork[]> {
    const enableMCP = process.env.NEXT_PUBLIC_ENABLE_MCP === 'true';

    if (!enableMCP) {
      console.log('⚙️ MCP 已关闭，使用本地降级数据');
      return this.getMockArtworks(emotion);
    }

    try {
      console.log('🔍 使用MCP搜索艺术作品...');
      const mcpResult = await frontendMCPClient.searchArtworks(emotion, userInput, analysis);

      if (!mcpResult.success) {
        throw new AgentError(
          'MCP_SEARCH_FAILED',
          '艺术作品检索服务暂时不可用，请稍后再试。',
          { source: mcpResult.source }
        );
      }

      if (!mcpResult.artworks || mcpResult.artworks.length === 0) {
        throw new AgentError(
          'MCP_NO_RESULTS',
          '没有找到匹配的作品，请尝试换一个情绪或补充更多描述。',
          { totalFound: mcpResult.totalFound }
        );
      }

      console.log('✅ MCP搜索成功:', mcpResult.artworks.length, '件作品');
      return mcpResult.artworks;

    } catch (error) {
      if (error instanceof AgentError) {
        throw error;
      }

      console.error('搜索艺术作品失败:', error);

      if (error instanceof MCPClientError) {
        if (error.code === 'MCP_NO_RESULTS') {
          throw new AgentError('MCP_NO_RESULTS', '没有找到匹配的作品，请尝试换一个情绪或补充更多描述。', {
            code: error.code,
            status: error.status,
            details: error.details
          });
        }

        console.warn('⚠️ MCP服务不可用，降级到本地数据');
        return this.getMockArtworks(emotion);
      }

      console.warn('⚠️ MCP未知错误，降级到本地数据');
      return this.getMockArtworks(emotion);
    }
  }

  // 获取模拟艺术作品数据（MCP关闭或失败时使用）
  private getMockArtworks(emotion: string): Artwork[] {
    const mockArtworks: Artwork[] = [
      {
        id: 'mock-1',
        title: '星夜',
        artist: '文森特·梵高',
        year: '1889',
        medium: '布面油画',
        dimensions: '73.7 × 92.1 cm',
        description: '这幅画展现了梵高内心世界的孤独与渴望，旋转的星空象征着艺术家内心的动荡。',
        imageUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DT1567.jpg',
        museum: '纽约现代艺术博物馆',
        license: 'Public Domain'
      },
      {
        id: 'mock-2',
        title: '呐喊',
        artist: '爱德华·蒙克',
        year: '1893',
        medium: '蛋彩画、蜡笔画、纸板',
        dimensions: '91 × 73.5 cm',
        description: '表现主义代表作，表达了现代人内心的焦虑和恐惧。',
        imageUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DP130155.jpg',
        museum: '挪威国家美术馆',
        license: 'Public Domain'
      },
      {
        id: 'mock-3',
        title: '睡莲',
        artist: '克劳德·莫奈',
        year: '1919',
        medium: '布面油画',
        dimensions: '100 × 200 cm',
        description: '莫奈晚年的代表作，展现了宁静祥和的自然之美。',
        imageUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DT1914.jpg',
        museum: '橘园美术馆',
        license: 'Public Domain'
      }
    ];

    console.log('🔍 返回降级数据:', mockArtworks.length, '件');
    return mockArtworks;
  }

  // Phase 3: LLM智能判定
  private async judgeArtworks(artworks: Artwork[], analysis: LLMAnalysis): Promise<Artwork[]> {
    const judgedArtworks: Artwork[] = [];

    for (const artwork of artworks) {
      try {
        const judgmentPrompt = `请对以下艺术作品进行评分和理由说明：

艺术作品信息：
- 标题：${artwork.title}
- 艺术家：${artwork.artist}
- 描述：${artwork.description}

情绪主题分析：${analysis.emotion_analysis}
策展策略：${analysis.curation_strategy}

请从以下维度评分（1-10分）：
1. 与情绪主题的契合度
2. 艺术价值和影响力
3. 视觉表现力
4. 整体推荐度

请以JSON格式返回：
{
  "overall_score": 8.5,
  "reason": "详细评分理由"
}`;

        const messages: OpenAIMessage[] = [
          {
            role: 'system',
            content: '你是一位专业的艺术策展人，擅长评估艺术作品与展览主题的契合度。'
          },
          {
            role: 'user',
            content: judgmentPrompt
          }
        ];

        const response = await frontendLLMClient.chat(messages, {
          model: process.env.NEXT_PUBLIC_GLM_MODEL || 'glm-4.5',
          temperature: 0.5,
          max_tokens: 300
        });

        const judgmentText = response.choices[0]?.message?.content || '{}';
        const judgment = JSON.parse(judgmentText);

        judgedArtworks.push({
          ...artwork,
          llmScore: judgment.overall_score || 7.0,
          llmReason: judgment.reason || '这是一件优秀的艺术作品'
        });

      } catch (error) {
        console.error('LLM判定失败:', error);
        // 如果判定失败，使用默认分数
        judgedArtworks.push({
          ...artwork,
          llmScore: 7.0,
          llmReason: '这是一件优秀的艺术作品'
        });
      }
    }

    // 按LLM评分排序
    judgedArtworks.sort((a, b) => (b.llmScore || 0) - (a.llmScore || 0));
    console.log('⚖️ LLM判定完成，按评分排序');
    return judgedArtworks;
  }

  // Phase 4: 生成策展结果
  private async generateCuration(emotion: string, artworks: Artwork[], analysis: LLMAnalysis): Promise<CurationResult> {
    const curationPrompt = `基于以下分析结果和艺术作品，生成一个专业的策展说明：

情绪主题：${emotion}
LLM分析：${JSON.stringify(analysis, null, 2)}
艺术作品数量：${artworks.length}
平均LLM评分：${(artworks.reduce((sum, a) => sum + (a.llmScore || 0), 0) / artworks.length).toFixed(1)}

请生成一个简洁而专业的策展说明，解释这个展览如何体现"${emotion}"这个情绪主题。`;

    const messages: OpenAIMessage[] = [
      {
        role: 'system',
        content: '你是一位专业的艺术策展人，擅长撰写展览说明。'
      },
      {
        role: 'user',
        content: curationPrompt
      }
    ];

    try {
      const response = await frontendLLMClient.chat(messages, {
        model: process.env.NEXT_PUBLIC_GLM_MODEL || 'glm-4.5',
        temperature: 0.8,
        max_tokens: 512
      });

      const description = response.choices[0]?.message?.content || '这是一个精心策划的艺术展览，展现了情感的深度和艺术的魅力。';
      
      // 生成情绪曲线
      const emotionCurve = this.generateEmotionCurve(artworks);

      return {
        theme: emotion,
        description,
        emotionCurve,
        totalWorks: artworks.length
      };

    } catch (error) {
      console.error('策展说明生成失败:', error);
      return {
        theme: emotion,
        description: '这是一个精心策划的艺术展览，展现了情感的深度和艺术的魅力。',
        emotionCurve: this.generateEmotionCurve(artworks),
        totalWorks: artworks.length
      };
    }
  }

  // 生成情绪曲线
  private generateEmotionCurve(artworks: Artwork[]): number[] {
    const curve: number[] = [];
    const total = artworks.length;
    
    for (let i = 0; i < total; i++) {
      // 基于LLM评分生成情绪强度
      const baseIntensity = (artworks[i].llmScore || 7.0) / 10;
      // 添加一些变化，让曲线更自然
      const variation = Math.sin((i / total) * Math.PI * 2) * 0.2;
      const intensity = Math.max(0.1, Math.min(1.0, baseIntensity + variation));
      curve.push(Number(intensity.toFixed(2)));
    }
    
    return curve;
  }

  private isValidAnalysis(data: any): data is LLMAnalysis {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const hasEmotionAnalysis = typeof data.emotion_analysis === 'string' && data.emotion_analysis.trim().length > 0;
    const hasKeywords = Array.isArray(data.search_keywords) && data.search_keywords.length > 0;
    const hasStyles = Array.isArray(data.art_styles);
    const hasStrategy = typeof data.curation_strategy === 'string' && data.curation_strategy.trim().length > 0;

    return hasEmotionAnalysis && hasKeywords && hasStyles && hasStrategy;
  }

  // 生成智能的默认分析结果
  private generateDefaultAnalysis(emotion: string, userInput?: string): LLMAnalysis {
    // 情绪关键词映射
    const emotionMappings: Record<string, any> = {
      '开心': {
        emotion_analysis: '开心是一种积极向上的情绪，代表着快乐、满足和乐观的心态。',
        art_styles: ['印象派', '表现主义', '后印象派'],
        search_keywords: ['joy', 'happiness', 'celebration', 'festival', 'sunshine'],
        recommended_artists: ['Vincent van Gogh', 'Claude Monet', 'Pierre-Auguste Renoir'],
        curation_strategy: '通过明亮色彩和欢快主题展现快乐的本质'
      },
      '孤独': {
        emotion_analysis: '孤独是一种深刻的情感体验，代表着内心的寂寞和渴望连接。',
        art_styles: ['表现主义', '超现实主义', '象征主义'],
        search_keywords: ['loneliness', 'solitude', 'melancholy', 'isolation', 'contemplation'],
        recommended_artists: ['Edvard Munch', 'Vincent van Gogh', 'Caspar David Friedrich'],
        curation_strategy: '通过深沉色调和孤独场景传达内心的寂寞感'
      },
      '平静': {
        emotion_analysis: '平静是一种宁静祥和的心境，代表着内心的安宁和平衡。',
        art_styles: ['印象派', '极简主义', '禅意艺术'],
        search_keywords: ['peace', 'serenity', 'calm', 'tranquility', 'meditation'],
        recommended_artists: ['Claude Monet', 'Mark Rothko', 'Agnes Martin'],
        curation_strategy: '通过柔和色彩和宁静构图营造平和氛围'
      },
      '忧郁': {
        emotion_analysis: '忧郁是一种复杂而美丽的情感，代表着深沉的思考和内心的波动。',
        art_styles: ['浪漫主义', '象征主义', '表现主义'],
        search_keywords: ['melancholy', 'sadness', 'blue', 'contemplation', 'nostalgia'],
        recommended_artists: ['Caspar David Friedrich', 'Edvard Munch', 'Egon Schiele'],
        curation_strategy: '通过深沉色调和富有表现力的构图传达忧郁之美'
      },
      '激动': {
        emotion_analysis: '激动是一种强烈的情感状态，代表着内心的激情和活力。',
        art_styles: ['表现主义', '未来主义', '抽象表现主义'],
        search_keywords: ['excitement', 'passion', 'energy', 'dynamism', 'intensity'],
        recommended_artists: ['Wassily Kandinsky', 'Jackson Pollock', 'Willem de Kooning'],
        curation_strategy: '通过动态构图和强烈色彩展现激情的爆发力'
      }
    };

    // 获取对应情绪的分析，如果没有则使用通用分析
    const analysis = emotionMappings[emotion] || {
      emotion_analysis: `这是一个关于"${emotion}"情绪的艺术策展，展现了情感的深度和多样性。`,
      art_styles: ['表现主义', '印象派', '现代艺术'],
      search_keywords: [emotion, 'emotion', 'feeling', 'art'],
      recommended_artists: ['Vincent van Gogh', 'Pablo Picasso', 'Claude Monet'],
      curation_strategy: '通过艺术作品展现情绪的深度和多样性'
    };

    // 如果有用户输入，增强搜索关键词
    if (userInput && userInput !== emotion) {
      analysis.search_keywords.push(userInput);
    }

    return analysis;
  }
}

// 导出单例实例
export const frontendAgent = new FrontendAgent();
