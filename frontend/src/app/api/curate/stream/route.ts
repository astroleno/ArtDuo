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
        console.log('🔍 生成的搜索查询:', searchQueries);
        
        // 使用多个查询进行搜索，提高匹配精度
        let allSearchResults = [];
        for (const query of searchQueries) {
          const results = await jsVectorSearchService.search(query.query, 15);
          // 为每个结果添加查询来源信息
          const enrichedResults = results.map(result => ({
            ...result,
            queryId: query.queryId,
            queryWeight: query.weight
          }));
          allSearchResults.push(...enrichedResults);
        }
        
        // 去重并按相似度排序
        const uniqueResults = deduplicateAndRankArtworks(allSearchResults);
        const searchResults = uniqueResults.slice(0, 30);
        
        const searchTime = Date.now() - searchStart;
        console.log(`✅ 向量检索完成，耗时: ${searchTime}ms，获得${searchResults.length}件作品`);
        console.log('🔍 检索结果示例:', searchResults.slice(0, 3).map(r => ({ id: r.id, title: r.title, similarity: r.similarity })));

        // Step 4: 选择最终作品ID
        const selectionStart = Date.now();
        const selectedArtworkIds = selectFinalArtworkIds(searchResults, curationIntent);
        const selectionTime = Date.now() - selectionStart;
        console.log(`✅ 作品ID选择完成，耗时: ${selectionTime}ms，选择${selectedArtworkIds.length}件作品`);

        // Step 5: 加载图片和元数据服务
        const serviceStart = Date.now();
        const imageService = new ImageService();
        await imageService.initialize();
        
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
          const imageData = imageService.getImageData(artworkId);
          
          return {
            id: artworkId,
            title: metadata?.title || '未知标题',
            artist: metadata?.artist || '未知艺术家',
            year: metadata?.year || '未知年代',
            medium: metadata?.medium || '未知媒介',
            description: metadata?.description || '',
            imageUrl: imageData?.primary || null,
            imageThumbnail: imageData?.thumbnail || null,
            additionalImages: imageData?.additionalImages || [],
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
  
  // 情绪弧线查询
  if (curationIntent.emotionalArc) {
    queries.push({
      queryId: 'arc',
      query: curationIntent.emotionalArc,
      weight: 0.9
    });
  }
  
  // 阶段查询：每个情绪阶段的关键词
  curationIntent.emotionalStages.forEach((stage: any, index: number) => {
    if (stage.keywords && stage.keywords.length > 0) {
      // 为每个阶段创建多个查询变体
      queries.push({
        queryId: `stage_${stage.stage}_keywords`,
        query: stage.keywords.join(' '),
        weight: 0.8
      });
      
      // 情绪名称查询
      queries.push({
        queryId: `stage_${stage.stage}_emotion`,
        query: stage.emotion,
        weight: 0.7
      });
      
      // 组合查询：情绪+关键词
      queries.push({
        queryId: `stage_${stage.stage}_combined`,
        query: `${stage.emotion} ${stage.keywords.join(' ')}`,
        weight: 0.9
      });
    }
  });
  
  // 视觉特征查询
  if (curationIntent.visualFeatures) {
    if (curationIntent.visualFeatures.colorPalette) {
      queries.push({
        queryId: 'colors',
        query: curationIntent.visualFeatures.colorPalette.join(' '),
        weight: 0.6
      });
    }
    if (curationIntent.visualFeatures.mood) {
      queries.push({
        queryId: 'mood',
        query: curationIntent.visualFeatures.mood.join(' '),
        weight: 0.7
      });
    }
  }
  
  // 艺术风格查询
  if (curationIntent.aestheticPreferences?.artStyles) {
    queries.push({
      queryId: 'styles',
      query: curationIntent.aestheticPreferences.artStyles.join(' '),
      weight: 0.5
    });
  }
  
  // 绘画优先查询
  queries.push({
    queryId: 'painting_priority',
    query: 'painting oil canvas watercolor acrylic tempera fresco',
    weight: 0.8
  });
  
  return queries;
}

/**
 * 选择最终作品ID
 */
function selectFinalArtworkIds(searchResults: any[], curationIntent: any) {
  // 去重并按相关性排序
  const uniqueArtworks = deduplicateAndRankArtworks(searchResults);
  
  // 计算每个阶段需要的作品数量
  const totalStages = curationIntent.emotionalStages.length;
  const totalArtworks = Math.min(12, Math.max(6, uniqueArtworks.length));
  const artworksPerStage = Math.floor(totalArtworks / totalStages);
  const remainingArtworks = totalArtworks % totalStages;
  
  console.log(`📊 作品分配: 总作品${totalArtworks}件, ${totalStages}个阶段, 每阶段${artworksPerStage}件`);
  
  // 按阶段分配作品
  const selectedArtworks = [];
  let currentIndex = 0;
  
  curationIntent.emotionalStages.forEach((stage: any, stageIndex: number) => {
    const stageArtworkCount = artworksPerStage + (stageIndex < remainingArtworks ? 1 : 0);
    const stageArtworks = uniqueArtworks.slice(currentIndex, currentIndex + stageArtworkCount);
    
    console.log(`📊 阶段${stage.stage} (${stage.emotion}): 分配${stageArtworkCount}件作品`);
    console.log(`📊 阶段${stage.stage}作品:`, stageArtworks.map(a => ({ id: a.id, title: a.title, similarity: a.similarity })));
    
    selectedArtworks.push(...stageArtworks);
    currentIndex += stageArtworkCount;
  });
  
  // 如果还有剩余作品，按相似度添加
  if (currentIndex < uniqueArtworks.length && selectedArtworks.length < totalArtworks) {
    const remaining = uniqueArtworks.slice(currentIndex, totalArtworks - selectedArtworks.length + currentIndex);
    selectedArtworks.push(...remaining);
  }
  
  console.log(`✅ 最终选择${selectedArtworks.length}件作品`);
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
  
  // 按相似度和绘画优先排序
  return unique.sort((a, b) => {
    // 绘画作品优先
    const aIsPainting = isPainting(a);
    const bIsPainting = isPainting(b);
    
    if (aIsPainting && !bIsPainting) return -1;
    if (!aIsPainting && bIsPainting) return 1;
    
    // 同类型按相似度排序
    return (b.similarity || 0) - (a.similarity || 0);
  });
}

/**
 * 判断是否为绘画作品
 */
function isPainting(artwork: any) {
  const medium = (artwork.medium || '').toLowerCase();
  const paintingKeywords = [
    'oil', 'canvas', 'watercolor', 'acrylic', 'tempera', 'fresco',
    'painting', 'paint', 'gouache', 'pastel', 'ink', 'brush'
  ];
  
  return paintingKeywords.some(keyword => medium.includes(keyword));
}

/**
 * 生成序言和结语
 */
async function generateNarration(artworks: any[], curationIntent: any) {
  const { glmOptimizedClient } = await import('@/lib/glm-optimized-client');
  
  const prompt = `作为世界级艺术策展人，请为以下展览撰写序言和结语：

【展览信息】
策展主题：${curationIntent.curatorialTheme}
情绪弧线：${curationIntent.emotionalArc}
作品数量：${artworks.length}件
视觉特征：${curationIntent.visualFeatures?.colorPalette?.join('、') || ''}色调，${curationIntent.visualFeatures?.mood?.join('、') || ''}氛围
叙事语调：${curationIntent.narrativeTone?.voice || ''}，${curationIntent.narrativeTone?.approach || ''}

【要求】
序言（300-400字）：
- 以诗意而深刻的方式开场，营造沉浸式氛围
- 深入阐释策展理念和情感内核
- 引导观众进入特定的心理状态
- 体现艺术与情感的深度对话

结语（200-250字）：
- 升华展览主题，引发哲学思考
- 连接个人体验与普遍人性
- 留下深刻印象和思考空间
- 以诗意语言收尾

请以JSON格式输出：
{
  "preface": "序言内容",
  "conclusion": "结语内容"
}`;

  const messages = [
    {
      role: 'system' as const,
      content: '你是一位世界级的艺术策展人，拥有20年策展经验，擅长撰写深刻、诗意、富有哲学思辨的展览序言和结语。你的文字具有文学性和艺术性，能够触动观众内心，引发深度思考。'
    },
    {
      role: 'user' as const,
      content: prompt
    }
  ];

  try {
    console.log('🎭 开始生成序言和结语...');
    const response = await glmOptimizedClient.chat(messages, {
      temperature: 0.9,
      max_tokens: 1200,
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
        console.log('📝 原始内容:', content);
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
    
    // 最后尝试：如果LLM没有按格式输出，使用内容作为序言
    console.log('⚠️ 所有解析方法失败，使用原始内容作为序言');
    console.log('📝 原始内容长度:', content.length);
    console.log('📝 原始内容前200字符:', content.substring(0, 200));
    
    // 尝试提取序言和结语文本（兜底提取，避免与上文变量同名）
    const prefaceMatch2 = content.match(/序言[：:]\s*(.+?)(?=结语|$)/s);
    const conclusionMatch2 = content.match(/结语[：:]\s*(.+?)$/s);
    
    if (prefaceMatch2) {
      console.log('✅ 找到序言文本(兜底)');
      return {
        preface: prefaceMatch2[1].trim(),
        conclusion: conclusionMatch2 ? conclusionMatch2[1].trim() : '通过这次展览，我们深入体验了情感主题的丰富层次。'
      };
    }
    
    // 如果还是找不到，使用整个内容作为序言
    const cleanContent = content.replace(/^[\s\S]*?(?=序言|结语|展览|艺术|等待|焦虑)/, '').trim();
    if (cleanContent.length > 50) {
      return {
        preface: cleanContent.substring(0, 400),
        conclusion: '通过这次展览，我们深入体验了情感主题的丰富层次。'
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
      
      // 与前端沉浸画廊对齐：前端读取 payload.explanations
      // result 为 BatchExplanationResult，包含 explanations 等统计字段
      send('artwork_batch_chunk', {
        batchIndex: i + 1,
        totalBatches: batches.length,
        explanations: result.explanations,
        successCount: result.successCount,
        failureCount: result.failureCount,
        fromCacheCount: result.fromCacheCount,
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
