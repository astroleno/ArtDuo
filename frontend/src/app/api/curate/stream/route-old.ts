import { NextRequest } from 'next/server';
import { realLLMCurationIntentGenerator } from '@/lib/curation/real-llm-curation-intent-fixed';
import { EmotionCurveGenerator } from '@/lib/curation/emotion-curve';
import { jsVectorSearchService } from '@/lib/vector-search/js-vector-search';
import { generateArtworkExplanations } from '@/lib/curation/artwork-explanation';

/**
 * 优化后的策展流式SSE接口
 * 按照正确的策展顺序：
 * 1. LLM策展规划+情绪曲线设计 (10s)
 * 2. 向量检索+作品匹配 (1s) 
 * 3. 序言+结语生成 (5s)
 * 4. 作品解释批次生成 (10s)
 * 
 * SSE事件顺序：
 * 1. preface_chunk（序言）
 * 2. artwork_batch_chunk for [1,2]
 * 3. artwork_batch_chunk for [3,4]
 * 4. artwork_batch_chunk for [5,6]
 * 5. artwork_batch_chunk for [7,8]
 * 6. artwork_batch_chunk for [9]
 * 7. closing_chunk（结语）
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

  console.log('🚀 开始优化后的策展流式输出...');
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, payload: unknown) => {
        try {
          if (controller.desiredSize === null) {
            console.warn('⚠️ 控制器已关闭，跳过发送:', type);
            return;
          }
          const data = JSON.stringify({ type, payload });
          console.log(`📤 发送SSE事件: ${type}`, payload);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (err) {
          console.error('❌ 发送数据失败:', err);
          try {
            if (controller.desiredSize !== null) {
              controller.enqueue(encoder.encode(`data: {"type":"error","payload":{"message":"serialize_failed"}}\n\n`));
            }
          } catch (closeErr) {
            console.error('❌ 关闭控制器失败:', closeErr);
          }
        }
      };

      const closeWithError = (message: string, details?: unknown) => {
        send('error', { message, details });
        controller.close();
      };

      try {
        const t0 = Date.now();
        send('start', { emotion, userInput });

        // Phase A · 规划层（后端角度）
        console.log('🧠 Phase A: 开始LLM策展规划...');
        
        // Step 1: LLM策展规划（单次调用）
        const curationStart = Date.now();
        const curationIntent = await realLLMCurationIntentGenerator.generateCurationIntent(userInput || emotion);
        const curationTime = Date.now() - curationStart;
        console.log(`✅ LLM策展规划完成，耗时: ${curationTime}ms`);
        
        send('curation_intent', {
          curatorialTheme: curationIntent.curatorialTheme,
          emotionalArc: curationIntent.emotionalArc,
          emotionalStages: curationIntent.emotionalStages,
          durationMs: curationTime
        });

        // Step 2: 情绪曲线设计（使用LLM生成的信息）
        const curveStart = Date.now();
        
        // 使用LLM生成的情绪曲线信息
        const llmEmotionCurve = curationIntent.emotionCurve;
        console.log('📊 LLM生成的情绪曲线信息:', llmEmotionCurve);
        
        // 基于LLM阶段信息生成情绪曲线
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
            // 使用LLM生成的阶段强度信息
            stageIntensities: stageIntensities,
            stageEmotions: stageEmotions
          }
        );
        const curveTime = Date.now() - curveStart;
        console.log(`✅ 情绪曲线设计完成，耗时: ${curveTime}ms`);
        console.log('📈 生成的情绪曲线:', emotionCurve);

        // Step 3: 检索引擎（向量库 + 本地DB）
        const searchStart = Date.now();
        const searchQueries = generateSearchQueries(curationIntent);
        // 使用第一个查询进行搜索
        const searchQuery = searchQueries[0]?.query || curationIntent.curatorialTheme;
        // 使用纯JavaScript向量搜索
        const searchResults = await jsVectorSearchService.search(searchQuery, 30);
        const searchTime = Date.now() - searchStart;
        console.log(`✅ 向量检索完成，耗时: ${searchTime}ms，获得${searchResults.length}件作品`);

        // Step 4: 选择最终作品
        const selectionStart = Date.now();
        const selectedArtworks = selectFinalArtworks(searchResults, curationIntent, emotionCurve);
        const selectionTime = Date.now() - selectionStart;
        console.log(`✅ 作品选择完成，耗时: ${selectionTime}ms，选择${selectedArtworks.length}件作品`);

        // 发送作品选择结果
        send('artworks_selected', {
          artworks: selectedArtworks,
          totalCount: selectedArtworks.length,
          durationMs: selectionTime
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
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

/**
 * 生成检索查询
 */
function generateSearchQueries(curationIntent: any) {
  const queries = [];
  
  curationIntent.emotionalStages.forEach((stage: any, index: number) => {
    // 基础情绪Query
    queries.push({
      query: `${stage.emotion} ${stage.keywords.join(' ')}`,
      weight: stage.intensity,
      filters: { emotion: stage.emotion }
    });
    
    // 关键词Query（每个关键词单独查询）
    stage.keywords.forEach((keyword: string) => {
      queries.push({
        query: `${keyword} ${stage.emotion}`,
        weight: stage.intensity * 0.8,
        filters: { keyword: keyword }
      });
    });
  });
  
  // 添加整体主题Query
  queries.push({
    query: curationIntent.curatorialTheme,
    weight: 1.0,
    filters: { theme: curationIntent.curatorialTheme }
  });
  
  return queries;
}

/**
 * 选择最终作品
 */
function selectFinalArtworks(searchResults: any, curationIntent: any, emotionCurve: any[]) {
  // 收集所有作品
  const allArtworks = Array.isArray(searchResults) ? searchResults : searchResults.results?.flatMap((result: any) => 
    result.artworks?.map((artwork: any) => ({
      ...artwork,
      queryId: result.queryId
    })) || []
  ) || [];

  // 去重并按相关性排序
  const uniqueArtworks = deduplicateAndRankArtworks(allArtworks);
  
  // 选择最终作品（6-12件）
  const targetCount = Math.min(12, Math.max(6, uniqueArtworks.length));
  const selectedArtworks = uniqueArtworks.slice(0, targetCount);

  // 为每件作品分配情绪阶段
  return selectedArtworks.map((artwork: any, index: number) => ({
    ...artwork,
    position: index + 1,
    stage: Math.floor(index / (targetCount / curationIntent.emotionalStages.length)) + 1,
    emotionalImpact: artwork.relevance * 0.9 + Math.random() * 0.1
  }));
}

/**
 * 去重并排序作品
 */
function deduplicateAndRankArtworks(artworks: any[]) {
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
 * 生成序言+结语（一次LLM调用）
 */
async function generateNarration(artworks: any[], curationIntent: any) {
  const { glmOptimizedClient } = await import('@/lib/glm-optimized-client');
  
  const prompt = `为艺术展览生成序言和结语（中文）。

展览主题：${curationIntent.curatorialTheme}
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
    throw error; // 抛出错误，让上层处理
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
  const batchSize = 2; // 固定小批次，快速返回
  const batches = [];
  
  // 分成小批次，每批2件作品
  for (let i = 0; i < artworks.length; i += batchSize) {
    batches.push(artworks.slice(i, i + batchSize));
  }
  
  console.log(`🎨 开始分批生成讲解：${batches.length}批，每批${batchSize}件，总计${artworks.length}件作品`);
  
  // 处理每个批次
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      const batchStart = Date.now();
      const result = await generateArtworkExplanations(
        batch,
        curationIntent.emotionalStages[0]?.emotion || 'joy',
        curationIntent.curatorialTheme,
        curationIntent.curatorialTheme,
        emotionCurve,
        curationIntent.emotionalStages
      );
      const batchTime = Date.now() - batchStart;
      
      // 发送这一批的讲解结果
      send('artwork_batch_chunk', {
        batchIndex: i + 1,
        batchSize: batch.length,
        explanations: result.explanations,
        successCount: result.successCount,
        failureCount: result.failureCount,
        durationMs: batchTime
      });
      
      console.log(`✅ 第${i + 1}批讲解完成，耗时: ${batchTime}ms`);
      
    } catch (error) {
      console.error(`❌ 第${i + 1}批讲解失败:`, error);
      send('artwork_batch_chunk', {
        batchIndex: i + 1,
        batchSize: batch.length,
        explanations: [],
        successCount: 0,
        failureCount: batch.length,
        error: error instanceof Error ? error.message : String(error),
        durationMs: 0
      });
    }
  }
  
  console.log('🎉 所有讲解批次生成完成');
}

// 便于测试：支持 GET /api/curate/stream?emotion=...&userInput=...
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const emotion = url.searchParams.get('emotion') || '';
  const userInput = url.searchParams.get('userInput') || '';

  if (!emotion) {
    return new Response(JSON.stringify({ error: 'Missing required field: emotion' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const fake = {
    json: async () => ({ emotion, userInput })
  } as unknown as NextRequest;

  return POST(fake);
}

/**
 * 模拟搜索函数 - 暂时替代hnswlib-node
 */
async function mockSearch(query: string) {
  // 模拟一些艺术作品数据，根据查询内容智能选择
  console.log(`🔍 模拟搜索查询: "${query}"`);
  
  const mockArtworks = [
    {
      id: "437133",
      title: "Garden at Sainte-Adresse",
      artist: "Claude Monet",
      year: "1867",
      medium: "Oil on canvas",
      description: "这是一件来自大都会艺术博物馆的珍贵作品。",
      imageUrl: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop&auto=format&q=80",
      museum: "大都会艺术博物馆"
    },
    {
      id: "729644",
      title: "In proof of true love, a watercarrier skeleton arguing with a woman (Posada); two skeleton angels in upper corners (Manilla)",
      artist: "José Guadalupe Posada",
      year: "ca. 1890–1896",
      medium: "Type-metal engraving and letterpress on blue paper",
      description: "这是一件来自大都会艺术博物馆的珍贵作品。",
      imageUrl: "https://images.metmuseum.org/CRDImages/dp/original/DP865112.jpg",
      museum: "大都会艺术博物馆"
    },
    {
      id: "436155",
      title: "The Rehearsal of the Ballet Onstage",
      artist: "Edgar Degas",
      year: "ca. 1874",
      medium: "Oil colors freely mixed with turpentine, with traces of watercolor and pastel over pen-and-ink drawing on cream-colored wove paper, laid down on bristol board and mounted on canvas",
      description: "这是一件来自大都会艺术博物馆的珍贵作品。",
      imageUrl: "https://images.metmuseum.org/CRDImages/ep/original/DT1565.jpg",
      museum: "大都会艺术博物馆"
    },
    {
      id: "671456",
      title: "Chrysanthemums in the Garden at Petit-Gennevilliers",
      artist: "Gustave Caillebotte",
      year: "1893",
      medium: "Oil on canvas",
      description: "这是一件来自大都会艺术博物馆的珍贵作品。",
      imageUrl: "https://images.metmuseum.org/CRDImages/ep/original/DP341200.jpg",
      museum: "大都会艺术博物馆"
    },
    {
      id: "436241",
      title: "Cows Crossing a Ford",
      artist: "Jules Dupré",
      year: "1836",
      medium: "Oil on canvas",
      description: "这是一件来自大都会艺术博物馆的珍贵作品。",
      imageUrl: "https://images.metmuseum.org/CRDImages/ep/original/DP232030.jpg",
      museum: "大都会艺术博物馆"
    },
    {
      id: "437422",
      title: "Charity",
      artist: "Guido Reni",
      year: "ca. 1630",
      medium: "Oil on canvas",
      description: "这是一件来自大都会艺术博物馆的珍贵作品。",
      imageUrl: "https://images.metmuseum.org/CRDImages/ep/original/DT10776.jpg",
      museum: "大都会艺术博物馆"
    },
    {
      id: "206965",
      title: "Longcase astronomical regulator",
      artist: "Ferdinand Berthoud",
      year: "ca. 1768–70",
      medium: "Case: oak veneered with ebony and brass, with gilt-bronze mounts; Dial: white enamel; Movement: gilded brass and steel",
      description: "这是一件来自大都会艺术博物馆的珍贵作品。",
      imageUrl: "https://images.metmuseum.org/CRDImages/es/original/DP336058.jpg",
      museum: "大都会艺术博物馆"
    },
    {
      id: "544320",
      title: "Stela of the Steward Mentuwoser",
      artist: "未知艺术家",
      year: "ca. 1944 B.C.",
      medium: "Limestone, paint",
      description: "Middle Kingdom",
      imageUrl: "https://images.metmuseum.org/CRDImages/eg/original/DP322064.jpg",
      museum: "大都会艺术博物馆"
    },
    {
      id: "200668",
      title: "Sabine Houdon (1787–1836)",
      artist: "Jean Antoine Houdon",
      year: "1788",
      medium: "White marble on gray marble socle",
      description: "这是一件来自大都会艺术博物馆的珍贵作品。",
      imageUrl: "https://images.metmuseum.org/CRDImages/es/original/DP242660.jpg",
      museum: "大都会艺术博物馆"
    }
  ];
  
  // 模拟搜索延迟
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return mockArtworks;
}
