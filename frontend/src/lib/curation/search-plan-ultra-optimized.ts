// 超优化搜索计划构建器 - 使用精确关键词和快速LLM调用
import { glmOptimizedClient } from '@/lib/glm-optimized-client';
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
 * 精确情绪关键词映射 - 基于艺术史和博物馆数据
 */
const PRECISE_EMOTION_KEYWORDS = {
  joy: {
    primary: ['celebration', 'festival', 'dance', 'music'],
    secondary: ['happiness', 'cheerful', 'merry', 'jubilant'],
    artTerms: ['baroque', 'rococo', 'impressionist', 'fauvist'],
    artists: ['Rubens', 'Fragonard', 'Monet', 'Matisse']
  },
  melancholy: {
    primary: ['sadness', 'contemplation', 'loneliness'],
    secondary: ['sorrow', 'grief', 'mourning', 'melancholy'],
    artTerms: ['romantic', 'symbolist', 'expressionist'],
    artists: ['Friedrich', 'Munch', 'Van Gogh', 'Picasso']
  },
  calm: {
    primary: ['peaceful', 'serene', 'tranquil'],
    secondary: ['meditation', 'nature', 'landscape', 'still'],
    artTerms: ['impressionist', 'zen', 'minimalist'],
    artists: ['Monet', 'Cézanne', 'Rothko', 'Morandi']
  },
  lonely: {
    primary: ['isolation', 'solitude', 'abandonment'],
    secondary: ['deserted', 'empty', 'alone', 'secluded'],
    artTerms: ['romantic', 'symbolist', 'surrealist'],
    artists: ['Friedrich', 'Hopper', 'Magritte', 'De Chirico']
  },
  passion: {
    primary: ['love', 'desire', 'romance', 'intensity'],
    secondary: ['passion', 'drama', 'emotion', 'fire'],
    artTerms: ['baroque', 'romantic', 'expressionist'],
    artists: ['Caravaggio', 'Delacroix', 'Klimt', 'Schiele']
  }
};

/**
 * 超优化搜索计划构建 - 大幅提升性能
 */
export async function buildSearchPlanUltraOptimized(
  emotion: string, 
  userInput?: string, 
  deterministicSeed?: string
): Promise<{ searchPlan: SearchPlan; llmAnalysis: LLMAnalysis }> {
  console.log(`🚀 开始超优化搜索计划构建: ${emotion}`);
  const startTime = Date.now();
  
  // 第一步：使用快速LLM生成关键词，增加多样性
  console.log(`📋 第一步：使用快速LLM生成关键词...`);
  let finalKeywords: string[];
  let llmAnalysis: LLMAnalysis;
  
  try {
    // 优先使用GLM客户端，如果不可用则降级到OpenAI客户端
    if (glmOptimizedClient.hasValidApiKey()) {
      console.log('🔑 使用GLM客户端生成关键词...');
      const customizedKeywords = await glmOptimizedClient.generateOptimizedKeywords(emotion, userInput);
      finalKeywords = customizedKeywords.length > 0 ? customizedKeywords : getPreciseKeywords(emotion);
    } else {
      console.log('🔑 GLM不可用，使用OpenAI客户端生成关键词...');
      const customizedKeywords = await generateKeywordsWithOpenAI(emotion, userInput);
      finalKeywords = customizedKeywords.length > 0 ? customizedKeywords : getPreciseKeywords(emotion);
    }
    console.log(`✅ 快速LLM生成关键词: ${finalKeywords.join(', ')}`);
  } catch (error) {
    console.warn('快速LLM关键词生成失败，使用精确关键词:', error);
    finalKeywords = getPreciseKeywords(emotion);
  }
  
  // 第三步：构建搜索计划
  const searchPlan: SearchPlan = {
    keywords: finalKeywords,
    filters: {
      period: { start: 1500, end: 2024 },
      medium: getRecommendedMediums(emotion),
      geo: getRecommendedGeos(emotion),
      creator: getRecommendedArtists(emotion),
      highlight: true,
      hasImages: true
    },
    sources: ['met', 'rijks']
  };
  
  // 第四步：生成LLM分析（使用快速模式）
  llmAnalysis = {
    emotion_analysis: `这是一个关于"${emotion}"情绪的艺术策展`,
    art_styles: getRecommendedArtStyles(emotion),
    search_keywords: finalKeywords,
    recommended_artists: getRecommendedArtists(emotion),
    curation_strategy: getCurationStrategy(emotion)
  };
  
  const processingTime = Date.now() - startTime;
  console.log(`✅ 超优化搜索计划构建完成，耗时: ${processingTime}ms`);
  
  return {
    searchPlan,
    llmAnalysis
  };
}

/**
 * 获取精确关键词
 */
function getPreciseKeywords(emotion: string): string[] {
  const emotionData = PRECISE_EMOTION_KEYWORDS[emotion as keyof typeof PRECISE_EMOTION_KEYWORDS];
  
  if (emotionData) {
    // 优先使用主要关键词，这些在博物馆数据库中匹配度更高
    return emotionData.primary;
  }
  
  // 默认关键词
  return [emotion];
}

/**
 * 获取推荐的艺术风格
 */
function getRecommendedArtStyles(emotion: string): string[] {
  const emotionData = PRECISE_EMOTION_KEYWORDS[emotion as keyof typeof PRECISE_EMOTION_KEYWORDS];
  return emotionData?.artTerms || [];
}

/**
 * 获取推荐的艺术家
 */
function getRecommendedArtists(emotion: string): string[] {
  const emotionData = PRECISE_EMOTION_KEYWORDS[emotion as keyof typeof PRECISE_EMOTION_KEYWORDS];
  return emotionData?.artists || [];
}

/**
 * 获取推荐的材质
 */
function getRecommendedMediums(emotion: string): string[] {
  const mediumMap: { [key: string]: string[] } = {
    joy: ['painting', 'sculpture', 'textile', 'ceramic'],
    melancholy: ['painting', 'drawing', 'print', 'sculpture'],
    calm: ['painting', 'sculpture', 'ceramic', 'textile'],
    lonely: ['painting', 'drawing', 'print', 'photography'],
    passion: ['painting', 'sculpture', 'textile', 'drawing']
  };
  
  return mediumMap[emotion] || ['painting', 'sculpture'];
}

/**
 * 获取推荐的地理区域
 */
function getRecommendedGeos(emotion: string): string[] {
  const geoMap: { [key: string]: string[] } = {
    joy: ['Europe', 'Asia', 'Americas'],
    melancholy: ['Europe', 'Asia'],
    calm: ['Asia', 'Europe'],
    lonely: ['Europe', 'Americas'],
    passion: ['Europe', 'Asia']
  };
  
  return geoMap[emotion] || ['Europe', 'Asia'];
}

/**
 * 获取策展策略
 */
function getCurationStrategy(emotion: string): string {
  const strategyMap: { [key: string]: string } = {
    joy: '通过明亮色彩和动态构图展现喜悦情绪',
    melancholy: '通过深沉色调和富有表现力的构图传达忧郁情感',
    calm: '通过柔和色彩和平衡构图营造宁静氛围',
    lonely: '通过空旷构图和冷色调表达孤独感',
    passion: '通过强烈对比和动态笔触展现激情'
  };
  
  return strategyMap[emotion] || '通过艺术作品展现情绪的深度和多样性';
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
 * 使用OpenAI客户端生成关键词（降级方案）
 */
async function generateKeywordsWithOpenAI(emotion: string, userInput?: string): Promise<string[]> {
  const prompt = `为情绪"${emotion}"生成5个多样化的艺术搜索关键词，包括不同风格、时期、技法等。${userInput ? `用户补充：${userInput}` : ''}

请只返回关键词，用逗号分隔。`;

  const messages = [
    {
      role: 'system' as const,
      content: '你是一个专业的艺术策展人，擅长生成多样化的艺术搜索关键词。请生成5个不同的关键词，用逗号分隔。'
    },
    {
      role: 'user' as const,
      content: prompt
    }
  ];

  try {
    const response = await openaiClient.chat(messages, {
      temperature: 0.3,
      max_tokens: 150
    });

    const content = response.choices[0]?.message?.content || '';
    const keywords = content.split(',').map(k => k.trim()).filter(k => k.length > 0);
    
    // 如果生成的关键词太少，补充一些默认关键词
    if (keywords.length < 3) {
      const defaultKeywords = getPreciseKeywords(emotion);
      keywords.push(...defaultKeywords.slice(0, 5 - keywords.length));
    }
    
    return keywords.slice(0, 5); // 确保最多5个关键词
  } catch (error) {
    console.error('OpenAI关键词生成失败:', error);
    return getPreciseKeywords(emotion);
  }
}

/**
 * 获取搜索计划统计信息
 */
export function getSearchPlanStats(plan: SearchPlan): {
  keywordCount: number;
  filterCount: number;
  sourceCount: number;
  estimatedSearchTime: number;
} {
  return {
    keywordCount: plan.keywords.length,
    filterCount: Object.keys(plan.filters).length,
    sourceCount: plan.sources.length,
    estimatedSearchTime: plan.keywords.length * 200 // 每个关键词约200ms
  };
}
