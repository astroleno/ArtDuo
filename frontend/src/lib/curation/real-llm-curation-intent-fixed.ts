/**
 * 真正的LLM策展意图生成器
 * 集成智谱AI GLM-4.5和情绪曲线设计模组
 */

import { glmOptimizedClient } from '@/lib/glm-optimized-client';
import { EmotionCurveGenerator } from '@/lib/curation/emotion-curve';
import { validateCurationIntent } from '@/lib/curation/curation-intent-schema';
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
    description: string;
    visualCharacteristics: string[];
    artworkCount: number;
    keywords: string[];
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
  keyMessages: string[];
  visualProgression: string;
  emotionCurve: {
    curveType: string;
    totalDuration: number;
    peakPoints: Array<{
      time: number;
      intensity: number;
      description: string;
    }>;
    transitionPoints: Array<{
      time: number;
      description: string;
    }>;
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
        max_tokens: 4096
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
    return `用户说："${userInput}"

请分析用户情绪并生成策展方案，输出JSON格式：

{
  "curatorialTheme": "策展主题",
  "emotionalArc": "情绪弧线描述",
  "emotionalStages": [
    {
      "stage": 1,
      "emotion": "情绪名称",
      "intensity": 0.7,
      "description": "阶段描述",
      "visualCharacteristics": ["视觉特征1", "视觉特征2"],
      "artworkCount": 3,
      "keywords": ["关键词1", "关键词2"]
    }
  ],
  "visualFeatures": {
    "colorPalette": ["色彩1", "色彩2"],
    "composition": ["构图1", "构图2"],
    "lighting": ["光线1", "光线2"],
    "mood": ["氛围1", "氛围2"],
    "texture": ["质感1", "质感2"]
  },
  "aestheticPreferences": {
    "mediaTypes": ["油画", "摄影"],
    "artStyles": ["印象派", "现代主义"],
    "timePeriods": ["19世纪", "20世纪"],
    "culturalContexts": ["西方", "现代"],
    "avoidElements": []
  },
  "narrativeTone": {
    "voice": "温和",
    "approach": "引导",
    "intimacy": "亲近",
    "pacing": "舒缓",
    "perspective": "第一人称"
  },
  "targetAudience": "寻求情感共鸣的用户",
  "keyMessages": ["核心信息1", "核心信息2"],
  "visualProgression": "视觉进程描述",
  "emotionCurve": {
    "curveType": "linear",
    "totalDuration": 30,
    "peakPoints": [{"time": 0.5, "intensity": 0.8, "description": "情感高峰"}],
    "transitionPoints": [{"time": 0.3, "description": "情绪转换"}]
  }
}

要求：
- 生成3-5个情绪阶段
- 总作品数量6-12件
- 输出完整JSON格式`;
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
        jsonStr = this.fixJSONFormat(jsonStr);
        
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
          console.error('❌ JSON解析失败，尝试从文本提取:', jsonError);
          return this.extractIntentFromText(content);
        }
      }

      // 如果没有找到JSON，尝试从文本中提取信息
      return this.extractIntentFromText(content);

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
    
    // 处理不完整的字段值
    // 如果字段值没有闭合引号，尝试修复
    jsonStr = jsonStr.replace(/"emotion":\s*"([^"]*?)(?=\s*[,}\]])/g, (match, value) => {
      if (!value.endsWith('"')) {
        return `"emotion": "${value}"`;
      }
      return match;
    });
    
    // 处理不完整的字符串值
    jsonStr = jsonStr.replace(/"description":\s*"([^"]*?)(?=\s*[,}\]])/g, (match, value) => {
      if (!value.endsWith('"')) {
        return `"description": "${value}"`;
      }
      return match;
    });
    
    // 处理不完整的数组
    jsonStr = jsonStr.replace(/"visualCharacteristics":\s*\[([^\]]*?)(?=\s*[,}\]])/g, (match, value) => {
      if (!value.endsWith(']')) {
        // 尝试修复数组内容
        const items = value.split(',').map(item => item.trim()).filter(item => item);
        const fixedItems = items.map(item => {
          if (!item.startsWith('"')) item = `"${item}`;
          if (!item.endsWith('"')) item = `${item}"`;
          return item;
        });
        return `"visualCharacteristics": [${fixedItems.join(', ')}]`;
      }
      return match;
    });
    
    // 处理不完整的keywords数组
    jsonStr = jsonStr.replace(/"keywords":\s*\[([^\]]*?)(?=\s*[,}\]])/g, (match, value) => {
      if (!value.endsWith(']')) {
        const items = value.split(',').map(item => item.trim()).filter(item => item);
        const fixedItems = items.map(item => {
          if (!item.startsWith('"')) item = `"${item}`;
          if (!item.endsWith('"')) item = `${item}"`;
          return item;
        });
        return `"keywords": [${fixedItems.join(', ')}]`;
      }
      return match;
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
      intensity: intent.emotionalStages[0]?.intensity || 0.7,
      curveType: 'linear' as 'linear' | 'wave' | 'peak' | 'valley' | 'custom'
    };

    return await EmotionCurveGenerator.generateCurve([], [], 'joy', curveConfig);
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
        composition: [],
        lighting: [],
        mood: [],
        texture: []
      },
      aestheticPreferences: data.aestheticPreferences || {
        mediaTypes: [],
        artStyles: [],
        timePeriods: [],
        culturalContexts: [],
        avoidElements: []
      },
      narrativeTone: data.narrativeTone || {
        voice: '温和',
        approach: '引导',
        intimacy: '亲近',
        pacing: '舒缓',
        perspective: '第一人称'
      },
      targetAudience: data.targetAudience || '寻求情感共鸣的用户',
      keyMessages: data.keyMessages || [],
      visualProgression: data.visualProgression || '',
      emotionCurve: data.emotionCurve || {
        curveType: 'linear',
        totalDuration: 30,
        peakPoints: [],
        transitionPoints: []
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
