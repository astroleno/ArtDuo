/**
 * 真正的LLM策展意图生成器
 * 集成智谱AI GLM-4.5和情绪曲线设计模组
 */

import { glmOptimizedClient } from '@/lib/glm-optimized-client';
import { EmotionCurveGenerator } from '@/lib/curation/emotion-curve';
import { z } from 'zod';

/**
 * LLM生成的策展意图接口
 */
export interface RealLLMCurationIntent {
  emotionalStages: Array<{
    stage: number;
    emotion: string;
    intensity: number;
    description: string;
    visualCharacteristics: string[];
    artworkCount: number;
    duration: number;
  }>;
  visualFeatures: {
    colorPalette: string[];
    composition: string[];
    lighting: string[];
    mood: string[];
    texture: string[];
  };
  aestheticPreferences: {
    mediaTypes: string[];
    artStyles: string[];
    timePeriods: string[];
    culturalContexts: string[];
    avoidElements: string[];
  };
  narrativeTone: {
    voice: string;
    approach: string;
    intimacy: string;
    pacing: string;
    perspective: string;
  };
  targetAudience: string;
  curatorialTheme: string;
  emotionalArc: string;
  keyMessages: string[];
  visualProgression: string;
  emotionCurve: {
    curveType: 'linear' | 'wave' | 'peak' | 'valley' | 'spiral' | 'custom';
    totalDuration: number;
    climaxPoint: number;
    resolutionPoint: number;
  };
}

/**
 * 真正的LLM策展意图生成器
 */
export class RealLLMCurationIntentGenerator {
  private client: typeof glmOptimizedClient;

  constructor() {
    this.client = glmOptimizedClient;
  }

  /**
   * 生成策展意图（真正调用LLM API）
   */
  async generateCurationIntent(userInput: string): Promise<RealLLMCurationIntent> {
    console.log('🧠 开始真正的LLM策展意图生成...');
    
    try {
      // 构建LLM提示词
      const prompt = this.buildCurationIntentPrompt(userInput);
      
      // 调用真正的LLM API
      const response = await this.client.chat([
        {
          role: 'system',
          content: '你是一位专业的艺术策展人，擅长分析用户的情感需求并制定个性化的策展方案。你需要生成详细的策展意图，包括情绪阶段、视觉特征、审美偏好、叙事语气等。'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.7,
        max_tokens: 2000
      });

      // 解析LLM响应
      const curationIntent = this.parseLLMResponse(response.choices[0].message.content);
      
      // 使用情绪曲线生成器优化情绪阶段
      const optimizedIntent = await this.optimizeWithEmotionCurve(curationIntent, userInput);
      
      console.log('✅ 真正的LLM策展意图生成完成');
      return optimizedIntent;

    } catch (error) {
      console.error('❌ LLM策展意图生成失败:', error);
      // 返回降级方案
      return this.getFallbackCurationIntent(userInput);
    }
  }

  /**
   * 构建策展意图提示词
   */
  private buildCurationIntentPrompt(userInput: string): string {
    return `
请作为一位专业的艺术策展人，分析以下用户输入并生成详细的策展意图：

用户输入："${userInput}"

请从以下维度分析并生成策展方案：

1. 情绪阶段分析：
   - 识别用户情感的核心和变化
   - 设计3-4个情绪阶段，每个阶段包含：情绪名称、强度(0-1)、描述、视觉特征
   - 考虑情绪的自然流动和转换
   - 为每个阶段分配作品数量（总计6-12件）

2. 视觉特征设计：
   - 色彩调色板：根据情绪选择主要色彩
   - 构图偏好：单人/群体、内敛/开放等
   - 光线设计：自然光/人工光、明亮/柔和等
   - 情绪氛围：宁静/激烈、内省/外向等
   - 质感偏好：光滑/粗糙、细腻/粗犷等

3. 审美偏好设定：
   - 媒介类型：摄影/油画/雕塑/数字艺术等
   - 艺术风格：印象派/表现主义/现代主义等
   - 时代范围：古典/现代/当代等
   - 文化背景：欧洲/亚洲/美洲等
   - 避免元素：宗教/商业/过于明亮等

4. 叙事语气设计：
   - 声音语调：亲密/专业/诗意等
   - 策展方法：直接/暗示/引导等
   - 亲密程度：高/中/低
   - 节奏控制：快/中/慢
   - 视角选择：第一人称/第三人称等

5. 策展主题和核心信息：
   - 生成一个吸引人的策展主题
   - 设计3-5个核心信息
   - 描述情绪弧线的整体走向
   - 设计视觉进程的变化

6. 情绪曲线设计：
   - 曲线类型：linear/wave/peak/valley/spiral/custom
   - 总时长：20-45分钟
   - 高潮点：0-1之间的位置
   - 解决点：0-1之间的位置

请以JSON格式输出，确保结构完整。`;
  }

  /**
   * 解析LLM响应
   */
  private parseLLMResponse(content: string): RealLLMCurationIntent {
    try {
      // 尝试直接解析JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        return this.validateAndNormalizeIntent(parsed);
      }

      // 如果没有找到JSON，尝试从文本中提取信息
      return this.extractIntentFromText(content);

    } catch (error) {
      console.error('❌ 解析LLM响应失败:', error);
      // 返回默认策展意图
      return this.getDefaultCurationIntent();
    }
  }

  /**
   * 使用情绪曲线生成器优化
   */
  private async optimizeWithEmotionCurve(
    intent: RealLLMCurationIntent, 
    userInput: string
  ): Promise<RealLLMCurationIntent> {
    try {
      // 使用情绪曲线生成器优化情绪阶段
      const emotionCurve = await this.generateEmotionCurve(intent, userInput);
      
      // 更新策展意图中的情绪曲线信息
      intent.emotionCurve = emotionCurve;
      
      // 根据情绪曲线调整作品数量分配
      intent.emotionalStages = this.adjustArtworkCounts(intent.emotionalStages, emotionCurve);
      
      return intent;

    } catch (error) {
      console.error('❌ 情绪曲线优化失败:', error);
      return intent;
    }
  }

  /**
   * 生成情绪曲线
   */
  private async generateEmotionCurve(
    intent: RealLLMCurationIntent, 
    userInput: string
  ): Promise<any> {
    // 使用现有的情绪曲线生成器
    const curveConfig = {
      emotion: intent.emotionalStages[0]?.emotion || 'contemplation',
      totalPoints: intent.emotionalStages.length,
      curveType: intent.emotionCurve?.curveType || 'wave',
      intensity: intent.emotionalStages.reduce((sum, stage) => sum + stage.intensity, 0) / intent.emotionalStages.length,
      variation: 0.3
    };

    // 生成情绪曲线点
    const curvePoints = EmotionCurveGenerator.generateCurve(
      [], // 空作品数组，只生成曲线
      [], // 空评分数组
      curveConfig.emotion,
      {
        curveType: curveConfig.curveType as 'linear' | 'wave' | 'peak' | 'valley' | 'custom',
        totalPoints: curveConfig.totalPoints,
        intensity: curveConfig.intensity,
        variation: curveConfig.variation
      }
    );

    return {
      curveType: curveConfig.curveType,
      totalDuration: intent.emotionalStages.reduce((sum, stage) => sum + stage.duration, 0),
      climaxPoint: this.calculateClimaxPoint(curvePoints),
      resolutionPoint: this.calculateResolutionPoint(curvePoints)
    };
  }

  /**
   * 计算高潮点
   */
  private calculateClimaxPoint(curvePoints: any[]): number {
    if (curvePoints.length === 0) return 0.5;
    
    const maxIntensity = Math.max(...curvePoints.map(p => p.intensity));
    const climaxPoint = curvePoints.find(p => p.intensity === maxIntensity);
    return climaxPoint ? climaxPoint.position : 0.5;
  }

  /**
   * 计算解决点
   */
  private calculateResolutionPoint(curvePoints: any[]): number {
    if (curvePoints.length === 0) return 0.8;
    
    // 找到最后一个点作为解决点
    const lastPoint = curvePoints[curvePoints.length - 1];
    return lastPoint ? lastPoint.position : 0.8;
  }

  /**
   * 调整作品数量分配
   */
  private adjustArtworkCounts(
    stages: any[], 
    emotionCurve: any
  ): any[] {
    const totalArtworks = stages.reduce((sum, stage) => sum + stage.artworkCount, 0);
    const targetTotal = Math.min(12, Math.max(6, totalArtworks));
    
    // 按强度分配作品数量
    const totalIntensity = stages.reduce((sum, stage) => sum + stage.intensity, 0);
    
    return stages.map(stage => ({
      ...stage,
      artworkCount: Math.max(1, Math.round((stage.intensity / totalIntensity) * targetTotal))
    }));
  }

  /**
   * 验证和标准化策展意图
   */
  private validateAndNormalizeIntent(intent: any): RealLLMCurationIntent {
    return {
      emotionalStages: intent.emotionalStages || [],
      visualFeatures: {
        colorPalette: intent.visualFeatures?.colorPalette || [],
        composition: intent.visualFeatures?.composition || [],
        lighting: intent.visualFeatures?.lighting || [],
        mood: intent.visualFeatures?.mood || [],
        texture: intent.visualFeatures?.texture || []
      },
      aestheticPreferences: {
        mediaTypes: intent.aestheticPreferences?.mediaTypes || [],
        artStyles: intent.aestheticPreferences?.artStyles || [],
        timePeriods: intent.aestheticPreferences?.timePeriods || [],
        culturalContexts: intent.aestheticPreferences?.culturalContexts || [],
        avoidElements: intent.aestheticPreferences?.avoidElements || []
      },
      narrativeTone: {
        voice: intent.narrativeTone?.voice || 'intimate',
        approach: intent.narrativeTone?.approach || 'gentle',
        intimacy: intent.narrativeTone?.intimacy || 'high',
        pacing: intent.narrativeTone?.pacing || 'medium',
        perspective: intent.narrativeTone?.perspective || 'first_person'
      },
      targetAudience: intent.targetAudience || '寻求情感共鸣的观众',
      curatorialTheme: intent.curatorialTheme || '情绪的艺术表达',
      emotionalArc: intent.emotionalArc || '从探索到理解',
      keyMessages: intent.keyMessages || ['艺术能治愈心灵'],
      visualProgression: intent.visualProgression || '从冷色调到暖色调的渐变',
      emotionCurve: {
        curveType: intent.emotionCurve?.curveType || 'wave',
        totalDuration: intent.emotionCurve?.totalDuration || 30,
        climaxPoint: intent.emotionCurve?.climaxPoint || 0.6,
        resolutionPoint: intent.emotionCurve?.resolutionPoint || 0.8
      }
    };
  }

  /**
   * 从文本中提取策展意图
   */
  private extractIntentFromText(content: string): RealLLMCurationIntent {
    // 简单的文本解析逻辑
    const emotionalStages = this.extractEmotionalStages(content);
    const visualFeatures = this.extractVisualFeatures(content);
    const aestheticPreferences = this.extractAestheticPreferences(content);
    const narrativeTone = this.extractNarrativeTone(content);
    
    return {
      emotionalStages,
      visualFeatures,
      aestheticPreferences,
      narrativeTone,
      targetAudience: '寻求情感共鸣的观众',
      curatorialTheme: '情绪的艺术表达',
      emotionalArc: '从探索到理解',
      keyMessages: ['艺术能治愈心灵'],
      visualProgression: '从冷色调到暖色调的渐变',
      emotionCurve: {
        curveType: 'wave',
        totalDuration: 30,
        climaxPoint: 0.6,
        resolutionPoint: 0.8
      }
    };
  }

  /**
   * 提取情绪阶段
   */
  private extractEmotionalStages(content: string): any[] {
    const stages = [];
    const stagePattern = /阶段\s*(\d+)[：:]\s*([^，,。]+)/g;
    let match;
    
    while ((match = stagePattern.exec(content)) !== null) {
      stages.push({
        stage: parseInt(match[1]),
        emotion: match[2].trim(),
        intensity: 0.7,
        description: match[2].trim(),
        visualCharacteristics: ['基础视觉特征'],
        artworkCount: 3,
        duration: 10
      });
    }
    
    return stages.length > 0 ? stages : [
      {
        stage: 1,
        emotion: 'exploration',
        intensity: 0.7,
        description: '探索阶段',
        visualCharacteristics: ['基础视觉特征'],
        artworkCount: 3,
        duration: 10
      }
    ];
  }

  /**
   * 提取视觉特征
   */
  private extractVisualFeatures(content: string): any {
    return {
      colorPalette: this.extractKeywords(content, ['色彩', '颜色', '色调']),
      composition: this.extractKeywords(content, ['构图', '布局', '结构']),
      lighting: this.extractKeywords(content, ['光线', '照明', '光影']),
      mood: this.extractKeywords(content, ['情绪', '氛围', '感觉']),
      texture: this.extractKeywords(content, ['质感', '纹理', '材质'])
    };
  }

  /**
   * 提取审美偏好
   */
  private extractAestheticPreferences(content: string): any {
    return {
      mediaTypes: this.extractKeywords(content, ['摄影', '油画', '雕塑', '数字艺术']),
      artStyles: this.extractKeywords(content, ['印象派', '表现主义', '现代主义']),
      timePeriods: this.extractKeywords(content, ['古典', '现代', '当代']),
      culturalContexts: this.extractKeywords(content, ['欧洲', '亚洲', '美洲']),
      avoidElements: this.extractKeywords(content, ['宗教', '商业', '明亮'])
    };
  }

  /**
   * 提取叙事语气
   */
  private extractNarrativeTone(content: string): any {
    return {
      voice: content.includes('亲密') ? 'intimate' : 'professional',
      approach: content.includes('直接') ? 'direct' : 'gentle',
      intimacy: content.includes('高') ? 'high' : 'medium',
      pacing: content.includes('快') ? 'fast' : 'medium',
      perspective: content.includes('第一人称') ? 'first_person' : 'third_person'
    };
  }

  /**
   * 提取关键词
   */
  private extractKeywords(content: string, keywords: string[]): string[] {
    return keywords.filter(keyword => content.includes(keyword));
  }

  /**
   * 获取默认策展意图
   */
  private getDefaultCurationIntent(): RealLLMCurationIntent {
    return {
      emotionalStages: [
        {
          stage: 1,
          emotion: 'exploration',
          intensity: 0.7,
          description: '探索阶段',
          visualCharacteristics: ['基础视觉特征'],
          artworkCount: 3,
          duration: 10
        }
      ],
      visualFeatures: {
        colorPalette: ['中性色调'],
        composition: ['平衡构图'],
        lighting: ['自然光线'],
        mood: ['平和'],
        texture: ['细腻']
      },
      aestheticPreferences: {
        mediaTypes: ['油画', '摄影'],
        artStyles: ['现代主义'],
        timePeriods: ['当代'],
        culturalContexts: ['全球'],
        avoidElements: []
      },
      narrativeTone: {
        voice: 'intimate',
        approach: 'gentle',
        intimacy: 'high',
        pacing: 'medium',
        perspective: 'first_person'
      },
      targetAudience: '寻求情感共鸣的观众',
      curatorialTheme: '情绪的艺术表达',
      emotionalArc: '从探索到理解',
      keyMessages: ['艺术能治愈心灵'],
      visualProgression: '从冷色调到暖色调的渐变',
      emotionCurve: {
        curveType: 'wave',
        totalDuration: 30,
        climaxPoint: 0.6,
        resolutionPoint: 0.8
      }
    };
  }

  /**
   * 获取降级策展意图
   */
  private getFallbackCurationIntent(userInput: string): RealLLMCurationIntent {
    return this.getDefaultCurationIntent();
  }
}

// 导出单例实例
export const realLLMCurationIntentGenerator = new RealLLMCurationIntentGenerator();
