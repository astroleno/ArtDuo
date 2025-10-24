/**
 * 情绪分类服务
 * 负责检测和分类用户输入的情绪
 */

// 情绪分类配置
export const EMOTION_CONFIG = {
  joy: {
    keywords: ['joy', 'happiness', 'celebration', 'delight', 'glee', 'jubilation', 'cheerful', 'merry'],
    synonyms: ['快乐', '高兴', '喜悦', '欢乐', '愉快'],
    intensity: 1.0
  },
  sadness: {
    keywords: ['sadness', 'melancholy', 'grief', 'sorrow', 'despair', 'mourning', 'blue', 'down'],
    synonyms: ['悲伤', '忧郁', '哀伤', '沮丧', '难过'],
    intensity: 1.0
  },
  love: {
    keywords: ['love', 'romance', 'passion', 'affection', 'tenderness', 'devotion', 'adoration'],
    synonyms: ['爱', '爱情', '浪漫', '激情', '温柔'],
    intensity: 1.0
  },
  fear: {
    keywords: ['fear', 'anxiety', 'terror', 'dread', 'panic', 'horror', 'worry', 'nervous'],
    synonyms: ['恐惧', '焦虑', '害怕', '担心', '紧张'],
    intensity: 1.0
  },
  anger: {
    keywords: ['anger', 'rage', 'fury', 'wrath', 'ire', 'indignation', 'mad', 'furious'],
    synonyms: ['愤怒', '生气', '狂怒', '愤慨', '恼火'],
    intensity: 1.0
  },
  surprise: {
    keywords: ['surprise', 'amazement', 'wonder', 'astonishment', 'shock', 'startle'],
    synonyms: ['惊讶', '惊奇', '震惊', '意外', '诧异'],
    intensity: 1.0
  },
  disgust: {
    keywords: ['disgust', 'revulsion', 'repulsion', 'aversion', 'loathing', 'repugnance'],
    synonyms: ['厌恶', '反感', '恶心', '憎恶', '嫌弃'],
    intensity: 1.0
  },
  contemplation: {
    keywords: ['contemplation', 'meditation', 'reflection', 'thought', 'pondering', 'introspection'],
    synonyms: ['沉思', '冥想', '反思', '思考', '内省'],
    intensity: 1.0
  },
  awe: {
    keywords: ['awe', 'reverence', 'wonder', 'amazement', 'admiration', 'respect'],
    synonyms: ['敬畏', '崇敬', '惊叹', '钦佩', '敬仰'],
    intensity: 1.0
  },
  peace: {
    keywords: ['peace', 'serenity', 'tranquility', 'calm', 'stillness', 'quiet', 'zen'],
    synonyms: ['平静', '宁静', '安详', '宁静', '平和'],
    intensity: 1.0
  }
} as const;

export type EmotionType = keyof typeof EMOTION_CONFIG;

/**
 * 情绪检测结果
 */
export interface EmotionDetectionResult {
  primaryEmotion: EmotionType | null;
  secondaryEmotions: EmotionType[];
  confidence: number;
  intensity: number;
  matchedKeywords: string[];
  suggestions: string[];
}

/**
 * 情绪分类器
 */
export class EmotionClassifier {
  private static instance: EmotionClassifier;
  
  private constructor() {}
  
  static getInstance(): EmotionClassifier {
    if (!EmotionClassifier.instance) {
      EmotionClassifier.instance = new EmotionClassifier();
    }
    return EmotionClassifier.instance;
  }

  /**
   * 检测文本中的情绪
   */
  detectEmotion(text: string): EmotionDetectionResult {
    const normalizedText = text.toLowerCase().trim();
    
    if (!normalizedText) {
      return {
        primaryEmotion: null,
        secondaryEmotions: [],
        confidence: 0,
        intensity: 0,
        matchedKeywords: [],
        suggestions: []
      };
    }

    const emotionScores = new Map<EmotionType, number>();
    const matchedKeywords: string[] = [];
    
    // 计算每种情绪的匹配分数
    for (const [emotion, config] of Object.entries(EMOTION_CONFIG)) {
      let score = 0;
      const emotionKeywords = [...config.keywords, ...config.synonyms];
      
      for (const keyword of emotionKeywords) {
        if (normalizedText.includes(keyword.toLowerCase())) {
          score += config.intensity;
          matchedKeywords.push(keyword);
        }
      }
      
      if (score > 0) {
        emotionScores.set(emotion as EmotionType, score);
      }
    }

    // 确定主要情绪和次要情绪
    const sortedEmotions = Array.from(emotionScores.entries())
      .sort(([, a], [, b]) => b - a);

    const primaryEmotion = sortedEmotions.length > 0 ? sortedEmotions[0][0] : null;
    const secondaryEmotions = sortedEmotions.slice(1, 3).map(([emotion]) => emotion);
    
    // 计算置信度
    const totalScore = Array.from(emotionScores.values()).reduce((sum, score) => sum + score, 0);
    const confidence = totalScore > 0 ? Math.min(totalScore / 10, 1) : 0;
    
    // 计算强度
    const intensity = primaryEmotion ? emotionScores.get(primaryEmotion)! : 0;
    
    // 生成建议
    const suggestions = this.generateSuggestions(primaryEmotion, secondaryEmotions);

    return {
      primaryEmotion,
      secondaryEmotions,
      confidence,
      intensity,
      matchedKeywords,
      suggestions
    };
  }

  /**
   * 生成情绪建议
   */
  private generateSuggestions(primaryEmotion: EmotionType | null, secondaryEmotions: EmotionType[]): string[] {
    const suggestions: string[] = [];
    
    if (primaryEmotion) {
      const config = EMOTION_CONFIG[primaryEmotion];
      suggestions.push(`检测到主要情绪：${primaryEmotion}`);
      suggestions.push(`相关关键词：${config.keywords.slice(0, 3).join(', ')}`);
    }
    
    if (secondaryEmotions.length > 0) {
      suggestions.push(`次要情绪：${secondaryEmotions.join(', ')}`);
    }
    
    if (suggestions.length === 0) {
      suggestions.push('未检测到明确情绪，建议使用更具体的情绪词汇');
    }
    
    return suggestions;
  }

  /**
   * 获取情绪权重
   */
  getEmotionWeight(emotion: EmotionType): number {
    return EMOTION_CONFIG[emotion].intensity;
  }

  /**
   * 获取所有情绪类型
   */
  getAllEmotions(): EmotionType[] {
    return Object.keys(EMOTION_CONFIG) as EmotionType[];
  }

  /**
   * 获取情绪配置
   */
  getEmotionConfig(emotion: EmotionType) {
    return EMOTION_CONFIG[emotion];
  }

  /**
   * 检查是否支持某种情绪
   */
  isEmotionSupported(emotion: string): emotion is EmotionType {
    return emotion in EMOTION_CONFIG;
  }

  /**
   * 获取情绪的中文名称
   */
  getEmotionChineseName(emotion: EmotionType): string {
    const emotionNames: Record<EmotionType, string> = {
      joy: '快乐',
      sadness: '悲伤',
      love: '爱情',
      fear: '恐惧',
      anger: '愤怒',
      surprise: '惊讶',
      disgust: '厌恶',
      contemplation: '沉思',
      awe: '敬畏',
      peace: '平静'
    };
    
    return emotionNames[emotion] || emotion;
  }

  /**
   * 批量检测情绪
   */
  batchDetectEmotions(texts: string[]): EmotionDetectionResult[] {
    return texts.map(text => this.detectEmotion(text));
  }

  /**
   * 获取情绪统计
   */
  getEmotionStats(results: EmotionDetectionResult[]): Record<EmotionType, number> {
    const stats: Record<EmotionType, number> = {} as any;
    
    // 初始化统计
    this.getAllEmotions().forEach(emotion => {
      stats[emotion] = 0;
    });
    
    // 统计情绪出现次数
    results.forEach(result => {
      if (result.primaryEmotion) {
        stats[result.primaryEmotion]++;
      }
      result.secondaryEmotions.forEach(emotion => {
        stats[emotion]++;
      });
    });
    
    return stats;
  }
}

/**
 * 情绪权重计算器
 */
export class EmotionWeightCalculator {
  /**
   * 计算情绪权重
   */
  static calculateEmotionWeight(emotion: EmotionType, intensity: number): number {
    const baseWeight = EMOTION_CONFIG[emotion].intensity;
    return baseWeight * intensity;
  }

  /**
   * 计算多情绪权重
   */
  static calculateMultiEmotionWeight(emotions: Array<{ emotion: EmotionType, intensity: number }>): number {
    if (emotions.length === 0) return 0;
    
    const totalWeight = emotions.reduce((sum, { emotion, intensity }) => {
      return sum + this.calculateEmotionWeight(emotion, intensity);
    }, 0);
    
    return totalWeight / emotions.length;
  }

  /**
   * 计算情绪相似度
   */
  static calculateEmotionSimilarity(emotion1: EmotionType, emotion2: EmotionType): number {
    if (emotion1 === emotion2) return 1.0;
    
    // 定义情绪相似度矩阵
    const similarityMatrix: Record<EmotionType, Record<EmotionType, number>> = {
      joy: { joy: 1.0, love: 0.8, surprise: 0.6, peace: 0.4, sadness: 0.1, fear: 0.1, anger: 0.1, disgust: 0.1, contemplation: 0.3, awe: 0.5 },
      sadness: { joy: 0.1, love: 0.3, surprise: 0.2, peace: 0.6, sadness: 1.0, fear: 0.7, anger: 0.4, disgust: 0.3, contemplation: 0.8, awe: 0.2 },
      love: { joy: 0.8, love: 1.0, surprise: 0.4, peace: 0.7, sadness: 0.3, fear: 0.2, anger: 0.1, disgust: 0.1, contemplation: 0.6, awe: 0.7 },
      fear: { joy: 0.1, love: 0.2, surprise: 0.6, peace: 0.2, sadness: 0.7, fear: 1.0, anger: 0.5, disgust: 0.4, contemplation: 0.3, awe: 0.8 },
      anger: { joy: 0.1, love: 0.1, surprise: 0.3, peace: 0.1, sadness: 0.4, fear: 0.5, anger: 1.0, disgust: 0.6, contemplation: 0.2, awe: 0.3 },
      surprise: { joy: 0.6, love: 0.4, surprise: 1.0, peace: 0.3, sadness: 0.2, fear: 0.6, anger: 0.3, disgust: 0.2, contemplation: 0.4, awe: 0.8 },
      disgust: { joy: 0.1, love: 0.1, surprise: 0.2, peace: 0.1, sadness: 0.3, fear: 0.4, anger: 0.6, disgust: 1.0, contemplation: 0.2, awe: 0.2 },
      contemplation: { joy: 0.3, love: 0.6, surprise: 0.4, peace: 0.8, sadness: 0.8, fear: 0.3, anger: 0.2, disgust: 0.2, contemplation: 1.0, awe: 0.7 },
      awe: { joy: 0.5, love: 0.7, surprise: 0.8, peace: 0.6, sadness: 0.2, fear: 0.8, anger: 0.3, disgust: 0.2, contemplation: 0.7, awe: 1.0 },
      peace: { joy: 0.4, love: 0.7, surprise: 0.3, peace: 1.0, sadness: 0.6, fear: 0.2, anger: 0.1, disgust: 0.1, contemplation: 0.8, awe: 0.6 }
    };
    
    return similarityMatrix[emotion1]?.[emotion2] || 0.0;
  }
}

// 导出单例实例
export const emotionClassifier = EmotionClassifier.getInstance();

// 导出工具函数
export const emotionUtils = {
  detectEmotion: emotionClassifier.detectEmotion.bind(emotionClassifier),
  getAllEmotions: emotionClassifier.getAllEmotions.bind(emotionClassifier),
  getEmotionConfig: emotionClassifier.getEmotionConfig.bind(emotionClassifier),
  isEmotionSupported: emotionClassifier.isEmotionSupported.bind(emotionClassifier),
  getEmotionChineseName: emotionClassifier.getEmotionChineseName.bind(emotionClassifier),
  calculateEmotionWeight: EmotionWeightCalculator.calculateEmotionWeight,
  calculateMultiEmotionWeight: EmotionWeightCalculator.calculateMultiEmotionWeight,
  calculateEmotionSimilarity: EmotionWeightCalculator.calculateEmotionSimilarity
};
