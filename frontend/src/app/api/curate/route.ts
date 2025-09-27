import { NextRequest, NextResponse } from 'next/server';
import { openaiClient } from '@/lib/openai';
import { ArtworkServiceManager } from '@/lib/artwork-services';
import { buildSearchPlanUltraOptimized, generateDeterministicSeed } from '@/lib/curation/search-plan-ultra-optimized';
import { LLMAnalysis } from '@/lib/curation/types';
import { batchJudgeArtworksUltraOptimized } from '@/lib/curation/llm-judge-ultra-optimized';
import { EmotionCurveGenerator } from '@/lib/curation/emotion-curve';
import { ArtworkSelector } from '@/lib/curation/artwork-selector';
import { generateArtworkExplanations, generateCurationSummary } from '@/lib/curation/artwork-explanation';
import { glmOptimizedClient } from '@/lib/glm-optimized-client';

// 注意：mock数据已移至 FallbackService 组件中

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emotion, userInput } = body;
    console.log('🎨 ArtDuo API调用开始 - 用户情绪:', emotion, '用户输入:', userInput);

    if (!emotion) {
      console.log('❌ 错误: 缺少情绪参数');
      return NextResponse.json(
        { error: 'Missing required field: emotion' },
        { status: 400 }
      );
    }

    // 初始化服务管理器
    const serviceManager = new ArtworkServiceManager();

    // 第一步：使用标准化的buildSearchPlan()函数生成搜索计划
    console.log('🧠 开始构建搜索计划...');
    const startTime = Date.now();
    
    // 生成确定性种子
    const deterministicSeed = generateDeterministicSeed(emotion, userInput);
    console.log('🎲 确定性种子:', deterministicSeed);
    
    // 构建搜索计划（超优化版）
    const { searchPlan, llmAnalysis } = await buildSearchPlanUltraOptimized(emotion, userInput, deterministicSeed);
    console.log('📋 搜索计划:', searchPlan);
    console.log('🧠 LLM分析结果:', llmAnalysis);
    
    // 使用从buildSearchPlan返回的LLM分析结果
    const analysisResult: LLMAnalysis = llmAnalysis;
    
    const planBuildTime = Date.now() - startTime;
    console.log(`⏱️ 搜索计划构建耗时: ${planBuildTime}ms`);

    // 第二步：使用LLM分析结果指导MCP搜索（粗选），优先painting类作品
    console.log('🔍 开始使用LLM指导的智能搜索（粗选）...');
    let artworkResult = await serviceManager.searchArtworks(emotion, userInput, analysisResult);
    
    // 如果主要服务失败，使用降级服务
    if (!artworkResult.success || artworkResult.artworks.length === 0) {
      console.log('⚠️ 主要服务失败，使用降级服务');
      const { FallbackService } = await import('@/lib/artwork-services/fallback-service');
      const fallbackService = new FallbackService();
      artworkResult = await fallbackService.searchArtworks(emotion, userInput, analysisResult);
    }
    
    // 获取当前使用的服务信息
    const serviceInfo = await serviceManager.getCurrentServiceInfo();
    console.log('🎯 当前使用服务:', serviceInfo.name, `(${serviceInfo.index + 1}/${serviceInfo.total})`);
    
    // 获取所有服务状态
    const allServicesStatus = await serviceManager.getAllServicesStatus();
    console.log('📊 所有服务状态:', allServicesStatus);

    // 第三步：LLM评分（精选准备）
    console.log('🧠 开始LLM评分（精选准备）...');
    const scoringStartTime = Date.now();
    // 让智能筛选来决定评分数量，不再限制作品数量
    console.log(`📊 实际获取作品数量: ${artworkResult.artworks.length}，将进行智能筛选和评分`);
    const scoringResult = await batchJudgeArtworksUltraOptimized(artworkResult.artworks, emotion, userInput, 5);
    const scoringTime = Date.now() - scoringStartTime;
    console.log(`⏱️ LLM评分完成，耗时: ${scoringTime}ms，成功: ${scoringResult.successCount}，失败: ${scoringResult.failureCount}`);

    // 第四步：生成情绪曲线
    console.log('🎭 开始生成情绪曲线...');
    const curveStartTime = Date.now();
    const emotionCurve = EmotionCurveGenerator.generateCurve(
      artworkResult.artworks, 
      scoringResult.scores, 
      emotion
    );
    const optimizedCurve = EmotionCurveGenerator.optimizeCurve(emotionCurve);
    const curveTime = Date.now() - curveStartTime;
    console.log(`⏱️ 情绪曲线生成完成，耗时: ${curveTime}ms`);

    // 第五步：智能作品选择（精选）
    console.log('🎯 开始智能作品选择（精选）...');
    const selectionStartTime = Date.now();
    const selectionResult = ArtworkSelector.selectBestArtworks(
      artworkResult.artworks,
      scoringResult.scores,
      optimizedCurve,
      { targetCount: 9 }
    );
    const selectionTime = Date.now() - selectionStartTime;
    console.log(`⏱️ 作品选择完成，耗时: ${selectionTime}ms，选择作品: ${selectionResult.selectedArtworks.length} 件`);

    // 第六步：生成作品讲解（首批即返：仅生成前3条，其余占位）
    console.log('🎨 开始生成作品讲解（首批返回3条，其余占位）...');
    const explanationStartTime = Date.now();
    const firstBatch = selectionResult.selectedArtworks.slice(0, 3);
    const restBatch = selectionResult.selectedArtworks.slice(3);
    const firstBatchResult = await generateArtworkExplanations(
      firstBatch,
      emotion,
      userInput,
      llmAnalysis.curation_strategy
    );
    const placeholders = restBatch.map(a => ({
      artworkId: a.id,
      title: a.title,
      artist: a.artist,
      explanation: {
        emotionalConnection: '',
        artisticAnalysis: '',
        historicalContext: '',
        curationReason: '',
        userRelevance: ''
      },
      confidence: 0,
      processingTime: 0
    }));
    const explanationsCombined = [...firstBatchResult.explanations, ...placeholders];
    const explanationTime = Date.now() - explanationStartTime;
    console.log(`⏱️ 首批作品讲解完成，耗时: ${explanationTime}ms，返回已完成讲解: ${firstBatchResult.successCount} 条`);

    // 第七步：生成策展简介/结语（使用GLM分析与曲线信息快速生成，避免外部依赖）
    const summaryStartTime = Date.now();
    const curationSummary = `# ${emotion}：跨越时空的情感编排\n\n本次展览围绕“${emotion}”的情绪线索，依据评分与情绪曲线完成精选编排。作品涵盖不同时期与风格，形成由静至动、由内省至张力的层次推进。观者可沿曲线峰谷变化体察情绪的生成、反思与升华。`;
    const summaryTime = Date.now() - summaryStartTime;
    console.log(`⏱️ 策展简介生成完成，耗时: ${summaryTime}ms`);

    // 第六步：使用LLM生成最终策展说明
    const curationPrompt = `基于以下分析结果和精选的艺术作品，生成一个专业的策展说明：

LLM分析结果: ${JSON.stringify(analysisResult, null, 2)}
精选作品数量: ${selectionResult.selectedArtworks.length}
粗选作品数量: ${artworkResult.artworks.length}
数据来源: ${artworkResult.source}
情绪曲线描述: ${EmotionCurveGenerator.generateCurveDescription(optimizedCurve, emotion)}
选择理由: ${selectionResult.selectionReasoning}
多样性指标: ${JSON.stringify(selectionResult.diversityMetrics, null, 2)}

请生成一个简洁而专业的策展说明，解释这个展览如何体现"${emotion}"这个情绪主题，以及作品选择的原因。`;

    const curationMessages = [
      {
        role: 'system' as const,
        content: '你是一位专业的艺术策展人，擅长撰写展览说明。'
      },
      {
        role: 'user' as const,
        content: curationPrompt
      }
    ];

    let curationDescription = '';
    try {
      const response = await openaiClient.chat(curationMessages, {
        model: process.env.NEXT_PUBLIC_GLM_MODEL || 'glm-4.5',
        temperature: 0.8,
        max_tokens: 512,
        thinking: 'disabled' as const
      });
      curationDescription = response.choices[0]?.message?.content || '这是一个精心策划的艺术展览，展现了情感的深度和艺术的魅力。';
    } catch (error) {
      console.error('策展说明生成失败:', error);
      curationDescription = '这是一个精心策划的艺术展览，展现了情感的深度和艺术的魅力。';
    }

    const totalProcessingTime = Date.now() - startTime;
    
    console.log('🎯 最终返回数据 - 精选作品数量:', selectionResult.selectedArtworks.length);
    console.log('🎯 策展描述:', curationDescription);
    console.log('🎯 数据来源:', artworkResult.source);
    console.log('⏱️ 总处理时间:', totalProcessingTime + 'ms');
    
    const response = {
      success: artworkResult.success,
      artworks: selectionResult.selectedArtworks.map(a => {
        const s = scoringResult.scores.find(s => s.artworkId === a.id);
        return {
          ...a,
          llmScore: s ? {
            emotionalFit: s.emotionFit,
            artisticValue: s.artisticValue,
            visualExpression: s.visualImpact,
            overallRecommendation: s.overallRecommendation,
            confidence: s.confidence
          } : undefined
        };
      }), // 使用精选后的作品，并注入llmScore
      curation: {
        theme: emotion,
        description: curationSummary, // 使用生成的策展总结
        emotionCurve: optimizedCurve.map(point => point.intensity), // 使用真实的情绪曲线
        totalWorks: selectionResult.selectedArtworks.length
      },
      explanations: explanationsCombined, // 返回首批讲解+占位
      serviceInfo: {
        current: serviceInfo.name,
        source: artworkResult.source,
        allServices: allServicesStatus
      },
      diagnostics: {
        searchPlan: searchPlan,
        llmAnalysis: analysisResult,
        processingTime: totalProcessingTime,
        planBuildTime: planBuildTime,
        deterministicSeed: deterministicSeed,
        coarseCount: artworkResult.artworks.length,
        preFilterCount: scoringResult.totalProcessed,
        scoredCount: scoringResult.scores.length,
        scoringResult: {
          totalProcessed: scoringResult.totalProcessed,
          successCount: scoringResult.successCount,
          failureCount: scoringResult.failureCount,
          scoringTime: scoringTime
        },
        llmScoring: true,
        scoringSuccess: scoringResult.successCount > 0,
        avgConfidence: scoringResult.scores.length > 0 ? (
          scoringResult.scores.reduce((sum, s) => sum + s.confidence, 0) / scoringResult.scores.length
        ) : 0,
        emotionCurve: {
          points: optimizedCurve,
          description: EmotionCurveGenerator.generateCurveDescription(optimizedCurve, emotion),
          generationTime: curveTime,
          curveSource: 'Legacy'
        },
        selectionResult: {
          selectedCount: selectionResult.selectedArtworks.length,
          selectionReasoning: selectionResult.selectionReasoning,
          diversityMetrics: selectionResult.diversityMetrics,
          selectionTime: selectionTime
        },
        explanationResult: {
          totalProcessed: firstBatch.length,
          successCount: firstBatchResult.successCount,
          failureCount: firstBatchResult.failureCount,
          explanationTime: explanationTime,
          explainFromCache: (firstBatchResult.fromCacheCount || 0) > 0,
          explainDegraded: firstBatchResult.failureCount > 0
        },
        summaryTime: summaryTime,
        glmKey: glmOptimizedClient.hasValidApiKey() ? 'GLM' : 'None',
        providers: {
          scoringProvider: 'GLM',
          explanationProvider: glmOptimizedClient.hasValidApiKey() ? 'GLM' : 'OpenAI',
          summaryProvider: 'OpenAI'
        }
      }
    };
    
    console.log('📤 返回完整响应:', JSON.stringify(response, null, 2));
    return NextResponse.json(response);
  } catch (error) {
    console.error('Curate API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 注意：选择函数已移至各个服务组件中

// 注意：曲线生成函数已移至各个服务组件中
