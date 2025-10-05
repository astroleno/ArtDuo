// 智谱AI GLM-4.5 优化客户端 - 利用批处理和thinking模式
// 基于: https://docs.bigmodel.cn/cn/api/introduction

export interface GLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GLMResponse {
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

export interface GLMBatchRequest {
  custom_id: string;
  method: string;
  url: string;
  body: {
    model: string;
    messages: GLMMessage[];
    temperature?: number;
    max_tokens?: number;
    thinking?: 'enabled' | 'disabled';
  };
}

export interface GLMBatchResponse {
  id: string;
  custom_id: string;
  response: {
    status_code: number;
    request_id: string;
    body: GLMResponse;
  };
  error?: {
    code: string;
    message: string;
  };
}

export class GLMOptimizedClient {
  private apiKey: string;
  private defaultModel: string;
  private baseUrl: string = 'https://open.bigmodel.cn/api/paas/v4';
  private batchUrl: string = 'https://open.bigmodel.cn/api/paas/v4/batches';
  private filesUrl: string = 'https://open.bigmodel.cn/api/paas/v4/files';

  constructor() {
    // 优先使用进程环境变量
    let apiKey = process.env.NEXT_PUBLIC_GLM_API_KEY || process.env.GLM_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
    let defaultModel = 'glm-4.5-air'; // 默认使用 glm-4.5-air

    // 若未取到，则尝试读取 .env.local（仅在Node环境有效）
    if (!apiKey) {
      try {
        // 仅在服务器侧运行时可用；Next.js dev 会在node侧执行
        // 简单解析 key=value 行
        // 注意：这里不引入 dotenv 依赖，避免额外包
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fs = require('fs');
        const path = require('path');
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
          const raw = fs.readFileSync(envPath, 'utf8');
          const lines = raw.split(/\r?\n/);
          for (const line of lines) {
            const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
            if (!m) continue;
            const k = m[1];
            let v = m[2];
            if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
            if (k === 'NEXT_PUBLIC_GLM_API_KEY' || k === 'GLM_API_KEY' || k === 'NEXT_PUBLIC_OPENAI_API_KEY') {
              apiKey = apiKey || v;
            }
            if (k === 'NEXT_PUBLIC_GLM_MODEL' || k === 'GLM_MODEL') {
              defaultModel = v || defaultModel;
            }
          }
        }
      } catch {
        // 忽略读取错误，继续尝试 JSON 兜底
      }
    }

    // 尝试从 env.local.json 读取配置（无论API key是否存在）
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs');
      const path = require('path');
      const jsonPath = path.resolve(process.cwd(), 'env.local.json');
      if (fs.existsSync(jsonPath)) {
        const obj = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        // 如果API key还没获取到，尝试从JSON读取
        if (!apiKey) {
          apiKey = obj.NEXT_PUBLIC_GLM_API_KEY || obj.GLM_API_KEY || obj.NEXT_PUBLIC_OPENAI_API_KEY || '';
        }
        // 总是尝试从JSON读取模型配置
        const jsonModel = obj.NEXT_PUBLIC_GLM_MODEL || obj.GLM_MODEL;
        if (jsonModel) {
          defaultModel = jsonModel;
        }
      }
    } catch {
      // 忽略读取错误
    }

    this.apiKey = apiKey || '';
    this.defaultModel = defaultModel;
    console.log('🔑 GLM客户端初始化:', {
      apiKeyLength: this.apiKey ? this.apiKey.length : 0,
      defaultModel: this.defaultModel
    });
  }

  hasValidApiKey(): boolean {
    const isValid = !!this.apiKey && this.apiKey.length > 10;
    console.log('🔑 GLM API密钥检查:', isValid ? '有效' : '无效');
    return isValid;
  }

  /**
   * 快速调用 - 禁用thinking模式，用于简单任务
   */
  async quickChat(
    messages: GLMMessage[], 
    options: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
      response_format?: { type: 'json_object' };
    } = {}
  ): Promise<GLMResponse> {
    const {
      model = this.defaultModel,
      temperature = 0.1, // 低温度，快速响应
      max_tokens = 512   // 限制token数量
    } = options;

    return this.chat(messages, {
      model,
      temperature,
      max_tokens,
      thinking: 'disabled', // 禁用推理，提高速度
      response_format: options.response_format
    });
  }

  /**
   * 深度分析调用 - 启用thinking模式，用于复杂任务
   */
  async deepAnalysis(
    messages: GLMMessage[], 
    options: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
      response_format?: { type: 'json_object' };
    } = {}
  ): Promise<GLMResponse> {
    const {
      model = this.defaultModel,
      temperature = 0.3,
      max_tokens = 2048
    } = options;

    return this.chat(messages, {
      model,
      temperature,
      max_tokens,
      thinking: 'enabled', // 启用推理，提高质量
      response_format: options.response_format
    });
  }

  /**
   * 基础聊天调用
   */
  async chat(
    messages: GLMMessage[], 
    options: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
      thinking?: 'enabled' | 'disabled';
      response_format?: { type: 'json_object' };
    } = {}
  ): Promise<GLMResponse> {
    const {
      model = this.defaultModel,
      temperature = 0.3,
      max_tokens = 1024,
      thinking = 'disabled'
    } = options;

    if (!this.hasValidApiKey()) {
      throw new Error('GLM API 密钥未配置或无效');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时，增加容错

      const requestBody: any = {
        model,
        messages,
        temperature,
        max_tokens,
      };

      // 只有在启用thinking模式时才添加thinking参数
      if (thinking === 'enabled') {
        requestBody.thinking = {
          enabled: true
        };
        console.log('🧠 启用thinking模式');
      } else {
        console.log('⚡ 禁用thinking模式，快速响应');
      }

      // JSON 模式强约束（可选）
      if (options.response_format?.type === 'json_object') {
        requestBody.response_format = { type: 'json_object' };
      }

      // 调试：打印请求体
      console.log('🔍 GLM API 请求体:', JSON.stringify(requestBody, null, 2));

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
        const error = await response.text();
        throw new Error(`GLM API error: ${response.status} ${error}`);
      }

      return response.json();
    } catch (error) {
      console.error('GLM API request failed:', error);
      throw error;
    }
  }

  /**
   * 批处理调用 - 使用并发请求模拟批处理
   */
  async batchProcess(
    requests: Array<{
      custom_id: string;
      messages: GLMMessage[];
      options?: {
        model?: string;
        temperature?: number;
        max_tokens?: number;
        thinking?: 'enabled' | 'disabled';
      };
    }>
  ): Promise<GLMBatchResponse[]> {
    if (!this.hasValidApiKey()) {
      throw new Error('GLM API 密钥未配置或无效');
    }

    console.log(`🚀 开始批处理 ${requests.length} 个请求...`);

    try {
      // 使用并发请求模拟批处理，避免复杂的批处理API
      const promises = requests.map(async (req) => {
        try {
          const response = await this.chat(req.messages, {
            model: req.options?.model || this.defaultModel,
            temperature: req.options?.temperature || 0.3,
            max_tokens: req.options?.max_tokens || 1024,
            thinking: req.options?.thinking || 'disabled'
          });

          return {
            id: `batch_${Date.now()}_${Math.random()}`,
            custom_id: req.custom_id,
            response: {
              status_code: 200,
              request_id: `req_${Date.now()}_${Math.random()}`,
              body: response
            }
          };
        } catch (error) {
          console.error(`批处理请求失败 (${req.custom_id}):`, error);
          return {
            id: `batch_${Date.now()}_${Math.random()}`,
            custom_id: req.custom_id,
            error: {
              code: 'REQUEST_FAILED',
              message: error instanceof Error ? error.message : 'Unknown error'
            }
          };
        }
      });

      const results = await Promise.allSettled(promises);
      const batchResponses: GLMBatchResponse[] = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            id: `batch_${Date.now()}_${Math.random()}`,
            custom_id: requests[index].custom_id,
            error: {
              code: 'PROMISE_REJECTED',
              message: result.reason instanceof Error ? result.reason.message : 'Promise rejected'
            }
          };
        }
      });

      console.log(`✅ 批处理完成: ${batchResponses.length} 个响应`);
      return batchResponses;
    } catch (error) {
      console.error('批处理请求失败:', error);
      throw error;
    }
  }


  /**
   * 真实 Batch API：上传 JSONL → 创建批处理 → 轮询完成 → 下载结果
   * 参考文档: https://docs.bigmodel.cn/cn/guide/tools/batch
   */
  async batchChatViaBigmodelJSONL(jsonlContent: string, endpoint: string = '/v4/chat/completions') {
    if (!this.hasValidApiKey()) {
      throw new Error('GLM API 密钥未配置或无效');
    }

    try {
      // 1) 上传 JSONL 文件
      const form = new FormData();
      form.append('purpose', 'batch');
      // 将 JSONL 内容作为文件上传
      const file = new Blob([jsonlContent], { type: 'application/jsonl' });
      form.append('file', file, 'requests.jsonl');

      const uploadResp = await fetch(this.filesUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        body: form
      });
      if (!uploadResp.ok) {
        const err = await uploadResp.text();
        throw new Error(`文件上传失败: ${uploadResp.status} ${err}`);
      }
      const uploaded = await uploadResp.json();
      const inputFileId = uploaded.id || uploaded.data?.id;
      if (!inputFileId) throw new Error('未获取到上传文件ID');

      // 2) 创建 Batch 任务
      const createResp = await fetch(this.batchUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input_file_id: inputFileId,
          endpoint
        })
      });
      if (!createResp.ok) {
        const err = await createResp.text();
        throw new Error(`创建Batch失败: ${createResp.status} ${err}`);
      }
      const batch = await createResp.json();
      const batchId = batch.id;
      if (!batchId) throw new Error('未获取到Batch任务ID');

      // 3) 轮询任务状态直到完成
      let status = batch.status;
      let outputFileId: string | undefined;
      let errorFileId: string | undefined;
      const start = Date.now();
      while (status !== 'completed' && status !== 'failed' && status !== 'cancelled' && Date.now() - start < 120000) {
        await new Promise(r => setTimeout(r, 1500));
        const getResp = await fetch(`${this.batchUrl}/${batchId}`, {
          headers: { 'Authorization': `Bearer ${this.apiKey}` }
        });
        if (!getResp.ok) break;
        const info = await getResp.json();
        status = info.status;
        outputFileId = info.output_file_id;
        errorFileId = info.error_file_id;
      }

      if (status !== 'completed') {
        throw new Error(`Batch未完成，状态: ${status}`);
      }

      // 4) 下载结果文件
      if (!outputFileId) throw new Error('缺少输出文件ID');
      const dlResp = await fetch(`${this.filesUrl}/${outputFileId}/content`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      if (!dlResp.ok) {
        const err = await dlResp.text();
        throw new Error(`下载结果失败: ${dlResp.status} ${err}`);
      }
      const text = await dlResp.text();
      // 返回 JSONL 文本（调用方解析每行JSON）
      return { text, errorFileId };
    } catch (e) {
      console.error('BigModel Batch 处理失败，回退到并发模拟:', e);
      throw e;
    }
  }

  /**
   * 基于 Batch API 的批量讲解：传入每条消息构造好的JSONL
   * 返回解析后的 choices 内容数组（与 batchProcess 返回结构不同）
   */
  async batchExplainFromJsonl(jsonl: string): Promise<Array<{ custom_id: string; content: string }>> {
    const { text } = await this.batchChatViaBigmodelJSONL(jsonl);
    const lines = text.split(/\r?\n/).filter(Boolean);
    const results: Array<{ custom_id: string; content: string }> = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        const customId = obj.custom_id || obj.id || '';
        const content = obj.response?.body?.choices?.[0]?.message?.content || '';
        results.push({ custom_id: customId, content });
      } catch {
        // 忽略无法解析的行
      }
    }
    return results;
  }


  /**
   * 优化的情绪关键词生成 - 使用快速模式，增加多样性
   */
  async generateOptimizedKeywords(emotion: string, userInput?: string): Promise<string[]> {
    // 增加一些随机性，避免过于固定
    const randomSeed = Math.random();
    const temperature = 0.3 + (randomSeed * 0.2); // 0.3-0.5的温度范围
    
    const messages: GLMMessage[] = [
      {
        role: 'system',
        content: '你是一个专业的艺术策展人，擅长生成多样化的艺术搜索关键词。请生成5个不同的关键词，用逗号分隔。'
      },
      {
        role: 'user',
        content: `为情绪"${emotion}"生成5个多样化的艺术搜索关键词，包括不同风格、时期、技法等。${userInput ? `用户补充：${userInput}` : ''}`
      }
    ];

    try {
      const response = await this.quickChat(messages, {
        temperature: temperature, // 使用动态温度
        max_tokens: 150
      });

      const content = response.choices[0]?.message?.content || '';
      const keywords = content.split(',').map(k => k.trim()).filter(k => k.length > 0);
      
      // 如果生成的关键词太少，补充一些默认关键词
      if (keywords.length < 3) {
        const defaultKeywords = this.getDefaultKeywords(emotion);
        keywords.push(...defaultKeywords.slice(0, 5 - keywords.length));
      }
      
      return keywords.slice(0, 5); // 确保最多5个关键词
    } catch (error) {
      console.error('关键词生成失败:', error);
      // 返回默认关键词
      return this.getDefaultKeywords(emotion);
    }
  }

  /**
   * 批量作品评分 - 使用批处理API
   */
  async batchScoreArtworks(
    artworks: Array<{ id: string; title: string; artist: string; year: string; medium: string }>,
    emotion: string,
    userInput?: string
  ): Promise<Array<{ artworkId: string; scores: any }>> {
    const requests = artworks.map((artwork, index) => ({
      custom_id: `score_${artwork.id}`,
      messages: [
        {
          role: 'system' as const,
          content: '你是一位专业的艺术策展人，请对艺术作品进行评分。只返回JSON格式的评分结果。'
        },
        {
          role: 'user' as const,
          content: `对作品"${artwork.title}"进行评分，评估与"${emotion}"情绪的契合度。返回JSON格式：{"emotion_fit": 0-10, "artistic_value": 0-10, "visual_impact": 0-10, "overall_recommendation": 0-10, "confidence": 0-1}`
        }
      ],
      options: {
        temperature: 0.2,
        max_tokens: 200,
        thinking: 'disabled' // 快速评分，不需要深度推理
      }
    }));

    try {
      const results = await this.batchProcess(requests);
      return results.map(result => ({
        artworkId: result.custom_id.replace('score_', ''),
        scores: JSON.parse(result.response.body.choices[0]?.message?.content || '{}')
      }));
    } catch (error) {
      console.error('批量评分失败:', error);
      throw error;
    }
  }

  /**
   * 获取默认关键词
   */
  private getDefaultKeywords(emotion: string): string[] {
    const keywordMap: { [key: string]: string[] } = {
      'joy': ['celebration', 'festival', 'dance', 'music', 'happiness'],
      'melancholy': ['sadness', 'contemplation', 'loneliness', 'reflection', 'blue'],
      'calm': ['peaceful', 'serene', 'tranquil', 'meditation', 'nature'],
      'lonely': ['isolation', 'solitude', 'abandonment', 'deserted', 'empty'],
      'passion': ['love', 'desire', 'romance', 'intensity', 'drama']
    };

    return keywordMap[emotion] || [emotion];
  }
}

// 导出单例实例
export const glmOptimizedClient = new GLMOptimizedClient();
