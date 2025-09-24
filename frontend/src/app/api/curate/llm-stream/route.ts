// LLM个性化流式策展API
import { NextRequest, NextResponse } from 'next/server';
import { ArtworkServiceManager } from '@/lib/artwork-services/artwork-service-manager';
import { buildSearchPlanOptimized } from '@/lib/curation/search-plan-builder-optimized';
import { batchJudgeArtworksUltraOptimized } from '@/lib/curation/llm-judge-ultra-optimized';
import { UnifiedCurationGenerator } from '@/lib/curation/unified-curation-generator';
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
        
        // 阶段4-5-6: 统一策展生成 (合并请求)
        console.log('🎨 阶段4-5-6: 统一策展生成...');
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'phase',
          data: { phase: 4, description: '统一策展生成 (情绪曲线+作品排序+序言结语)', timestamp: Date.now() }
        })}\n\n`));
        
        const unifiedResult = await UnifiedCurationGenerator.generateUnifiedCuration(
          emotion,
          userInput || '',
          searchResult.artworks,
          scores
        );
        
        // 流式输出: 情绪曲线设计
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'emotion_curve',
          data: {
            design: unifiedResult.emotionCurve,
            timestamp: Date.now()
          }
        })}\n\n`));
        
        // 根据统一结果重新排序作品
        const selectedArtworks = unifiedResult.artworkOrdering.orderedArtworks
          .map(artworkId => searchResult.artworks.find(a => a.id === artworkId))
          .filter(artwork => artwork !== undefined)
          .slice(0, 9);
        
        // 流式输出: 选定作品
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'artworks_selected',
          data: {
            artworks: selectedArtworks,
            totalFound: searchResult.artworks.length,
            source: searchResult.source,
            orderingReasons: unifiedResult.artworkOrdering.matchingReasons,
            timestamp: Date.now()
          }
        })}\n\n`));

        // 启动图片预缓存（非阻塞）
        console.log('🖼️ 启动图片预缓存...');
        preloadArtworkImages(selectedArtworks, controller, encoder);
        
        // 流式输出: 序言
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'introduction',
          data: { content: unifiedResult.curationTexts.introduction, timestamp: Date.now() }
        })}\n\n`));
        
        // 流式输出: 结语
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'conclusion',
          data: { content: unifiedResult.curationTexts.conclusion, timestamp: Date.now() }
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
          curationIntroduction: unifiedResult.curationTexts.introduction,
          curationConclusion: unifiedResult.curationTexts.conclusion,
          overallNarrative: unifiedResult.emotionCurve.overallNarrative
        };
        
        // 转换情绪曲线格式以兼容讲解生成
        const emotionCurveForExplanation = {
          curveType: unifiedResult.emotionCurve.curveType === 'guided_journey' ? 'complex' : 
                    unifiedResult.emotionCurve.curveType === 'sandbox_discovery' ? 'peak' : 'wave',
          totalStages: unifiedResult.emotionCurve.totalStages,
          overallNarrative: unifiedResult.emotionCurve.overallNarrative,
          transitionLogic: unifiedResult.emotionCurve.designPhilosophy,
          colorPalette: unifiedResult.emotionCurve.colorPalette,
          emotionJourney: unifiedResult.emotionCurve.emotionJourney.map(stage => ({
            stage: stage.stage,
            stageName: stage.stageName,
            intensity: stage.intensity,
            description: stage.description,
            artworkRequirement: stage.artworkRequirement,
            visualMood: stage.visualAtmosphere
          }))
        };
        
        console.log('🧠 [DEBUG] 转换后的情绪曲线数据:', {
          hasOverallNarrative: !!emotionCurveForExplanation.overallNarrative,
          hasTransitionLogic: !!emotionCurveForExplanation.transitionLogic,
          emotionJourneyLength: emotionCurveForExplanation.emotionJourney.length,
          curveType: emotionCurveForExplanation.curveType
        });

        // 完成456流式输出，发送完成信号
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'complete',
          data: {
            summary: {
              totalArtworks: selectedArtworks.length,
              emotionCurve: emotionCurveForExplanation.curveType,
              processingPhases: 6,
              message: "策展完成，作品讲解将在后台生成"
            },
            timestamp: Date.now()
          }
        })}\n\n`));
        
        // 在后台异步生成讲解，不阻塞流式响应
        console.log('🧠 后台启动讲解生成...');
        generateExplanationsInBackground(
          selectedArtworks,
          baseExplanationContext,
          emotionCurveForExplanation
        );
        
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
 * 图片预缓存函数 - 提升沉浸式体验
 */
async function preloadArtworkImages(
  artworks: any[],
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  const imagePreloadPromises = artworks.map(async (artwork, index) => {
    try {
      console.log(`🖼️ 预缓存图片 ${index + 1}/9: ${artwork.title}`);
      
      // 使用fetch预加载图片（获取部分数据以触发浏览器缓存）
      const response = await fetch(artwork.imageUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ArtDuo-Preloader/1.0)',
          'Range': 'bytes=0-1023' // 只下载前1KB来触发缓存
        }
      });

      if (response.ok) {
        // 流式通知图片预缓存状态
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            event: 'image_preload_progress',
            data: {
              artworkId: artwork.id,
              artworkIndex: index,
              status: 'loaded',
              title: artwork.title,
              imageUrl: artwork.imageUrl,
              contentLength: response.headers.get('content-length'),
              timestamp: Date.now()
            }
          })}\n\n`));
        } catch (e) {
          // Stream已关闭，忽略通知
        }
        
        console.log(`✅ 图片预缓存成功: ${artwork.title}`);
        return { artworkId: artwork.id, status: 'success', size: response.headers.get('content-length') };
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.warn(`⚠️ 图片预缓存失败: ${artwork.title} - ${error.message}`);
      
      // 流式通知预缓存失败（不影响整体流程）
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'image_preload_progress',
          data: {
            artworkId: artwork.id,
            artworkIndex: index,
            status: 'failed',
            title: artwork.title,
            imageUrl: artwork.imageUrl,
            error: error.message,
            timestamp: Date.now()
          }
        })}\n\n`));
      } catch (e) {
        // Stream已关闭，忽略通知
      }
      
      return { artworkId: artwork.id, status: 'failed', error: error.message };
    }
  });

  // 并发执行所有预缓存，但不阻塞主流程
  Promise.allSettled(imagePreloadPromises).then(results => {
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 'success').length;
    const failed = results.length - successful;
    
    console.log(`🖼️ 图片预缓存完成: ${successful}成功, ${failed}失败`);
    
    // 检查controller是否仍然可用
    try {
      // 流式通知预缓存完成状态
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        event: 'image_preload_complete',
        data: {
          total: artworks.length,
          successful,
          failed,
          timestamp: Date.now()
        }
      })}\n\n`));
    } catch (error) {
      console.log('🖼️ 预缓存完成通知未发送 (stream已关闭)');
    }
  });
}

// 序言和结语生成已合并到统一策展生成器中

/**
 * 后台生成两级讲解体系
 */
async function generateExplanationsInBackground(
  artworks: any[],
  baseContext: any,
  emotionCurveDesign: any
) {
  console.log('🧠 [后台] 开始生成两级讲解体系...');
  
  try {
    // 生成两级讲解：简略 + 详细
    const explanations = await LLMEnhancedExplanationGenerator.generateEnhancedExplanationsBatch(
      artworks,
      baseContext,
      emotionCurveDesign
    );
    
    console.log(`✅ [后台] 讲解生成完成: ${explanations.length}个作品`);
    // 这里可以将结果保存到缓存或数据库，供前端API调用
    
  } catch (error) {
    console.error('❌ [后台] 讲解生成失败:', error);
  }
}

/**
 * 分批生成增强版讲解 (已弃用，改为后台生成)
 */
async function generateExplanationsInBatches(
  artworks: any[],
  baseContext: any,
  emotionCurveForExplanation: any,
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
          emotionCurveForExplanation
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
