/**
 * LLM-guided retrieval 策展系统
 * 架构：用户输入 → LLM策展意图 → 多Query检索 → LLM编排
 */

import { hybridSearchService } from '@/lib/vector-search/hybrid-search';
import { emotionClassifier } from '@/lib/vector-search/emotion-classifier';
import { llmCurationIntentGenerator, LLMCurationIntent } from '@/lib/curation/llm-curation-intent';

/**
 * LLM策展意图输出（使用LLM生成的接口）
 */
export type CurationIntent = LLMCurationIntent;

/**
 * 检索Query
 */
export interface RetrievalQuery {
  id: string;
  query: string;
  stage: number;
  weight: number;
  searchType: 'semantic' | 'keyword' | 'hybrid';
  filters: any;
}

/**
 * 检索结果
 */
export interface RetrievalResult {
  queryId: string;
  stage: number;
  artworks: Array<{
    id: string;
    title: string;
    artist: string;
    similarity: number;
    relevance: number;
    reasoning: string;
  }>;
  totalFound: number;
  searchTime: number;
}

/**
 * 最终策展编排
 */
export interface CurationComposition {
  emotionalArc: string;
  totalArtworks: number;
  selectedArtworks: Array<{
    id: string;
    title: string;
    artist: string;
    stage: number;
    position: number;
    reasoning: string;
    emotionalImpact: number;
  }>;
  narrativeFlow: string;
  visualProgression: string;
  curatorialStatement: string;
}

/**
 * LLM-guided retrieval 策展系统
 */
export class LLMGuidedCuration {
  private userInput: string;
  private curationIntent: CurationIntent | null = null;
  private retrievalQueries: RetrievalQuery[] = [];
  private retrievalResults: RetrievalResult[] = [];
  private finalComposition: CurationComposition | null = null;

  constructor(userInput: string) {
    this.userInput = userInput;
  }

  /**
   * 执行LLM-guided retrieval策展流程
   */
  async execute(): Promise<{
    intent: CurationIntent;
    queries: RetrievalQuery[];
    results: RetrievalResult[];
    composition: CurationComposition;
  }> {
    console.log('🧠 开始LLM-guided retrieval策展流程...');
    const startTime = Date.now();

    try {
      // 第一步：LLM生成策展意图
      console.log('📋 第一步：LLM生成策展意图...');
      this.curationIntent = await this.generateCurationIntent();
      console.log(`✅ 策展意图生成完成: "${this.curationIntent.curatorialTheme}"`);

      // 第二步：生成多Query检索策略
      console.log('🔍 第二步：生成多Query检索策略...');
      this.retrievalQueries = await this.generateRetrievalQueries();
      console.log(`✅ 检索策略生成完成: ${this.retrievalQueries.length} 个Query`);

      // 第三步：执行多Query检索
      console.log('🎯 第三步：执行多Query检索...');
      this.retrievalResults = await this.executeMultiQueryRetrieval();
      console.log(`✅ 多Query检索完成: ${this.retrievalResults.length} 个结果集`);

      // 第四步：LLM编排最终策展
      console.log('📝 第四步：LLM编排最终策展...');
      this.finalComposition = await this.composeFinalCuration();
      console.log(`✅ 最终策展编排完成: ${this.finalComposition.totalArtworks} 件作品`);

      const totalTime = Date.now() - startTime;
      console.log(`🎉 LLM-guided retrieval策展完成，总耗时: ${totalTime}ms`);

      return {
        intent: this.curationIntent,
        queries: this.retrievalQueries,
        results: this.retrievalResults,
        composition: this.finalComposition
      };

    } catch (error) {
      console.error('❌ LLM-guided retrieval策展失败:', error);
      throw error;
    }
  }

  /**
   * 第一步：生成策展意图
   */
  private async generateCurationIntent(): Promise<CurationIntent> {
    try {
      // 检测用户输入的情绪
      const emotionDetection = emotionClassifier.detectEmotion(this.userInput);
      console.log(`🎭 检测到情绪: ${emotionDetection.primaryEmotion}, 置信度: ${emotionDetection.confidence}`);

      // 调用真正的LLM API生成策展意图
      const intent = await llmCurationIntentGenerator.generateCurationIntent(this.userInput);
      
      console.log(`✅ LLM策展意图生成完成: "${intent.curatorialTheme}"`);
      return intent;

    } catch (error) {
      console.error('❌ 策展意图生成失败:', error);
      throw error;
    }
  }






  /**
   * 第二步：生成检索Query
   */
  private async generateRetrievalQueries(): Promise<RetrievalQuery[]> {
    if (!this.curationIntent) {
      throw new Error('策展意图未生成');
    }

    const queries: RetrievalQuery[] = [];
    let queryId = 0;

    // 为每个情绪阶段生成Query
    this.curationIntent.emotionalStages.forEach((stage, index) => {
      // 基础情绪Query
      queries.push({
        id: `emotion_${queryId++}`,
        query: `${stage.emotion} ${stage.description}`,
        stage: stage.stage,
        weight: stage.intensity,
        searchType: 'semantic',
        filters: { emotion: stage.emotion }
      });

      // 视觉特征Query
      stage.visualCharacteristics.forEach(characteristic => {
        queries.push({
          id: `visual_${queryId++}`,
          query: `${characteristic} ${stage.emotion}`,
          stage: stage.stage,
          weight: stage.intensity * 0.8,
          searchType: 'hybrid',
          filters: { visual: characteristic }
        });
      });
    });

    // 添加整体主题Query
    queries.push({
      id: `theme_${queryId++}`,
      query: this.curationIntent.curatorialTheme,
      stage: 0,
      weight: 1.0,
      searchType: 'semantic',
      filters: { theme: this.curationIntent.curatorialTheme }
    });

    // 添加视觉偏好Query
    this.curationIntent.visualFeatures.colorPalette.forEach(color => {
      queries.push({
        id: `color_${queryId++}`,
        query: `${color} ${this.curationIntent.curatorialTheme}`,
        stage: 0,
        weight: 0.7,
        searchType: 'keyword',
        filters: { color: color }
      });
    });

    return queries;
  }

  /**
   * 第三步：执行多Query检索
   */
  private async executeMultiQueryRetrieval(): Promise<RetrievalResult[]> {
    if (!this.retrievalQueries.length) {
      throw new Error('检索Query未生成');
    }

    const results: RetrievalResult[] = [];

    for (const query of this.retrievalQueries) {
      try {
        console.log(`🔍 执行检索: "${query.query}"`);
        const startTime = Date.now();

        // 执行向量检索
        const searchResults = await hybridSearchService.search(query.query, query.filters);
        const searchTime = Date.now() - startTime;

        // 处理检索结果
        const artworks = searchResults.map(result => ({
          id: result.id,
          title: result.title || 'Unknown',
          artist: result.artist || 'Unknown',
          similarity: result.similarity || 0,
          relevance: this.calculateRelevance(result, query),
          reasoning: this.generateReasoning(result, query)
        }));

        results.push({
          queryId: query.id,
          stage: query.stage,
          artworks: artworks.slice(0, 10), // 每个Query最多10件作品
          totalFound: artworks.length,
          searchTime
        });

        console.log(`✅ 检索完成: ${artworks.length} 件作品，耗时: ${searchTime}ms`);

      } catch (error) {
        console.error(`❌ 检索失败: ${query.query}`, error);
        results.push({
          queryId: query.id,
          stage: query.stage,
          artworks: [],
          totalFound: 0,
          searchTime: 0
        });
      }
    }

    return results;
  }

  /**
   * 计算作品相关性
   */
  private calculateRelevance(result: any, query: RetrievalQuery): number {
    let relevance = result.similarity || 0;
    
    // 根据Query权重调整
    relevance *= query.weight;
    
    // 根据作品质量调整
    if (result.qualityLevel === 'excellent') {
      relevance *= 1.2;
    } else if (result.qualityLevel === 'good') {
      relevance *= 1.1;
    }

    return Math.min(relevance, 1.0);
  }

  /**
   * 生成作品选择理由
   */
  private generateReasoning(result: any, query: RetrievalQuery): string {
    const reasons = [];
    
    if (result.similarity > 0.8) {
      reasons.push('高度语义匹配');
    }
    if (result.qualityLevel === 'excellent') {
      reasons.push('作品质量优秀');
    }
    if (query.searchType === 'semantic') {
      reasons.push('语义检索匹配');
    }
    if (query.searchType === 'keyword') {
      reasons.push('关键词匹配');
    }

    return reasons.join('，');
  }

  /**
   * 第四步：LLM编排最终策展
   */
  private async composeFinalCuration(): Promise<CurationComposition> {
    if (!this.curationIntent || !this.retrievalResults.length) {
      throw new Error('策展意图或检索结果未生成');
    }

    // 模拟LLM编排最终策展（实际应该调用LLM API）
    const composition = await this.callLLMForFinalComposition();
    
    return composition;
  }

  /**
   * 调用LLM编排最终策展
   */
  private async callLLMForFinalComposition(): Promise<CurationComposition> {
    // 模拟LLM调用
    await new Promise(resolve => setTimeout(resolve, 600));

    // 收集所有检索结果
    const allArtworks = this.retrievalResults.flatMap(result => 
      result.artworks.map(artwork => ({
        ...artwork,
        queryId: result.queryId,
        stage: result.stage
      }))
    );

    // 去重并按相关性排序
    const uniqueArtworks = this.deduplicateAndRankArtworks(allArtworks);

    // 选择最终作品（6-12件）
    const selectedCount = Math.min(12, Math.max(6, uniqueArtworks.length));
    const selectedArtworks = uniqueArtworks.slice(0, selectedCount);

    // 生成策展编排
    return {
      emotionalArc: this.generateEmotionalArc(selectedArtworks),
      totalArtworks: selectedArtworks.length,
      selectedArtworks: selectedArtworks.map((artwork, index) => ({
        id: artwork.id,
        title: artwork.title,
        artist: artwork.artist,
        stage: artwork.stage,
        position: index + 1,
        reasoning: artwork.reasoning,
        emotionalImpact: artwork.relevance
      })),
      narrativeFlow: this.generateNarrativeFlow(selectedArtworks),
      visualProgression: this.generateVisualProgression(selectedArtworks),
      curatorialStatement: this.generateCuratorialStatement(selectedArtworks)
    };
  }

  /**
   * 去重并排序作品
   */
  private deduplicateAndRankArtworks(artworks: any[]): any[] {
    const uniqueMap = new Map();
    
    artworks.forEach(artwork => {
      const existing = uniqueMap.get(artwork.id);
      if (!existing || artwork.relevance > existing.relevance) {
        uniqueMap.set(artwork.id, artwork);
      }
    });

    return Array.from(uniqueMap.values())
      .sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * 生成情绪弧线
   */
  private generateEmotionalArc(artworks: any[]): string {
    const stages = artworks.map(a => a.stage).filter((v, i, arr) => arr.indexOf(v) === i).sort();
    return `从第${stages[0]}阶段的${this.curationIntent?.emotionalStages[stages[0]-1]?.emotion}到第${stages[stages.length-1]}阶段的${this.curationIntent?.emotionalStages[stages[stages.length-1]-1]?.emotion}`;
  }

  /**
   * 生成叙事流程
   */
  private generateNarrativeFlow(artworks: any[]): string {
    return `通过${artworks.length}件精心挑选的作品，展现了一个从${this.curationIntent?.emotionalStages[0]?.description}到${this.curationIntent?.emotionalStages[this.curationIntent.emotionalStages.length-1]?.description}的完整情绪旅程`;
  }

  /**
   * 生成视觉进程
   */
  private generateVisualProgression(artworks: any[]): string {
    return `视觉上从${this.curationIntent?.visualFeatures.colorPalette[0] || '冷色调'}逐渐过渡到${this.curationIntent?.visualFeatures.colorPalette[this.curationIntent?.visualFeatures.colorPalette.length-1] || '暖色调'}，营造出层次丰富的情感氛围`;
  }

  /**
   * 生成策展声明
   */
  private generateCuratorialStatement(artworks: any[]): string {
    return `"${this.curationIntent?.curatorialTheme}"：这次策展通过${artworks.length}件作品，为${this.curationIntent?.targetAudience}创造了一个${this.curationIntent?.narrativeTone.voice}而${this.curationIntent?.narrativeTone.approach}的艺术体验空间。`;
  }
}

/**
 * LLM-guided retrieval API
 */
export async function llmGuidedCurationAPI(request: Request) {
  try {
    const body = await request.json();
    const { userInput } = body;

    if (!userInput) {
      return new Response(JSON.stringify({ error: 'Missing required field: userInput' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 执行LLM-guided retrieval策展
    const curation = new LLMGuidedCuration(userInput);
    const result = await curation.execute();

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ LLM-guided retrieval API失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
