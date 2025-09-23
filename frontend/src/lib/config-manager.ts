// 统一配置管理器 - 优先使用env.local.json配置
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * 配置接口
 */
export interface AppConfig {
  // OpenAI配置
  openai_api_key?: string;
  openai_base_url?: string;
  openai_model?: string;
  
  // GLM配置
  glm_api_key?: string;
  glm_base_url?: string;
  glm_model?: string;
  
  // 其他API配置
  rijks_api_key?: string;
  met_api_url?: string;
  app_url?: string;
  
  // 功能开关
  enable_mcp_service?: boolean;
}

/**
 * 统一配置管理器
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig = {};
  
  private constructor() {
    this.loadConfig();
  }
  
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }
  
  /**
   * 加载配置 - 优先级：env.local.json > 环境变量
   */
  private loadConfig() {
    // 1. 先从环境变量读取
    this.config = {
      openai_api_key: process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      openai_base_url: process.env.NEXT_PUBLIC_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL,
      openai_model: process.env.NEXT_PUBLIC_OPENAI_MODEL || process.env.OPENAI_MODEL,
      
      glm_api_key: process.env.NEXT_PUBLIC_GLM_API_KEY || process.env.GLM_API_KEY,
      glm_base_url: process.env.NEXT_PUBLIC_GLM_URL || process.env.GLM_URL,
      glm_model: process.env.NEXT_PUBLIC_GLM_MODEL || process.env.GLM_MODEL,
      
      rijks_api_key: process.env.NEXT_PUBLIC_RIJKS_API_KEY || process.env.RIJKS_API_KEY,
      met_api_url: process.env.NEXT_PUBLIC_MET_API_URL || process.env.MET_API_URL,
      app_url: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL,
      
      enable_mcp_service: (process.env.ENABLE_MCP_SERVICE || '').toLowerCase() === 'true'
    };
    
    // 2. 再从env.local.json覆盖（优先级更高）
    try {
      const envJsonPath = join(process.cwd(), 'env.local.json');
      if (existsSync(envJsonPath)) {
        const envJsonData = JSON.parse(readFileSync(envJsonPath, 'utf8'));
        
        // 映射env.local.json的字段到配置
        const fieldMapping: Record<string, keyof AppConfig> = {
          'NEXT_PUBLIC_OPENAI_API_KEY': 'openai_api_key',
          'NEXT_PUBLIC_OPENAI_BASE_URL': 'openai_base_url', 
          'NEXT_PUBLIC_OPENAI_MODEL': 'openai_model',
          
          'NEXT_PUBLIC_GLM_API_KEY': 'glm_api_key',
          'NEXT_PUBLIC_GLM_URL': 'glm_base_url',
          'NEXT_PUBLIC_GLM_MODEL': 'glm_model',
          
          'NEXT_PUBLIC_RIJKS_API_KEY': 'rijks_api_key',
          'NEXT_PUBLIC_MET_API_URL': 'met_api_url',
          'NEXT_PUBLIC_APP_URL': 'app_url',
          
          'ENABLE_MCP_SERVICE': 'enable_mcp_service'
        };
        
        // 从env.local.json覆盖配置
        for (const [jsonKey, configKey] of Object.entries(fieldMapping)) {
          if (envJsonData[jsonKey] !== undefined) {
            if (configKey === 'enable_mcp_service') {
              this.config[configKey] = String(envJsonData[jsonKey]).toLowerCase() === 'true';
            } else {
              this.config[configKey] = envJsonData[jsonKey];
            }
          }
        }
        
        console.log('🔧 配置管理器: 从 env.local.json 加载配置');
      }
    } catch (error) {
      console.warn('⚠️ 读取 env.local.json 失败:', error);
    }
    
    console.log('🔧 配置管理器: 配置加载完成', {
      hasOpenAI: !!this.config.openai_api_key,
      hasGLM: !!this.config.glm_api_key,
      hasRijks: !!this.config.rijks_api_key,
      openaiModel: this.config.openai_model,
      glmModel: this.config.glm_model
    });
  }
  
  /**
   * 获取LLM配置 - 优先OpenAI，然后GLM
   */
  getLLMConfig(): {
    apiKey: string;
    baseUrl: string;
    model: string;
    provider: 'openai' | 'glm';
  } {
    // 优先使用OpenAI
    if (this.config.openai_api_key) {
      return {
        apiKey: this.config.openai_api_key,
        baseUrl: this.config.openai_base_url || 'https://api.openai.com/v1',
        model: this.config.openai_model || 'gpt-4o-mini',
        provider: 'openai'
      };
    }
    
    // 降级到GLM
    if (this.config.glm_api_key) {
      return {
        apiKey: this.config.glm_api_key,
        baseUrl: this.config.glm_base_url || 'https://open.bigmodel.cn/api/paas/v4',
        model: this.config.glm_model || 'glm-4-plus',
        provider: 'glm'
      };
    }
    
    throw new Error('未配置任何LLM API密钥');
  }
  
  /**
   * 获取特定配置值
   */
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }
  
  /**
   * 获取所有配置
   */
  getAll(): AppConfig {
    return { ...this.config };
  }
}

// 导出单例实例
export const configManager = ConfigManager.getInstance();
