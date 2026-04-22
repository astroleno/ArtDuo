import { NextRequest } from 'next/server';
import { realLLMCurationIntentGenerator } from '@/lib/curation/real-llm-curation-intent-fixed';
import { EmotionCurveGenerator } from '@/lib/curation/emotion-curve';
import { jsVectorSearchService } from '@/lib/vector-search/js-vector-search';
import { generateArtworkExplanations } from '@/lib/curation/artwork-explanation';
import { ImageService } from '@/lib/image-service';
import fs from 'fs';
import path from 'path';

/**
 * 增强版策展流式SSE接口
 * 使用分离的数据架构：
 * 1. 向量检索 → 获取作品ID列表
 * 2. 图片服务 → 根据ID获取图片URL
 * 3. 元数据服务 → 根据ID获取完整信息
 */
export async function POST(request: NextRequest) {
  // 验证请求参数
  let body, emotion, userInput;
  try {
    body = await request.json().catch(() => ({}));
    emotion = body.emotion;
    userInput = body.userInput;
    
    if (!emotion) {
      return new Response(JSON.stringify({ error: 'Missing required field: emotion' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  console.log('🚀 开始增强版策展流式输出...');
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, payload: unknown) => {
        const data = `data: ${JSON.stringify({ type, payload })}\n\n`;
        console.log(`📤 发送SSE事件: ${type}`, payload);
        controller.enqueue(encoder.encode(data));
      };

      const closeWithError = (type: string, payload: unknown) => {
        send(type, payload);
        controller.close();
      };

      try {
        const t0 = Date.now();

        // Phase A · 规划层
        console.log('📋 Phase A: 开始规划层处理...');

        // Step 1: LLM策展规划
        const curationStart = Date.now();
        const curationIntent = await realLLMCurationIntentGenerator.generateCurationIntent(emotion, userInput);
        const curationTime = Date.now() - curationStart;
        console.log(`✅ LLM策展规划完成，耗时: ${curationTime}ms`);
        console.log('📊 策展意图:', curationIntent);

        // Step 2: 情绪曲线设计
        const curveStart = Date.now();
        const stageIntensities = curationIntent.emotionalStages.map(stage => stage.intensity);
        const stageEmotions = curationIntent.emotionalStages.map(stage => stage.emotion);
        
        console.log('📊 准备生成情绪曲线:');
        console.log('📊 阶段强度:', stageIntensities);
        console.log('📊 阶段情绪:', stageEmotions);
        
        const emotionCurve = EmotionCurveGenerator.generateCurve(
          [], // 空作品数组，只生成曲线
          [], // 空评分数组
          curationIntent.emotionalStages[0]?.emotion || 'joy',
          {
            curveType: 'custom',
            totalPoints: curationIntent.emotionalStages.length,
            intensity: curationIntent.emotionalStages[0]?.intensity || 0.8,
            variation: 0.3,
            stageIntensities: stageIntensities,
            stageEmotions: stageEmotions
          }
        );
        const curveTime = Date.now() - curveStart;
        console.log(`✅ 情绪曲线设计完成，耗时: ${curveTime}ms`);

        // Step 3: 向量检索
        const searchStart = Date.now();
        const searchQueries = generateSearchQueries(curationIntent);
        const searchQuery = searchQueries[0]?.query || curationIntent.curatorialTheme;
        const searchResults = await jsVectorSearchService.search(searchQuery, 30);
        const searchTime = Date.now() - searchStart;
        console.log(`✅ 向量检索完成，耗时: ${searchTime}ms，获得${searchResults.length}件作品`);

        // Step 4: 选择最终作品ID
        const selectionStart = Date.now();
        const selectedArtworkIds = selectFinalArtworkIds(searchResults, curationIntent);
        const selectionTime = Date.now() - selectionStart;
        console.log(`✅ 作品ID选择完成，耗时: ${selectionTime}ms，选择${selectedArtworkIds.length}件作品`);

        // Step 5: 加载图片和元数据服务
        const serviceStart = Date.now();
        const imageService = new ImageService();
        await imageService.loadImages();
        
        // 加载元数据
        const metadataPath = path.join(process.cwd(), 'public', 'data', 'artworks-metadata.json');
        const metadataData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        const metadataMap = new Map(metadataData.map((item: any) => [item.id, item]));
        
        const serviceTime = Date.now() - serviceStart;
        console.log(`✅ 服务加载完成，耗时: ${serviceTime}ms`);

        // Step 6: 组装最终作品数据
        const assemblyStart = Date.now();
        const selectedArtworks = selectedArtworkIds.map((artworkId: string, index: number) => {
          const metadata = metadataMap.get(artworkId);
          const imageUrls = imageService.getImageUrls(artworkId);
          
          return {
            id: artworkId,
            title: metadata?.title || '未知标题',
            artist: metadata?.artist || '未知艺术家',
            year: metadata?.year || '未知年代',
            medium: metadata?.medium || '未知媒介',
            description: metadata?.description || '',
            imageUrl: imageUrls.primary,
            imageThumbnail: imageUrls.thumbnail,
            additionalImages: imageUrls.alternatives,
            position: index + 1,
            stage: Math.floor(index / (selectedArtworkIds.length / curationIntent.emotionalStages.length)) + 1,
            emotion: metadata?.emotion || null
          };
        });
        const assemblyTime = Date.now() - assemblyStart;
        console.log(`✅ 作品数据组装完成，耗时: ${assemblyTime}ms`);

        // 发送作品选择结果
        send('artworks_selected', {
          artworks: selectedArtworks,
          totalCount: selectedArtworks.length,
          durationMs: selectionTime + serviceTime + assemblyTime
        });

        // Phase B · 叙述层（SSE阶段）
        console.log('📝 Phase B: 开始叙述层处理...');

        // 生成序言+结语（一次LLM调用）
        const narrationStart = Date.now();
        const { preface, conclusion } = await generateNarration(selectedArtworks, curationIntent);
        const narrationTime = Date.now() - narrationStart;
        console.log(`✅ 序言+结语生成完成，耗时: ${narrationTime}ms`);

        // 1. 序言流式输出
        console.log('📝 发送序言事件，内容长度:', preface.length);
        send('preface_chunk', {
          content: preface,
          durationMs: narrationTime
        });
        console.log('✅ 序言事件已发送');

        // 2. 作品解释批次生成（2-2-2模式）
        const explanationStart = Date.now();
        await generateExplanationsInBatches(selectedArtworks, curationIntent, emotionCurve, send);
        const explanationTime = Date.now() - explanationStart;
        console.log(`✅ 作品解释生成完成，耗时: ${explanationTime}ms`);

        // 3. 结语流式输出
        console.log('📝 发送结语事件，内容长度:', conclusion.length);
        send('closing_chunk', {
          content: conclusion,
          durationMs: narrationTime
        });
        console.log('✅ 结语事件已发送');

        // 完结
        send('complete', { 
          elapsedMs: Date.now() - t0,
          totalArtworks: selectedArtworks.length,
          totalPhases: 2
        });
        controller.close();

      } catch (error) {
        closeWithError('stream_step_failed', { 
          message: error instanceof Error ? error.message : String(error) 
        });
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * 生成搜索查询
 */
function generateSearchQueries(curationIntent: any) {
  const queries = [];
  
  // 主查询：策展主题
  if (curationIntent.curatorialTheme) {
    queries.push({
      queryId: 'main',
      query: curationIntent.curatorialTheme,
      weight: 1.0
    });
  }
  
  // 阶段查询：每个情绪阶段的关键词
  curationIntent.emotionalStages.forEach((stage: any, index: number) => {
    if (stage.keywords && stage.keywords.length > 0) {
      queries.push({
        queryId: `stage_${stage.stage}`,
        query: stage.keywords.join(' '),
        weight: 0.8
      });
    }
  });
  
  return queries;
}

/**
 * 选择最终作品ID
 */
function selectFinalArtworkIds(searchResults: any[], curationIntent: any) {
  // 去重并按相关性排序
  const uniqueArtworks = deduplicateAndRankArtworks(searchResults);
  
  // 选择最终作品（6-12件）
  const targetCount = Math.min(12, Math.max(6, uniqueArtworks.length));
  const selectedArtworks = uniqueArtworks.slice(0, targetCount);
  
  // 返回作品ID列表
  return selectedArtworks.map((artwork: any) => artwork.id);
}

/**
 * 去重并排序作品
 */
function deduplicateAndRankArtworks(artworks: any[]) {
  const seen = new Set();
  const unique = artworks.filter(artwork => {
    if (seen.has(artwork.id)) return false;
    seen.add(artwork.id);
    return true;
  });
  
  // 按相似度排序
  return unique.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
}

/**
 * 生成序言和结语
 */
async function generateNarration(artworks: any[], curationIntent: any) {
  const { glmOptimizedClient } = await import('@/lib/llm/glm-optimized-client');
  
  const prompt = `作为一位资深艺术策展人，请为以下展览生成序言和结语：

策展主题：${curationIntent.curatorialTheme}
情绪弧线：${curationIntent.emotionalArc}
作品数量：${artworks.length}件

请生成：
1. 序言（200-300字）：解释展览的核心理念和作品选择逻辑
2. 结语（150-200字）：总结展览的艺术价值和情感体验

请以JSON格式输出：
{
  "preface": "序言内容",
  "conclusion": "结语内容"
}`;

  const messages = [
    {
      role: 'system' as const,
      content: '你是一位资深的艺术策展人，擅长撰写富有感染力的展览序言和深刻而富有启发性的展览结语。'
    },
    {
      role: 'user' as const,
      content: prompt
    }
  ];

  try {
    console.log('🎭 开始生成序言和结语...');
    const response = await glmOptimizedClient.chat(messages, {
      temperature: 0.8,
      max_tokens: 800,
      thinking: 'disabled' as const
    });
    
    const content = response.choices[0]?.message?.content || '';
    console.log('📝 LLM原始序言+结语输出:', content);
    
    // 尝试解析JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('✅ 序言+结语JSON解析成功:', parsed);
        return {
          preface: parsed.preface || '这是一个精心策划的艺术展览...',
          conclusion: parsed.conclusion || '通过这次展览，我们深入体验了情感主题的丰富层次...'
        };
      } catch (parseError) {
        console.error('❌ JSON解析失败:', parseError);
      }
    }
    
    // 如果解析失败，尝试直接提取文本
    console.log('⚠️ JSON解析失败，尝试直接提取文本...');
    const prefaceMatch = content.match(/序言[：:]\s*(.+?)(?=结语|$)/s);
    const conclusionMatch = content.match(/结语[：:]\s*(.+?)$/s);
    
    if (prefaceMatch && conclusionMatch) {
      console.log('✅ 直接提取序言+结语成功');
      return {
        preface: prefaceMatch[1].trim(),
        conclusion: conclusionMatch[1].trim()
      };
    }
    
    // 如果都失败，抛出错误而不是返回默认内容
    throw new Error('无法解析LLM输出的序言和结语');
    
  } catch (error) {
    console.error('❌ 序言+结语生成失败:', error);
    throw error;
  }
}

/**
 * 分批并发生成讲解（2-2-2模式）
 */
async function generateExplanationsInBatches(
  artworks: any[],
  curationIntent: any,
  emotionCurve: any,
  send: (type: string, payload: unknown) => void
) {
  const batchSize = 2;
  const batches = [];
  
  for (let i = 0; i < artworks.length; i += batchSize) {
    batches.push(artworks.slice(i, i + batchSize));
  }
  
  console.log(`🎨 开始分批生成讲解：${batches.length}批，每批${batchSize}件，总计${artworks.length}件作品`);
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      const batchStart = Date.now();
      const result = await generateArtworkExplanations(
        batch,
        curationIntent.emotionalStages[0]?.emotion || 'joy',
        curationIntent.curatorialTheme,
        curationIntent.curatorialTheme,
        emotionCurve
      );
      const batchTime = Date.now() - batchStart;
      
      console.log(`✅ 批次${i + 1}讲解生成完成，耗时: ${batchTime}ms`);
      
      send('artwork_batch_chunk', {
        batchIndex: i + 1,
        totalBatches: batches.length,
        artworks: result,
        durationMs: batchTime
      });
      
    } catch (error) {
      console.error(`❌ 批次${i + 1}讲解生成失败:`, error);
      send('artwork_batch_error', {
        batchIndex: i + 1,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}






