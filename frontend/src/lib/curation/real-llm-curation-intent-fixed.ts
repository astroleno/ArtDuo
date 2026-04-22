/**
 * 真正的LLM策展意图生成器
 * 集成智谱AI GLM-4.5和情绪曲线设计模组
 */

import { glmOptimizedClient } from '@/lib/glm-optimized-client';
import { EmotionCurveGenerator } from '@/lib/curation/emotion-curve';
import { validateCurationIntent } from '@/lib/curation/curation-intent-schema-simplified';
import { z } from 'zod';

/**
 * LLM生成的策展意图接口
 */
export interface RealLLMCurationIntent {
  curatorialTheme: string;
  emotionalArc: string;
  emotionalStages: Array<{
    stage: number;
    emotion: string;
    intensity: number;
    artworkCount: number;
    keywords: string[];
  }>;
  visualFeatures: {
    colorPalette: string[];
    mood: string[];
  };
  aestheticPreferences: {
    mediaTypes: string[];
    artStyles: string[];
  };
  narrativeTone: {
    voice: string;
    approach: string;
    intimacy: string;
    pacing: string;
    perspective: string;
  };
}

/**
 * 真正的LLM策展意图生成器
 */
export class RealLLMCurationIntentGenerator {
  private client = glmOptimizedClient;

  /**
   * 生成策展意图
   */
  async generateCurationIntent(userInput: string): Promise<RealLLMCurationIntent> {
    try {
      console.log('🎯 开始真正的LLM策展意图生成...');
      console.log('📝 用户输入:', userInput);
      
      const prompt = this.buildCurationIntentPrompt(userInput);
      
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
        max_tokens: 4096,
        thinking: 'disabled',
        response_format: { type: 'json_object' }
      });

      // 解析LLM响应
      console.log('🔍 LLM API完整响应:', JSON.stringify(response, null, 2));
      const rawContent = response.choices[0].message.content;
      console.log('📝 LLM原始策展意图输出长度:', rawContent?.length || 0);
      console.log('📝 LLM原始策展意图输出:', rawContent?.substring(0, 500) || '空内容');
      
      // 检查LLM是否返回了空内容
      if (!rawContent || rawContent.trim().length === 0) {
        console.error('❌ LLM返回空内容');
        throw new Error('LLM返回空内容，请检查API配置');
      }
      
      const curationIntent = this.parseLLMResponse(rawContent, userInput);
      
      // 使用情绪曲线生成器优化情绪阶段
      const optimizedIntent = await this.optimizeWithEmotionCurve(curationIntent, userInput);
      
      console.log('✅ 真正的LLM策展意图生成完成');
      console.log('📊 策展意图摘要:', {
        theme: optimizedIntent.curatorialTheme,
        stages: optimizedIntent.emotionalStages.length,
        totalArtworks: optimizedIntent.emotionalStages.reduce((sum, stage) => sum + stage.artworkCount, 0)
      });
      return optimizedIntent;

    } catch (error) {
      console.error('❌ LLM策展意图生成失败:', error);
      throw error;
    }
  }


  /**
   * 构建策展意图提示词
   */
  private buildCurationIntentPrompt(userInput: string): string {
    return `用户："${userInput}"

输出JSON：
{
  "curatorialTheme": "主题",
  "emotionalArc": "弧线",
  "emotionalStages": [
    {"stage": 1, "emotion": "情绪", "intensity": 0.7, "artworkCount": 3, "keywords": ["关键词"]}
  ],
  "visualFeatures": {"colorPalette": ["色彩"], "mood": ["氛围"]},
  "aestheticPreferences": {"mediaTypes": ["媒介"], "artStyles": ["风格"]},
  "narrativeTone": {"voice": "语调", "approach": "方法", "intimacy": "程度", "pacing": "节奏", "perspective": "视角"}
}

要求：3-5个阶段，6-12件作品，完整JSON`;
  }

  /**
   * 解析LLM响应
   */
  private parseLLMResponse(content: string, userInput?: string): RealLLMCurationIntent {
    try {
      // 尝试直接解析JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        let jsonStr = jsonMatch[0];
        
        // 尝试修复常见的JSON格式问题
        console.log('🔧 修复前JSON长度:', jsonStr.length);
        console.log('🔧 修复前JSON片段:', jsonStr.substring(240, 280));
        jsonStr = this.fixJSONFormat(jsonStr);
        console.log('🔧 修复后JSON长度:', jsonStr.length);
        console.log('🔧 修复后JSON片段:', jsonStr.substring(240, 280));
        console.log('🔧 完整修复后JSON:', jsonStr);
        
        try {
          const parsed = JSON.parse(jsonStr);
          
          // 验证JSON Schema
          const validation = validateCurationIntent(parsed);
          if (!validation.valid) {
            console.error('❌ 策展意图Schema验证失败:', validation.errors);
            throw new Error(`策展意图格式验证失败: ${validation.errors?.join(', ')}`);
          }
          console.log('✅ 策展意图Schema验证通过');
          
          return this.validateAndNormalizeIntent(parsed);
        } catch (jsonError) {
          console.error('❌ JSON解析失败:', jsonError);
          throw new Error('JSON解析失败');
        }
      }

      // 如果没有找到JSON，直接抛出错误
      throw new Error('LLM响应中没有找到有效的JSON格式');

    } catch (error) {
      console.error('❌ 解析LLM响应失败:', error);
      throw new Error('无法解析LLM响应');
    }
  }

  /**
   * 修复JSON格式问题
   */
  private fixJSONFormat(jsonStr: string): string {
    // 移除可能的markdown代码块标记
    jsonStr = jsonStr.replace(/```json\s*/, '').replace(/```\s*$/, '');
    
    // 处理不完整的字段值 - 更全面的修复
    // 修复 emotion 字段
    jsonStr = jsonStr.replace(/"emotion":\s*"([^"]*?)(?=\s*[,}\]])/g, (match, value) => {
      if (!value.endsWith('"')) {
        return `"emotion": "${value}"`;
      }
      return match;
    });
    
    // 修复没有值的 emotion 字段
    jsonStr = jsonStr.replace(/"emotion":\s*$/gm, '"emotion": "未知情绪"');
    
    // 修复 intensity 字段
    jsonStr = jsonStr.replace(/"intensity":\s*$/gm, '"intensity": 0.5');
    
    // 修复截断的 intensity 字段 - 处理 "intensity": 后面没有值的情况
    jsonStr = jsonStr.replace(/"intensity":\s*$/gm, '"intensity": 0.5');
    
    // 修复 artworkCount 字段
    jsonStr = jsonStr.replace(/"artworkCount":\s*$/gm, '"artworkCount": 2');
    
    // 移除所有错误的修复逻辑 - LLM输出已经是正确的
    
    // 修复不完整的对象 - 添加缺失的字段
    // 修复只有 stage, emotion, intensity 的对象
    jsonStr = jsonStr.replace(/"stage":\s*(\d+),?\s*"emotion":\s*"([^"]*)",?\s*"intensity":\s*([0-9.]+),?\s*}/g, 
      (match, stage, emotion, intensity) => {
        return `{"stage": ${stage}, "emotion": "${emotion}", "intensity": ${intensity}, "artworkCount": 2, "keywords": ["关键词"]}`;
      });
    
    // 修复只有 stage, emotion 的对象
    jsonStr = jsonStr.replace(/"stage":\s*(\d+),?\s*"emotion":\s*"([^"]*)",?\s*}/g, 
      (match, stage, emotion) => {
        return `{"stage": ${stage}, "emotion": "${emotion}", "intensity": 0.5, "artworkCount": 2, "keywords": ["关键词"]}`;
      });
    
    // 修复只有 stage 的对象
    jsonStr = jsonStr.replace(/"stage":\s*(\d+),?\s*}/g, 
      (match, stage) => {
        return `{"stage": ${stage}, "emotion": "未知情绪", "intensity": 0.5, "artworkCount": 2, "keywords": ["关键词"]}`;
      });
    
    // 如果emotionalStages数组没有闭合，尝试修复
    if (jsonStr.includes('"emotionalStages": [') && !jsonStr.includes(']')) {
      // 找到最后一个完整的对象
      const lastCompleteObject = jsonStr.lastIndexOf('}');
      if (lastCompleteObject > 0) {
        // 添加缺失的闭合括号
        jsonStr = jsonStr.substring(0, lastCompleteObject + 1) + ']';
      }
    }
    
    // 确保所有数组和对象都正确闭合
    const openBraces = (jsonStr.match(/\{/g) || []).length;
    const closeBraces = (jsonStr.match(/\}/g) || []).length;
    const openBrackets = (jsonStr.match(/\[/g) || []).length;
    const closeBrackets = (jsonStr.match(/\]/g) || []).length;
    
    // 添加缺失的闭合括号
    for (let i = 0; i < openBraces - closeBraces; i++) {
      jsonStr += '}';
    }
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      jsonStr += ']';
    }
    
    return jsonStr;
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
      
      // 情绪曲线已生成，无需更新intent
      
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
    // 提取LLM生成的阶段信息
    const stageEmotions = intent.emotionalStages.map(stage => stage.emotion);
    const stageIntensities = intent.emotionalStages.map(stage => stage.intensity);
    
    console.log('🎯 使用LLM阶段信息生成情绪曲线');
    console.log('📊 阶段情绪:', stageEmotions);
    console.log('📊 阶段强度:', stageIntensities);
    
    // 使用情绪曲线生成器的LLM阶段模式
    const curveConfig = {
      emotion: intent.emotionalStages[0]?.emotion || 'contemplation',
      intensity: intent.emotionalStages[0]?.intensity || 0.7,
      curveType: 'custom' as 'linear' | 'wave' | 'peak' | 'valley' | 'custom',
      stageIntensities: stageIntensities,
      stageEmotions: stageEmotions,
      totalPoints: intent.emotionalStages.length
    };

    // 生成基于LLM阶段的情绪曲线骨架
    const curve = EmotionCurveGenerator.generateCurve([], [], intent.emotionalStages[0]?.emotion || 'contemplation', curveConfig);
    
    console.log('✅ 情绪曲线生成完成:', curve);
    return curve;
  }

  /**
   * 调整作品数量分配
   */
  private adjustArtworkCounts(
    stages: RealLLMCurationIntent['emotionalStages'], 
    emotionCurve: any
  ): RealLLMCurationIntent['emotionalStages'] {
    // 根据情绪曲线调整每个阶段的作品数量
    const totalArtworks = stages.reduce((sum, stage) => sum + stage.artworkCount, 0);
    const adjustedStages = stages.map((stage, index) => {
      // 根据情绪强度调整作品数量
      const intensityMultiplier = stage.intensity;
      const adjustedCount = Math.max(1, Math.round(stage.artworkCount * intensityMultiplier));
      
      return {
        ...stage,
        artworkCount: adjustedCount
      };
    });

    return adjustedStages;
  }

  /**
   * 验证和标准化策展意图
   */
  private validateAndNormalizeIntent(data: any): RealLLMCurationIntent {
    // 验证必需字段
    if (!data.curatorialTheme) {
      throw new Error('缺少策展主题');
    }
    if (!data.emotionalArc) {
      throw new Error('缺少情绪弧线');
    }
    if (!data.emotionalStages || !Array.isArray(data.emotionalStages) || data.emotionalStages.length === 0) {
      throw new Error('缺少有效的情绪阶段');
    }

    return {
      curatorialTheme: data.curatorialTheme,
      emotionalArc: data.emotionalArc,
      emotionalStages: data.emotionalStages,
      visualFeatures: data.visualFeatures || {
        colorPalette: [],
        mood: []
      },
      aestheticPreferences: data.aestheticPreferences || {
        mediaTypes: [],
        artStyles: []
      },
      narrativeTone: data.narrativeTone || {
        voice: '温和',
        approach: '引导',
        intimacy: '亲近',
        pacing: '舒缓',
        perspective: '第一人称'
      }
    };
  }

  /**
   * 从文本中提取策展意图
   */
  private extractIntentFromText(content: string): RealLLMCurationIntent {
    // 尝试从文本中提取JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const jsonStr = this.fixJSONFormat(jsonMatch[0]);
        const parsed = JSON.parse(jsonStr);
        return this.validateAndNormalizeIntent(parsed);
      } catch (error) {
        console.error('❌ 从文本提取JSON失败:', error);
        throw new Error('无法从LLM响应中提取有效的策展意图');
      }
    }
    
    throw new Error('LLM响应中没有找到有效的JSON格式');
  }


}

// 导出单例实例
export const realLLMCurationIntentGenerator = new RealLLMCurationIntentGenerator();
