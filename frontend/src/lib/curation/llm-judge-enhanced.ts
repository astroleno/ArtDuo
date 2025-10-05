// 增强版LLM评分系统 - 带重试机制、降级处理和默认流程
import { glmOptimizedClient } from '@/lib/glm-optimized-client';
import { z } from 'zod';
import { Artwork } from './types';

/**
 * 作品评分结果接口
 */
export interface ArtworkScore {
  artworkId: string;
  emotionFit: number;        // 情绪契合度 (0-10)
  artisticValue: number;     // 艺术价值 (0-10)
  visualImpact: number;      // 视觉表现力 (0-10)
  overallRecommendation: number; // 整体推荐度 (0-10)
  confidence: number;        // 置信度 (0-1)
  reasoning: string;         // 评分理由
}

/**
 * 批量评分结果
 */
export interface BatchScoreResult {
  scores: ArtworkScore[];
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  processingTime: number;
  fallbackUsed: boolean;
  retryAttempts: number;
}

/**
 * 评分策略枚举
 */
enum ScoringStrategy {
  AI_FIRST = 'ai_first',           // 优先使用AI评分
  RULE_BASED_FALLBACK = 'rule_based', // 规则降级
  HYBRID = 'hybrid',               // 混合模式
  DEFAULT_ONLY = 'default_only'    // 仅使用默认评分
}

/**
 * 重试配置
 */
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;      // 基础延迟（毫秒）
  maxDelay: number;       // 最大延迟（毫秒）
  backoffMultiplier: number; // 退避倍数
  timeoutMs: number;      // 请求超时时间
}

/**
 * 降级策略配置
 */
interface FallbackConfig {
  enableRuleBasedScoring: boolean;
  enableDefaultScoring: boolean;
  minConfidenceThreshold: number;
  maxFailureRate: number;   // 最大失败率（0-1）
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 8000,
  backoffMultiplier: 2,
  timeoutMs: 30000
};

const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  enableRuleBasedScoring: true,
  enableDefaultScoring: true,
  minConfidenceThreshold: 0.3,
  maxFailureRate: 0.7
};

// 统一评分schema
const ScoreItemSchema = z.object({
  artwork_id: z.string().min(1),
  emotion_fit: z.number().min(0).max(10),
  artistic_value: z.number().min(0).max(10),
  visual_impact: z.number().min(0).max(10),
  overall_recommendation: z.number().min(0).max(10),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(10).max(300)
});

const BatchScoreSchema = z.object({
  scores: z.array(ScoreItemSchema),
  errors: z.array(z.any()).optional()
});

/**
 * 增强版批量评分系统
 */
export async function batchJudgeArtworksEnhanced(
  artworks: Artwork[],
  emotion: string,
  userInput?: string,
  options: {
    maxConcurrent?: number;
    strategy?: ScoringStrategy;
    retryConfig?: Partial<RetryConfig>;
    fallbackConfig?: Partial<FallbackConfig>;
  } = {}
): Promise<BatchScoreResult> {
  console.log(`🚀 开始增强版批量LLM评分: ${artworks.length} 件作品`);
  const startTime = Date.now();

  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
  const fallbackConfig = { ...DEFAULT_FALLBACK_CONFIG, ...options.fallbackConfig };
  const strategy = options.strategy || ScoringStrategy.AI_FIRST;

  let totalRetryAttempts = 0;
  let fallbackUsed = false;

  try {
    // 第一步：智能预筛选
    console.log(`🔍 第一步：智能预筛选...`);
    const preFilteredArtworks = await smartPreFilter(artworks, emotion, userInput, 18);
    console.log(`📊 预筛选结果: ${preFilteredArtworks.length} 件作品`);

    let scores: ArtworkScore[] = [];
    let parseFailures = 0;

    // 第二步：根据策略选择评分方法
    if (strategy === ScoringStrategy.DEFAULT_ONLY) {
      console.log(`📝 使用默认评分策略...`);
      scores = generateDefaultScores(preFilteredArtworks, emotion, userInput);
      fallbackUsed = true;
    } else {
      // 尝试AI评分
      console.log(`🤖 尝试AI评分（策略: ${strategy}）...`);
      const aiResult = await attemptAIScoring(
        preFilteredArtworks,
        emotion,
        userInput,
        retryConfig,
        totalRetryAttempts
      );

      scores = aiResult.scores;
      parseFailures = aiResult.failureCount;
      totalRetryAttempts = aiResult.retryAttempts;

      // 检查是否需要降级处理
      const failureRate = parseFailures / preFilteredArtworks.length;
      const needsFallback = failureRate > fallbackConfig.maxFailureRate || scores.length === 0;

      if (needsFallback && fallbackConfig.enableRuleBasedScoring) {
        console.log(`⚠️ AI评分失败率过高 (${(failureRate * 100).toFixed(1)}%)，启用降级处理...`);
        fallbackUsed = true;

        if (strategy === ScoringStrategy.HYBRID && scores.length > 0) {
          // 混合模式：保留部分AI结果，补充降级评分
          const remainingArtworks = preFilteredArtworks.filter(
            art => !scores.some(score => score.artworkId === art.id)
          );
          const fallbackScores = generateRuleBasedScores(remainingArtworks, emotion, userInput);
          scores = [...scores, ...fallbackScores];
        } else {
          // 完全降级
          scores = generateRuleBasedScores(preFilteredArtworks, emotion, userInput);
        }
      }
    }

    // 第三步：最终质量检查和补充
    const finalScores = await validateAndEnhanceScores(scores, preFilteredArtworks, emotion, fallbackConfig);

    const processingTime = Date.now() - startTime;
    const successCount = finalScores.filter(s => s.confidence >= fallbackConfig.minConfidenceThreshold).length;
    const failureCount = finalScores.length - successCount;

    console.log(`✅ 评分完成: ${successCount}成功, ${failureCount}失败, 耗时: ${processingTime}ms`);
    console.log(`🔄 重试次数: ${totalRetryAttempts}, 降级使用: ${fallbackUsed ? '是' : '否'}`);

    return {
      scores: finalScores,
      totalProcessed: preFilteredArtworks.length,
      successCount,
      failureCount,
      processingTime,
      fallbackUsed,
      retryAttempts: totalRetryAttempts
    };

  } catch (error) {
    console.error(`❌ 评分系统严重错误:`, error);

    // 最后的兜底策略
    const emergencyScores = generateDefaultScores(artworks, emotion, userInput);
    const processingTime = Date.now() - startTime;

    return {
      scores: emergencyScores,
      totalProcessed: artworks.length,
      successCount: emergencyScores.length,
      failureCount: 0,
      processingTime,
      fallbackUsed: true,
      retryAttempts: totalRetryAttempts
    };
  }
}

/**
 * AI评分尝试（带重试机制）
 */
async function attemptAIScoring(
  artworks: Artwork[],
  emotion: string,
  userInput?: string,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
  initialRetryCount: number = 0
): Promise<{ scores: ArtworkScore[], failureCount: number, retryAttempts: number }> {
  let retryAttempts = initialRetryCount;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(
        retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
        retryConfig.maxDelay
      );
      console.log(`🔄 AI评分重试 ${attempt}/${retryConfig.maxRetries}，等待 ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      retryAttempts++;
    }

    try {
      console.log(`🎯 AI评分尝试 ${attempt + 1}/${retryConfig.maxRetries + 1}...`);

      const result = await batchScoreWithGLM(artworks, emotion, userInput, retryConfig.timeoutMs);

      if (result.scores.length > 0) {
        console.log(`✅ AI评分成功: ${result.scores.length} 件作品`);
        return {
          scores: result.scores,
          failureCount: result.failureCount || 0,
          retryAttempts
        };
      } else {
        console.log(`⚠️ AI评分返回空结果，尝试重试...`);
        lastError = new Error('AI评分返回空结果');
      }

    } catch (error) {
      lastError = error as Error;
      console.log(`❌ AI评分尝试 ${attempt + 1} 失败:`, error.message);

      // 判断是否为可重试的错误
      if (!isRetryableError(error)) {
        console.log(`🚫 错误不可重试，直接降级处理`);
        break;
      }
    }
  }

  console.log(`💥 所有AI评分尝试失败，最后错误:`, lastError?.message);
  return { scores: [], failureCount: artworks.length, retryAttempts };
}

/**
 * 批量GLM评分调用
 */
async function batchScoreWithGLM(
  artworks: Artwork[],
  emotion: string,
  userInput?: string,
  timeoutMs: number = 45000
): Promise<{ scores: ArtworkScore[], failureCount: number }> {
  const batchSize = 20; // 单线处理，可以用更大批次提高效率
  const batches = [];

  for (let i = 0; i < artworks.length; i += batchSize) {
    batches.push(artworks.slice(i, i + batchSize));
  }

  console.log(`📦 分${batches.length}个批次进行评分，每批最多${batchSize}件作品`);

  const allScores: ArtworkScore[] = [];
  let failureCount = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`🎯 处理第${i + 1}/${batches.length}批: ${batch.length}件作品`);

    try {
      const prompt = generateScoringPrompt(batch, emotion, userInput);

      const response = await glmOptimizedClient.chat([
        {
          role: 'system' as const,
          content: '你是一个专业的艺术作品评分专家。请严格按照指定的JSON格式返回评分结果。'
        },
        {
          role: 'user' as const,
          content: prompt
        }
      ], {
        model: 'glm-4.5-air',
        temperature: 0.3,
        max_tokens: 2000,
        thinking: 'disabled'
      });

      if (response?.choices?.[0]?.message?.content) {
        const raw = response.choices[0].message.content;
        console.log(`📝 收到GLM响应，长度: ${raw.length}字符`);

        // 尝试解析JSON响应
        let parsed;
        try {
          // 清理可能的markdown标记
          const cleanJson = raw.replace(/```json\n?|\n?```/g, '').trim();
          parsed = JSON.parse(cleanJson);
        } catch (parseError) {
          console.log(`⚠️ JSON解析失败，尝试修复...`);
          parsed = attemptJsonRepair(raw);
        }

        if (parsed && parsed.scores && Array.isArray(parsed.scores)) {
          const batchScores = parsed.scores.map(item => ({
            artworkId: item.artwork_id,
            emotionFit: item.emotion_fit,
            artisticValue: item.artistic_value,
            visualImpact: item.visual_impact,
            overallRecommendation: item.overall_recommendation,
            confidence: item.confidence,
            reasoning: item.reasoning
          })).filter(score => score.artworkId && batch.some(art => art.id === score.artworkId));

          allScores.push(...batchScores);
          console.log(`✅ 批次${i + 1}成功: ${batchScores.length}件作品`);
        } else {
          console.log(`❌ 批次${i + 1}响应格式错误`);
          failureCount += batch.length;
        }
      } else {
        console.log(`❌ 批次${i + 1}无有效响应`);
        failureCount += batch.length;
      }

    } catch (error) {
      console.log(`❌ 批次${i + 1}处理失败:`, error.message);
      failureCount += batch.length;
    }

    // 单线处理，不需要批次间延迟
  }

  return { scores: allScores, failureCount };
}

/**
 * 基于规则的评分系统（降级策略）
 */
function generateRuleBasedScores(artworks: Artwork[], emotion: string, userInput?: string): ArtworkScore[] {
  console.log(`🔧 使用基于规则的评分系统: ${artworks.length} 件作品`);

  return artworks.map(artwork => {
    let emotionFit = 5.0;
    let artisticValue = 6.0;
    let visualImpact = 5.5;
    let confidence = 0.6;
    let reasoning = '';

    // 基于作品信息的规则评分
    const title = artwork.title?.toLowerCase() || '';
    const artist = artwork.artist?.toLowerCase() || '';
    const medium = artwork.medium?.toLowerCase() || '';
    const description = artwork.description?.toLowerCase() || '';

    // 情绪关键词匹配
    const emotionKeywords = getEmotionKeywords(emotion);
    const matchedKeywords = emotionKeywords.filter(keyword =>
      title.includes(keyword) || description.includes(keyword)
    );

    if (matchedKeywords.length > 0) {
      emotionFit = Math.min(8.0, emotionFit + matchedKeywords.length * 0.8);
      reasoning += `作品标题/描述包含情绪关键词: ${matchedKeywords.join(', ')}; `;
    }

    // 艺术家知名度评分
    const famousArtists = ['vincent van gogh', 'pablo picasso', 'claude monet', 'leonardo da vinci', 'rembrandt'];
    if (famousArtists.some(famous => artist.includes(famous))) {
      artisticValue = Math.min(9.5, artisticValue + 2.0);
      reasoning += '知名艺术家作品; ';
    }

    // 媒介类型评分
    if (medium.includes('oil') || medium.includes('painting')) {
      artisticValue += 0.5;
      visualImpact += 0.5;
      reasoning += '经典绘画媒介; ';
    }

    // 视觉冲击力评估
    if (artwork.imageUrl && !artwork.imageUrl.includes('unsplash')) {
      visualImpact += 1.0;
      reasoning += '高质量博物馆图像; ';
    }

    // 时间段加分
    if (artwork.year) {
      const year = parseInt(artwork.year);
      if (year >= 1800 && year <= 2000) {
        artisticValue += 0.3;
        reasoning += '近现代艺术作品; ';
      }
    }

    const overallRecommendation = (emotionFit + artisticValue + visualImpact) / 3;

    return {
      artworkId: artwork.id,
      emotionFit: Math.min(10, Math.max(0, emotionFit)),
      artisticValue: Math.min(10, Math.max(0, artisticValue)),
      visualImpact: Math.min(10, Math.max(0, visualImpact)),
      overallRecommendation: Math.min(10, Math.max(0, overallRecommendation)),
      confidence: Math.min(1, Math.max(0, confidence)),
      reasoning: reasoning || '基于规则的基础评分，综合考虑作品标题、艺术家、媒介等因素。'
    };
  });
}

/**
 * 默认评分系统（最后兜底）
 */
function generateDefaultScores(artworks: Artwork[], emotion: string, userInput?: string): ArtworkScore[] {
  console.log(`🛡️ 使用默认评分系统: ${artworks.length} 件作品`);

  // 基于情绪的基础分数
  const emotionBaseScores: Record<string, number> = {
    'joy': 7.0,
    'happy': 7.5,
    'peaceful': 6.5,
    'calm': 6.0,
    'melancholy': 6.0,
    'sad': 5.5,
    'lonely': 5.0,
    'exhausted': 5.0,
    'confused': 5.5,
    'anxious': 5.0,
    'heartbroken': 4.5,
    'nostalgic': 6.5,
    'hopeful': 7.0,
    'inspired': 7.5
  };

  const baseScore = emotionBaseScores[emotion.toLowerCase()] || 6.0;

  return artworks.map((artwork, index) => {
    // 简单的差异化评分，避免所有分数相同
    const variation = (Math.sin(index * 1.5) + 1) * 0.5; // 0-1的变化
    const emotionFit = baseScore + variation * 2 - 1; // ±1的变化
    const artisticValue = 6.0 + variation * 1.5;
    const visualImpact = 5.5 + variation * 2;
    const overallRecommendation = (emotionFit + artisticValue + visualImpact) / 3;

    return {
      artworkId: artwork.id,
      emotionFit: Math.min(10, Math.max(0, emotionFit)),
      artisticValue: Math.min(10, Math.max(0, artisticValue)),
      visualImpact: Math.min(10, Math.max(0, visualImpact)),
      overallRecommendation: Math.min(10, Math.max(0, overallRecommendation)),
      confidence: 0.4, // 默认评分置信度较低
      reasoning: `系统默认评分，基于"${emotion}"情绪的基础评估。建议通过AI评分获得更精准的结果。`
    };
  });
}

/**
 * 质量验证和增强
 */
async function validateAndEnhanceScores(
  scores: ArtworkScore[],
  artworks: Artwork[],
  emotion: string,
  fallbackConfig: FallbackConfig
): Promise<ArtworkScore[]> {
  console.log(`🔍 评分质量验证和增强...`);

  // 确保每件作品都有评分
  const scoredArtworkIds = new Set(scores.map(s => s.artworkId));
  const missingScores = artworks.filter(art => !scoredArtworkIds.has(art.id));

  if (missingScores.length > 0) {
    console.log(`📝 为${missingScores.length}件缺失作品生成补充评分...`);
    const supplementScores = generateDefaultScores(missingScores, emotion);
    scores.push(...supplementScores);
  }

  // 验证评分合理性
  return scores.map(score => {
    // 确保分数在合理范围内
    const validatedScore = {
      ...score,
      emotionFit: Math.min(10, Math.max(0, score.emotionFit)),
      artisticValue: Math.min(10, Math.max(0, score.artisticValue)),
      visualImpact: Math.min(10, Math.max(0, score.visualImpact)),
      overallRecommendation: Math.min(10, Math.max(0, score.overallRecommendation)),
      confidence: Math.min(1, Math.max(0, score.confidence))
    };

    // 如果置信度过低，调整推理文本
    if (validatedScore.confidence < fallbackConfig.minConfidenceThreshold) {
      validatedScore.reasoning += ' [低置信度评分，建议人工审核]';
    }

    return validatedScore;
  });
}

/**
 * 智能预筛选
 */
async function smartPreFilter(artworks: Artwork[], emotion: string, userInput?: string, maxCount: number = 18): Promise<Artwork[]> {
  // 优先选择有图像的作品
  const withImage = artworks.filter(art => art.imageUrl && art.imageUrl.trim() !== '');
  const withoutImage = artworks.filter(art => !art.imageUrl || art.imageUrl.trim() === '');

  // 在有图像的作品中优先选择绘画类
  const paintings = withImage.filter(art =>
    art.medium?.toLowerCase().includes('painting') ||
    art.medium?.toLowerCase().includes('oil') ||
    art.medium?.toLowerCase().includes('canvas')
  );
  const others = withImage.filter(art => !paintings.includes(art));

  // 按优先级组合
  const prioritized = [...paintings, ...others, ...withoutImage];

  // 确保多样性，避免同一艺术家过多
  const diversified: Artwork[] = [];
  const artistCount = new Map<string, number>();

  for (const artwork of prioritized) {
    const artistKey = artwork.artist || 'Unknown';
    const count = artistCount.get(artistKey) || 0;

    if (count < 3 || diversified.length < maxCount / 2) { // 前半部分允许重复，后半部分强制多样性
      diversified.push(artwork);
      artistCount.set(artistKey, count + 1);

      if (diversified.length >= maxCount) break;
    }
  }

  return diversified.slice(0, maxCount);
}

/**
 * 生成评分提示词
 */
function generateScoringPrompt(artworks: Artwork[], emotion: string, userInput?: string): string {
  const artworkList = artworks.map((art, index) =>
    `${index + 1}. ID:${art.id} 标题:"${art.title}" 艺术家:"${art.artist}" 年代:"${art.year}" 媒介:"${art.medium}"`
  ).join('\n');

  return `请为以下艺术作品进行情绪契合度评分。

用户情绪: ${emotion}
用户描述: ${userInput || '无'}

作品列表:
${artworkList}

请严格按照以下JSON格式返回评分结果:
{
  "scores": [
    {
      "artwork_id": "作品ID",
      "emotion_fit": 情绪契合度(0-10),
      "artistic_value": 艺术价值(0-10),
      "visual_impact": 视觉表现力(0-10),
      "overall_recommendation": 整体推荐度(0-10),
      "confidence": 置信度(0-1),
      "reasoning": "评分理由(10-300字)"
    }
  ]
}

评分标准:
- emotion_fit: 作品与"${emotion}"情绪的契合程度
- artistic_value: 艺术价值和历史意义
- visual_impact: 视觉冲击力和美学价值
- overall_recommendation: 综合推荐度
- confidence: 评分的置信程度
- reasoning: 详细说明评分理由`;
}

/**
 * 获取情绪关键词
 */
function getEmotionKeywords(emotion: string): string[] {
  const keywordMap: Record<string, string[]> = {
    'joy': ['happy', 'joy', 'celebration', 'bright', 'cheerful', 'festive'],
    'happy': ['happy', 'joy', 'smile', 'bright', 'positive', 'cheerful'],
    'peaceful': ['peaceful', 'calm', 'quiet', 'serene', 'tranquil', 'gentle'],
    'melancholy': ['melancholy', 'sad', 'somber', 'pensive', 'thoughtful', 'quiet'],
    'exhausted': ['tired', 'exhausted', 'weary', 'fatigue', 'rest', 'repose'],
    'lonely': ['lonely', 'solitude', 'alone', 'isolated', 'quiet', 'introspective'],
    'heartbroken': ['heartbreak', 'sad', 'loss', 'grief', 'pain', 'sorrow'],
    'confused': ['confused', 'uncertain', 'question', 'mystery', 'complex', 'puzzle'],
    'anxious': ['anxious', 'tension', 'stress', 'worry', 'concern', 'agitated'],
    'nostalgic': ['nostalgia', 'memory', 'past', 'remember', 'time', 'history'],
    'hopeful': ['hope', 'future', 'optimistic', 'bright', 'promise', 'forward'],
    'inspired': ['inspired', 'creative', 'passion', 'energy', 'vision', 'spirit']
  };

  return keywordMap[emotion.toLowerCase()] || [];
}

/**
 * 判断错误是否可重试
 */
function isRetryableError(error: Error): boolean {
  const retryablePatterns = [
    /timeout/i,
    /network/i,
    /connection/i,
    /rate limit/i,
    /too many requests/i,
    /temporarily unavailable/i,
    /internal server error/i,
    /502/i,
    /503/i,
    /504/i
  ];

  return retryablePatterns.some(pattern => pattern.test(error.message));
}

/**
 * 尝试修复损坏的JSON
 */
function attemptJsonRepair(raw: string): any {
  try {
    // 尝试常见的JSON修复
    let repaired = raw.trim();

    // 移除可能的markdown标记
    repaired = repaired.replace(/```json\n?|\n?```/g, '');

    // 查找JSON对象开始和结束
    const start = repaired.indexOf('{');
    const end = repaired.lastIndexOf('}');

    if (start !== -1 && end !== -1 && end > start) {
      repaired = repaired.substring(start, end + 1);
      return JSON.parse(repaired);
    }

    // 如果包含scores数组，尝试提取
    const scoresMatch = repaired.match(/"scores"\s*:\s*\[(.*?)\]/s);
    if (scoresMatch) {
      const scoresJson = `{"scores": [${scoresMatch[1]}]}`;
      return JSON.parse(scoresJson);
    }

    return null;
  } catch (error) {
    console.log(`JSON修复失败:`, error.message);
    return null;
  }
}