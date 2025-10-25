/**
 * 智能策展策略系统
 * 正确的策展流程：LLM分析 → 策展策略 → 情绪曲线 → 向量检索 → 讲解
 */

import { EmotionCurveGenerator } from '@/lib/curation/emotion-curve';
import { hybridSearchService } from '@/lib/vector-search/hybrid-search';
import { emotionClassifier } from '@/lib/vector-search/emotion-classifier';

/**
 * 策展策略接口
 */
export interface CurationStrategy {
  theme: string;                    // 策展主题
  narrative: string;                // 策展叙事
  artisticStyles: string[];         // 艺术风格
  timePeriods: string[];            // 时代范围
  culturalContexts: string[];       // 文化背景
  emotionalJourney: string;         // 情绪旅程描述
  targetAudience: string;           // 目标观众
  curatorialApproach: string;        // 策展方法
  keyMessages: string[];            // 核心信息
  visualFlow: string;               // 视觉流程
}

/**
 * 情绪曲线设计
 */
export interface EmotionCurveDesign {
  curveType: 'linear' | 'wave' | 'peak' | 'valley' | 'custom';
  phases: Array<{
    phase: number;
    emotion: string;
    intensity: number;
    description: string;
    artworkCount: number;
  }>;
  totalDuration: number;
  emotionalArc: string;
  climaxPoint: number;
  resolutionPoint: number;
}

/**
 * 智能策展策略生成器
 */
export class IntelligentCurationStrategy {
  private emotion: string;
  private userInput?: string;
  private strategy: CurationStrategy | null = null;
  private emotionCurve: EmotionCurveDesign | null = null;

  constructor(emotion: string, userInput?: string) {
    this.emotion = emotion;
    this.userInput = userInput;
  }

  /**
   * 执行完整的智能策展流程
   */
  async execute(): Promise<{
    strategy: CurationStrategy;
    emotionCurve: EmotionCurveDesign;
    selectedArtworks: any[];
    explanations: any[];
    curationSummary: any;
  }> {
    console.log('🧠 开始智能策展流程...');
    const startTime = Date.now();

    try {
      // 第一步：LLM分析用户输入，制定策展策略
      console.log('📋 第一步：制定策展策略...');
      this.strategy = await this.generateCurationStrategy();
      console.log(`✅ 策展策略制定完成: "${this.strategy.theme}"`);

      // 第二步：LLM设计情绪曲线
      console.log('📈 第二步：设计情绪曲线...');
      this.emotionCurve = await this.designEmotionCurve();
      console.log(`✅ 情绪曲线设计完成: ${this.emotionCurve.curveType} 类型`);

      // 第三步：向量检索匹配作品
      console.log('🔍 第三步：向量检索匹配作品...');
      const selectedArtworks = await this.vectorSearchArtworks();
      console.log(`✅ 向量检索完成，找到 ${selectedArtworks.length} 件作品`);

      // 第四步：LLM分批次生成讲解
      console.log('📝 第四步：生成作品讲解...');
      const explanations = await this.generateExplanations(selectedArtworks);
      console.log(`✅ 作品讲解生成完成`);

      // 第五步：生成策展总结
      const curationSummary = await this.generateCurationSummary(selectedArtworks, explanations);

      const totalTime = Date.now() - startTime;
      console.log(`🎉 智能策展流程完成，总耗时: ${totalTime}ms`);

      return {
        strategy: this.strategy,
        emotionCurve: this.emotionCurve,
        selectedArtworks,
        explanations,
        curationSummary
      };

    } catch (error) {
      console.error('❌ 智能策展流程执行失败:', error);
      throw error;
    }
  }

  /**
   * 第一步：生成策展策略
   */
  private async generateCurationStrategy(): Promise<CurationStrategy> {
    try {
      // 检测用户输入的情绪
      const emotionDetection = emotionClassifier.detectEmotion(this.emotion);
      console.log(`🎭 检测到情绪: ${emotionDetection.primaryEmotion}, 置信度: ${emotionDetection.confidence}`);

      // 模拟LLM生成策展策略（实际应该调用LLM API）
      const strategy = await this.callLLMForStrategy(emotionDetection);
      
      return strategy;

    } catch (error) {
      console.error('❌ 策展策略生成失败:', error);
      throw error;
    }
  }

  /**
   * 调用LLM生成策展策略
   */
  private async callLLMForStrategy(emotionDetection: any): Promise<CurationStrategy> {
    // 模拟LLM调用（实际应该使用真实的LLM API）
    await new Promise(resolve => setTimeout(resolve, 500)); // 模拟500ms LLM调用

    const primaryEmotion = emotionDetection.primaryEmotion || this.emotion;
    
    // 根据情绪生成不同的策展策略
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

    return strategyTemplates[primaryEmotion as keyof typeof strategyTemplates] || strategyTemplates.joy;
  }

  /**
   * 第二步：设计情绪曲线
   */
  private async designEmotionCurve(): Promise<EmotionCurveDesign> {
    try {
      if (!this.strategy) {
        throw new Error('策展策略未生成');
      }

      // 模拟LLM设计情绪曲线
      const curve = await this.callLLMForEmotionCurve();
      
      return curve;

    } catch (error) {
      console.error('❌ 情绪曲线设计失败:', error);
      throw error;
    }
  }

  /**
   * 调用LLM设计情绪曲线
   */
  private async callLLMForEmotionCurve(): Promise<EmotionCurveDesign> {
    // 模拟LLM调用
    await new Promise(resolve => setTimeout(resolve, 300)); // 模拟300ms LLM调用

    const primaryEmotion = this.emotion;
    
    // 根据情绪和策略设计不同的曲线
    const curveTemplates = {
      joy: {
        curveType: 'wave' as const,
        phases: [
          { phase: 1, emotion: 'joy', intensity: 0.8, description: '开场快乐', artworkCount: 3 },
          { phase: 2, emotion: 'contemplation', intensity: 0.6, description: '深度思考', artworkCount: 3 },
          { phase: 3, emotion: 'peace', intensity: 0.9, description: '内心平静', artworkCount: 3 }
        ],
        totalDuration: 45,
        emotionalArc: '从快乐到沉思再到内心的平静',
        climaxPoint: 0.8,
        resolutionPoint: 0.9
      },
      sadness: {
        curveType: 'valley' as const,
        phases: [
          { phase: 1, emotion: 'sadness', intensity: 0.9, description: '深度悲伤', artworkCount: 3 },
          { phase: 2, emotion: 'melancholy', intensity: 0.7, description: '忧郁沉思', artworkCount: 3 },
          { phase: 3, emotion: 'hope', intensity: 0.8, description: '希望之光', artworkCount: 3 }
        ],
        totalDuration: 50,
        emotionalArc: '从悲伤到忧郁再到希望',
        climaxPoint: 0.9,
        resolutionPoint: 0.8
      },
      love: {
        curveType: 'peak' as const,
        phases: [
          { phase: 1, emotion: 'love', intensity: 0.7, description: '初遇爱情', artworkCount: 3 },
          { phase: 2, emotion: 'passion', intensity: 0.9, description: '激情燃烧', artworkCount: 3 },
          { phase: 3, emotion: 'devotion', intensity: 0.8, description: '永恒承诺', artworkCount: 3 }
        ],
        totalDuration: 40,
        emotionalArc: '从初遇到激情再到永恒',
        climaxPoint: 0.9,
        resolutionPoint: 0.8
      }
    };

    return curveTemplates[primaryEmotion as keyof typeof curveTemplates] || curveTemplates.joy;
  }

  /**
   * 第三步：向量检索匹配作品
   */
  private async vectorSearchArtworks(): Promise<any[]> {
    try {
      if (!this.strategy || !this.emotionCurve) {
        throw new Error('策展策略或情绪曲线未生成');
      }

      // 初始化混合检索服务
      await hybridSearchService.initialize();

      // 构建检索查询（结合策略和情绪曲线）
      const searchQuery = this.buildIntelligentSearchQuery();
      console.log(`🔍 智能检索查询: "${searchQuery}"`);

      // 构建智能过滤器
      const filters = this.buildIntelligentFilters();

      // 执行向量检索
      const searchResults = await hybridSearchService.search(searchQuery, filters);
      console.log(`📊 向量检索结果: ${searchResults.length} 件作品`);

      // 根据情绪曲线调整作品选择
      const adjustedResults = this.adjustResultsByStrategyAndCurve(searchResults);

      // 选择最终9件作品
      const selectedArtworks = adjustedResults.slice(0, 9);

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
    }

    // 添加情绪曲线信息
    if (this.emotionCurve) {
      const curveEmotions = this.emotionCurve.phases.map(p => p.emotion).join(' ');
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
   * 根据策略和曲线调整结果
   */
  private adjustResultsByStrategyAndCurve(searchResults: any[]): any[] {
    if (!this.strategy || !this.emotionCurve) return searchResults;

    return searchResults.map(result => {
      let adjustedScore = result.finalScore || result.similarity;
      
      // 根据策展策略调整权重
      if (this.strategy.artisticStyles.some(style => 
        result.artwork?.medium?.toLowerCase().includes(style.toLowerCase())
      )) {
        adjustedScore *= 1.3;
      }

      // 根据情绪曲线调整权重
      const curveEmotions = this.emotionCurve.phases.map(p => p.emotion);
      if (curveEmotions.includes(result.emotionType)) {
        adjustedScore *= 1.2;
      }

      // 根据文化背景调整权重
      if (this.strategy.culturalContexts.some(context => 
        result.artwork?.culture?.toLowerCase().includes(context.toLowerCase())
      )) {
        adjustedScore *= 1.1;
      }

      return {
        ...result,
        adjustedScore,
        strategyMatch: this.strategy.artisticStyles.some(style => 
          result.artwork?.medium?.toLowerCase().includes(style.toLowerCase())
        ),
        curveMatch: curveEmotions.includes(result.emotionType)
      };
    }).sort((a, b) => b.adjustedScore - a.adjustedScore);
  }

  /**
   * 第四步：生成作品讲解
   */
  private async generateExplanations(artworks: any[]): Promise<any[]> {
    try {
      if (artworks.length === 0) return [];

      // 分批次生成讲解（3+3+3模式）
      const explanations: any[] = [];
      const batchSize = 3;

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
    // 模拟LLM生成讲解（实际应该调用LLM API）
    await new Promise(resolve => setTimeout(resolve, 400)); // 模拟400ms LLM调用

    return artworks.map(artwork => ({
      artworkId: artwork.id,
      explanation: this.generateIntelligentExplanation(artwork, batchNumber),
      confidence: 0.9,
      batchNumber,
      strategyContext: this.strategy?.theme,
      emotionContext: this.emotionCurve?.phases[batchNumber - 1]?.emotion
    }));
  }

  /**
   * 生成智能讲解
   */
  private generateIntelligentExplanation(artwork: any, batchNumber: number): string {
    const phase = this.emotionCurve?.phases[batchNumber - 1];
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
   * 第五步：生成策展总结
   */
  private async generateCurationSummary(artworks: any[], explanations: any[]): Promise<any> {
    return {
      strategy: this.strategy,
      emotionCurve: this.emotionCurve,
      totalArtworks: artworks.length,
      totalExplanations: explanations.length,
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
 * 智能策展API
 */
export async function intelligentCurationAPI(request: Request) {
  try {
    const body = await request.json();
    const { emotion, userInput } = body;

    if (!emotion) {
      return new Response(JSON.stringify({ error: 'Missing required field: emotion' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 执行智能策展流程
    const curationStrategy = new IntelligentCurationStrategy(emotion, userInput);
    const result = await curationStrategy.execute();

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ 智能策展API失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
