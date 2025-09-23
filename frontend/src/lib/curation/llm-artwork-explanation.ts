// LLM驱动的增强版作品讲解生成器
import { Artwork, ArtworkExplanation } from './types';
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
    
    const prompt = this.buildEnhancedPrompt(artwork, context);
    
    try {
      const messages = [
        {
          role: 'system' as const,
          content: `你是一位专业的艺术策展人和讲解员，擅长将艺术作品与用户的情绪体验深度关联。你能够：
1. 理解整个策展的情绪脉络和叙事逻辑
2. 将单件作品置于完整的情绪旅程中解读
3. 建立作品与用户具体情境的深层连接
4. 使用具体而生动的语言，避免空洞的艺术术语

请始终返回有效的JSON格式。`
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

      const explanation: ArtworkExplanation = {
        artworkId: artwork.id,
        emotionalConnection: explanationData.emotionalConnection || '与情绪的基本关联',
        artisticAnalysis: explanationData.artisticAnalysis || '艺术技法分析',
        historicalContext: explanationData.historicalContext || '历史背景信息',
        curationReason: explanationData.curationReason || '策展选择理由',
        userRelevance: explanationData.userRelevance || '与用户情境的关联',
        confidence: Math.max(0, Math.min(1, explanationData.confidence || 0.7)),
        // 新增字段
        stageNarrative: explanationData.stageNarrative || '',
        emotionTransition: explanationData.emotionTransition || '',
        viewingGuidance: explanationData.viewingGuidance || ''
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
  private static buildEnhancedPrompt(
    artwork: Artwork, 
    context: EnhancedExplanationContext
  ): string {
    const { artworkPosition, artworkStageInfo } = context;
    
    let positionDescription = '';
    if (artworkPosition.isOpening) {
      positionDescription = `这是策展的开篇作品（第${artworkPosition.index + 1}/${artworkPosition.total}件）`;
    } else if (artworkPosition.isClosing) {
      positionDescription = `这是策展的收尾作品（第${artworkPosition.index + 1}/${artworkPosition.total}件）`;
    } else if (artworkPosition.isMidpoint) {
      positionDescription = `这是策展的中心转折作品（第${artworkPosition.index + 1}/${artworkPosition.total}件）`;
    } else {
      positionDescription = `这是策展中的第${artworkPosition.index + 1}件作品（共${artworkPosition.total}件）`;
    }

    return `为艺术作品生成深度个性化讲解（中文）。

## 作品信息
- 标题：${artwork.title}
- 艺术家：${artwork.artist}
- 创作年代：${artwork.year}
- 材质：${artwork.medium}
- 描述：${artwork.description || '暂无描述'}
- 收藏机构：${artwork.museum}

## 用户情境
- 核心情绪：${context.emotion}
- 具体描述：${context.userInput}

## 策展上下文
${positionDescription}
${context.curationIntroduction ? `策展序言：${context.curationIntroduction}` : ''}
${context.curationConclusion ? `策展结语：${context.curationConclusion}` : ''}
${context.overallNarrative ? `整体叙事：${context.overallNarrative}` : ''}

## 情绪曲线设计
${artworkStageInfo ? `
当前阶段：${artworkStageInfo.stageName}
阶段描述：${artworkStageInfo.stageDescription}
情绪强度：${(artworkStageInfo.expectedIntensity * 100).toFixed(0)}%
作品要求：${artworkStageInfo.artworkRequirement}
` : ''}

${context.emotionCurveDesign ? `
整体情绪旅程：${context.emotionCurveDesign.overallNarrative}
转换逻辑：${context.emotionCurveDesign.transitionLogic}
` : ''}

## 生成要求

请深度分析这件作品在整个情绪旅程中的作用，生成个性化讲解：

1. **情绪关联**：这件作品如何与用户的"${context.emotion}"和"${context.userInput}"产生深层共鸣？
2. **艺术分析**：从技法、构图、色彩、材质等角度，分析作品的表现力
3. **历史背景**：作品的创作背景、时代特征、艺术史地位
4. **策展理由**：为什么选择这件作品放在这个位置？它如何服务于整体叙事？
5. **用户相关性**：结合用户的具体情境，这件作品能给用户什么启发或慰藉？
6. **阶段叙事**：这件作品在情绪旅程中承担什么角色？
7. **情绪转换**：观看这件作品后，用户的情绪状态预期如何变化？
8. **观看指导**：建议用户如何观看和体验这件作品？

## 写作要求
- 使用具体而生动的语言，避免空洞的艺术术语
- 每个维度80-150字，深入而不冗长
- 建立作品与用户情境的具体连接，不要泛泛而谈
- 体现这件作品在整个情绪旅程中的独特价值

返回JSON格式：
{
  "emotionalConnection": "情绪关联分析",
  "artisticAnalysis": "艺术技法分析", 
  "historicalContext": "历史背景阐述",
  "curationReason": "策展选择理由",
  "userRelevance": "用户情境关联",
  "stageNarrative": "阶段叙事作用",
  "emotionTransition": "情绪转换预期",
  "viewingGuidance": "观看体验建议",
  "confidence": 0.85
}`;
  }

  /**
   * 降级方案 - 生成基础讲解
   */
  private static getFallbackExplanation(
    artwork: Artwork, 
    context: EnhancedExplanationContext
  ): ArtworkExplanation {
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
      viewingGuidance: `建议静心观看，感受作品的色彩、构图和情绪表达`
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
        emotionCurveDesign
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
