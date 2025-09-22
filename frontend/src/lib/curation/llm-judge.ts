// LLM评分系统 - 阶段5的核心功能
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
 * 对单个作品进行LLM评分
 */
export async function llmJudgeArtwork(
  artwork: Artwork, 
  emotion: string, 
  userInput?: string
): Promise<ArtworkScore> {
  console.log(`🧠 开始LLM评分作品: ${artwork.title}`);
  
  const prompt = buildJudgmentPrompt(artwork, emotion, userInput);
  
  const messages = [
    {
      role: 'system' as const,
      content: '你是一位专业的艺术策展人和艺术评论家，擅长从多个维度评估艺术作品。请始终返回有效的JSON格式。'
    },
    {
      role: 'user' as const,
      content: prompt
    }
  ];

  try {
    const response = await openaiClient.chat(messages, {
      model: 'glm-4.5',
      temperature: 0.3,
      max_tokens: 2048
    });

    const analysisText = response.choices[0]?.message?.reasoning_content || 
                        response.choices[0]?.message?.content || '{}';
    
    // 尝试解析JSON
    let scoreData;
    try {
      scoreData = JSON.parse(analysisText);
    } catch (error) {
      // 尝试从长文本中提取JSON
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        scoreData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法解析LLM评分结果');
      }
    }

    const score: ArtworkScore = {
      artworkId: artwork.id,
      emotionFit: Math.max(0, Math.min(10, scoreData.emotion_fit || 5)),
      artisticValue: Math.max(0, Math.min(10, scoreData.artistic_value || 5)),
      visualImpact: Math.max(0, Math.min(10, scoreData.visual_impact || 5)),
      overallRecommendation: Math.max(0, Math.min(10, scoreData.overall_recommendation || 5)),
      confidence: Math.max(0, Math.min(1, scoreData.confidence || 0.5)),
      reasoning: scoreData.reasoning || '基于作品特征和情绪主题的综合评估'
    };

    console.log(`✅ 作品评分完成: ${artwork.title} - 总分: ${score.overallRecommendation}`);
    return score;

  } catch (error) {
    console.error(`❌ 作品评分失败: ${artwork.title}`, error);
    
    // 返回默认评分
    return {
      artworkId: artwork.id,
      emotionFit: 5,
      artisticValue: 5,
      visualImpact: 5,
      overallRecommendation: 5,
      confidence: 0.3,
      reasoning: '评分系统暂时不可用，使用默认评分'
    };
  }
}

/**
 * 智能批量评分 - 从大量作品中筛选出最相关的进行评分
 */
export async function batchJudgeArtworks(
  artworks: Artwork[], 
  emotion: string, 
  userInput?: string,
  maxConcurrent: number = 4
): Promise<BatchScoreResult> {
  console.log(`🧠 开始智能批量LLM评分: ${artworks.length} 件作品`);
  const startTime = Date.now();
  
  // 第一步：从所有作品中筛选出最相关的40件作品
  console.log(`🔍 第一步：从 ${artworks.length} 件作品中筛选出最相关的40件...`);
  const filteredArtworks = await smartFilterArtworks(artworks, emotion, userInput, 40);
  console.log(`📊 筛选结果: ${filteredArtworks.length} 件作品通过智能筛选`);
  
  // 第二步：对筛选出的作品进行批量评分（优化策略）
  console.log(`🎯 第二步：对筛选出的作品进行批量评分...`);
  const scores: ArtworkScore[] = [];
  let successCount = 0;
  let failureCount = 0;

  // 使用更大的批次进行批量评分，减少API调用次数
  const batchSize = 12; // 每批次12件作品，减少API调用次数
  const maxConcurrentBatches = 2; // 最多2个批次并发
  
  for (let i = 0; i < filteredArtworks.length; i += batchSize * maxConcurrentBatches) {
    const currentBatch = filteredArtworks.slice(i, i + batchSize * maxConcurrentBatches);
    console.log(`🔄 处理批次组 ${Math.floor(i/(batchSize * maxConcurrentBatches)) + 1}: ${currentBatch.length} 件作品`);
    
    // 将当前批次分成多个子批次
    const subBatches = [];
    for (let j = 0; j < currentBatch.length; j += batchSize) {
      subBatches.push(currentBatch.slice(j, j + batchSize));
    }
    
    // 并发处理子批次
    const batchPromises = subBatches.map(async (subBatch, batchIndex) => {
      try {
        console.log(`  📝 子批次 ${batchIndex + 1}: ${subBatch.length} 件作品`);
        const batchScores = await scoreBatchArtworks(subBatch, emotion, userInput);
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
      successCount += batchScores.length;
    });
    
    // 批次间短暂延迟，避免API限制
    if (i + batchSize * maxConcurrentBatches < filteredArtworks.length) {
      await new Promise(resolve => setTimeout(resolve, 300)); // 减少延迟时间
    }
  }

  // 为未筛选的作品生成默认评分
  for (let i = 0; i < artworks.length; i++) {
    const artwork = artworks[i];
    const isFiltered = filteredArtworks.some(filtered => filtered.id === artwork.id);
    
    if (!isFiltered) {
      const defaultScore: ArtworkScore = {
        artworkId: artwork.id,
        emotionFit: 2,  // 未筛选的作品给很低的情绪契合度
        artisticValue: 5,
        visualImpact: 5,
        overallRecommendation: 3,
        confidence: 0.1,
        reasoning: '未通过智能筛选，使用默认评分'
      };
      scores.push(defaultScore);
    }
  }

  const processingTime = Date.now() - startTime;
  
  console.log(`✅ 智能批量评分完成: ${successCount} 成功, ${failureCount} 失败, 耗时: ${processingTime}ms`);
  
  return {
    scores,
    totalProcessed: artworks.length,
    successCount,
    failureCount,
    processingTime
  };
}

/**
 * 智能筛选高关联度作品 - 处理大量作品
 */
async function smartFilterArtworks(
  artworks: Artwork[], 
  emotion: string, 
  userInput?: string,
  targetCount: number = 25
): Promise<Artwork[]> {
  console.log(`🔍 开始智能筛选: ${artworks.length} 件作品，目标筛选出 ${targetCount} 件`);
  
  try {
    // 如果作品数量较少，直接返回
    if (artworks.length <= targetCount) {
      console.log(`📊 作品数量 ${artworks.length} <= 目标数量 ${targetCount}，直接返回所有作品`);
      return artworks;
    }
    
    // 构建智能筛选提示词
    const filterPrompt = buildSmartFilterPrompt(artworks, emotion, userInput, targetCount);
    
    const messages = [
      {
        role: 'system' as const,
        content: '你是一位专业的艺术策展人，擅长从大量艺术作品中筛选出与特定情绪主题最相关的作品。请始终返回有效的JSON格式。'
      },
      {
        role: 'user' as const,
        content: filterPrompt
      }
    ];

    console.log(`📝 发送智能筛选请求到LLM...`);
    const response = await openaiClient.chat(messages, {
      model: 'glm-4.5',
      temperature: 0.1,  // 降低温度，提高一致性
      max_tokens: 6144   // 增加token数量以处理更多作品
    });

    const analysisText = response.choices[0]?.message?.reasoning_content || 
                        response.choices[0]?.message?.content || '{}';
    
    console.log(`📥 收到智能筛选响应`);
    
    // 解析筛选结果
    let filterResult;
    try {
      filterResult = JSON.parse(analysisText);
    } catch (error) {
      console.error('智能筛选JSON解析失败，尝试提取:', error);
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        filterResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法解析智能筛选结果');
      }
    }

    // 提取筛选出的作品ID
    const selectedIds = filterResult.selected_ids || filterResult.selectedIds || [];
    console.log(`📊 筛选出 ${selectedIds.length} 件高关联度作品`);
    
    // 根据ID筛选作品
    const filteredArtworks = artworks.filter(artwork => 
      selectedIds.includes(artwork.id)
    );
    
    console.log(`✅ 智能筛选完成: ${filteredArtworks.length} 件作品`);
    return filteredArtworks;

  } catch (error) {
    console.error(`❌ 智能筛选失败:`, error);
    
    // 筛选失败时，返回前25件作品作为备选
    console.log(`🔄 使用备选方案: 返回前 ${targetCount} 件作品`);
    return artworks.slice(0, targetCount);
  }
}

/**
 * 构建智能筛选提示词 - 处理大量作品
 */
function buildSmartFilterPrompt(artworks: Artwork[], emotion: string, userInput?: string, targetCount: number = 25): string {
  // 为了处理大量作品，我们只显示关键信息
  const artworksInfo = artworks.map((artwork, index) => 
    `${index + 1}. ID: ${artwork.id} | ${artwork.title} | ${artwork.artist} | ${artwork.year} | ${artwork.medium}`
  ).join('\n');

  return `请从以下 ${artworks.length} 件艺术作品中筛选出与"${emotion}"情绪主题最相关的 ${targetCount} 件作品。

作品列表：
${artworksInfo}

${userInput ? `用户补充要求：${userInput}` : ''}

筛选标准：
1. 主题契合度：作品主题、内容是否与"${emotion}"情绪相关
2. 视觉表现：色彩、构图、风格是否体现"${emotion}"情绪
3. 艺术价值：作品的艺术价值和表现力
4. 多样性：确保筛选出的作品在风格、时期、艺术家等方面有适当多样性

请严格按照以下JSON格式返回筛选结果：

{
  "selected_ids": ["${artworks[0]?.id}", "${artworks[1]?.id}", "${artworks[2]?.id}"],
  "reasoning": "简要说明筛选理由和标准"
}

注意：
1. 必须选择 exactly ${targetCount} 件作品
2. 只返回作品ID数组，不要包含其他信息
3. 只返回JSON，不要包含任何其他文字
4. 确保JSON格式正确，可以被解析
5. 优先选择与"${emotion}"情绪最相关的作品`;
}

/**
 * 对单个批次的作品进行批量评分（优化版）
 */
async function scoreBatchArtworks(
  artworks: Artwork[], 
  emotion: string, 
  userInput?: string
): Promise<ArtworkScore[]> {
  console.log(`📝 开始批次批量评分: ${artworks.length} 件作品`);
  
  try {
    // 构建优化的批量评分提示词
    const batchPrompt = buildOptimizedBatchPrompt(artworks, emotion, userInput);
    
    const messages = [
      {
        role: 'system' as const,
        content: '你是一位专业的艺术策展人，擅长评估艺术作品与情绪主题的契合度。请严格按照JSON格式返回结果，不要包含任何其他文字。'
      },
      {
        role: 'user' as const,
        content: batchPrompt
      }
    ];

    console.log(`📤 发送批量评分请求到LLM...`);
    const response = await openaiClient.chat(messages, {
      model: 'glm-4.5',
      temperature: 0.1,  // 降低温度提高一致性
      max_tokens: 7168   // 进一步提升 token 上限
    });

    const analysisText = response.choices[0]?.message?.reasoning_content || 
                        response.choices[0]?.message?.content || '{}';
    
    console.log(`📥 收到批次评分响应`);
    
    // 增强的JSON解析逻辑
    let batchScores;
    try {
      batchScores = JSON.parse(analysisText);
    } catch (error) {
      console.error('批次评分JSON解析失败，尝试多种提取方法:', error);
      
      // 方法1: 提取第一个完整的JSON对象
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          batchScores = JSON.parse(jsonMatch[0]);
          console.log('✅ 方法1成功: 提取完整JSON对象');
        } catch (parseError) {
          console.error('方法1失败:', parseError);
        }
      }
      
      // 方法2: 如果方法1失败，尝试提取scores数组
      if (!batchScores) {
        const scoresMatch = analysisText.match(/"scores"\s*:\s*\[[\s\S]*?\]/);
        if (scoresMatch) {
          try {
            const scoresStr = scoresMatch[0].replace(/"scores"\s*:\s*/, '');
            const scores = JSON.parse(scoresStr);
            batchScores = { scores };
            console.log('✅ 方法2成功: 提取scores数组');
          } catch (parseError) {
            console.error('方法2失败:', parseError);
          }
        }
      }
      
      // 方法3: 如果前两种方法都失败，尝试逐行解析
      if (!batchScores) {
        console.log('🔄 尝试方法3: 逐行解析');
        const lines = analysisText.split('\n');
        const scores = [];
        
        for (const line of lines) {
          if (line.includes('artworkId') && line.includes('emotionFit')) {
            try {
              const scoreMatch = line.match(/\{[\s\S]*?\}/);
              if (scoreMatch) {
                const score = JSON.parse(scoreMatch[0]);
                scores.push(score);
              }
            } catch (parseError) {
              console.error('逐行解析失败:', parseError);
            }
          }
        }
        
        if (scores.length > 0) {
          batchScores = { scores };
          console.log(`✅ 方法3成功: 解析出 ${scores.length} 个评分`);
        }
      }
      
      if (!batchScores) {
        throw new Error('所有解析方法都失败');
      }
    }

    // 验证和标准化评分结果
    const scores: ArtworkScore[] = [];

    if (batchScores.scores && Array.isArray(batchScores.scores)) {
      // 如果是对象包含scores数组的格式
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
    } else if (Array.isArray(batchScores)) {
      // 如果是数组格式
      for (let i = 0; i < Math.min(artworks.length, batchScores.length); i++) {
        const artwork = artworks[i];
        const scoreData = batchScores[i];
        
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
    } else {
      throw new Error('批次评分结果格式不正确');
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

    // 验证评分结果的完整性
    if (scores.length !== artworks.length) {
      console.warn(`⚠️ 评分数量不匹配: 期望 ${artworks.length}，实际 ${scores.length}`);
      
      // 为缺失的评分生成默认值
      const existingIds = new Set(scores.map(s => s.artworkId));
      for (const artwork of artworks) {
        if (!existingIds.has(artwork.id)) {
          scores.push({
            artworkId: artwork.id,
            emotionFit: 5,
            artisticValue: 5,
            visualImpact: 5,
            overallRecommendation: 5,
            confidence: 0.3,
            reasoning: 'LLM评分缺失，使用默认评分'
          });
        }
      }
    }

    console.log(`✅ 批次批量评分完成: ${scores.length} 个评分`);
    return scores;

  } catch (error) {
    console.error(`❌ 批次多段评分失败:`, error);
    
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
 * 构建优化的批量评分提示词
 */
function buildOptimizedBatchPrompt(artworks: Artwork[], emotion: string, userInput?: string): string {
  const artworksInfo = artworks.map((artwork, index) => 
    `${index + 1}. 作品信息：
- 标题：${artwork.title}
- 艺术家：${artwork.artist}
- 创作年代：${artwork.year}
- 材质：${artwork.medium}
- 描述：${artwork.description}
- 博物馆：${artwork.museum}
- 作品ID：${artwork.id}`
  ).join('\n\n');

  return `请对以下${artworks.length}件艺术作品进行批量评分，评估其与"${emotion}"情绪主题的契合度：

${artworksInfo}

${userInput ? `用户补充要求：${userInput}` : ''}

评分标准：
1. emotion_fit (0-10): 与"${emotion}"情绪的契合度
2. artistic_value (0-10): 艺术价值和历史意义
3. visual_impact (0-10): 视觉冲击力和表现力
4. overall_recommendation (0-10): 综合推荐度
5. confidence (0-1): 评分置信度

严格按照以下JSON格式返回：

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

要求：
1. 必须为每件作品提供完整评分
2. 只返回JSON，不要其他文字
3. 确保JSON格式正确`;
}

/**
 * 构建单个作品评分提示词
 */
function buildJudgmentPrompt(artwork: Artwork, emotion: string, userInput?: string): string {
  return `请对以下艺术作品进行专业评分，评估其与"${emotion}"情绪主题的契合度：

作品信息：
- 标题：${artwork.title}
- 艺术家：${artwork.artist}
- 创作年代：${artwork.year}
- 材质：${artwork.medium}
- 描述：${artwork.description}
- 博物馆：${artwork.museum}
${userInput ? `- 用户补充：${userInput}` : ''}

请从以下四个维度进行评分（0-10分）：

1. 情绪契合度 (emotion_fit)：作品是否很好地表达了"${emotion}"情绪？
2. 艺术价值 (artistic_value)：作品的艺术价值和历史意义如何？
3. 视觉表现力 (visual_impact)：作品的视觉冲击力和表现力如何？
4. 整体推荐度 (overall_recommendation)：综合考虑，推荐度如何？

请严格按照以下JSON格式返回评分结果：

{
  "emotion_fit": 8,
  "artistic_value": 7,
  "visual_impact": 9,
  "overall_recommendation": 8,
  "confidence": 0.85,
  "reasoning": "详细说明评分理由，包括作品如何体现情绪主题，以及各个维度的具体分析"
}

注意：只返回JSON，不要包含任何其他文字。`;
}

/**
 * 计算综合评分
 */
export function calculateOverallScore(score: ArtworkScore): number {
  const weights = {
    emotionFit: 0.4,        // 情绪契合度权重最高
    artisticValue: 0.25,    // 艺术价值
    visualImpact: 0.25,     // 视觉表现力
    overallRecommendation: 0.1 // 整体推荐度
  };

  return (
    score.emotionFit * weights.emotionFit +
    score.artisticValue * weights.artisticValue +
    score.visualImpact * weights.visualImpact +
    score.overallRecommendation * weights.overallRecommendation
  );
}

/**
 * 根据评分排序作品
 */
export function sortArtworksByScore(artworks: Artwork[], scores: ArtworkScore[]): Artwork[] {
  const scoreMap = new Map(scores.map(score => [score.artworkId, score]));
  
  return artworks.sort((a, b) => {
    const scoreA = scoreMap.get(a.id);
    const scoreB = scoreMap.get(b.id);
    
    if (!scoreA || !scoreB) return 0;
    
    const overallA = calculateOverallScore(scoreA);
    const overallB = calculateOverallScore(scoreB);
    
    return overallB - overallA; // 降序排列
  });
}
