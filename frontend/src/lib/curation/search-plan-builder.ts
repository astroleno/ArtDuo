// 搜索计划构建器 - 阶段1的核心功能
import { openaiClient } from '@/lib/openai';
import { SearchPlan, LLMAnalysis } from './types';

/**
 * 构建搜索计划 - 阶段1的核心函数
 * @param emotion 用户情绪
 * @param userInput 用户追加描述
 * @param deterministicSeed 确定性种子，保证可复现
 * @returns 标准化的搜索计划和LLM分析结果
 */
export async function buildSearchPlan(
  emotion: string, 
  userInput?: string, 
  deterministicSeed?: string
): Promise<{ searchPlan: SearchPlan; llmAnalysis: LLMAnalysis }> {
  console.log('🧠 开始构建搜索计划:', { emotion, userInput, deterministicSeed });

  try {
    // 构建LLM提示词
    const prompt = buildSearchPlanPrompt(emotion, userInput);
    
    // 调用LLM获取分析结果
    const llmAnalysis = await callLLMForAnalysis(prompt, deterministicSeed);
    
    // 转换为标准搜索计划格式
    const searchPlan = convertToSearchPlan(llmAnalysis, emotion);
    
    // 合法性校验
    validateSearchPlan(searchPlan);
    
    console.log('✅ 搜索计划构建完成:', searchPlan);
    return { searchPlan, llmAnalysis };
    
  } catch (error) {
    console.error('❌ 搜索计划构建失败:', error);
    
    // 返回默认搜索计划
    const defaultPlan = getDefaultSearchPlan(emotion);
    const defaultAnalysis: LLMAnalysis = {
      emotion_analysis: `这是一个关于"${emotion}"情绪的艺术策展`,
      art_styles: [],
      search_keywords: [emotion],
      recommended_artists: [],
      curation_strategy: '通过艺术作品展现情绪的深度和多样性'
    };
    return { searchPlan: defaultPlan, llmAnalysis: defaultAnalysis };
  }
}

/**
 * 构建LLM提示词
 */
function buildSearchPlanPrompt(emotion: string, userInput?: string): string {
  return `你是一位专业的艺术策展人。用户输入了情绪关键词"${emotion}"${userInput ? `，并补充说明："${userInput}"` : ''}。

请分析这个情绪主题，并生成一个智能搜索策略来找到相关的艺术作品。请考虑：

1. 情绪分析：这个情绪的核心特征是什么？
2. 艺术风格：哪些艺术风格最能表达这种情绪？
3. 关键词策略：应该搜索哪些英文关键词来找到相关作品？
4. 艺术家推荐：哪些艺术家擅长表达这种情绪？
5. 时期范围：哪些历史时期更容易找到相关作品？
6. 材质偏好：哪些艺术材质更适合表达这种情绪？
7. 地理范围：哪些地区的艺术作品更相关？

请严格按照以下JSON格式返回分析结果，不要包含任何其他文字：

{
  "emotion_analysis": "情绪分析",
  "art_styles": ["风格1", "风格2"],
  "search_keywords": ["关键词1", "关键词2"],
  "recommended_artists": ["艺术家1", "艺术家2"],
  "curation_strategy": "策展策略说明",
  "period_suggestion": {
    "start": 1800,
    "end": 2000
  },
  "medium_suggestion": ["油画", "水彩"],
  "geo_suggestion": ["欧洲", "美国"],
  "subtitle": "基于情绪分析生成的副标题，简洁有力，体现情绪主题"
}

注意：只返回JSON，不要包含任何解释文字。`;
}

/**
 * 调用LLM获取分析结果
 */
async function callLLMForAnalysis(prompt: string, deterministicSeed?: string): Promise<LLMAnalysis> {
  const messages = [
    {
      role: 'system' as const,
      content: '你是一位专业的艺术策展人，擅长分析情绪主题并制定智能搜索策略。请始终返回有效的JSON格式。'
    },
    {
      role: 'user' as const,
      content: prompt
    }
  ];

  const options: any = {
    model: process.env.NEXT_PUBLIC_GLM_MODEL || 'glm-4.5',
    temperature: 0.1,
    max_tokens: 4096
  };

  // 如果有确定性种子，使用固定的temperature
  if (deterministicSeed) {
    options.temperature = 0.1; // 更确定性的输出
    options.seed = deterministicSeed;
  }

  const response = await openaiClient.chat(messages, options);
  // GLM-4.5模型返回的内容在reasoning_content字段中
  const analysisText = response.choices[0]?.message?.reasoning_content || 
                      response.choices[0]?.message?.content || '{}';
  
  console.log('🔍 LLM响应调试信息:');
  console.log('  - 响应状态:', response.choices[0]?.finish_reason);
  console.log('  - 内容长度:', analysisText.length);
  console.log('  - 内容预览:', analysisText.substring(0, 200) + '...');
  
  try {
    // 尝试直接解析JSON
    return JSON.parse(analysisText);
  } catch (error) {
    console.error('LLM响应解析失败，尝试提取JSON:', error);
    
    // 尝试从长文本中提取JSON
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const jsonStr = jsonMatch[0];
        console.log('🔍 提取到的JSON字符串:', jsonStr);
        return JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('JSON提取解析失败:', parseError);
      }
    }
    
    // 尝试从reasoning_content中提取JSON（GLM-4.5的特殊处理）
    const reasoningMatch = analysisText.match(/\{[\s\S]*"emotion_analysis"[\s\S]*\}/);
    if (reasoningMatch) {
      try {
        const jsonStr = reasoningMatch[0];
        console.log('🔍 从推理内容中提取JSON:', jsonStr);
        return JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('推理内容JSON解析失败:', parseError);
      }
    }
    
    // 如果都失败了，返回默认分析
    console.warn('使用默认LLM分析结果');
    return {
      emotion_analysis: `这是一个关于"${emotion}"情绪的艺术策展`,
      art_styles: ['表现主义', '印象派'],
      search_keywords: [emotion],
      recommended_artists: [],
      curation_strategy: '通过艺术作品展现情绪的深度和多样性'
    };
  }
}

/**
 * 将LLM分析结果转换为标准搜索计划格式
 */
function convertToSearchPlan(llmAnalysis: LLMAnalysis, emotion: string): SearchPlan {
  return {
    keywords: llmAnalysis.search_keywords || [emotion],
    filters: {
      period: llmAnalysis.period_suggestion || getDefaultPeriod(),
      medium: llmAnalysis.medium_suggestion || [],
      geo: llmAnalysis.geo_suggestion || [],
      creator: llmAnalysis.recommended_artists || [],
      highlight: true,
      hasImages: true
    },
    sources: ['met', 'rijks'] // 默认使用两个数据源
  };
}

/**
 * 获取默认时期范围
 */
function getDefaultPeriod(): { start: number; end: number } {
  return {
    start: 1500,
    end: 2024
  };
}

/**
 * 合法性校验
 */
function validateSearchPlan(searchPlan: SearchPlan): void {
  // 检查关键词
  if (!searchPlan.keywords || searchPlan.keywords.length === 0) {
    throw new Error('搜索关键词不能为空');
  }
  
  // 检查关键词内容
  const validKeywords = searchPlan.keywords.filter(keyword => 
    keyword && keyword.trim().length > 0
  );
  
  if (validKeywords.length === 0) {
    throw new Error('所有搜索关键词都为空');
  }
  
  // 检查数据源
  if (!searchPlan.sources || searchPlan.sources.length === 0) {
    throw new Error('数据源不能为空');
  }
  
  // 检查时期范围
  if (searchPlan.filters.period) {
    const { start, end } = searchPlan.filters.period;
    if (start >= end) {
      throw new Error('时期范围无效：开始时间必须小于结束时间');
    }
  }
  
  console.log('✅ 搜索计划合法性校验通过');
}

/**
 * 获取默认搜索计划
 */
function getDefaultSearchPlan(emotion: string): SearchPlan {
  console.log('⚠️ 使用默认搜索计划');
  
  return {
    keywords: [emotion],
    filters: {
      period: getDefaultPeriod(),
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
 * 生成确定性种子
 */
export function generateDeterministicSeed(emotion: string, userInput?: string): string {
  const input = `${emotion}_${userInput || ''}`;
  // 简单的哈希函数生成种子
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  return Math.abs(hash).toString();
}
