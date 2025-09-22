// 策展相关类型定义

/**
 * 搜索计划接口 - 阶段1的标准输出格式
 */
export interface SearchPlan {
  keywords: string[];
  filters: {
    period?: {
      start: number;
      end: number;
    };
    medium?: string[];
    geo?: string[];
    creator?: string[];
    highlight?: boolean;
    hasImages: boolean;
  };
  sources: string[];
}

/**
 * LLM分析结果接口 - 当前使用的格式
 */
export interface LLMAnalysis {
  emotion_analysis: string;
  art_styles: string[];
  search_keywords: string[];
  recommended_artists: string[];
  curation_strategy: string;
  period_suggestion?: {
    start: number;
    end: number;
  };
  medium_suggestion?: string[];
  geo_suggestion?: string[];
}

/**
 * 策展信息接口
 */
export interface CurationInfo {
  theme: string;
  description: string;
  emotionCurve: number[];
  totalWorks: number;
}

/**
 * 艺术作品接口
 */
export interface Artwork {
  id: string;
  title: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  imageUrl: string;
  description: string;
  museum: string;
  license: string;
  source?: string;
}

/**
 * 策展响应接口
 */
export interface CurationResponse {
  success: boolean;
  artworks: Artwork[];
  curation: CurationInfo;
  source: string;
  diagnostics?: {
    searchPlan?: SearchPlan;
    llmAnalysis?: LLMAnalysis;
    processingTime?: number;
    errors?: string[];
  };
}
