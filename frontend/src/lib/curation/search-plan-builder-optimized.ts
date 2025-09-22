// 优化版搜索计划构建器 - 大幅提升性能
import { openaiClient } from '@/lib/openai';

/**
 * 搜索计划接口
 */
export interface SearchPlan {
  keywords: string[];
  filters: {
    period?: { start: number; end: number };
    medium?: string[];
    geo?: string[];
    creator?: string[];
    highlight?: boolean;
    hasImages: boolean;
  };
  sources: string[];
}

/**
 * LLM分析结果接口
 */
export interface LLMAnalysis {
  emotion_analysis: string;
  art_styles: string[];
  search_keywords: string[];
  recommended_artists: string[];
  curation_strategy: string;
}

/**
 * 搜索计划模板
 */
const SEARCH_PLAN_TEMPLATES = {
  joy: {
    keywords: ['joy', 'happiness', 'celebration', 'festival', 'dance', 'music'],
    filters: {
      period: { start: 1500, end: 2024 },
      medium: ['painting', 'sculpture', 'textile'],
      geo: ['Europe', 'Asia', 'Americas'],
      highlight: true,
      hasImages: true
    },
    sources: ['met', 'rijks']
  },
  melancholy: {
    keywords: ['melancholy', 'sadness', 'contemplation', 'loneliness', 'reflection'],
    filters: {
      period: { start: 1500, end: 2024 },
      medium: ['painting', 'drawing', 'print'],
      geo: ['Europe', 'Asia'],
      highlight: true,
      hasImages: true
    },
    sources: ['met', 'rijks']
  },
  calm: {
    keywords: ['calm', 'peaceful', 'serene', 'tranquil', 'meditation', 'nature'],
    filters: {
      period: { start: 1500, end: 2024 },
      medium: ['painting', 'sculpture', 'ceramic'],
      geo: ['Asia', 'Europe'],
      highlight: true,
      hasImages: true
    },
    sources: ['met', 'rijks']
  },
  lonely: {
    keywords: ['lonely', 'isolation', 'solitude', 'abandonment', 'deserted'],
    filters: {
      period: { start: 1500, end: 2024 },
      medium: ['painting', 'drawing', 'print'],
      geo: ['Europe', 'Americas'],
      highlight: true,
      hasImages: true
    },
    sources: ['met', 'rijks']
  },
  passion: {
    keywords: ['passion', 'love', 'desire', 'romance', 'intensity', 'drama'],
    filters: {
      period: { start: 1500, end: 2024 },
      medium: ['painting', 'sculpture', 'textile'],
      geo: ['Europe', 'Asia'],
      highlight: true,
      hasImages: true
    },
    sources: ['met', 'rijks']
  }
};

/**
 * 优化版搜索计划构建 - 大幅提升性能
 */
export async function buildSearchPlanOptimized(
  emotion: string, 
  userInput?: string, 
  deterministicSeed?: string
): Promise<{ searchPlan: SearchPlan; llmAnalysis: LLMAnalysis }> {
  console.log(`🚀 开始优化版搜索计划构建: ${emotion}`);
  const startTime = Date.now();
  
  // 第一步：使用模板快速构建基础搜索计划
  console.log(`📋 第一步：使用模板构建基础搜索计划...`);
  const basePlan = getSearchPlanTemplate(emotion);
  
  // 第二步：如果有用户输入，进行快速定制
  let customizedPlan = basePlan;
  let llmAnalysis: LLMAnalysis;
  
  if (userInput && userInput.trim().length > 0) {
    console.log(`🎯 第二步：快速定制搜索计划...`);
    const customization = await quickCustomizePlan(basePlan, emotion, userInput);
    customizedPlan = customization.searchPlan;
    llmAnalysis = customization.llmAnalysis;
  } else {
    // 使用默认分析
    llmAnalysis = {
      emotion_analysis: `这是一个关于"${emotion}"情绪的艺术策展`,
      art_styles: [],
      search_keywords: basePlan.keywords,
      recommended_artists: [],
      curation_strategy: '通过艺术作品展现情绪的深度和多样性'
    };
  }
  
  const processingTime = Date.now() - startTime;
  console.log(`✅ 优化版搜索计划构建完成，耗时: ${processingTime}ms`);
  
  return {
    searchPlan: customizedPlan,
    llmAnalysis
  };
}

/**
 * 获取搜索计划模板
 */
function getSearchPlanTemplate(emotion: string): SearchPlan {
  const template = SEARCH_PLAN_TEMPLATES[emotion as keyof typeof SEARCH_PLAN_TEMPLATES];
  
  if (template) {
    return { ...template };
  }
  
  // 默认模板
  return {
    keywords: [emotion],
    filters: {
      period: { start: 1500, end: 2024 },
      medium: [],
      geo: [],
      creator: [],
      highlight: true,
      hasImages: true
    },
    sources: ['met', 'rijks']
  };
}

/**
 * 快速定制搜索计划 - 使用轻量级LLM调用
 */
async function quickCustomizePlan(
  basePlan: SearchPlan, 
  emotion: string, 
  userInput: string
): Promise<{ searchPlan: SearchPlan; llmAnalysis: LLMAnalysis }> {
  console.log(`🎯 快速定制搜索计划: ${emotion}`);
  
  try {
    const prompt = `基于用户输入快速定制搜索计划：

情绪主题：${emotion}
用户输入：${userInput}
基础搜索计划：${JSON.stringify(basePlan, null, 2)}

请快速分析并返回：
1. 定制的搜索关键词（基于用户输入）
2. 简化的策展策略

返回JSON格式：
{
  "search_keywords": ["关键词1", "关键词2"],
  "curation_strategy": "简化的策展策略描述"
}

要求：只返回JSON，保持简洁。`;

    const messages = [
      {
        role: 'system' as const,
        content: '你是一位专业的艺术策展人，擅长快速定制搜索计划。请只返回JSON格式。'
      },
      {
        role: 'user' as const,
        content: prompt
      }
    ];

    const response = await openaiClient.chat(messages, {
      model: 'glm-4.5',
      temperature: 0.3,
      max_tokens: 512 // 减少token数量，提高速度
    });

    const result = response.choices[0]?.message?.content || '{}';
    const customization = JSON.parse(result);
    
    // 构建定制化的搜索计划
    const customizedPlan: SearchPlan = {
      ...basePlan,
      keywords: customization.search_keywords || basePlan.keywords
    };
    
    const llmAnalysis: LLMAnalysis = {
      emotion_analysis: `这是一个关于"${emotion}"情绪的艺术策展，结合用户输入"${userInput}"`,
      art_styles: [],
      search_keywords: customizedPlan.keywords,
      recommended_artists: [],
      curation_strategy: customization.curation_strategy || '通过艺术作品展现情绪的深度和多样性'
    };
    
    console.log(`✅ 快速定制完成`);
    return { searchPlan: customizedPlan, llmAnalysis };
    
  } catch (error) {
    console.error('快速定制失败，使用基础计划:', error);
    
    const llmAnalysis: LLMAnalysis = {
      emotion_analysis: `这是一个关于"${emotion}"情绪的艺术策展`,
      art_styles: [],
      search_keywords: basePlan.keywords,
      recommended_artists: [],
      curation_strategy: '通过艺术作品展现情绪的深度和多样性'
    };
    
    return { searchPlan: basePlan, llmAnalysis };
  }
}

/**
 * 生成确定性种子
 */
export function generateDeterministicSeed(emotion: string, userInput?: string): string {
  const input = `${emotion}-${userInput || ''}`;
  let hash = 0;
  
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  
  return Math.abs(hash).toString();
}

/**
 * 验证搜索计划的合法性
 */
export function validateSearchPlan(plan: SearchPlan): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!plan.keywords || plan.keywords.length === 0) {
    errors.push('搜索关键词不能为空');
  }
  
  if (plan.keywords.some(keyword => !keyword || keyword.trim().length === 0)) {
    errors.push('搜索关键词不能包含空字符串');
  }
  
  if (!plan.filters.hasImages) {
    errors.push('必须要求有图像');
  }
  
  if (!plan.sources || plan.sources.length === 0) {
    errors.push('数据源不能为空');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 获取搜索计划统计信息
 */
export function getSearchPlanStats(plan: SearchPlan): {
  keywordCount: number;
  filterCount: number;
  sourceCount: number;
} {
  return {
    keywordCount: plan.keywords.length,
    filterCount: Object.keys(plan.filters).length,
    sourceCount: plan.sources.length
  };
}
