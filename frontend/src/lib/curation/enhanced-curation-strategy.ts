/**
 * 增强版智能策展策略系统
 * 支持6-12件作品，预设+实时生成情绪曲线
 */

import { EmotionCurveGenerator } from '@/lib/curation/emotion-curve';
import { hybridSearchService } from '@/lib/vector-search/hybrid-search';
import { emotionClassifier } from '@/lib/vector-search/emotion-classifier';

/**
 * 策展规模配置
 */
export interface CurationScale {
  type: 'compact' | 'standard' | 'immersive';
  artworkCount: number;
  duration: number;
  description: string;
}

/**
 * 预设情绪曲线模板
 */
export interface PresetEmotionCurve {
  id: string;
  name: string;
  description: string;
  curveType: 'linear' | 'wave' | 'peak' | 'valley' | 'spiral' | 'custom';
  phases: Array<{
    phase: number;
    emotion: string;
    intensity: number;
    description: string;
    artworkCount: number;
    duration: number;
  }>;
  totalDuration: number;
  emotionalArc: string;
  suitableEmotions: string[];
  complexity: 'simple' | 'medium' | 'complex';
}

/**
 * 实时生成的情绪曲线
 */
export interface DynamicEmotionCurve {
  curveType: 'linear' | 'wave' | 'peak' | 'valley' | 'spiral' | 'custom';
  phases: Array<{
    phase: number;
    emotion: string;
    intensity: number;
    description: string;
    artworkCount: number;
    duration: number;
  }>;
  totalDuration: number;
  emotionalArc: string;
  userSpecific: boolean;
  confidence: number;
}

/**
 * 策展策略接口
 */
export interface CurationStrategy {
  theme: string;
  narrative: string;
  artisticStyles: string[];
  timePeriods: string[];
  culturalContexts: string[];
  emotionalJourney: string;
  targetAudience: string;
  curatorialApproach: string;
  keyMessages: string[];
  visualFlow: string;
  scale: CurationScale;
  emotionCurve: PresetEmotionCurve | DynamicEmotionCurve;
}

/**
 * 增强版智能策展策略生成器
 */
export class EnhancedCurationStrategy {
  private emotion: string;
  private userInput?: string;
  private strategy: CurationStrategy | null = null;

  // 策展规模配置
  private readonly CURATION_SCALES: CurationScale[] = [
    {
      type: 'compact',
      artworkCount: 6,
      duration: 20,
      description: '简洁策展，适合快速体验'
    },
    {
      type: 'standard',
      artworkCount: 9,
      duration: 30,
      description: '标准策展，平衡体验和深度'
    },
    {
      type: 'immersive',
      artworkCount: 12,
      duration: 45,
      description: '深度策展，适合沉浸式体验'
    }
  ];

  // 预设情绪曲线模板
  private readonly PRESET_CURVES: PresetEmotionCurve[] = [
    {
      id: 'joy_linear',
      name: '快乐线性曲线',
      description: '从快乐开始，逐渐深入内心平静',
      curveType: 'linear',
      phases: [
        { phase: 1, emotion: 'joy', intensity: 0.8, description: '开场快乐', artworkCount: 2, duration: 8 },
        { phase: 2, emotion: 'contentment', intensity: 0.7, description: '满足感', artworkCount: 2, duration: 8 },
        { phase: 3, emotion: 'peace', intensity: 0.9, description: '内心平静', artworkCount: 2, duration: 8 }
      ],
      totalDuration: 24,
      emotionalArc: '从快乐到满足再到平静',
      suitableEmotions: ['joy', 'happiness', 'cheerful'],
      complexity: 'simple'
    },
    {
      id: 'sadness_wave',
      name: '悲伤波浪曲线',
      description: '从悲伤到忧郁再到希望，波浪式情感变化',
      curveType: 'wave',
      phases: [
        { phase: 1, emotion: 'sadness', intensity: 0.9, description: '深度悲伤', artworkCount: 2, duration: 10 },
        { phase: 2, emotion: 'melancholy', intensity: 0.6, description: '忧郁沉思', artworkCount: 2, duration: 10 },
        { phase: 3, emotion: 'hope', intensity: 0.8, description: '希望之光', artworkCount: 2, duration: 10 }
      ],
      totalDuration: 30,
      emotionalArc: '从悲伤到忧郁再到希望',
      suitableEmotions: ['sadness', 'grief', 'melancholy'],
      complexity: 'medium'
    },
    {
      id: 'love_spiral',
      name: '爱情螺旋曲线',
      description: '从初遇到激情再到永恒，螺旋式上升',
      curveType: 'spiral',
      phases: [
        { phase: 1, emotion: 'love', intensity: 0.7, description: '初遇爱情', artworkCount: 2, duration: 8 },
        { phase: 2, emotion: 'passion', intensity: 0.9, description: '激情燃烧', artworkCount: 2, duration: 8 },
        { phase: 3, emotion: 'devotion', intensity: 0.8, description: '永恒承诺', artworkCount: 2, duration: 8 }
      ],
      totalDuration: 24,
      emotionalArc: '从初遇到激情再到永恒',
      suitableEmotions: ['love', 'romance', 'passion'],
      complexity: 'medium'
    },
    {
      id: 'fear_peak',
      name: '恐惧峰值曲线',
      description: '从紧张到恐惧再到释放，峰值式情感体验',
      curveType: 'peak',
      phases: [
        { phase: 1, emotion: 'anxiety', intensity: 0.6, description: '紧张焦虑', artworkCount: 2, duration: 8 },
        { phase: 2, emotion: 'fear', intensity: 0.9, description: '恐惧高峰', artworkCount: 2, duration: 8 },
        { phase: 3, emotion: 'relief', intensity: 0.7, description: '释放解脱', artworkCount: 2, duration: 8 }
      ],
      totalDuration: 24,
      emotionalArc: '从紧张到恐惧再到释放',
      suitableEmotions: ['fear', 'anxiety', 'terror'],
      complexity: 'complex'
    },
    {
      id: 'contemplation_valley',
      name: '沉思谷值曲线',
      description: '从表面到深度再到升华，谷值式内省体验',
      curveType: 'valley',
      phases: [
        { phase: 1, emotion: 'curiosity', intensity: 0.7, description: '好奇探索', artworkCount: 2, duration: 8 },
        { phase: 2, emotion: 'contemplation', intensity: 0.9, description: '深度沉思', artworkCount: 2, duration: 8 },
        { phase: 3, emotion: 'wisdom', intensity: 0.8, description: '智慧升华', artworkCount: 2, duration: 8 }
      ],
      totalDuration: 24,
      emotionalArc: '从好奇到沉思再到智慧',
      suitableEmotions: ['contemplation', 'meditation', 'reflection'],
      complexity: 'complex'
    }
  ];

  constructor(emotion: string, userInput?: string) {
    this.emotion = emotion;
    this.userInput = userInput;
  }

  /**
   * 执行增强版智能策展流程
   */
  async execute(): Promise<{
    strategy: CurationStrategy;
    selectedArtworks: any[];
    explanations: any[];
    curationSummary: any;
  }> {
    console.log('🧠 开始增强版智能策展流程...');
    const startTime = Date.now();

    try {
      // 第一步：LLM分析用户输入，制定策展策略
      console.log('📋 第一步：制定策展策略...');
      this.strategy = await this.generateEnhancedStrategy();
      console.log(`✅ 策展策略制定完成: "${this.strategy.theme}"`);

      // 第二步：向量检索匹配作品
      console.log('🔍 第二步：向量检索匹配作品...');
      const selectedArtworks = await this.vectorSearchArtworks();
      console.log(`✅ 向量检索完成，找到 ${selectedArtworks.length} 件作品`);

      // 第三步：LLM分批次生成讲解
      console.log('📝 第三步：生成作品讲解...');
      const explanations = await this.generateExplanations(selectedArtworks);
      console.log(`✅ 作品讲解生成完成`);

      // 第四步：生成策展总结
      const curationSummary = await this.generateCurationSummary(selectedArtworks, explanations);

      const totalTime = Date.now() - startTime;
      console.log(`🎉 增强版智能策展流程完成，总耗时: ${totalTime}ms`);

      return {
        strategy: this.strategy,
        selectedArtworks,
        explanations,
        curationSummary
      };

    } catch (error) {
      console.error('❌ 增强版智能策展流程执行失败:', error);
      throw error;
    }
  }

  /**
   * 生成增强版策展策略
   */
  private async generateEnhancedStrategy(): Promise<CurationStrategy> {
    try {
      // 检测用户输入的情绪
      const emotionDetection = emotionClassifier.detectEmotion(this.emotion);
      console.log(`🎭 检测到情绪: ${emotionDetection.primaryEmotion}, 置信度: ${emotionDetection.confidence}`);

      // 确定策展规模
      const scale = this.determineCurationScale(emotionDetection);
      console.log(`📏 策展规模: ${scale.type} (${scale.artworkCount}件作品)`);

      // 选择或生成情绪曲线
      const emotionCurve = await this.selectOrGenerateEmotionCurve(emotionDetection, scale);
      console.log(`📈 情绪曲线: ${emotionCurve.curveType} 类型`);

      // 生成策展策略
      const strategy = await this.generateCurationStrategy(emotionDetection, scale, emotionCurve);
      
      return strategy;

    } catch (error) {
      console.error('❌ 增强版策展策略生成失败:', error);
      throw error;
    }
  }

  /**
   * 确定策展规模
   */
  private determineCurationScale(emotionDetection: any): CurationScale {
    // 根据用户输入和情绪强度确定规模
    const intensity = emotionDetection.intensity || 0.5;
    const hasUserInput = !!this.userInput && this.userInput.length > 20;
    
    if (intensity > 0.8 && hasUserInput) {
      return this.CURATION_SCALES[2]; // immersive
    } else if (intensity > 0.6 || hasUserInput) {
      return this.CURATION_SCALES[1]; // standard
    } else {
      return this.CURATION_SCALES[0]; // compact
    }
  }

  /**
   * 选择或生成情绪曲线
   */
  private async selectOrGenerateEmotionCurve(
    emotionDetection: any, 
    scale: CurationScale
  ): Promise<PresetEmotionCurve | DynamicEmotionCurve> {
    
    const primaryEmotion = emotionDetection.primaryEmotion || this.emotion;
    
    // 首先尝试匹配预设曲线
    const matchingPreset = this.PRESET_CURVES.find(curve => 
      curve.suitableEmotions.includes(primaryEmotion) &&
      this.isScaleCompatible(curve, scale)
    );

    if (matchingPreset && emotionDetection.confidence > 0.7) {
      console.log(`🎯 使用预设曲线: ${matchingPreset.name}`);
      return matchingPreset;
    }

    // 如果预设不匹配或置信度低，实时生成
    console.log(`🔄 实时生成情绪曲线...`);
    return await this.generateDynamicEmotionCurve(emotionDetection, scale);
  }

  /**
   * 检查规模兼容性
   */
  private isScaleCompatible(curve: PresetEmotionCurve, scale: CurationScale): boolean {
    const totalArtworks = curve.phases.reduce((sum, phase) => sum + phase.artworkCount, 0);
    return totalArtworks <= scale.artworkCount;
  }

  /**
   * 生成动态情绪曲线
   */
  private async generateDynamicEmotionCurve(
    emotionDetection: any,
    scale: CurationScale
  ): Promise<DynamicEmotionCurve> {
    
    // 模拟LLM生成动态曲线
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const primaryEmotion = emotionDetection.primaryEmotion || this.emotion;
    const intensity = emotionDetection.intensity || 0.5;
    
    // 根据情绪类型和强度生成不同的曲线
    const curveTemplates = {
      joy: {
        curveType: 'wave' as const,
        phases: [
          { phase: 1, emotion: 'joy', intensity: intensity, description: '开场快乐', artworkCount: Math.floor(scale.artworkCount / 3), duration: Math.floor(scale.duration / 3) },
          { phase: 2, emotion: 'contentment', intensity: intensity * 0.8, description: '满足感', artworkCount: Math.floor(scale.artworkCount / 3), duration: Math.floor(scale.duration / 3) },
          { phase: 3, emotion: 'peace', intensity: intensity * 1.2, description: '内心平静', artworkCount: scale.artworkCount - Math.floor(scale.artworkCount / 3) * 2, duration: scale.duration - Math.floor(scale.duration / 3) * 2 }
        ],
        totalDuration: scale.duration,
        emotionalArc: '从快乐到满足再到平静',
        userSpecific: true,
        confidence: emotionDetection.confidence
      },
      sadness: {
        curveType: 'valley' as const,
        phases: [
          { phase: 1, emotion: 'sadness', intensity: intensity, description: '深度悲伤', artworkCount: Math.floor(scale.artworkCount / 3), duration: Math.floor(scale.duration / 3) },
          { phase: 2, emotion: 'melancholy', intensity: intensity * 0.7, description: '忧郁沉思', artworkCount: Math.floor(scale.artworkCount / 3), duration: Math.floor(scale.duration / 3) },
          { phase: 3, emotion: 'hope', intensity: intensity * 0.9, description: '希望之光', artworkCount: scale.artworkCount - Math.floor(scale.artworkCount / 3) * 2, duration: scale.duration - Math.floor(scale.duration / 3) * 2 }
        ],
        totalDuration: scale.duration,
        emotionalArc: '从悲伤到忧郁再到希望',
        userSpecific: true,
        confidence: emotionDetection.confidence
      }
    };

    return curveTemplates[primaryEmotion as keyof typeof curveTemplates] || curveTemplates.joy;
  }

  /**
   * 生成策展策略
   */
  private async generateCurationStrategy(
    emotionDetection: any,
    scale: CurationScale,
    emotionCurve: PresetEmotionCurve | DynamicEmotionCurve
  ): Promise<CurationStrategy> {
    
    // 模拟LLM生成策展策略
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const primaryEmotion = emotionDetection.primaryEmotion || this.emotion;
    
    const strategyTemplates = {
      joy: {
        theme: "欢乐的艺术之旅",
        narrative: "通过色彩鲜艳、充满活力的艺术作品，带领观众体验纯粹的快乐",
        artisticStyles: ["印象派", "表现主义", "现代主义"],
        timePeriods: ["19世纪", "20世纪", "当代"],
        culturalContexts: ["欧洲", "美洲", "亚洲"],
        emotionalJourney: "从轻松愉快到深度满足",
        targetAudience: "寻求快乐和正能量的观众",
        curatorialApproach: "色彩心理学与情绪疗愈",
        keyMessages: ["艺术能带来快乐", "色彩影响情绪", "创造力源于内心"],
        visualFlow: "明亮色调 → 温暖色彩 → 金色光芒"
      },
      sadness: {
        theme: "悲伤的深度与美感",
        narrative: "探索悲伤在艺术中的表达，展现人类情感的深度和复杂性",
        artisticStyles: ["浪漫主义", "象征主义", "表现主义"],
        timePeriods: ["19世纪", "20世纪早期"],
        culturalContexts: ["欧洲", "俄罗斯"],
        emotionalJourney: "从深沉悲伤到接受与成长",
        targetAudience: "正在经历情感波动的观众",
        curatorialApproach: "情感疗愈与艺术治疗",
        keyMessages: ["悲伤是成长的一部分", "艺术能治愈心灵", "情感需要表达"],
        visualFlow: "深色调 → 蓝色系 → 温暖光芒"
      },
      love: {
        theme: "爱的艺术表达",
        narrative: "通过不同文化和时代的艺术作品，展现爱的多样性和深度",
        artisticStyles: ["文艺复兴", "浪漫主义", "印象派"],
        timePeriods: ["15-16世纪", "19世纪", "20世纪"],
        culturalContexts: ["意大利", "法国", "全球"],
        emotionalJourney: "从初恋到深爱，从激情到永恒",
        targetAudience: "情侣、夫妻、爱情追求者",
        curatorialApproach: "情感共鸣与关系建设",
        keyMessages: ["爱是艺术永恒的主题", "不同文化对爱的理解", "爱需要表达和珍惜"],
        visualFlow: "暖色调 → 红色系 → 金色光芒"
      }
    };

    const baseStrategy = strategyTemplates[primaryEmotion as keyof typeof strategyTemplates] || strategyTemplates.joy;
    
    return {
      ...baseStrategy,
      scale,
      emotionCurve
    };
  }

  /**
   * 向量检索匹配作品
   */
  private async vectorSearchArtworks(): Promise<any[]> {
    try {
      if (!this.strategy) {
        throw new Error('策展策略未生成');
      }

      // 初始化混合检索服务
      await hybridSearchService.initialize();

      // 构建检索查询
      const searchQuery = this.buildIntelligentSearchQuery();
      console.log(`🔍 智能检索查询: "${searchQuery}"`);

      // 构建智能过滤器
      const filters = this.buildIntelligentFilters();

      // 执行向量检索
      const searchResults = await hybridSearchService.search(searchQuery, filters);
      console.log(`📊 向量检索结果: ${searchResults.length} 件作品`);

      // 根据情绪曲线调整作品选择
      const adjustedResults = this.adjustResultsByCurve(searchResults);

      // 选择最终作品（根据规模确定数量）
      const selectedArtworks = adjustedResults.slice(0, this.strategy.scale.artworkCount);

      return selectedArtworks;

    } catch (error) {
      console.error('❌ 向量检索失败:', error);
      throw error;
    }
  }

  /**
   * 构建智能检索查询
   */
  private buildIntelligentSearchQuery(): string {
    let query = this.emotion;
    
    if (this.userInput) {
      query += ` ${this.userInput}`;
    }

    // 添加策展策略信息
    if (this.strategy) {
      query += ` ${this.strategy.theme}`;
      query += ` ${this.strategy.artisticStyles.join(' ')}`;
      query += ` ${this.strategy.culturalContexts.join(' ')}`;
      
      // 添加情绪曲线信息
      const curveEmotions = this.strategy.emotionCurve.phases.map(p => p.emotion).join(' ');
      query += ` ${curveEmotions}`;
    }

    return query;
  }

  /**
   * 构建智能过滤器
   */
  private buildIntelligentFilters(): any {
    const filters: any = {
      qualityLevel: ['excellent', 'good'],
      preferPainting: true
    };

    // 根据策展策略添加过滤器
    if (this.strategy) {
      if (this.strategy.timePeriods.length > 0) {
        filters.dateRange = {
          min: this.strategy.timePeriods.includes('15-16世纪') ? 1400 : 1800,
          max: this.strategy.timePeriods.includes('当代') ? 2024 : 1950
        };
      }

      if (this.strategy.culturalContexts.length > 0) {
        filters.culture = this.strategy.culturalContexts[0];
      }
    }

    return filters;
  }

  /**
   * 根据情绪曲线调整结果
   */
  private adjustResultsByCurve(searchResults: any[]): any[] {
    if (!this.strategy) return searchResults;

    return searchResults.map(result => {
      let adjustedScore = result.finalScore || result.similarity;
      
      // 根据情绪曲线调整权重
      const curveEmotions = this.strategy.emotionCurve.phases.map(p => p.emotion);
      if (curveEmotions.includes(result.emotionType)) {
        adjustedScore *= 1.2;
      }

      // 根据策展策略调整权重
      if (this.strategy.artisticStyles.some(style => 
        result.artwork?.medium?.toLowerCase().includes(style.toLowerCase())
      )) {
        adjustedScore *= 1.3;
      }

      return {
        ...result,
        adjustedScore,
        curveMatch: curveEmotions.includes(result.emotionType),
        strategyMatch: this.strategy.artisticStyles.some(style => 
          result.artwork?.medium?.toLowerCase().includes(style.toLowerCase())
        )
      };
    }).sort((a, b) => b.adjustedScore - a.adjustedScore);
  }

  /**
   * 生成作品讲解
   */
  private async generateExplanations(artworks: any[]): Promise<any[]> {
    try {
      if (artworks.length === 0) return [];

      // 根据策展规模确定批次大小
      const batchSize = this.strategy?.scale.type === 'immersive' ? 4 : 3;
      const explanations: any[] = [];

      for (let i = 0; i < artworks.length; i += batchSize) {
        const batch = artworks.slice(i, i + batchSize);
        console.log(`📝 生成第 ${Math.floor(i / batchSize) + 1} 批讲解 (${batch.length} 件作品)`);

        try {
          const batchExplanations = await this.generateBatchExplanations(batch, i / batchSize + 1);
          explanations.push(...batchExplanations);
          console.log(`✅ 第 ${Math.floor(i / batchSize) + 1} 批讲解完成`);

        } catch (error) {
          console.error(`❌ 第 ${Math.floor(i / batchSize) + 1} 批讲解失败:`, error);
          // 为失败的作品生成基础讲解
          const fallbackExplanations = batch.map(artwork => ({
            artworkId: artwork.id,
            explanation: this.generateFallbackExplanation(artwork, i / batchSize + 1),
            confidence: 0.5
          }));
          explanations.push(...fallbackExplanations);
        }
      }

      return explanations;

    } catch (error) {
      console.error('❌ 讲解生成失败:', error);
      return [];
    }
  }

  /**
   * 生成批次讲解
   */
  private async generateBatchExplanations(artworks: any[], batchNumber: number): Promise<any[]> {
    // 模拟LLM生成讲解
    await new Promise(resolve => setTimeout(resolve, 400));
    
    return artworks.map(artwork => ({
      artworkId: artwork.id,
      explanation: this.generateIntelligentExplanation(artwork, batchNumber),
      confidence: 0.9,
      batchNumber,
      strategyContext: this.strategy?.theme,
      emotionContext: this.strategy?.emotionCurve.phases[batchNumber - 1]?.emotion
    }));
  }

  /**
   * 生成智能讲解
   */
  private generateIntelligentExplanation(artwork: any, batchNumber: number): string {
    const phase = this.strategy?.emotionCurve.phases[batchNumber - 1];
    const strategy = this.strategy;
    
    return `这件作品完美诠释了策展主题"${strategy?.theme}"。在情绪曲线的第${batchNumber}阶段"${phase?.emotion}"中，它通过${artwork.medium}的技法，展现了${strategy?.emotionalJourney}的深度。${strategy?.keyMessages[0]}，这正是我们希望通过艺术传达的核心信息。`;
  }

  /**
   * 生成降级讲解
   */
  private generateFallbackExplanation(artwork: any, batchNumber: number): string {
    return `这件作品与您的情绪"${this.emotion}"产生了共鸣，在策展的第${batchNumber}阶段中展现了独特的艺术价值。`;
  }

  /**
   * 生成策展总结
   */
  private async generateCurationSummary(artworks: any[], explanations: any[]): Promise<any> {
    return {
      strategy: this.strategy,
      totalArtworks: artworks.length,
      totalExplanations: explanations.length,
      scale: this.strategy?.scale,
      emotionCurve: this.strategy?.emotionCurve,
      qualityDistribution: this.getQualityDistribution(artworks),
      emotionDistribution: this.getEmotionDistribution(artworks),
      strategyAlignment: this.calculateStrategyAlignment(artworks),
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * 获取质量分布
   */
  private getQualityDistribution(artworks: any[]): any {
    const distribution = { excellent: 0, good: 0, basic: 0, minimal: 0 };
    
    artworks.forEach(artwork => {
      const quality = artwork.qualityLevel || 'good';
      distribution[quality as keyof typeof distribution]++;
    });

    return distribution;
  }

  /**
   * 获取情绪分布
   */
  private getEmotionDistribution(artworks: any[]): any {
    const distribution: any = {};
    
    artworks.forEach(artwork => {
      const emotion = artwork.emotionType || 'unknown';
      distribution[emotion] = (distribution[emotion] || 0) + 1;
    });

    return distribution;
  }

  /**
   * 计算策略对齐度
   */
  private calculateStrategyAlignment(artworks: any[]): number {
    if (!this.strategy || artworks.length === 0) return 0;

    let alignmentScore = 0;
    let totalChecks = 0;

    artworks.forEach(artwork => {
      // 检查艺术风格匹配
      if (this.strategy!.artisticStyles.some(style => 
        artwork.medium?.toLowerCase().includes(style.toLowerCase())
      )) {
        alignmentScore += 1;
      }
      totalChecks += 1;

      // 检查文化背景匹配
      if (this.strategy!.culturalContexts.some(context => 
        artwork.culture?.toLowerCase().includes(context.toLowerCase())
      )) {
        alignmentScore += 1;
      }
      totalChecks += 1;
    });

    return totalChecks > 0 ? alignmentScore / totalChecks : 0;
  }
}

/**
 * 增强版智能策展API
 */
export async function enhancedCurationAPI(request: Request) {
  try {
    const body = await request.json();
    const { emotion, userInput } = body;

    if (!emotion) {
      return new Response(JSON.stringify({ error: 'Missing required field: emotion' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 执行增强版智能策展流程
    const curationStrategy = new EnhancedCurationStrategy(emotion, userInput);
    const result = await curationStrategy.execute();

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ 增强版智能策展API失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
