/**
 * 前端LLM客户端 - 直接调用BigModel GLM API
 * 支持浏览器环境下的LLM调用
 */

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIStreamResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class FrontendLLMClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    // 从环境变量或用户输入获取API密钥
    this.apiKey = process.env.NEXT_PUBLIC_BIGMODEL_API_KEY || 
                  (typeof window !== 'undefined' ? localStorage.getItem('user_bigmodel_api_key') : null) || 
                  '6be0ec1133ba4e9fb16b5ed76ae9f3fc.JEf38PO0DQiorzxl';
    
    console.log('🔑 LLM API密钥配置:', {
      envKey: !!process.env.NEXT_PUBLIC_BIGMODEL_API_KEY,
      localStorageKey: typeof window !== 'undefined' ? !!localStorage.getItem('user_bigmodel_api_key') : false,
      usingFallback: !process.env.NEXT_PUBLIC_BIGMODEL_API_KEY && (typeof window === 'undefined' || !localStorage.getItem('user_bigmodel_api_key'))
    });
    
    this.baseUrl = process.env.NEXT_PUBLIC_BIGMODEL_BASE_URL || 
                   'https://open.bigmodel.cn/api/paas/v4';
    
    this.model = process.env.NEXT_PUBLIC_BIGMODEL_MODEL || 'glm-4.5';
  }

  // 设置用户API密钥
  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_bigmodel_api_key', apiKey);
    }
  }

  // 检查API密钥是否有效
  hasValidApiKey(): boolean {
    return !!this.apiKey && this.apiKey.length > 10;
  }

  async chat(messages: OpenAIMessage[], options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
  } = {}): Promise<OpenAIResponse> {
    const {
      model = this.model,
      temperature = 0.7,
      max_tokens = 1024,
      stream = false
    } = options;

    if (!this.hasValidApiKey()) {
      throw new Error('API密钥未设置或无效，请在设置中配置BigModel API密钥');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens,
          stream,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`BigModel API error: ${response.status} ${error}`);
      }

      return response.json();
    } catch (error) {
      console.error('❌ BigModel API request failed:', error);
      console.error('❌ 错误类型:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('❌ 错误消息:', error instanceof Error ? error.message : String(error));
      
      // 如果是网络错误或超时，返回模拟响应
      if (error instanceof Error && (
        error.name === 'AbortError' || 
        error.message.includes('fetch failed') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('timeout')
      )) {
        console.warn('⚠️ BigModel API unavailable, using fallback response');
        return this.getFallbackResponse(messages);
      }
      
      throw error;
    }
  }

  async *chatStream(messages: OpenAIMessage[], options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  } = {}): AsyncGenerator<OpenAIStreamResponse, void, unknown> {
    const {
      model = this.model,
      temperature = 0.7,
      max_tokens = 1024
    } = options;

    if (!this.hasValidApiKey()) {
      throw new Error('API密钥未设置或无效，请在设置中配置BigModel API密钥');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens,
          stream: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`BigModel API error: ${response.status} ${error}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                return;
              }
              try {
                const parsed = JSON.parse(data);
                yield parsed;
              } catch (e) {
                console.warn('Failed to parse SSE data:', data);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('BigModel API stream failed:', error);
      
      // 如果是网络错误或超时，使用降级流式响应
      if (error instanceof Error && (
        error.name === 'AbortError' || 
        error.message.includes('fetch failed') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('timeout')
      )) {
        console.warn('BigModel API unavailable, using fallback stream');
        yield* this.getFallbackStream(messages);
        return;
      }
      
      throw error;
    }
  }

  // 专门为艺术作品对话优化的方法
  async chatAboutArtwork(
    artwork: any,
    userMessage: string,
    conversationHistory: OpenAIMessage[] = []
  ): Promise<string> {
    const systemPrompt = `你是一位专业的艺术策展人和艺术史专家。你正在与用户讨论艺术作品《${artwork.title}》。

作品信息：
- 标题：${artwork.title}
- 艺术家：${artwork.artist}
- 创作年代：${artwork.year}
- 材质：${artwork.medium}
- 尺寸：${artwork.dimensions}
- 描述：${artwork.description}
- 收藏机构：${artwork.museum}

请以专业、友好、易懂的方式回答用户的问题。你可以从以下角度来讨论：
1. 艺术史背景和意义
2. 艺术家的创作风格和技法
3. 作品的艺术价值和影响
4. 相关的历史和文化背景
5. 作品在艺术史上的地位

请用中文回答，语言要生动有趣，避免过于学术化的表达。`;

    const messages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    try {
      const response = await this.chat(messages, {
        model: this.model,
        temperature: 0.8,
        max_tokens: 1024
      });

      return response.choices[0]?.message?.content || '抱歉，我无法回答这个问题。';
    } catch (error) {
      console.error('BigModel API error:', error);
      return '抱歉，我现在无法回答您的问题，请稍后再试。';
    }
  }

  // 流式艺术作品对话
  async *chatAboutArtworkStream(
    artwork: any,
    userMessage: string,
    conversationHistory: OpenAIMessage[] = []
  ): AsyncGenerator<string, void, unknown> {
    const systemPrompt = `你是一位专业的艺术策展人和艺术史专家。你正在与用户讨论艺术作品《${artwork.title}》。

作品信息：
- 标题：${artwork.title}
- 艺术家：${artwork.artist}
- 创作年代：${artwork.year}
- 材质：${artwork.medium}
- 尺寸：${artwork.dimensions}
- 描述：${artwork.description}
- 收藏机构：${artwork.museum}

请以专业、友好、易懂的方式回答用户的问题。你可以从以下角度来讨论：
1. 艺术史背景和意义
2. 艺术家的创作风格和技法
3. 作品的艺术价值和影响
4. 相关的历史和文化背景
5. 作品在艺术史上的地位

请用中文回答，语言要生动有趣，避免过于学术化的表达。`;

    const messages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    try {
      for await (const chunk of this.chatStream(messages, {
        model: this.model,
        temperature: 0.8,
        max_tokens: 1024
      })) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      console.error('BigModel API error:', error);
      yield '抱歉，我现在无法回答您的问题，请稍后再试。';
    }
  }

  // 降级响应方法
  private getFallbackResponse(messages: OpenAIMessage[]): OpenAIResponse {
    const lastMessage = messages[messages.length - 1];
    const userInput = lastMessage?.content || '';
    
    // 根据用户输入生成简单的回复
    let fallbackContent = '抱歉，我现在无法连接到AI服务，请稍后再试。';
    
    if (userInput.includes('孤独') || userInput.includes('lonely')) {
      fallbackContent = '孤独是一种深刻的情感体验。许多伟大的艺术作品都表达了这种情感，比如梵高的《星夜》和蒙克的《呐喊》。这些作品通过色彩和构图传达了艺术家内心的孤独感。';
    } else if (userInput.includes('平静') || userInput.includes('calm')) {
      fallbackContent = '平静是一种珍贵的心境。莫奈的《睡莲》系列作品完美地捕捉了这种宁静的美感，通过柔和的色彩和流动的笔触营造出宁静祥和的氛围。';
    } else if (userInput.includes('激动') || userInput.includes('excited')) {
      fallbackContent = '激动的情感往往能激发最强烈的艺术表达。毕加索的《格尔尼卡》就是这种激情的完美体现，通过强烈的对比和动态的构图传达了艺术家内心的愤怒和激情。';
    } else if (userInput.includes('忧郁') || userInput.includes('melancholy')) {
      fallbackContent = '忧郁是一种复杂而美丽的情感。许多艺术作品都探索了这种情感，通过深沉的色调和富有表现力的构图来传达内心的忧郁和沉思。';
    } else if (userInput.includes('喜悦') || userInput.includes('joy')) {
      fallbackContent = '喜悦是艺术中最能感染人的情感之一。梵高的《向日葵》系列作品充满了生命力和乐观精神，明亮的黄色和充满活力的笔触传达出纯粹的喜悦。';
    }

    return {
      id: 'fallback-' + Date.now(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'fallback',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: fallbackContent,
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };
  }

  // 降级流式响应
  private async *getFallbackStream(messages: OpenAIMessage[]): AsyncGenerator<OpenAIStreamResponse, void, unknown> {
    const fallbackResponse = this.getFallbackResponse(messages);
    const content = fallbackResponse.choices[0].message.content;
    
    // 模拟流式输出
    const words = content.split('');
    for (let i = 0; i < words.length; i++) {
      yield {
        id: fallbackResponse.id,
        object: 'chat.completion.chunk',
        created: fallbackResponse.created,
        model: fallbackResponse.model,
        choices: [{
          index: 0,
          delta: {
            content: words[i]
          }
        }]
      };
      
      // 模拟打字延迟
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // 发送结束标记
    yield {
      id: fallbackResponse.id,
      object: 'chat.completion.chunk',
      created: fallbackResponse.created,
      model: fallbackResponse.model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'stop'
      }],
      usage: fallbackResponse.usage
    };
  }
}

// 导出单例实例
export const frontendLLMClient = new FrontendLLMClient();
