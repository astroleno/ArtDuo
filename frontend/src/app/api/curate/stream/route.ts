import { NextRequest } from 'next/server';
import { ArtworkServiceManager } from '@/lib/artwork-services';
import { buildSearchPlanUltraOptimized, generateDeterministicSeed } from '@/lib/curation/search-plan-ultra-optimized';
import { batchJudgeArtworksUltraOptimized } from '@/lib/curation/llm-judge-ultra-optimized';
import { EmotionCurveGenerator } from '@/lib/curation/emotion-curve';
import { ArtworkSelector } from '@/lib/curation/artwork-selector';
import { generateArtworkExplanations, generateCurationSummary } from '@/lib/curation/artwork-explanation';

/**
 * 策展流式SSE接口
 * 事件顺序：plan → coarse → score(batch) → select → summary → explanation
 * 所有事件均为 data: {type, payload} 的JSON对象
 */
export async function POST(request: NextRequest) {
  // 默认关闭流式输出：只有当 CURATE_STREAM_ENABLED === 'true' 才启用
  if (process.env.CURATE_STREAM_ENABLED !== 'true') {
    return new Response(JSON.stringify({ error: 'streaming disabled' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
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

        // 1) 计划
        try {
          const planStart = Date.now();
          const seed = generateDeterministicSeed(emotion, userInput);
          const { searchPlan, llmAnalysis } = await buildSearchPlanUltraOptimized(emotion, userInput, seed);
          const planTime = Date.now() - planStart;
          send('plan', { searchPlan, llmAnalysis, seed, durationMs: planTime });

          // 2) 粗选
          const coarseStart = Date.now();
          const serviceManager = new ArtworkServiceManager();
          let artworkResult;
          try {
            artworkResult = await serviceManager.searchArtworks(emotion, userInput, llmAnalysis);
          } catch (svcErr) {
            // 服务异常时，直接降级到本地回退服务
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
          // 仅发送精简的作品信息，避免负载过大
          const coarseSample = artworkResult.artworks.slice(0, 5).map(a => ({ id: a.id, title: a.title, artist: a.artist }));
          send('coarse', { total: artworkResult.artworks.length, source: artworkResult.source, durationMs: coarseTime, sample: coarseSample });

          // 3) 评分（可能较慢，发送阶段进度）
          const scoreStart = Date.now();
          // 显示禁用评分缓存以避免“看起来没花时间”的错觉
          process.env.SCORING_CACHE_ENABLED = 'false';
          const scoring = await batchJudgeArtworksUltraOptimized(artworkResult.artworks, emotion, userInput, 5);
          const scoreTime = Date.now() - scoreStart;
          send('score', {
            totalProcessed: scoring.totalProcessed,
            successCount: scoring.successCount,
            failureCount: scoring.failureCount,
            durationMs: scoreTime
          });

          // 4) 曲线与精选
          const selectStart = Date.now();
          const curve = EmotionCurveGenerator.generateCurve(artworkResult.artworks, scoring.scores, emotion);
          const optimized = EmotionCurveGenerator.optimizeCurve(curve);
          const selection = ArtworkSelector.selectBestArtworks(
            artworkResult.artworks, scoring.scores, optimized, { targetCount: 9 }
          );
          const selectTime = Date.now() - selectStart;
          const selectedBrief = selection.selectedArtworks.map(a => ({ id: a.id, title: a.title, artist: a.artist }));
          send('select', {
            selectedCount: selection.selectedArtworks.length,
            selectionReasoning: selection.selectionReasoning,
            diversityMetrics: selection.diversityMetrics,
            durationMs: selectTime,
            artworks: selectedBrief
          });

          // 5) 策展总结（短版仍由现有函数生成全文，前端可截取）
          const summaryStart = Date.now();
          const summary = await generateCurationSummary(
            selection.selectedArtworks,
            emotion,
            [],
            userInput
          );
          const summaryTime = Date.now() - summaryStart;
          send('summary', { summary, durationMs: summaryTime });

          // 6) 讲解（批次内并发，发送聚合结果；如需片段化可后续细化到字段级）
          const explStart = Date.now();
          const expl = await generateArtworkExplanations(
            selection.selectedArtworks,
            emotion,
            userInput,
            llmAnalysis.curation_strategy
          );
          const explTime = Date.now() - explStart;
          const explanationsBrief = expl.explanations.map(e => ({
            artworkId: e.artworkId,
            title: e.title,
            artist: e.artist,
            confidence: e.confidence
          }));
          send('explanation', {
            totalProcessed: expl.totalProcessed,
            successCount: expl.successCount,
            failureCount: expl.failureCount,
            fromCacheCount: (expl as any).fromCacheCount ?? 0,
            durationMs: explTime,
            items: explanationsBrief
          });

          // 完结
          send('complete', { elapsedMs: Date.now() - t0 });
          controller.close();
        } catch (stepError) {
          closeWithError('stream_step_failed', { message: stepError instanceof Error ? stepError.message : String(stepError) });
        }
      } catch (error) {
        closeWithError('internal_error', { message: error instanceof Error ? error.message : String(error) });
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


