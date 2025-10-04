import { NextRequest } from 'next/server';
import { ArtworkServiceManager } from '@/lib/artwork-services';
import { buildSearchPlanUltraOptimized, generateDeterministicSeed } from '@/lib/curation/search-plan-ultra-optimized';
import { batchJudgeArtworksUltraOptimized } from '@/lib/curation/llm-judge-ultra-optimized';
import { EmotionCurveGenerator } from '@/lib/curation/emotion-curve';
import { ArtworkSelector } from '@/lib/curation/artwork-selector';
import { generateArtworkExplanations, generateCurationSummary } from '@/lib/curation/artwork-explanation';

/**
 * 策展流式SSE接口 - 优化版
 * 正确事件顺序：
 * 1. 情绪曲线生成 → emotion_curve
 * 2. 作品评分选择 → artworks_selected (输出前3件时立即触发讲解)
 * 3. 策展序言 → introduction
 * 4. 策展结语 → conclusion
 * 5. 讲解并发生成 → explanations_batch (3+3+3)
 */
export async function POST(request: NextRequest) {
  // 启用流式输出（去掉环境变量限制）
  console.log('🚀 开始策展流式输出...');
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, payload: unknown) => {
        try {
          const data = JSON.stringify({ type, payload });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (err) {
          // 序列化失败也要安全关闭
          controller.enqueue(encoder.encode(`data: {"type":"error","payload":{"message":"serialize_failed"}}\n\n`));
        }
      };

      const closeWithError = (message: string, details?: unknown) => {
        send('error', { message, details });
        controller.close();
      };

      try {
        const body = await request.json().catch(() => ({}));
        const emotion: string = body.emotion;
        const userInput: string | undefined = body.userInput;
        if (!emotion) {
          closeWithError('Missing required field: emotion');
          return;
        }

        const t0 = Date.now();
        send('start', { emotion, userInput });

        // 前置准备阶段（不输出）
        const planStart = Date.now();
        const seed = generateDeterministicSeed(emotion, userInput);
        const { searchPlan, llmAnalysis } = await buildSearchPlanUltraOptimized(emotion, userInput, seed);
        const planTime = Date.now() - planStart;
        console.log(`🧠 搜索计划完成，耗时: ${planTime}ms`);

        // 作品搜索阶段（不输出）
        const coarseStart = Date.now();
        const serviceManager = new ArtworkServiceManager();
        let artworkResult;
        try {
          artworkResult = await serviceManager.searchArtworks(emotion, userInput, llmAnalysis);
        } catch (svcErr) {
          const { FallbackService } = await import('@/lib/artwork-services/fallback-service');
          const fallback = new FallbackService();
          artworkResult = await fallback.searchArtworks(emotion, userInput, llmAnalysis);
        }
        if (!artworkResult || !artworkResult.success || artworkResult.artworks.length === 0) {
          const { FallbackService } = await import('@/lib/artwork-services/fallback-service');
          const fallback = new FallbackService();
          artworkResult = await fallback.searchArtworks(emotion, userInput, llmAnalysis);
        }
        const coarseTime = Date.now() - coarseStart;
        console.log(`🔍 作品搜索完成，耗时: ${coarseTime}ms，获得${artworkResult.artworks.length}件作品`);

        // 作品评分阶段（不输出）
        const scoreStart = Date.now();
        process.env.SCORING_CACHE_ENABLED = 'false';
        const scoring = await batchJudgeArtworksUltraOptimized(artworkResult.artworks, emotion, userInput, 5);
        const scoreTime = Date.now() - scoreStart;
        console.log(`🧠 作品评分完成，耗时: ${scoreTime}ms`);

        // 1. 情绪曲线生成 → 流式输出
        const curveStart = Date.now();
        const curve = EmotionCurveGenerator.generateCurve(artworkResult.artworks, scoring.scores, emotion);
        const optimized = EmotionCurveGenerator.optimizeCurve(curve);
        const curveTime = Date.now() - curveStart;
        send('emotion_curve', {
          curve: optimized.map(p => p.intensity),
          description: EmotionCurveGenerator.generateCurveDescription(optimized, emotion),
          durationMs: curveTime
        });

        // 2. 作品选择 → 流式输出（输出前3件时立即触发讲解）
        const selectStart = Date.now();
        const selection = ArtworkSelector.selectBestArtworks(
          artworkResult.artworks, scoring.scores, optimized, { targetCount: 9 }
        );
        const selectTime = Date.now() - selectStart;
        
        // 输出选定的作品
        const selectedArtworks = selection.selectedArtworks.map(a => ({
          id: a.id,
          title: a.title,
          artist: a.artist,
          year: a.year,
          medium: a.medium,
          imageUrl: a.imageUrl,
          description: a.description,
          museum: a.museum
        }));
        send('artworks_selected', {
          artworks: selectedArtworks,
          selectionReasoning: selection.selectionReasoning,
          diversityMetrics: selection.diversityMetrics,
          durationMs: selectTime
        });

        // 立即开始讲解并发生成（非阻塞）
        const explanationPromise = generateExplanationsInBatches(
          selection.selectedArtworks,
          emotion,
          userInput,
          llmAnalysis.curation_strategy,
          send
        );

        // 3. 策展序言生成 → 流式输出
        const introStart = Date.now();
        const introduction = await generateCurationIntroduction(
          selection.selectedArtworks,
          emotion,
          userInput,
          llmAnalysis
        );
        const introTime = Date.now() - introStart;
        send('introduction', { introduction, durationMs: introTime });

        // 4. 策展结语生成 → 流式输出
        const conclusionStart = Date.now();
        const conclusion = await generateCurationConclusion(
          selection.selectedArtworks,
          emotion,
          userInput,
          optimized
        );
        const conclusionTime = Date.now() - conclusionStart;
        send('conclusion', { conclusion, durationMs: conclusionTime });

        // 等待讲解并发生成完成
        await explanationPromise;

        // 完结
        send('complete', { elapsedMs: Date.now() - t0 });
        controller.close();
      } catch (error) {
        closeWithError('stream_step_failed', { message: error instanceof Error ? error.message : String(error) });
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

// 便于测试：支持 GET /api/curate/stream?emotion=...&userInput=...
export async function GET(request: NextRequest) {
  // 构造一个带有 json() 的轻量请求对象，复用 POST 流程
  const url = new URL(request.url);
  const emotion = url.searchParams.get('emotion') || '';
  const userInput = url.searchParams.get('userInput') || '';

  const fake = {
    json: async () => ({ emotion, userInput })
  } as unknown as NextRequest;

  return POST(fake);
}

/**
 * 分批并发生成讲解（小批次快速返回）
 */
async function generateExplanationsInBatches(
  artworks: any[],
  emotion: string,
  userInput: string | undefined,
  curationStrategy: string,
  send: (type: string, payload: unknown) => void
) {
  const batchSize = 2; // 固定小批次，快速返回
  const batches = [];
  
  // 分成小批次，每批2件作品
  for (let i = 0; i < artworks.length; i += batchSize) {
    batches.push(artworks.slice(i, i + batchSize));
  }
  
  console.log(`🎨 开始分批生成讲解：${batches.length}批，每批${batchSize}件，总计${artworks.length}件作品`);
  
  // 优先处理第一批，快速返回给用户
  const firstBatch = batches[0];
  if (firstBatch) {
    try {
      console.log('🚀 优先处理第一批讲解，快速返回...');
      const firstBatchStart = Date.now();
      const firstResult = await generateArtworkExplanations(
        firstBatch,
        emotion,
        userInput,
        curationStrategy
      );
      const firstBatchTime = Date.now() - firstBatchStart;
      
      // 不做SSE层映射，要求上游LLM直接产出 introduction/detail（见 artwork-explanation.ts）
      const explanationsNormalized = firstResult.explanations;

      // 立即发送第一批结果
      send('explanations_batch', {
        batchIndex: 1,
        batchSize: firstBatch.length,
        explanations: explanationsNormalized,
        successCount: firstResult.successCount,
        failureCount: firstResult.failureCount,
        durationMs: firstBatchTime,
        isFirstBatch: true // 标记为第一批
      });
      
      console.log(`✅ 第一批讲解完成，耗时: ${firstBatchTime}ms，用户可开始浏览`);
    } catch (error) {
      console.error('❌ 第一批讲解失败:', error);
      send('explanations_batch', {
        batchIndex: 1,
        batchSize: firstBatch.length,
        explanations: [],
        successCount: 0,
        failureCount: firstBatch.length,
        error: error instanceof Error ? error.message : String(error),
        durationMs: 0,
        isFirstBatch: true
      });
    }
  }
  
  // 并发生成剩余批次的讲解
  const remainingBatches = batches.slice(1);
  if (remainingBatches.length > 0) {
    const batchPromises = remainingBatches.map(async (batch, index) => {
      try {
        const batchStart = Date.now();
        const result = await generateArtworkExplanations(
          batch,
          emotion,
          userInput,
          curationStrategy
        );
        const batchTime = Date.now() - batchStart;
        
        // 不做SSE层映射，要求上游LLM直接产出 introduction/detail
        const explanationsNormalized = result.explanations;

        // 发送这一批的讲解结果
        send('explanations_batch', {
          batchIndex: index + 2, // 从第2批开始
          batchSize: batch.length,
          explanations: explanationsNormalized,
          successCount: result.successCount,
          failureCount: result.failureCount,
          durationMs: batchTime
        });
        
        console.log(`✅ 第${index + 2}批讲解完成，耗时: ${batchTime}ms`);
        return result;
      } catch (error) {
        console.error(`❌ 第${index + 2}批讲解失败:`, error);
        send('explanations_batch', {
          batchIndex: index + 2,
          batchSize: batch.length,
          explanations: [],
          successCount: 0,
          failureCount: batch.length,
          error: error instanceof Error ? error.message : String(error),
          durationMs: 0
        });
        return null;
      }
    });
    
    // 等待剩余批次完成
    await Promise.all(batchPromises);
  }
  
  console.log('🎉 所有讲解批次生成完成');
}

/**
 * 生成策展序言
 */
async function generateCurationIntroduction(
  artworks: any[],
  emotion: string,
  userInput: string | undefined,
  llmAnalysis: any
): Promise<string> {
  const { glmOptimizedClient } = await import('@/lib/glm-optimized-client');
  
  const prompt = `为艺术展览生成策展序言（中文，200-300字）。

展览主题：${emotion}
${userInput ? `用户需求：${userInput}` : ''}
作品数量：${artworks.length}件

精选作品：
${artworks.slice(0, 3).map((a, i) => `${i+1}. 《${a.title}》- ${a.artist} (${a.year})`).join('\n')}

策展理念：${llmAnalysis.curation_strategy || '通过精选作品展现情感主题的深度内涵'}

请生成一个富有感染力的策展序言，解释展览的核心理念和作品选择逻辑。`;

  const messages = [
    {
      role: 'system' as const,
      content: '你是一位资深的艺术策展人，擅长撰写富有感染力的展览序言。'
    },
    {
      role: 'user' as const,
      content: prompt
    }
  ];

  try {
    const response = await glmOptimizedClient.chat(messages, {
      temperature: 0.8,
      max_tokens: 400,
      thinking: 'disabled' as const
    });
    
    return response.choices[0]?.message?.content || `这是一个围绕"${emotion}"主题精心策划的艺术展览，通过${artworks.length}件精选作品，深入探索这一情感主题的丰富内涵和艺术表达。`;
  } catch (error) {
    console.error('策展序言生成失败:', error);
    return `这是一个围绕"${emotion}"主题精心策划的艺术展览，通过${artworks.length}件精选作品，深入探索这一情感主题的丰富内涵和艺术表达。`;
  }
}

/**
 * 生成策展结语
 */
async function generateCurationConclusion(
  artworks: any[],
  emotion: string,
  userInput: string | undefined,
  emotionCurve: any[]
): Promise<string> {
  const { glmOptimizedClient } = await import('@/lib/glm-optimized-client');
  
  const prompt = `为艺术展览生成策展结语（中文，150-200字）。

展览主题：${emotion}
${userInput ? `用户需求：${userInput}` : ''}
作品数量：${artworks.length}件
情绪曲线：从${emotionCurve[0]?.intensity || 0.5}到${emotionCurve[emotionCurve.length-1]?.intensity || 0.5}的情感变化

请生成一个深刻而富有启发性的策展结语，总结展览的艺术价值和情感体验。`;

  const messages = [
    {
      role: 'system' as const,
      content: '你是一位资深的艺术策展人，擅长撰写深刻而富有启发性的展览结语。'
    },
    {
      role: 'user' as const,
      content: prompt
    }
  ];

  try {
    const response = await glmOptimizedClient.chat(messages, {
      temperature: 0.8,
      max_tokens: 300,
      thinking: 'disabled' as const
    });
    
    return response.choices[0]?.message?.content || `通过这次展览，我们深入体验了"${emotion}"这一情感主题的丰富层次。每一件作品都是艺术家内心世界的真实写照，共同构成了一幅关于人类情感的深刻画卷。`;
  } catch (error) {
    console.error('策展结语生成失败:', error);
    return `通过这次展览，我们深入体验了"${emotion}"这一情感主题的丰富层次。每一件作品都是艺术家内心世界的真实写照，共同构成了一幅关于人类情感的深刻画卷。`;
  }
}


