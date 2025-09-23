// 统一LLM客户端 - 自动选择最佳可用的LLM服务
import { configManager } from './config-manager';

/**
 * LLM消息接口
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * LLM响应接口
 */
export interface LLMResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      reasoning_content?: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * LLM调用选项
 */
export interface LLMOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  response_format?: { type: 'json_object' };
  thinking?: 'enabled' | 'disabled';
}

/**
 * 统一LLM客户端
 */
export class UnifiedLLMClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private provider: 'openai' | 'glm';
  
  constructor() {
    const config = configManager.getLLMConfig();
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.model = config.model;
    this.provider = config.provider;
    
    console.log(`🧠 统一LLM客户端初始化: ${this.provider.toUpperCase()}, 模型: ${this.model}`);
  }
  
  /**
   * 聊天补全
   */
  async chat(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const {
      model = this.model,
      temperature = 0.7,
      max_tokens = 1024,
      stream = false,
      response_format,
      thinking
    } = options;
    
    // 构建请求体
    const requestBody: any = {
      model,
      messages,
      temperature,
      max_tokens,
      stream
    };
    
    // 添加特定提供商的参数
    if (this.provider === 'glm') {
      // GLM特有参数
      if (response_format) {
        requestBody.response_format = response_format;
      }
      if (thinking) {
        requestBody.thinking = thinking;
      }
    } else if (this.provider === 'openai') {
      // OpenAI特有参数
      if (response_format) {
        requestBody.response_format = response_format;
      }
      // OpenAI不支持thinking参数，忽略
    }
    
    try {
      console.log(`🧠 调用${this.provider.toUpperCase()} LLM:`, {
        model,
        messages: messages.length,
        temperature,
        max_tokens,
        hasResponseFormat: !!response_format,
        thinking: thinking || 'default'
      });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ ${this.provider.toUpperCase()} API错误:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`${this.provider.toUpperCase()} API error: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      
      console.log(`✅ ${this.provider.toUpperCase()} LLM调用成功:`, {
        model: result.model,
        usage: result.usage,
        finishReason: result.choices[0]?.finish_reason
      });
      
      return result;
      
    } catch (error) {
      console.error(`❌ ${this.provider.toUpperCase()} LLM调用失败:`, error);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`${this.provider.toUpperCase()} API调用超时`);
      }
      
      throw error;
    }
  }
  
  /**
   * 检查API密钥是否有效
   */
  hasValidApiKey(): boolean {
    return !!this.apiKey && this.apiKey.length > 10;
  }
  
  /**
   * 获取当前提供商信息
   */
  getProviderInfo(): {
    provider: string;
    model: string;
    hasValidKey: boolean;
  } {
    return {
      provider: this.provider,
      model: this.model,
      hasValidKey: this.hasValidApiKey()
    };
  }
}

// 导出单例实例
export const unifiedLLMClient = new UnifiedLLMClient();
