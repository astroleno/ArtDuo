// 公共 fetch 工具 - 超时、重试、User-Agent

interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

interface FetchResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

/**
 * 增强的 fetch 客户端
 */
export class FetchClient {
  private defaultTimeout: number;
  private defaultRetries: number;
  private defaultRetryDelay: number;
  private userAgent: string;

  constructor(options: {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    userAgent?: string;
  } = {}) {
    this.defaultTimeout = options.timeout || 10000; // 10秒超时
    this.defaultRetries = options.retries || 3; // 3次重试
    this.defaultRetryDelay = options.retryDelay || 1000; // 1秒延迟
    this.userAgent = options.userAgent || 'ArtDuo/1.0 (https://artduo.app)';
  }

  /**
   * 执行 HTTP 请求
   */
  async request<T = any>(
    url: string, 
    options: FetchOptions = {}
  ): Promise<FetchResponse<T>> {
    const {
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      retryDelay = this.defaultRetryDelay,
      ...fetchOptions
    } = options;

    // 设置默认 headers
    const headers = new Headers(fetchOptions.headers);
    if (!headers.has('User-Agent')) {
      headers.set('User-Agent', this.userAgent);
    }
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    const requestOptions: RequestInit = {
      ...fetchOptions,
      headers,
    };

    let lastError: Error | null = null;

    // 重试逻辑
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(`🌐 请求 ${url} (尝试 ${attempt + 1}/${retries + 1})`);
        
        const response = await this.fetchWithTimeout(url, requestOptions, timeout);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        console.log(`✅ 请求成功: ${url}`);
        
        return {
          data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        };

      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ 请求失败 (尝试 ${attempt + 1}/${retries + 1}): ${error}`);
        
        // 如果不是最后一次尝试，等待后重试
        if (attempt < retries) {
          await this.delay(retryDelay * Math.pow(2, attempt)); // 指数退避
        }
      }
    }

    // 所有重试都失败了
    console.error(`❌ 请求最终失败: ${url}`, lastError);
    throw lastError || new Error('请求失败');
  }

  /**
   * GET 请求
   */
  async get<T = any>(url: string, options: FetchOptions = {}): Promise<FetchResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  /**
   * POST 请求
   */
  async post<T = any>(url: string, data?: any, options: FetchOptions = {}): Promise<FetchResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  /**
   * 带超时的 fetch
   */
  private async fetchWithTimeout(
    url: string, 
    options: RequestInit, 
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`请求超时 (${timeout}ms): ${url}`);
      }
      throw error;
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 创建默认实例
export const fetchClient = new FetchClient({
  timeout: 10000,
  retries: 3,
  retryDelay: 1000,
  userAgent: 'ArtDuo/1.0 (https://artduo.app)'
});

// 便捷方法
export const apiGet = <T = any>(url: string, options?: FetchOptions) => 
  fetchClient.get<T>(url, options);

export const apiPost = <T = any>(url: string, data?: any, options?: FetchOptions) => 
  fetchClient.post<T>(url, data, options);
