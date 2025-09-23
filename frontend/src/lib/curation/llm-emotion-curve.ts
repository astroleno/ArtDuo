// LLM驱动的个性化情绪曲线生成器
import { Artwork } from './types';
import { ArtworkScore } from './llm-judge-ultra-optimized';
import { glmClient } from '@/lib/glm-optimized-client';
import { EmotionPoint } from './emotion-curve';

/**
 * LLM生成的情绪曲线设计
 */
export interface LLMEmotionCurveDesign {
  curveType: 'ascending' | 'descending' | 'wave' | 'peak' | 'valley' | 'complex';
  totalStages: number;
  emotionJourney: {
    stage: number;
    stageName: string;
    intensity: number; // 0-1
    description: string;
    artworkRequirement: string;
    visualMood: string;
  }[];
  overallNarrative: string;
  transitionLogic: string;
  colorPalette: string[];
}

/**
 * LLM驱动的情绪曲线生成器
 */
export class LLMEmotionCurveGenerator {
  
  /**
   * 基于用户输入生成个性化情绪曲线设计
   */
  static async generatePersonalizedCurve(
    emotion: string,
    userInput: string,
    artworkCount: number = 9
  ): Promise<LLMEmotionCurveDesign> {
    console.log(`🧠 开始LLM个性化情绪曲线生成: ${emotion}`);
    
    const prompt = `你是一位专业的艺术策展人和心理学专家。请为用户的情绪体验设计一条个性化的艺术观展情绪曲线。

用户情绪：${emotion}
用户描述：${userInput}
作品数量：${artworkCount}

请深度分析用户的情绪状态和具体情境，设计一条能够引导用户情绪转化的艺术观展曲线。

设计要求：
1. 基于用户的具体情境，不要使用模板化的情绪处理
2. 考虑艺术作品的观展顺序如何影响情绪体验
3. 设计合理的情绪起伏，避免单调或过于剧烈
4. 每个阶段都要有明确的艺术作品要求和情绪目标
5. 整体要形成一个有意义的情绪旅程

返回JSON格式：
{
  "curveType": "complex",
  "totalStages": ${artworkCount},
  "emotionJourney": [
    {
      "stage": 1,
      "stageName": "阶段名称",
      "intensity": 0.8,
      "description": "这个阶段的情绪特征和目标",
      "artworkRequirement": "需要什么类型的艺术作品",
      "visualMood": "视觉氛围描述"
    }
  ],
  "overallNarrative": "整个情绪旅程的叙事逻辑",
  "transitionLogic": "情绪转换的心理学原理",
  "colorPalette": ["#color1", "#color2", "#color3"]
}`;

    try {
      const messages = [
        {
          role: 'system' as const,
          content: '你是一位结合艺术治疗和策展经验的专家，擅长设计个性化的艺术情绪体验。请始终返回有效的JSON格式。'
        },
        {
          role: 'user' as const,
          content: prompt
        }
      ];

      console.log('🧠 [DEBUG] 开始调用LLM生成情绪曲线设计...');
      console.log('🧠 [DEBUG] 提示词长度:', prompt.length);
      console.log('🧠 [DEBUG] GLM客户端可用性:', glmClient.hasValidApiKey());
      
      const response = await glmClient.chat(messages, {
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
        thinking: 'disabled'
      });
      
      console.log('🧠 [DEBUG] LLM响应成功，内容长度:', response.choices[0]?.message?.content?.length || 0);

      const curveDesignText = response.choices[0]?.message?.content || '{}';
      
      // 解析LLM返回的情绪曲线设计
      let curveDesign: LLMEmotionCurveDesign;
      try {
        curveDesign = JSON.parse(curveDesignText);
      } catch (error) {
        console.error('❌ LLM情绪曲线设计解析失败:', error);
        // 返回默认设计
        curveDesign = this.getDefaultCurveDesign(emotion, userInput, artworkCount);
      }

      // 验证和修正设计
      curveDesign = this.validateAndFixCurveDesign(curveDesign, artworkCount);
      
      console.log('✅ LLM情绪曲线设计生成完成:', curveDesign.overallNarrative);
      return curveDesign;

    } catch (error) {
      console.error('❌ [DEBUG] LLM情绪曲线生成失败:', error);
      console.error('❌ [DEBUG] 错误详情:', JSON.stringify(error, null, 2));
      console.log('🔄 [DEBUG] 使用降级方案生成情绪曲线');
      return this.getDefaultCurveDesign(emotion, userInput, artworkCount);
    }
  }

  /**
   * 将LLM设计转换为具体的情绪曲线点
   */
  static convertDesignToCurve(
    design: LLMEmotionCurveDesign,
    artworks: Artwork[],
    scores: ArtworkScore[]
  ): EmotionPoint[] {
    console.log('🎨 将LLM设计转换为情绪曲线点...');
    
    const curve: EmotionPoint[] = [];
    const artworkCount = Math.min(artworks.length, design.totalStages);
    
    // 为每个阶段分配作品和生成曲线点
    for (let i = 0; i < artworkCount; i++) {
      const stage = design.emotionJourney[i] || design.emotionJourney[design.emotionJourney.length - 1];
      
      const emotionPoint: EmotionPoint = {
        position: i / (artworkCount - 1), // 0 到 1
        intensity: stage.intensity,
        artworkId: artworks[i]?.id
      };
      
      curve.push(emotionPoint);
    }
    
    console.log(`✅ 情绪曲线点生成完成，共${curve.length}个点`);
    return curve;
  }

  /**
   * 智能作品排序 - 根据LLM设计匹配最佳作品
   */
  static async intelligentArtworkOrdering(
    design: LLMEmotionCurveDesign,
    artworks: Artwork[],
    scores: ArtworkScore[],
    emotion: string,
    userInput: string
  ): Promise<Artwork[]> {
    console.log('🎯 开始智能作品排序...');
    
    // 构建作品匹配提示词
    const artworkInfo = artworks.map((artwork, index) => ({
      index,
      title: artwork.title,
      artist: artwork.artist,
      year: artwork.year,
      medium: artwork.medium,
      description: artwork.description?.substring(0, 200) || '',
      score: scores.find(s => s.artworkId === artwork.id)?.overallRecommendation || 5
    }));

    const prompt = `你是艺术策展专家。请根据情绪曲线设计，为每个阶段选择最合适的艺术作品。

用户情绪：${emotion}
用户描述：${userInput}

情绪曲线设计：
${design.emotionJourney.map((stage, i) => 
  `阶段${i+1}: ${stage.stageName} (强度${stage.intensity}) - ${stage.description}
  需求: ${stage.artworkRequirement}`
).join('\n')}

可选作品列表：
${artworkInfo.map(art => 
  `[${art.index}] ${art.title} - ${art.artist} (${art.year})
  媒介: ${art.medium} | 评分: ${art.score}
  描述: ${art.description}`
).join('\n\n')}

请为每个阶段选择最匹配的作品，返回JSON格式：
{
  "selections": [
    {
      "stage": 1,
      "artworkIndex": 0,
      "matchingReason": "选择理由"
    }
  ]
}`;

    try {
      const messages = [
        {
          role: 'system' as const,
          content: '你是专业的艺术策展人，擅长根据情绪设计选择和排序艺术作品。请始终返回有效的JSON格式。'
        },
        {
          role: 'user' as const,
          content: prompt
        }
      ];

      const response = await glmClient.chat(messages, {
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        thinking: 'disabled'
      });

      const selectionText = response.choices[0]?.message?.content || '{}';
      const selection = JSON.parse(selectionText);
      
      // 根据选择结果重新排序作品
      const orderedArtworks: Artwork[] = [];
      const usedIndices = new Set<number>();
      
      // 按阶段顺序添加选中的作品
      for (const sel of selection.selections || []) {
        const artworkIndex = sel.artworkIndex;
        if (artworkIndex >= 0 && artworkIndex < artworks.length && !usedIndices.has(artworkIndex)) {
          orderedArtworks.push(artworks[artworkIndex]);
          usedIndices.add(artworkIndex);
          console.log(`📍 阶段${sel.stage}: 选择作品 "${artworks[artworkIndex].title}" - ${sel.matchingReason}`);
        }
      }
      
      // 添加剩余的高评分作品
      const remainingArtworks = artworks
        .map((artwork, index) => ({ artwork, index, score: scores.find(s => s.artworkId === artwork.id)?.overallRecommendation || 0 }))
        .filter(item => !usedIndices.has(item.index))
        .sort((a, b) => b.score - a.score)
        .map(item => item.artwork);
      
      orderedArtworks.push(...remainingArtworks);
      
      console.log(`✅ 智能作品排序完成，共${orderedArtworks.length}件作品`);
      return orderedArtworks;

    } catch (error) {
      console.error('❌ 智能作品排序失败:', error);
      // 降级到评分排序
      return artworks.sort((a, b) => {
        const scoreA = scores.find(s => s.artworkId === a.id)?.overallRecommendation || 0;
        const scoreB = scores.find(s => s.artworkId === b.id)?.overallRecommendation || 0;
        return scoreB - scoreA;
      });
    }
  }

  /**
   * 获取默认曲线设计（降级方案）
   */
  private static getDefaultCurveDesign(
    emotion: string, 
    userInput: string, 
    artworkCount: number
  ): LLMEmotionCurveDesign {
    return {
      curveType: 'wave',
      totalStages: artworkCount,
      emotionJourney: Array.from({ length: artworkCount }, (_, i) => ({
        stage: i + 1,
        stageName: `阶段${i + 1}`,
        intensity: 0.3 + Math.sin(i / artworkCount * Math.PI) * 0.4,
        description: `${emotion}情绪的第${i + 1}个阶段`,
        artworkRequirement: '符合当前情绪阶段的艺术作品',
        visualMood: '平静而深沉'
      })),
      overallNarrative: `通过艺术作品引导${emotion}情绪的转化过程`,
      transitionLogic: '渐进式情绪调节',
      colorPalette: ['#4A5568', '#718096', '#A0AEC0']
    };
  }

  /**
   * 验证和修正曲线设计
   */
  private static validateAndFixCurveDesign(
    design: LLMEmotionCurveDesign, 
    expectedCount: number
  ): LLMEmotionCurveDesign {
    // 确保阶段数量正确
    if (design.emotionJourney.length !== expectedCount) {
      const journey = design.emotionJourney;
      if (journey.length > expectedCount) {
        design.emotionJourney = journey.slice(0, expectedCount);
      } else {
        // 补充缺失的阶段
        const lastStage = journey[journey.length - 1] || {
          stage: 1,
          stageName: '默认阶段',
          intensity: 0.5,
          description: '默认情绪阶段',
          artworkRequirement: '适合的艺术作品',
          visualMood: '平和'
        };
        
        for (let i = journey.length; i < expectedCount; i++) {
          design.emotionJourney.push({
            ...lastStage,
            stage: i + 1,
            stageName: `阶段${i + 1}`
          });
        }
      }
    }

    // 确保强度值在合理范围内
    design.emotionJourney.forEach(stage => {
      stage.intensity = Math.max(0, Math.min(1, stage.intensity));
    });

    return design;
  }
}
