// 超优化LLM评分系统 - 使用智谱AI批处理和thinking模式控制
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
}

/**
 * 评分缓存接口
 */
interface ScoreCache {
  [key: string]: {
    score: ArtworkScore;
    timestamp: number;
    ttl: number;
  };
}

// 内存缓存
const scoreCache: ScoreCache = {};
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时

// 统一评分schema（LLM原始输出）
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
 * 超优化批量评分 - 使用智谱AI批处理API
 */
export async function batchJudgeArtworksUltraOptimized(
  artworks: Artwork[], 
  emotion: string, 
  userInput?: string,
  maxConcurrent: number = 5
): Promise<BatchScoreResult> {
  console.log(`🚀 开始超优化批量LLM评分: ${artworks.length} 件作品`);
  const startTime = Date.now();
  
  // 第一步：智能预筛选，减少评分工作量
  console.log(`🔍 第一步：智能预筛选...`);
  const preFilteredArtworks = await smartPreFilter(artworks, emotion, userInput, 25);
  console.log(`📊 预筛选结果: ${preFilteredArtworks.length} 件作品 (从 ${artworks.length} 件中筛选)`);
  
  // 第二步：检查缓存，避免重复评分
  console.log(`💾 第二步：检查评分缓存...`);
  const { cachedScores, uncachedArtworks } = await checkScoreCache(preFilteredArtworks, emotion);
  console.log(`📊 缓存结果: ${cachedScores.length} 件已缓存，${uncachedArtworks.length} 件需要评分`);
  
  // 第三步：批量评分未缓存的作品（使用智谱AI批处理API）
  let newScores: ArtworkScore[] = [];
  let parseFailures = 0;
  if (uncachedArtworks.length > 0) {
    console.log(`🎯 第三步：使用批处理API评分 ${uncachedArtworks.length} 件作品...`);
    try {
      const res = await batchScoreWithGLM(uncachedArtworks, emotion, userInput);
      newScores = res.scores;
      parseFailures += res.failureCount || 0;
      
      // 缓存新评分
      await cacheScores(newScores, emotion);
    } catch (error) {
      console.error('批处理评分失败，使用传统方法:', error);
      const fallbackRes = await fallbackBatchScoring(uncachedArtworks, emotion, userInput, maxConcurrent);
      newScores = fallbackRes.scores;
      parseFailures += fallbackRes.failureCount || 0;
    }
  }
  
  // 第四步：合并所有评分
  const allScores = [...cachedScores, ...newScores];
  
  // 为未评分的作品添加默认评分
  const scoredIds = new Set(allScores.map(s => s.artworkId));
  const unscoredArtworks = preFilteredArtworks.filter(a => !scoredIds.has(a.id));
  
  const defaultScores = unscoredArtworks.map(artwork => ({
    artworkId: artwork.id,
    emotionFit: 5,
    artisticValue: 5,
    visualImpact: 5,
    overallRecommendation: 5,
    confidence: 0.3,
    reasoning: '智能预筛选通过，使用默认评分'
  }));
  
  const finalScores = [...allScores, ...defaultScores];
  
  const processingTime = Date.now() - startTime;
  const successCount = finalScores.length;
  const failureCount = parseFailures;
  
  console.log(`✅ 超优化批量评分完成: ${finalScores.length} 个评分，耗时 ${processingTime}ms`);
  
  return {
    scores: finalScores,
    totalProcessed: preFilteredArtworks.length,
    successCount,
    failureCount,
    processingTime
  };
}

/**
 * 智能预筛选 - 使用快速LLM调用
 */
async function smartPreFilter(
  artworks: Artwork[], 
  emotion: string, 
  userInput?: string, 
  targetCount: number = 25
): Promise<Artwork[]> {
  // 配置
  const envTarget = Number(process.env.NEXT_PUBLIC_PREFILTER_COUNT || process.env.PREFILTER_COUNT || targetCount);
  const finalTarget = Number.isFinite(envTarget) && envTarget > 0 ? envTarget : targetCount;
  const ratio = Number(process.env.NEXT_PUBLIC_PREFILTER_RATIO || process.env.PREFILTER_RATIO || 0.3);
  const minK = Number(process.env.NEXT_PUBLIC_PREFILTER_MIN || process.env.PREFILTER_MIN || 10);
  const maxK = Number(process.env.NEXT_PUBLIC_PREFILTER_MAX || process.env.PREFILTER_MAX || 40);
  const mode = String(process.env.NEXT_PUBLIC_PREFILTER_MODE || process.env.PREFILTER_MODE || 'rule');

  // 规则轻评分（无API成本）
  const keywords = [emotion, ...(userInput ? userInput.split(/\s+/).slice(0, 4) : [])]
    .filter(Boolean)
    .map(k => String(k).toLowerCase());

  const sourcePriority: Record<string, number> = { met: 1.0, rijks: 0.9 };

  function computeLightScore(art: any): number {
    const title = (art.title || '').toLowerCase();
    const desc = (art.description || '').toLowerCase();
    const medium = (art.medium || '').toLowerCase();
    const artist = (art.artist || '').toLowerCase();
    const src = (art.source || '').toLowerCase();

    // 关键词命中（标题加权更高）
    let score = 0;
    for (const kw of keywords) {
      if (!kw) continue;
      if (title.includes(kw)) score += 3.0;
      if (desc.includes(kw)) score += 1.5;
      if (medium.includes(kw) || artist.includes(kw)) score += 0.5;
    }

    // 有图/高质量来源
    if (art.image || art.primaryImage || art.webImage) score += 1.0;
    score += sourcePriority[src] ? sourcePriority[src] : 0.2;

    // 年代与材质的基本加分
    const year = Number(String(art.year || art.objectDate || '').match(/\d{3,4}/)?.[0] || 0);
    if (year >= 1500 && year <= 2025) score += 0.4;
    if (medium) score += 0.2;

    return score;
  }

  // 计算轻评分与排序
  const scored = artworks.map(a => ({ a, s: computeLightScore(a) }));
  scored.sort((x, y) => y.s - x.s);

  // 比例截取
  const proposedK = Math.round(scored.length * (Number.isFinite(ratio) && ratio > 0 && ratio <= 1 ? ratio : 0.3));
  const capK = Math.max(minK, Math.min(maxK, proposedK));
  const take = Math.min(scored.length, Math.max(capK, finalTarget));

  console.log(`🔍 智能预筛选(rule): ${artworks.length} → ${take} 件作品 (ratio=${ratio}, min=${minK}, max=${maxK}, target=${finalTarget})`);

  const result = scored.slice(0, take).map(x => x.a);
  console.log(`✅ 智能预筛选完成: ${result.length} 件作品 (轻评分排序+比例截取)`);
  return result;
}

/**
 * 使用智谱AI批处理API进行评分
 */
async function batchScoreWithGLM(
  artworks: Artwork[], 
  emotion: string, 
  userInput?: string
): Promise<{ scores: ArtworkScore[]; failureCount: number }> {
  console.log(`🎯 使用智谱AI批处理API评分: ${artworks.length} 件作品`);
  
  try {
    // 准备批处理请求
    const batchRequests = artworks.map(artwork => ({
      custom_id: `score_${artwork.id}`,
      messages: [
        {
          role: 'system' as const,
          content: '你是一位专业的艺术策展人，请对艺术作品进行评分。只返回JSON格式的评分结果。'
        },
        {
          role: 'user' as const,
          content: `对作品"${artwork.title}"进行评分，评估与"${emotion}"情绪的契合度。返回JSON格式：{"emotion_fit": 0-10, "artistic_value": 0-10, "visual_impact": 0-10, "overall_recommendation": 0-10, "confidence": 0-1, "reasoning": "评分理由"}`
        }
      ],
      options: {
        temperature: 0.2,
        max_tokens: 200,
        thinking: 'disabled' as const // 快速评分，不需要深度推理
      }
    }));

    // 调用批处理API
    const results = await glmOptimizedClient.batchProcess(batchRequests);
    
    // 解析结果
    const scores: ArtworkScore[] = [];
    let failureCount = 0;
    for (const result of results) {
      if (result.response && result.response.status_code === 200) {
        try {
          const raw = JSON.parse(result.response.body.choices[0]?.message?.content || '{}');
          const artworkId = result.custom_id.replace('score_', '');

          // 支持直接对象或包含scores数组
          let validItem: z.infer<typeof ScoreItemSchema> | null = null;
          if (raw && typeof raw === 'object' && Array.isArray(raw.scores)) {
            const parsed = BatchScoreSchema.safeParse(raw);
            if (parsed.success && parsed.data.scores.length > 0) {
              validItem = parsed.data.scores[0];
            }
          } else {
            const parsed = ScoreItemSchema.safeParse({ ...raw, artwork_id: raw.artwork_id || artworkId });
            if (parsed.success) {
              validItem = parsed.data;
            }
          }

          if (!validItem) {
            failureCount++;
            scores.push({
              artworkId,
              emotionFit: 5,
              artisticValue: 5,
              visualImpact: 5,
              overallRecommendation: 5,
              confidence: 0.3,
              reasoning: '评分解析失败，使用默认评分'
            });
          } else {
            scores.push({
              artworkId,
              emotionFit: validItem.emotion_fit,
              artisticValue: validItem.artistic_value,
              visualImpact: validItem.visual_impact,
              overallRecommendation: validItem.overall_recommendation,
              confidence: validItem.confidence,
              reasoning: validItem.reasoning
            });
          }
        } catch (error) {
          console.error('解析评分结果失败:', error);
          const artworkId = result.custom_id.replace('score_', '');
          failureCount++;
          scores.push({
            artworkId,
            emotionFit: 5,
            artisticValue: 5,
            visualImpact: 5,
            overallRecommendation: 5,
            confidence: 0.3,
            reasoning: '评分解析异常，使用默认评分'
          });
        }
      }
    }
    
    console.log(`✅ 批处理评分完成: ${scores.length} 个评分`);
    return { scores, failureCount };
    
  } catch (error) {
    console.error('批处理评分失败:', error);
    throw error;
  }
}

/**
 * 降级批量评分 - 使用传统方法
 */
async function fallbackBatchScoring(
  artworks: Artwork[], 
  emotion: string, 
  userInput?: string,
  maxConcurrent: number = 5
): Promise<{ scores: ArtworkScore[]; failureCount: number }> {
  console.log(`🔄 使用降级批量评分: ${artworks.length} 件作品`);
  
  const batchSize = 6; // 每批次6件作品
  const scores: ArtworkScore[] = [];
  let failureCount = 0;
  
  // 分批处理
  for (let i = 0; i < artworks.length; i += batchSize * maxConcurrent) {
    const currentBatch = artworks.slice(i, i + batchSize * maxConcurrent);
    console.log(`🔄 处理批次组: ${currentBatch.length} 件作品`);
    
    // 将当前批次分成多个子批次
    const subBatches = [];
    for (let j = 0; j < currentBatch.length; j += batchSize) {
      subBatches.push(currentBatch.slice(j, j + batchSize));
    }
    
    // 并发处理子批次
    const batchPromises = subBatches.map(async (subBatch, batchIndex) => {
      try {
        console.log(`  📝 子批次 ${batchIndex + 1}: ${subBatch.length} 件作品`);
        const batchScores = await scoreBatchArtworksOptimized(subBatch, emotion, userInput);
        failureCount += batchScores.failureCount;
        return batchScores.scores;
      } catch (error) {
        console.error(`子批次 ${batchIndex + 1} 评分失败:`, error);
        return [];
      }
    });

    const batchResults = await Promise.all(batchPromises);
    
    // 合并结果
    batchResults.forEach(batchScores => {
      scores.push(...batchScores);
    });
    
    // 批次间短暂延迟，避免API限制
    if (i + batchSize * maxConcurrent < artworks.length) {
      await new Promise(resolve => setTimeout(resolve, 100)); // 减少延迟时间
    }
  }
  
  console.log(`✅ 降级批量评分完成: ${scores.length} 个评分`);
  return { scores, failureCount };
}

/**
 * 优化版批次评分 - 使用快速LLM调用
 */
async function scoreBatchArtworksOptimized(
  artworks: Artwork[], 
  emotion: string, 
  userInput?: string
): Promise<{ scores: ArtworkScore[]; failureCount: number }> {
  console.log(`📝 开始批次评分: ${artworks.length} 件作品`);
  
  try {
    const prompt = buildOptimizedBatchPrompt(artworks, emotion, userInput);
    
    const messages = [
      {
        role: 'system' as const,
        content: '你是一位专业的艺术策展人，擅长批量评估艺术作品。请严格按照JSON格式返回评分结果。'
      },
      {
        role: 'user' as const,
        content: prompt
      }
    ];

    // 使用快速模式，禁用thinking
    const response = await glmOptimizedClient.quickChat(messages, {
      temperature: 0.2,
      max_tokens: 1536
    });

    const analysisText = response.choices[0]?.message?.content || '{}';
    
    // 解析评分结果
    let batchScores;
    try {
      batchScores = JSON.parse(analysisText);
    } catch (error) {
      console.error('批次评分JSON解析失败，尝试提取:', error);
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        batchScores = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法解析批次评分结果');
      }
    }

    // 验证和标准化评分结果
    const scores: ArtworkScore[] = [];
    let failureCount = 0;

    if (batchScores.scores && Array.isArray(batchScores.scores)) {
      // Zod校验整个批次
      const parsed = BatchScoreSchema.safeParse(batchScores);
      const scoreArray = parsed.success ? parsed.data.scores : batchScores.scores;
      if (!parsed.success) {
        failureCount += 1;
      }

      for (let i = 0; i < Math.min(artworks.length, scoreArray.length); i++) {
        const artwork = artworks[i];
        const scoreData = scoreArray[i];
        
        if (scoreData && typeof scoreData === 'object') {
          // 单条兜底校验
          const itemParsed = ScoreItemSchema.safeParse({ ...scoreData, artwork_id: scoreData.artwork_id || artwork.id });
          if (!itemParsed.success) {
            failureCount += 1;
            scores.push({
              artworkId: artwork.id,
              emotionFit: 5,
              artisticValue: 5,
              visualImpact: 5,
              overallRecommendation: 5,
              confidence: 0.3,
              reasoning: '评分校验失败，使用默认评分'
            });
            continue;
          }

          const score: ArtworkScore = {
            artworkId: artwork.id,
            emotionFit: itemParsed.data.emotion_fit,
            artisticValue: itemParsed.data.artistic_value,
            visualImpact: itemParsed.data.visual_impact,
            overallRecommendation: itemParsed.data.overall_recommendation,
            confidence: itemParsed.data.confidence,
            reasoning: itemParsed.data.reasoning
          };
          scores.push(score);
        } else {
          // 添加默认评分
          scores.push({
            artworkId: artwork.id,
            emotionFit: 5,
            artisticValue: 5,
            visualImpact: 5,
            overallRecommendation: 5,
            confidence: 0.3,
            reasoning: '批次评分中未获得有效评分，使用默认评分'
          });
          failureCount += 1;
        }
      }
    }

    // 为批次中未获得评分的作品添加默认评分
    for (let i = scores.length; i < artworks.length; i++) {
      const artwork = artworks[i];
      scores.push({
        artworkId: artwork.id,
        emotionFit: 5,
        artisticValue: 5,
        visualImpact: 5,
        overallRecommendation: 5,
        confidence: 0.3,
        reasoning: '批次评分中未获得有效评分，使用默认评分'
      });
    }

    console.log(`✅ 批次评分完成: ${scores.length} 个评分`);
    return { scores, failureCount };

  } catch (error) {
    console.error(`❌ 批次评分失败:`, error);
    
    // 返回所有作品的默认评分
    return {
      scores: artworks.map(artwork => ({
        artworkId: artwork.id,
        emotionFit: 5,
        artisticValue: 5,
        visualImpact: 5,
        overallRecommendation: 5,
        confidence: 0.3,
        reasoning: '批次评分系统暂时不可用，使用默认评分'
      })),
      failureCount: artworks.length
    };
  }
}

/**
 * 构建优化的批量评分提示词 - 更简洁高效
 */
function buildOptimizedBatchPrompt(artworks: Artwork[], emotion: string, userInput?: string): string {
  const artworksInfo = artworks.map((artwork, index) => 
    `${index + 1}. ${artwork.title} | ${artwork.artist} | ${artwork.year} | ${artwork.medium} | ID:${artwork.id}`
  ).join('\n');

  return `对以下${artworks.length}件艺术作品进行批量评分，评估与"${emotion}"情绪的契合度：

${artworksInfo}

${userInput ? `用户要求：${userInput}` : ''}

评分标准：
- emotion_fit (0-10): 与"${emotion}"情绪的契合度
- artistic_value (0-10): 艺术价值
- visual_impact (0-10): 视觉冲击力
- overall_recommendation (0-10): 综合推荐度
- confidence (0-1): 评分置信度

返回JSON格式：
{
  "scores": [
    {
      "artwork_id": "${artworks[0]?.id}",
      "emotion_fit": 8,
      "artistic_value": 7,
      "visual_impact": 9,
      "overall_recommendation": 8,
      "confidence": 0.85,
      "reasoning": "评分理由"
    }
  ]
}

要求：只返回JSON，确保格式正确。`;
}

/**
 * 检查评分缓存
 */
async function checkScoreCache(artworks: Artwork[], emotion: string): Promise<{
  cachedScores: ArtworkScore[];
  uncachedArtworks: Artwork[];
}> {
  const cachedScores: ArtworkScore[] = [];
  const uncachedArtworks: Artwork[] = [];
  
  const now = Date.now();
  
  for (const artwork of artworks) {
    const cacheKey = `${artwork.id}-${emotion}`;
    const cached = scoreCache[cacheKey];
    
    if (cached && (now - cached.timestamp) < cached.ttl) {
      cachedScores.push(cached.score);
    } else {
      uncachedArtworks.push(artwork);
    }
  }
  
  return { cachedScores, uncachedArtworks };
}

/**
 * 缓存评分结果
 */
async function cacheScores(scores: ArtworkScore[], emotion: string): Promise<void> {
  const now = Date.now();
  
  for (const score of scores) {
    const cacheKey = `${score.artworkId}-${emotion}`;
    scoreCache[cacheKey] = {
      score,
      timestamp: now,
      ttl: CACHE_TTL
    };
  }
}

/**
 * 清理过期缓存
 */
export function cleanupExpiredCache(): void {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const key in scoreCache) {
    const cached = scoreCache[key];
    if ((now - cached.timestamp) >= cached.ttl) {
      delete scoreCache[key];
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 清理过期缓存: ${cleanedCount} 个条目`);
  }
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats(): { total: number; size: number } {
  const total = Object.keys(scoreCache).length;
  const size = JSON.stringify(scoreCache).length;
  
  return { total, size };
}
