// 作品讲解和用户关联分析系统
import { glmOptimizedClient } from '@/lib/glm-optimized-client';
import { openaiClient } from '@/lib/openai';
import { Artwork } from './types';

/**
 * 作品讲解结果接口
 */
export interface ArtworkExplanation {
  artworkId: string;
  title: string;
  artist: string;
  explanation: {
    emotionalConnection: string;    // 与用户情绪输入的关联
    artisticAnalysis: string;       // 艺术分析
    historicalContext: string;      // 历史背景
    curationReason: string;         // 策展理由
    userRelevance: string;          // 与用户输入的相关性
  };
  confidence: number;
  processingTime: number;
}

/**
 * 批量作品讲解结果
 */
export interface BatchExplanationResult {
  explanations: ArtworkExplanation[];
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  processingTime: number;
}

/**
 * 为策展作品生成讲解和用户关联分析
 */
export async function generateArtworkExplanations(
  artworks: Artwork[],
  emotion: string,
  userInput?: string,
  curationStrategy?: string
): Promise<BatchExplanationResult> {
  console.log(`🎨 开始生成作品讲解: ${artworks.length} 件作品`);
  const startTime = Date.now();
  
  const explanations: ArtworkExplanation[] = [];
  let successCount = 0;
  let failureCount = 0;
  
  // 分批处理，避免API限制
  // 控制并发与批次，降低429限流概率
  const batchSize = 3;
  const maxConcurrent = 3; // 每批最多并发3条
  for (let i = 0; i < artworks.length; i += batchSize) {
    const batch = artworks.slice(i, i + batchSize);
    console.log(`📝 处理批次 ${Math.floor(i/batchSize) + 1}: ${batch.length} 件作品`);
    
    // 批内并发执行，轻微抖动以降低瞬时并发尖峰
    const batchPromises = batch.map(async (artwork, idx) => {
      try {
        // 轻微抖动（30-80ms）
        await new Promise(r => setTimeout(r, 30 + Math.floor(Math.random() * 50)));
        // 添加超时控制 + 指数退避重试
        const explanation = await generateWithRetry(
          () => generateSingleArtworkExplanation(artwork, emotion, userInput, curationStrategy),
          [1000, 2000, 4000] // 1s, 2s, 4s
        );
        
        successCount++;
        return explanation;
      } catch (error) {
        console.error(`作品 ${artwork.id} 讲解生成失败:`, error);
        failureCount++;
        return createFallbackExplanation(artwork, emotion, userInput);
      }
    });
    
    const batchResults: ArtworkExplanation[] = await Promise.all(batchPromises);
    explanations.push(...batchResults);
    
    // 批次间延迟，避免API限制
    if (i + batchSize < artworks.length) {
      await new Promise(resolve => setTimeout(resolve, 120)); // 减小批间间隔
    }
  }
  
  const processingTime = Date.now() - startTime;
  console.log(`✅ 作品讲解生成完成: ${explanations.length} 个讲解，耗时 ${processingTime}ms`);
  
  return {
    explanations,
    totalProcessed: artworks.length,
    successCount,
    failureCount,
    processingTime
  };
}

/**
 * 生成单个作品的讲解
 */
async function generateSingleArtworkExplanation(
  artwork: Artwork,
  emotion: string,
  userInput?: string,
  curationStrategy?: string
): Promise<ArtworkExplanation> {
  const startTime = Date.now();
  
  const prompt = `为艺术作品生成讲解与用户关联分析（中文）。

写作约束：
1) 使用客观第三人称，不使用“你/您的/我们/我/这件作品/它”等代词；
2) 句子短而具体，优先使用作品名称、材质、年代、地点等实体名；
3) 避免空洞形容词与模板化句式，禁止重复“产生共鸣/独特的创作风格/重要的艺术史意义”等套话；
4) 每段80–120字；仅输出JSON，不含额外文本或Markdown；

作品信息：
- 标题：${artwork.title}
- 艺术家：${artwork.artist}
- 创作年代：${artwork.year}
- 材质：${artwork.medium}
- 描述：${artwork.description || '暂无描述'}
- 收藏机构：${artwork.museum}

用户情绪输入：${emotion}
${userInput ? `用户补充：${userInput}` : ''}
${curationStrategy ? `策展总结/编排要点：${curationStrategy}` : ''}

请从以下角度生成讲解：
1. 情绪关联：围绕“${emotion}”用实体信息解释呈现方式；
2. 艺术分析：技法、风格、构图、材质的具体要点；
3. 历史背景：年代/地域/流派与事件脉络；
4. 策展理由：与策展总结/编排要点的对应关系；
5. 用户相关性：结合“${userInput || '无'}”给出具体联系；

返回JSON格式：
{
  "emotionalConnection": "情绪关联分析",
  "artisticAnalysis": "艺术分析",
  "historicalContext": "历史背景",
  "curationReason": "策展理由",
  "userRelevance": "用户相关性分析",
  "confidence": 0.85
}`;

  const messages = [
    {
      role: 'system' as const,
      content: '你是一位专业的艺术策展人和艺术史专家，擅长深入分析艺术作品与用户情感需求的关联。请提供专业、生动、易懂的讲解。'
    },
    {
      role: 'user' as const,
      content: prompt
    }
  ];

  try {
    let response;
    
    // 优先使用GLM客户端，如果不可用则降级到OpenAI客户端
    if (glmOptimizedClient.hasValidApiKey()) {
      console.log('🔑 使用GLM客户端生成作品讲解(快速, no thinking)...');
      try {
        // 首选快速模式（禁用thinking）
        response = await glmOptimizedClient.quickChat(messages, {
          temperature: 0.6,
          max_tokens: 1200
        });
        console.log('✅ GLM讲解生成成功(快速)');
      } catch (glmError) {
        console.error('❌ GLM快速讲解失败:', glmError);
        throw glmError;
      }
    } else {
      console.log('🔑 GLM不可用，使用OpenAI客户端生成作品讲解...');
      response = await openaiClient.chat(messages, {
        temperature: 0.7,
        max_tokens: 2048
      });
    }

    let content = response.choices[0]?.message?.content || '{}';
    let explanationData;
    
    try {
      explanationData = JSON.parse(content);
    } catch (error) {
      // 如果JSON解析失败，尝试提取JSON部分
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        explanationData = JSON.parse(jsonMatch[0]);
      } else {
        // 快速模式解析失败时，做一次thinking重试
        if (glmOptimizedClient.hasValidApiKey()) {
          console.log('🔁 讲解重试(启用thinking)...');
          const retry = await glmOptimizedClient.deepAnalysis(messages, {
            temperature: 0.6,
            max_tokens: 1200
          });
          content = retry.choices[0]?.message?.content || '{}';
          const retryMatch = content.match(/\{[\s\S]*\}/);
          if (retryMatch) {
            explanationData = JSON.parse(retryMatch[0]);
          } else {
            throw new Error('无法解析讲解结果');
          }
        } else {
          throw new Error('无法解析讲解结果');
        }
      }
    }

    const processingTime = Date.now() - startTime;
    
    return {
      artworkId: artwork.id,
      title: artwork.title,
      artist: artwork.artist,
      explanation: {
        emotionalConnection: explanationData.emotionalConnection || '这件作品通过其独特的艺术表现力，与您的情感需求产生了深刻的共鸣。',
        artisticAnalysis: explanationData.artisticAnalysis || '作品展现了艺术家独特的创作风格和技法。',
        historicalContext: explanationData.historicalContext || '这件作品在其创作时代具有重要的艺术史意义。',
        curationReason: explanationData.curationReason || '这件作品被选中是因为它完美地体现了策展主题。',
        userRelevance: explanationData.userRelevance || '这件作品与您的输入高度相关，能够满足您的艺术欣赏需求。'
      },
      confidence: Math.max(0, Math.min(1, explanationData.confidence || 0.8)),
      processingTime
    };
    
  } catch (error) {
    console.error('作品讲解生成失败:', error);
    throw error;
  }
}

// 带指数退避的重试封装，针对429/超时/网络错误
async function generateWithRetry<T>(fn: () => Promise<T>, delaysMs: number[]): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      // 外围超时保护（30s）
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('讲解生成超时')), 30000));
      // 竞速：函数 vs 超时
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await Promise.race([fn(), timeout]) as any as T;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes('429') || msg.includes('High concurrency') || msg.includes('Too Many Requests');
      const isTimeout = msg.includes('超时') || msg.includes('timeout') || msg.includes('aborted');
      const isRetriable = is429 || isTimeout;
      if (attempt === delaysMs.length || !isRetriable) break;
      const delay = delaysMs[attempt] + Math.floor(Math.random() * 200);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('讲解生成失败');
}

/**
 * 创建降级讲解
 */
function createFallbackExplanation(
  artwork: Artwork,
  emotion: string,
  userInput?: string
): ArtworkExplanation {
  return {
    artworkId: artwork.id,
    title: artwork.title,
    artist: artwork.artist,
    explanation: {
      emotionalConnection: `这件作品《${artwork.title}》通过其艺术表现力，与"${emotion}"情绪产生了共鸣。`,
      artisticAnalysis: `作品展现了${artwork.artist}独特的创作风格，在${artwork.year}年创作，使用了${artwork.medium}材质。`,
      historicalContext: `这件作品在其创作时代具有重要的艺术史意义，体现了当时的艺术思潮。`,
      curationReason: `这件作品被选中是因为它完美地体现了"${emotion}"这一主题的艺术表达。`,
      userRelevance: userInput ? `这件作品与您的输入"${userInput}"高度相关，能够满足您的艺术欣赏需求。` : '这件作品与您的情绪需求高度匹配。'
    },
    confidence: 0.6,
    processingTime: 0
  };
}

/**
 * 生成策展总结
 */
export async function generateCurationSummary(
  artworks: Artwork[],
  emotion: string,
  explanations: ArtworkExplanation[],
  userInput?: string
): Promise<string> {
  const prompt = `基于以下策展结果，生成一个简洁而深刻的策展总结。

策展主题：${emotion}
${userInput ? `用户需求：${userInput}` : ''}

策展作品：
${artworks.map((artwork, index) => 
  `${index + 1}. 《${artwork.title}》- ${artwork.artist} (${artwork.year})`
).join('\n')}

作品讲解要点：
${explanations.map((exp, index) => 
  `${index + 1}. ${exp.title}: ${exp.explanation.emotionalConnection}`
).join('\n')}

请生成一个200-300字的策展总结，包括：
1. 策展主题的核心理念
2. 作品选择的逻辑
3. 整体策展的艺术价值
4. 与用户需求的契合度

语言要求：专业而生动，富有感染力。`;

  const messages = [
    {
      role: 'system' as const,
      content: '你是一位资深的艺术策展人，擅长撰写富有感染力的策展总结。'
    },
    {
      role: 'user' as const,
      content: prompt
    }
  ];

  try {
    let response;
    
    // 优先使用GLM客户端，如果不可用则降级到OpenAI客户端
    if (glmOptimizedClient.hasValidApiKey()) {
      console.log('🔑 使用GLM客户端生成策展总结...');
      response = await glmOptimizedClient.deepAnalysis(messages, {
        temperature: 0.8,
        max_tokens: 512
      });
    } else {
      console.log('🔑 GLM不可用，使用OpenAI客户端生成策展总结...');
      response = await openaiClient.chat(messages, {
        temperature: 0.8,
        max_tokens: 512
      });
    }

    return response.choices[0]?.message?.content || '这是一个精心策划的艺术展览，展现了深刻的情感表达和艺术价值。';
  } catch (error) {
    console.error('策展总结生成失败:', error);
    return '这是一个精心策划的艺术展览，通过精选的作品展现了深刻的情感表达和艺术价值。';
  }
}

/**
 * 验证讲解质量
 */
export function validateExplanation(explanation: ArtworkExplanation): {
  valid: boolean;
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0;
  
  // 检查各个字段的完整性
  if (!explanation.explanation.emotionalConnection || explanation.explanation.emotionalConnection.length < 20) {
    issues.push('情绪关联分析过于简短');
  } else {
    score += 20;
  }
  
  if (!explanation.explanation.artisticAnalysis || explanation.explanation.artisticAnalysis.length < 20) {
    issues.push('艺术分析过于简短');
  } else {
    score += 20;
  }
  
  if (!explanation.explanation.historicalContext || explanation.explanation.historicalContext.length < 20) {
    issues.push('历史背景分析过于简短');
  } else {
    score += 20;
  }
  
  if (!explanation.explanation.curationReason || explanation.explanation.curationReason.length < 20) {
    issues.push('策展理由过于简短');
  } else {
    score += 20;
  }
  
  if (!explanation.explanation.userRelevance || explanation.explanation.userRelevance.length < 20) {
    issues.push('用户相关性分析过于简短');
  } else {
    score += 20;
  }
  
  return {
    valid: issues.length === 0,
    score,
    issues
  };
}
