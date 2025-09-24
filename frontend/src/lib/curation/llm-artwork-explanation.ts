// LLM驱动的增强版作品讲解生成器
import { Artwork, ArtworkExplanation } from './types';

/**
 * 两级讲解结构
 */
export interface TwoTierExplanation extends ArtworkExplanation {
  // 简略讲解 (画廊主界面显示)
  briefIntroduction: string;  // 1-2句话的简短介绍
  
  // 详细讲解 (点击展开查看)
  detailedAnalysis: {
    emotionalJourney: string;    // 情绪旅程描述
    artisticInsights: string;    // 艺术洞察
    historicalStory: string;     // 历史故事
    personalConnection: string;  // 个人连接
    viewingExperience: string;   // 观看体验建议
  };
  
  // 语音播放相关
  audioScript?: string;  // 优化后的语音播放文本
}
import { glmClient } from '@/lib/glm-optimized-client';
import { LLMEmotionCurveDesign } from './llm-emotion-curve';

/**
 * 增强版讲解生成上下文
 */
export interface EnhancedExplanationContext {
  // 基础信息
  emotion: string;
  userInput: string;
  
  // 策展信息
  curationIntroduction?: string;
  curationConclusion?: string;
  overallNarrative?: string;
  
  // 情绪曲线信息
  emotionCurveDesign?: LLMEmotionCurveDesign;
  artworkStageInfo?: {
    stageNumber: number;
    stageName: string;
    stageDescription: string;
    expectedIntensity: number;
    artworkRequirement: string;
  };
  
  // 作品在整体策展中的位置
  artworkPosition: {
    index: number; // 0-based
    total: number;
    isOpening: boolean;
    isClosing: boolean;
    isMidpoint: boolean;
  };
}

/**
 * LLM驱动的增强版作品讲解生成器
 */
export class LLMEnhancedExplanationGenerator {
  
  /**
   * 生成单个作品的增强版讲解
   */
  static async generateEnhancedExplanation(
    artwork: Artwork,
    context: EnhancedExplanationContext
  ): Promise<ArtworkExplanation> {
    console.log(`🧠 生成增强版讲解: ${artwork.title}`);
    
    const prompt = this.buildNaturalPrompt(artwork, context);
    
    try {
      const messages = [
        {
          role: 'system' as const,
          content: `你是一位温暖、富有共情力的艺术导览员。你的特质：
- 善于倾听和理解每位观者的情绪状态
- 用朋友般的语调分享艺术的故事和感动
- 避免冰冷的学术用语，让艺术变得亲近温暖
- 能够将艺术作品与观者的生活体验自然连接

你的目标是让每位观者在艺术面前感到被理解、被陪伴，而不是被教育。

请始终返回有效的JSON格式，让每句话都充满人情味。`
        },
        {
          role: 'user' as const,
          content: prompt
        }
      ];

      const response = await glmClient.chat(messages, {
        temperature: 0.6,
        max_tokens: 2500,
        response_format: { type: 'json_object' },
        thinking: 'disabled'
      });

      const explanationText = response.choices[0]?.message?.content || '{}';
      
      // 解析讲解结果
      let explanationData;
      try {
        explanationData = JSON.parse(explanationText);
      } catch (error) {
        console.error('❌ 讲解结果解析失败:', error);
        // 使用降级方案
        explanationData = this.getFallbackExplanation(artwork, context);
      }

      const explanation: TwoTierExplanation = {
        artworkId: artwork.id,
        // 保持原有字段兼容性
        emotionalConnection: explanationData.detailedAnalysis?.emotionalJourney || explanationData.emotionalConnection || '与情绪的基本关联',
        artisticAnalysis: explanationData.detailedAnalysis?.artisticInsights || explanationData.artisticAnalysis || '艺术技法分析',
        historicalContext: explanationData.detailedAnalysis?.historicalStory || explanationData.historicalContext || '历史背景信息',
        curationReason: explanationData.detailedAnalysis?.personalConnection || explanationData.curationReason || '策展选择理由',
        userRelevance: explanationData.detailedAnalysis?.personalConnection || explanationData.userRelevance || '与用户情境的关联',
        confidence: Math.max(0, Math.min(1, explanationData.confidence || 0.8)),
        // 新增字段
        stageNarrative: explanationData.stageNarrative || '',
        emotionTransition: explanationData.emotionTransition || '',
        viewingGuidance: explanationData.detailedAnalysis?.viewingExperience || explanationData.viewingGuidance || '',
        
        // 两级讲解新字段
        briefIntroduction: explanationData.briefIntroduction || '这是一件值得细细品味的作品。',
        detailedAnalysis: {
          emotionalJourney: explanationData.detailedAnalysis?.emotionalJourney || '这件作品与您的情绪产生共鸣',
          artisticInsights: explanationData.detailedAnalysis?.artisticInsights || '艺术家运用了独特的技法',
          historicalStory: explanationData.detailedAnalysis?.historicalStory || '这件作品承载着时代的记忆',
          personalConnection: explanationData.detailedAnalysis?.personalConnection || '这件作品能够带来个人启发',
          viewingExperience: explanationData.detailedAnalysis?.viewingExperience || '建议您静静观看，感受作品的力量'
        },
        audioScript: explanationData.audioScript || this.generateAudioScript(explanationData)
      };

      console.log(`✅ 增强版讲解生成完成: ${artwork.title}`);
      return explanation;

    } catch (error) {
      console.error(`❌ 增强版讲解生成失败: ${artwork.title}`, error);
      return this.getFallbackExplanation(artwork, context);
    }
  }

  /**
   * 构建增强版提示词
   */
  private static buildNaturalPrompt(
    artwork: Artwork, 
    context: EnhancedExplanationContext
  ): string {
    const { artworkPosition, artworkStageInfo } = context;
    
    let positionDescription = '';
    if (artworkPosition.isOpening) {
      positionDescription = `这是开启情绪旅程的第一件作品`;
    } else if (artworkPosition.isClosing) {
      positionDescription = `这是完成情绪转化的最后一件作品`;
    } else if (artworkPosition.isMidpoint) {
      positionDescription = `这是情绪转化的关键转折点`;
    } else {
      positionDescription = `这是情绪旅程中的第${artworkPosition.index + 1}站`;
    }

    return `你是一位温暖而富有洞察力的艺术导览员，正在为一位特殊的观者介绍这件作品。

## 这位观者的状态
他们现在感受到"${context.emotion}"，具体来说：${context.userInput}

## 这件作品
《${artwork.title}》by ${artwork.artist} (${artwork.year})
${artwork.description ? `作品描述：${artwork.description}` : ''}
${positionDescription}

## 你的任务
请为这位观者创作两层讲解：

**第一层 - 初见印象 (briefIntroduction)**
就像在真实画廊中，观者刚走到作品前，你轻声说出的第一句话。要自然、温暖，能立刻建立情感连接。1-2句话即可。

**第二层 - 深度对话 (detailedAnalysis)**
当观者表现出兴趣，愿意深入了解时，你会分享的故事和洞察：

- **emotionalJourney**: 这件作品如何陪伴观者的情绪变化？像朋友般的理解和共鸣
- **artisticInsights**: 艺术家的创作故事和技巧，用生动的语言讲述，不要教科书式的分析
- **historicalStory**: 这件作品背后的时代故事，让历史变得生动有趣
- **personalConnection**: 基于观者的具体情况，这件作品能带来什么个人启发？
- **viewingExperience**: 建议观者如何观看这件作品，像朋友的贴心提醒

**语音播放版本 (audioScript)**
将上述内容整合为适合语音播放的连贯讲解，自然流畅，就像真人在身边轻声讲述。

## 写作风格
- 像朋友对话，不是学术讲座
- 用温暖、理解的语调，特别考虑观者的"${context.emotion}"情绪
- 避免艺术术语堆砌，用生动的比喻和故事
- 让每句话都有温度和共鸣

请返回JSON格式：
{
  "briefIntroduction": "初见时的温暖问候",
  "detailedAnalysis": {
    "emotionalJourney": "情绪陪伴的故事",
    "artisticInsights": "艺术家的创作故事",
    "historicalStory": "时代背景的生动讲述",
    "personalConnection": "给观者的个人启发",
    "viewingExperience": "观看建议"
  },
  "audioScript": "适合语音播放的连贯讲解",
  "confidence": 0.9
}`;
  }

  /**
   * 生成音频播放脚本
   */
  private static generateAudioScript(explanationData: any): string {
    const brief = explanationData.briefIntroduction || '';
    const detailed = explanationData.detailedAnalysis || {};
    
    return `${brief} ${detailed.emotionalJourney || ''} ${detailed.artisticInsights || ''} ${detailed.viewingExperience || ''}`.trim();
  }

  /**
   * 降级方案 - 生成基础讲解
   */
  private static getFallbackExplanation(
    artwork: Artwork, 
    context: EnhancedExplanationContext
  ): TwoTierExplanation {
    const briefIntro = `这是${artwork.artist}的作品《${artwork.title}》，它似乎在对您的"${context.emotion}"轻声诉说着什么。`;
    
    return {
      artworkId: artwork.id,
      emotionalConnection: `${artwork.title}通过其${artwork.medium}的表现形式，与"${context.emotion}"产生共鸣`,
      artisticAnalysis: `${artwork.artist}在${artwork.year}创作的这件作品，展现了独特的艺术技法`,
      historicalContext: `作品创作于${artwork.year}，反映了当时的艺术风格和社会背景`,
      curationReason: `选择这件作品是为了在策展中展现${context.emotion}的不同层面`,
      userRelevance: `结合用户的"${context.userInput}"，这件作品能够提供情绪上的理解和共鸣`,
      confidence: 0.6,
      stageNarrative: `这件作品在情绪旅程中起到重要的连接作用`,
      emotionTransition: `观看后用户的情绪状态将得到调节和升华`,
      viewingGuidance: `建议静心观看，感受作品的色彩、构图和情绪表达`,
      
      // 两级讲解
      briefIntroduction: briefIntro,
      detailedAnalysis: {
        emotionalJourney: `在您感受"${context.emotion}"的时刻，这件作品就像一位理解您的朋友。`,
        artisticInsights: `${artwork.artist}在创作这件作品时，运用了${artwork.medium}的独特表现力。`,
        historicalStory: `${artwork.year}年，当这件作品诞生时，世界正经历着独特的时代变迁。`,
        personalConnection: `每个人在面对这件作品时都会有不同的感受，对您来说，它可能正好回应了内心的某种需要。`,
        viewingExperience: `不妨先从整体感受开始，然后慢慢关注细节，让作品与您的心境自然对话。`
      },
      audioScript: `${briefIntro} 在您感受"${context.emotion}"的时刻，这件作品就像一位理解您的朋友。${artwork.artist}在创作时运用了独特的表现力，让我们一起静静感受它想要传达的温暖。`
    };
  }

  /**
   * 批量生成增强版讲解
   */
  static async generateEnhancedExplanationsBatch(
    artworks: Artwork[],
    baseContext: Omit<EnhancedExplanationContext, 'artworkPosition' | 'artworkStageInfo'>,
    emotionCurveDesign?: LLMEmotionCurveDesign
  ): Promise<ArtworkExplanation[]> {
    console.log(`🧠 批量生成增强版讲解，共${artworks.length}件作品`);
    console.log('🧠 [DEBUG] emotionCurveDesign 状态:', emotionCurveDesign ? '已提供' : '未提供');
    console.log('🧠 [DEBUG] baseContext keys:', Object.keys(baseContext));
    
    const explanations: ArtworkExplanation[] = [];
    const total = artworks.length;
    const midpoint = Math.floor(total / 2);
    
    // 为每件作品构建完整上下文并生成讲解
    for (let i = 0; i < artworks.length; i++) {
      const artwork = artworks[i];
      
      // 构建作品位置信息
      const artworkPosition = {
        index: i,
        total,
        isOpening: i === 0,
        isClosing: i === total - 1,
        isMidpoint: i === midpoint
      };
      
      // 构建阶段信息
      let artworkStageInfo;
      if (emotionCurveDesign && emotionCurveDesign.emotionJourney[i]) {
        const stage = emotionCurveDesign.emotionJourney[i];
        artworkStageInfo = {
          stageNumber: stage.stage,
          stageName: stage.stageName,
          stageDescription: stage.description,
          expectedIntensity: stage.intensity,
          artworkRequirement: stage.artworkRequirement
        };
      }
      
      // 构建完整上下文
      const enhancedContext: EnhancedExplanationContext = {
        ...baseContext,
        artworkPosition,
        artworkStageInfo,
        ...(emotionCurveDesign && { emotionCurveDesign })
      };
      
      try {
        const explanation = await this.generateEnhancedExplanation(artwork, enhancedContext);
        explanations.push(explanation);
      } catch (error) {
        console.error(`❌ 作品讲解生成失败: ${artwork.title}`, error);
        explanations.push(this.getFallbackExplanation(artwork, enhancedContext));
      }
      
      // 添加延迟避免API限流
      if (i < artworks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log(`✅ 批量增强版讲解生成完成，共${explanations.length}个讲解`);
    return explanations;
  }
}
