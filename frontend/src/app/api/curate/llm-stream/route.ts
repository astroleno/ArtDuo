// LLM个性化流式策展API
import { NextRequest, NextResponse } from 'next/server';
import { ArtworkServiceManager } from '@/lib/artwork-services/artwork-service-manager';
import { buildSearchPlanOptimized } from '@/lib/curation/search-plan-builder-optimized';
import { batchJudgeArtworksUltraOptimized } from '@/lib/curation/llm-judge-ultra-optimized';
import { LLMEmotionCurveGenerator } from '@/lib/curation/llm-emotion-curve';
import { LLMEnhancedExplanationGenerator } from '@/lib/curation/llm-artwork-explanation';
import { glmClient } from '@/lib/glm-optimized-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await request.json();
        const { emotion, userInput } = body;
        
        if (!emotion) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            event: 'error',
            data: { error: '缺少情绪参数' }
          })}\n\n`));
          controller.close();
          return;
        }

        console.log('🎭 开始LLM个性化流式策展:', { emotion, userInput });
        
        // 事件: 开始处理
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'start',
          data: { emotion, userInput, timestamp: Date.now() }
        })}\n\n`));

        // 阶段1: LLM个性化搜索计划
        console.log('📋 阶段1: 构建个性化搜索计划...');
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'phase',
          data: { phase: 1, description: '构建个性化搜索计划', timestamp: Date.now() }
        })}\n\n`));
        
        const { searchPlan, llmAnalysis } = await buildSearchPlanOptimized(emotion, userInput);
        
        // 阶段2: 搜索艺术作品
        console.log('🔍 阶段2: 搜索艺术作品...');
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'phase',
          data: { phase: 2, description: '搜索艺术作品', timestamp: Date.now() }
        })}\n\n`));
        
        const serviceManager = new ArtworkServiceManager();
        const searchResult = await serviceManager.searchArtworks(emotion, userInput, llmAnalysis);
        
        if (!searchResult.artworks || searchResult.artworks.length === 0) {
          throw new Error('未找到相关艺术作品');
        }
        
        // 阶段3: LLM评分和智能筛选
        console.log('🧠 阶段3: LLM评分和智能筛选...');
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'phase',
          data: { phase: 3, description: 'LLM智能评分', timestamp: Date.now() }
        })}\n\n`));
        
        const batchResult = await batchJudgeArtworksUltraOptimized(
          searchResult.artworks,
          emotion,
          userInput
        );
        const scores = batchResult.scores;
        
        // 阶段4: LLM个性化情绪曲线设计
        console.log('🎨 阶段4: 生成个性化情绪曲线...');
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'phase',
          data: { phase: 4, description: '设计个性化情绪曲线', timestamp: Date.now() }
        })}\n\n`));
        
        const emotionCurveDesign = await LLMEmotionCurveGenerator.generatePersonalizedCurve(
          emotion,
          userInput || '',
          9 // 目标作品数量
        );
        
        // 流式输出: 情绪曲线设计
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'emotion_curve',
          data: {
            design: emotionCurveDesign,
            timestamp: Date.now()
          }
        })}\n\n`));
        
        // 阶段5: LLM智能作品排序
        console.log('🎯 阶段5: LLM智能作品排序...');
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'phase',
          data: { phase: 5, description: 'LLM智能作品排序', timestamp: Date.now() }
        })}\n\n`));
        
        const orderedArtworks = await LLMEmotionCurveGenerator.intelligentArtworkOrdering(
          emotionCurveDesign,
          searchResult.artworks,
          scores,
          emotion,
          userInput || ''
        );
        
        // 选取前9件作品
        const selectedArtworks = orderedArtworks.slice(0, 9);
        
        // 流式输出: 选定作品
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'artworks_selected',
          data: {
            artworks: selectedArtworks,
            totalFound: searchResult.artworks.length,
            source: searchResult.source,
            timestamp: Date.now()
          }
        })}\n\n`));
        
        // 阶段6: 生成策展序言和结语
        console.log('📝 阶段6: 生成策展序言和结语...');
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'phase',
          data: { phase: 6, description: '生成策展序言和结语', timestamp: Date.now() }
        })}\n\n`));
        
        // 并行生成序言和结语
        const [introduction, conclusion] = await Promise.all([
          generateCurationIntroduction(emotion, userInput, emotionCurveDesign, selectedArtworks),
          generateCurationConclusion(emotion, userInput, emotionCurveDesign, selectedArtworks)
        ]);
        
        // 流式输出: 序言
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'introduction',
          data: { content: introduction, timestamp: Date.now() }
        })}\n\n`));
        
        // 流式输出: 结语
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'conclusion',
          data: { content: conclusion, timestamp: Date.now() }
        })}\n\n`));
        
        // 阶段7: 启动增强版讲解生成（并发进行）
        console.log('🧠 阶段7: 启动增强版讲解生成...');
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'phase',
          data: { phase: 7, description: '生成增强版作品讲解', timestamp: Date.now() }
        })}\n\n`));
        
        // 构建讲解生成的基础上下文
        const baseExplanationContext = {
          emotion,
          userInput: userInput || '',
          curationIntroduction: introduction,
          curationConclusion: conclusion,
          overallNarrative: emotionCurveDesign.overallNarrative
        };
        
        // 并发生成讲解，分批返回
        generateExplanationsInBatches(
          selectedArtworks,
          baseExplanationContext,
          emotionCurveDesign,
          controller,
          encoder
        );
        
        // 完成信号
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'complete',
          data: {
            summary: {
              totalArtworks: selectedArtworks.length,
              emotionCurve: emotionCurveDesign.curveType,
              processingPhases: 7
            },
            timestamp: Date.now()
          }
        })}\n\n`));
        
      } catch (error) {
        console.error('❌ LLM个性化流式策展失败:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'error',
          data: { error: error instanceof Error ? error.message : '策展过程出现错误' }
        })}\n\n`));
      } finally {
        controller.close();
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * 生成策展序言
 */
async function generateCurationIntroduction(
  emotion: string,
  userInput: string,
  curveDesign: any,
  artworks: any[]
): Promise<string> {
  const prompt = `为个性化艺术策展生成序言（中文）。

用户情绪：${emotion}
用户描述：${userInput}
情绪旅程：${curveDesign.overallNarrative}
转换逻辑：${curveDesign.transitionLogic}
作品数量：${artworks.length}

请生成一段150-200字的策展序言，要求：
1. 直接回应用户的情绪状态和具体情境
2. 预告这次艺术旅程将如何帮助用户
3. 语言温暖而专业，避免空洞的艺术术语
4. 建立用户与艺术作品之间的情感桥梁

直接返回序言内容，不要包含其他格式。`;

  try {
    const response = await glmClient.chat([
      {
        role: 'system',
        content: '你是一位富有同理心的艺术策展人，擅长用温暖的语言连接艺术与人心。'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
      temperature: 0.7,
      max_tokens: 500,
      thinking: 'disabled'
    });

    return response.choices[0]?.message?.content || '欢迎开启这场艺术情绪之旅。';
  } catch (error) {
    console.error('❌ 序言生成失败:', error);
    return `在"${emotion}"的情绪中，让我们通过艺术的力量，寻找内心的共鸣与慰藉。这${artworks.length}件精选作品，将陪伴您走过这段情绪旅程。`;
  }
}

/**
 * 生成策展结语
 */
async function generateCurationConclusion(
  emotion: string,
  userInput: string,
  curveDesign: any,
  artworks: any[]
): Promise<string> {
  const prompt = `为个性化艺术策展生成结语（中文）。

用户情绪：${emotion}
用户描述：${userInput}
情绪旅程：${curveDesign.overallNarrative}
转换逻辑：${curveDesign.transitionLogic}

请生成一段120-150字的策展结语，要求：
1. 总结这次艺术旅程的意义
2. 回应用户最初的情绪状态，展现转化的可能
3. 给用户以启发和力量
4. 语言富有诗意但不失真诚

直接返回结语内容，不要包含其他格式。`;

  try {
    const response = await glmClient.chat([
      {
        role: 'system',
        content: '你是一位富有同理心的艺术策展人，擅长用启发性的语言为艺术体验画下句号。'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
      temperature: 0.8,
      max_tokens: 400,
      thinking: 'disabled'
    });

    return response.choices[0]?.message?.content || '艺术的力量在于它能够触动我们内心最柔软的部分，愿这次旅程为您带来内心的平静与力量。';
  } catch (error) {
    console.error('❌ 结语生成失败:', error);
    return '通过艺术的陪伴，我们学会了与自己的情绪和解。愿这些作品中的美好，能够在您心中留下温暖的印记。';
  }
}

/**
 * 分批生成增强版讲解
 */
async function generateExplanationsInBatches(
  artworks: any[],
  baseContext: any,
  curveDesign: any,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  const batchSize = 3;
  const totalBatches = Math.ceil(artworks.length / batchSize);
  
  console.log(`🧠 开始分批生成讲解: ${totalBatches}批，每批${batchSize}个`);
  
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIndex = batchIndex * batchSize;
    const endIndex = Math.min(startIndex + batchSize, artworks.length);
    const batchArtworks = artworks.slice(startIndex, endIndex);
    
    try {
      console.log(`🧠 处理第${batchIndex + 1}批讲解 (${startIndex + 1}-${endIndex})`);
      
      // 为这批作品生成增强版讲解
      const explanations = await LLMEnhancedExplanationGenerator.generateEnhancedExplanationsBatch(
        batchArtworks,
        baseContext,
        curveDesign
      );
      
      // 流式输出这批讲解
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        event: 'explanations_batch',
        data: {
          batchIndex: batchIndex + 1,
          totalBatches,
          explanations,
          artworkIndices: Array.from({ length: batchArtworks.length }, (_, i) => startIndex + i),
          timestamp: Date.now()
        }
      })}\n\n`));
      
    } catch (error) {
      console.error(`❌ 第${batchIndex + 1}批讲解生成失败:`, error);
      
      // 发送错误但继续处理其他批次
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        event: 'explanations_error',
        data: {
          batchIndex: batchIndex + 1,
          error: '讲解生成失败',
          timestamp: Date.now()
        }
      })}\n\n`));
    }
  }
  
  console.log('✅ 所有讲解批次处理完成');
}
