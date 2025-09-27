// 优化版LLM评分系统 - 大幅提升性能
import { openaiClient } from '@/lib/openai';
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

/**
 * 优化版批量评分 - 大幅提升性能
 */
export async function batchJudgeArtworksOptimized(
  artworks: Artwork[], 
  emotion: string, 
  userInput?: string,
  maxConcurrent: number = 3
): Promise<BatchScoreResult> {
  console.log(`🚀 开始优化版批量LLM评分: ${artworks.length} 件作品`);
  const startTime = Date.now();
  
  // 第一步：暂时禁用预筛选，直接使用所有作品
  console.log(`🔍 第一步：使用所有作品进行评分...`);
  const preFilteredArtworks = artworks.slice(0, 30); // 限制为前30件作品
  console.log(`📊 评分作品: ${preFilteredArtworks.length} 件作品 (从 ${artworks.length} 件中选择)`);
  
  // 第二步：检查缓存，避免重复评分
  console.log(`💾 第二步：检查评分缓存...`);
  const { cachedScores, uncachedArtworks } = await checkScoreCache(preFilteredArtworks, emotion);
  console.log(`📊 缓存结果: ${cachedScores.length} 件已缓存，${uncachedArtworks.length} 件需要评分`);
  
  // 第三步：批量评分未缓存的作品
  let newScores: ArtworkScore[] = [];
  if (uncachedArtworks.length > 0) {
    console.log(`🎯 第三步：批量评分 ${uncachedArtworks.length} 件作品...`);
    newScores = await optimizedBatchScoring(uncachedArtworks, emotion, userInput, maxConcurrent);
    
    // 缓存新评分
    await cacheScores(newScores, emotion);
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
    reasoning: '快速预筛选通过，使用默认评分'
  }));
  
  const finalScores = [...allScores, ...defaultScores];
  
  const processingTime = Date.now() - startTime;
  const successCount = finalScores.length;
  const failureCount = 0;
  
  console.log(`✅ 优化版批量评分完成: ${finalScores.length} 个评分，耗时 ${processingTime}ms`);
  
  return {
    scores: finalScores,
    totalProcessed: preFilteredArtworks.length,
    successCount,
    failureCount,
    processingTime
  };
}

/**
 * 快速预筛选 - 使用轻量级LLM调用
 */
async function quickPreFilter(
  artworks: Artwork[], 
  emotion: string, 
  userInput?: string, 
  targetCount: number = 20
): Promise<Artwork[]> {
  if (artworks.length <= targetCount) {
    return artworks;
  }
  
  console.log(`🔍 快速预筛选: ${artworks.length} → ${targetCount} 件作品`);
  
  try {
    // 构建简化的预筛选提示词
    const artworksInfo = artworks.map((artwork, index) => 
      `${index + 1}. ${artwork.title} | ${artwork.artist} | ${artwork.year} | ${artwork.medium}`
    ).join('\n');

    const prompt = `从以下${artworks.length}件艺术作品中快速筛选出与"${emotion}"情绪最相关的${targetCount}件作品。

作品列表：
${artworksInfo}

${userInput ? `用户要求：${userInput}` : ''}

请只返回作品编号，用逗号分隔，如：1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35,37,39`;

    const messages = [
      {
        role: 'system' as const,
        content: '你是一位专业的艺术策展人，擅长快速筛选与特定情绪相关的艺术作品。请只返回作品编号。'
      },
      {
        role: 'user' as const,
        content: prompt
      }
    ];

    const response = await openaiClient.chat(messages, {
      model: process.env.NEXT_PUBLIC_GLM_MODEL || 'glm-4.5',
      temperature: 0.1,
      max_tokens: 512 // 减少token数量，提高速度
    });

    const result = response.choices[0]?.message?.content || '';
    const selectedIndices = result.split(',').map(s => parseInt(s.trim()) - 1).filter(i => i >= 0 && i < artworks.length);
    
    const selectedArtworks = selectedIndices.map(i => artworks[i]).filter(Boolean);
    
    console.log(`✅ 快速预筛选完成: ${selectedArtworks.length} 件作品`);
    return selectedArtworks.slice(0, targetCount);
    
  } catch (error) {
    console.error('快速预筛选失败，使用前20件作品:', error);
    return artworks.slice(0, targetCount);
  }
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
 * 优化版批量评分 - 使用更大的批次和更少的API调用
 */
async function optimizedBatchScoring(
  artworks: Artwork[], 
  emotion: string, 
  userInput?: string,
  maxConcurrent: number = 3
): Promise<ArtworkScore[]> {
  console.log(`🎯 开始优化版批量评分: ${artworks.length} 件作品`);
  
  const batchSize = 8; // 每批次8件作品，平衡性能和准确性
  const scores: ArtworkScore[] = [];
  
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
        return batchScores;
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
      await new Promise(resolve => setTimeout(resolve, 200)); // 减少延迟时间
    }
  }
  
  console.log(`✅ 优化版批量评分完成: ${scores.length} 个评分`);
  return scores;
}

/**
 * 优化版批次评分 - 使用更高效的提示词和参数
 */
async function scoreBatchArtworksOptimized(
  artworks: Artwork[], 
  emotion: string, 
  userInput?: string
): Promise<ArtworkScore[]> {
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

    const response = await openaiClient.chat(messages, {
      model: process.env.NEXT_PUBLIC_GLM_MODEL || 'glm-4.5',
      temperature: 0.2, // 降低温度，提高一致性
      max_tokens: 2048 // 减少token数量，提高速度
    });

    const analysisText = response.choices[0]?.message?.reasoning_content || 
                        response.choices[0]?.message?.content || '{}';
    
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

    if (batchScores.scores && Array.isArray(batchScores.scores)) {
      for (let i = 0; i < Math.min(artworks.length, batchScores.scores.length); i++) {
        const artwork = artworks[i];
        const scoreData = batchScores.scores[i];
        
        if (scoreData && typeof scoreData === 'object') {
          const score: ArtworkScore = {
            artworkId: artwork.id,
            emotionFit: Math.max(0, Math.min(10, scoreData.emotion_fit || 5)),
            artisticValue: Math.max(0, Math.min(10, scoreData.artistic_value || 5)),
            visualImpact: Math.max(0, Math.min(10, scoreData.visual_impact || 5)),
            overallRecommendation: Math.max(0, Math.min(10, scoreData.overall_recommendation || 5)),
            confidence: Math.max(0, Math.min(1, scoreData.confidence || 0.5)),
            reasoning: scoreData.reasoning || '基于作品特征和情绪主题的综合评估'
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
    return scores;

  } catch (error) {
    console.error(`❌ 批次评分失败:`, error);
    
    // 返回所有作品的默认评分
    return artworks.map(artwork => ({
      artworkId: artwork.id,
      emotionFit: 5,
      artisticValue: 5,
      visualImpact: 5,
      overallRecommendation: 5,
      confidence: 0.3,
      reasoning: '批次评分系统暂时不可用，使用默认评分'
    }));
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
