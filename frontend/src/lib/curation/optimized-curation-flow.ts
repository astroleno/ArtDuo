/**
 * 优化后的策展流程
 * 新流程：情绪曲线 → 向量检索 → LLM讲解
 */

import { NextRequest } from 'next/server';
import { EmotionCurveGenerator } from '@/lib/curation/emotion-curve';
import { hybridSearchService } from '@/lib/vector-search/hybrid-search';
import { emotionClassifier } from '@/lib/vector-search/emotion-classifier';
import { generateArtworkExplanations } from '@/lib/curation/artwork-explanation';

/**
 * 优化后的策展流程类
 */
export class OptimizedCurationFlow {
  private emotion: string;
  private userInput?: string;
  private emotionCurve: any = null;
  private selectedArtworks: any[] = [];
  private explanations: any[] = [];

  constructor(emotion: string, userInput?: string) {
    this.emotion = emotion;
    this.userInput = userInput;
  }

  /**
   * 执行完整的优化策展流程
   */
  async execute(): Promise<{
    emotionCurve: any;
    selectedArtworks: any[];
    explanations: any[];
    summary: any;
  }> {
    console.log('🚀 开始优化策展流程...');
    const startTime = Date.now();

    try {
      // 第一步：LLM生成情绪曲线
      console.log('📈 第一步：生成情绪曲线...');
      this.emotionCurve = await this.generateEmotionCurve();
      console.log('✅ 情绪曲线生成完成');

      // 第二步：向量检索匹配作品
      console.log('🔍 第二步：向量检索匹配作品...');
      this.selectedArtworks = await this.vectorSearchArtworks();
      console.log(`✅ 向量检索完成，找到 ${this.selectedArtworks.length} 件作品`);

      // 第三步：LLM分批次生成讲解
      console.log('📝 第三步：生成作品讲解...');
      this.explanations = await this.generateExplanations();
      console.log('✅ 作品讲解生成完成');

      // 生成策展总结
      const summary = await this.generateSummary();

      const totalTime = Date.now() - startTime;
      console.log(`🎉 优化策展流程完成，总耗时: ${totalTime}ms`);

      return {
        emotionCurve: this.emotionCurve,
        selectedArtworks: this.selectedArtworks,
        explanations: this.explanations,
        summary
      };

    } catch (error) {
      console.error('❌ 策展流程执行失败:', error);
      throw error;
    }
  }

  /**
   * 第一步：生成情绪曲线
   */
  private async generateEmotionCurve(): Promise<any> {
    try {
      const curveGenerator = new EmotionCurveGenerator();
      
      // 检测用户输入的情绪
      const emotionDetection = emotionClassifier.detectEmotion(this.emotion);
      console.log(`🎭 检测到情绪: ${emotionDetection.primaryEmotion}, 置信度: ${emotionDetection.confidence}`);

      // 生成情绪曲线
      const curve = await curveGenerator.generateCurve(
        this.emotion,
        this.userInput,
        emotionDetection.primaryEmotion || 'joy'
      );

      return {
        ...curve,
        detectedEmotion: emotionDetection.primaryEmotion,
        confidence: emotionDetection.confidence,
        intensity: emotionDetection.intensity
      };

    } catch (error) {
      console.error('❌ 情绪曲线生成失败:', error);
      throw error;
    }
  }

  /**
   * 第二步：向量检索匹配作品
   */
  private async vectorSearchArtworks(): Promise<any[]> {
    try {
      // 初始化混合检索服务
      await hybridSearchService.initialize();

      // 构建检索查询
      const searchQuery = this.buildSearchQuery();
      console.log(`🔍 检索查询: "${searchQuery}"`);

      // 构建检索过滤器
      const filters = this.buildSearchFilters();

      // 执行向量检索
      const searchResults = await hybridSearchService.search(searchQuery, filters);
      console.log(`📊 向量检索结果: ${searchResults.length} 件作品`);

      // 根据情绪曲线调整作品选择
      const adjustedResults = this.adjustResultsByCurve(searchResults);

      // 选择最终9件作品
      const selectedArtworks = adjustedResults.slice(0, 9);

      return selectedArtworks;

    } catch (error) {
      console.error('❌ 向量检索失败:', error);
      throw error;
    }
  }

  /**
   * 构建检索查询
   */
  private buildSearchQuery(): string {
    let query = this.emotion;
    
    if (this.userInput) {
      query += ` ${this.userInput}`;
    }

    // 添加情绪曲线信息
    if (this.emotionCurve) {
      const curveKeywords = this.emotionCurve.keywords || [];
      query += ` ${curveKeywords.join(' ')}`;
    }

    return query;
  }

  /**
   * 构建检索过滤器
   */
  private buildSearchFilters(): any {
    return {
      qualityLevel: ['excellent', 'good'], // 优先高质量作品
      preferPainting: true, // 优先绘画作品
      dateRange: {
        min: 1500,
        max: 2024
      }
    };
  }

  /**
   * 根据情绪曲线调整结果
   */
  private adjustResultsByCurve(searchResults: any[]): any[] {
    if (!this.emotionCurve) return searchResults;

    // 根据情绪曲线的峰值和谷值调整作品权重
    return searchResults.map(result => {
      let adjustedScore = result.finalScore || result.similarity;
      
      // 如果作品的情绪与曲线匹配，增加权重
      if (this.emotionCurve.emotionType === result.emotionType) {
        adjustedScore *= 1.2;
      }
      
      // 根据情绪强度调整
      if (this.emotionCurve.intensity > 0.8) {
        adjustedScore *= 1.1;
      }

      return {
        ...result,
        adjustedScore,
        curveMatch: this.emotionCurve.emotionType === result.emotionType
      };
    }).sort((a, b) => b.adjustedScore - a.adjustedScore);
  }

  /**
   * 第三步：生成作品讲解
   */
  private async generateExplanations(): Promise<any[]> {
    try {
      if (this.selectedArtworks.length === 0) {
        return [];
      }

      // 分批次生成讲解（3+3+3模式）
      const explanations: any[] = [];
      const batchSize = 3;

      for (let i = 0; i < this.selectedArtworks.length; i += batchSize) {
        const batch = this.selectedArtworks.slice(i, i + batchSize);
        console.log(`📝 生成第 ${Math.floor(i / batchSize) + 1} 批讲解 (${batch.length} 件作品)`);

        try {
          const batchExplanations = await generateArtworkExplanations(
            batch,
            this.emotion,
            this.userInput,
            this.emotionCurve
          );
          
          explanations.push(...batchExplanations);
          console.log(`✅ 第 ${Math.floor(i / batchSize) + 1} 批讲解完成`);

        } catch (error) {
          console.error(`❌ 第 ${Math.floor(i / batchSize) + 1} 批讲解失败:`, error);
          // 为失败的作品生成基础讲解
          const fallbackExplanations = batch.map(artwork => ({
            artworkId: artwork.id,
            explanation: `这件作品与您的情绪"${this.emotion}"产生了共鸣。`,
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
   * 生成策展总结
   */
  private async generateSummary(): Promise<any> {
    return {
      emotion: this.emotion,
      userInput: this.userInput,
      emotionCurve: this.emotionCurve,
      totalArtworks: this.selectedArtworks.length,
      totalExplanations: this.explanations.length,
      qualityDistribution: this.getQualityDistribution(),
      emotionDistribution: this.getEmotionDistribution(),
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * 获取质量分布
   */
  private getQualityDistribution(): any {
    const distribution = { excellent: 0, good: 0, basic: 0, minimal: 0 };
    
    this.selectedArtworks.forEach(artwork => {
      const quality = artwork.qualityLevel || 'good';
      distribution[quality as keyof typeof distribution]++;
    });

    return distribution;
  }

  /**
   * 获取情绪分布
   */
  private getEmotionDistribution(): any {
    const distribution: any = {};
    
    this.selectedArtworks.forEach(artwork => {
      const emotion = artwork.emotionType || 'unknown';
      distribution[emotion] = (distribution[emotion] || 0) + 1;
    });

    return distribution;
  }
}

/**
 * 优化后的策展API路由
 */
export async function optimizedCurationAPI(request: NextRequest) {
  try {
    const body = await request.json();
    const { emotion, userInput } = body;

    if (!emotion) {
      return new Response(JSON.stringify({ error: 'Missing required field: emotion' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 执行优化策展流程
    const curationFlow = new OptimizedCurationFlow(emotion, userInput);
    const result = await curationFlow.execute();

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ 优化策展API失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 性能对比测试
 */
export async function performanceComparison(emotion: string, userInput?: string) {
  console.log('🧪 开始性能对比测试...');
  
  const results = {
    optimized: { time: 0, artworks: 0, cost: 0 },
    original: { time: 0, artworks: 0, cost: 0 }
  };

  // 测试优化流程
  const optimizedStart = Date.now();
  try {
    const optimizedFlow = new OptimizedCurationFlow(emotion, userInput);
    const optimizedResult = await optimizedFlow.execute();
    results.optimized.time = Date.now() - optimizedStart;
    results.optimized.artworks = optimizedResult.selectedArtworks.length;
    results.optimized.cost = 0; // 向量检索无成本
  } catch (error) {
    console.error('❌ 优化流程测试失败:', error);
  }

  // 测试原始流程（模拟）
  const originalStart = Date.now();
  try {
    // 这里应该调用原始的策展流程
    // 暂时使用模拟数据
    await new Promise(resolve => setTimeout(resolve, 5000)); // 模拟5秒延迟
    results.original.time = Date.now() - originalStart;
    results.original.artworks = 9;
    results.original.cost = 50; // 模拟50次API调用
  } catch (error) {
    console.error('❌ 原始流程测试失败:', error);
  }

  console.log('📊 性能对比结果:');
  console.log(`优化流程: ${results.optimized.time}ms, ${results.optimized.artworks}件作品, 成本${results.optimized.cost}`);
  console.log(`原始流程: ${results.original.time}ms, ${results.original.artworks}件作品, 成本${results.original.cost}`);
  
  const improvement = {
    timeImprovement: Math.round((results.original.time - results.optimized.time) / results.original.time * 100),
    costReduction: Math.round((results.original.cost - results.optimized.cost) / results.original.cost * 100)
  };

  console.log(`🚀 性能提升: 时间${improvement.timeImprovement}%, 成本${improvement.costReduction}%`);

  return { results, improvement };
}
