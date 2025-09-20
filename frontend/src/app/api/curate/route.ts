import { NextRequest, NextResponse } from 'next/server';
import { openaiClient } from '@/lib/openai';
import { ArtworkServiceManager } from '@/lib/artwork-services';

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

    // 第一步：使用 BigModel 分析用户情绪并生成智能搜索策略
    const analysisPrompt = `你是一位专业的艺术策展人。用户输入了情绪关键词"${emotion}"${userInput ? `，并补充说明："${userInput}"` : ''}。

请分析这个情绪主题，并生成一个智能搜索策略来找到相关的艺术作品。请考虑：

1. 情绪分析：这个情绪的核心特征是什么？
2. 艺术风格：哪些艺术风格最能表达这种情绪？
3. 关键词策略：应该搜索哪些英文关键词来找到相关作品？
4. 艺术家推荐：哪些艺术家擅长表达这种情绪？

请以JSON格式返回分析结果：
{
  "emotion_analysis": "情绪分析",
  "art_styles": ["风格1", "风格2"],
  "search_keywords": ["关键词1", "关键词2"],
  "recommended_artists": ["艺术家1", "艺术家2"],
  "curation_strategy": "策展策略说明"
}`;

    const analysisMessages = [
      {
        role: 'system' as const,
        content: '你是一位专业的艺术策展人，擅长分析情绪主题并制定智能搜索策略。'
      },
      {
        role: 'user' as const,
        content: analysisPrompt
      }
    ];

    let analysisResult = null;
    try {
      const response = await openaiClient.chat(analysisMessages, {
        model: 'glm-4.5',
        temperature: 0.7,
        max_tokens: 800
      });
      const analysisText = response.choices[0]?.message?.content || '{}';
      analysisResult = JSON.parse(analysisText);
      console.log('🧠 LLM分析结果:', analysisResult);
    } catch (error) {
      console.error('LLM分析失败:', error);
      // 使用默认分析结果
      analysisResult = {
        emotion_analysis: `这是一个关于"${emotion}"情绪的艺术策展`,
        art_styles: ['表现主义', '印象派'],
        search_keywords: [emotion],
        recommended_artists: [],
        curation_strategy: '通过艺术作品展现情绪的深度和多样性'
      };
    }

    // 第二步：使用LLM分析结果指导MCP搜索
    console.log('🔍 开始使用LLM指导的智能搜索...');
    const artworkResult = await serviceManager.searchArtworks(emotion, userInput, analysisResult);
    
    // 获取当前使用的服务信息
    const serviceInfo = await serviceManager.getCurrentServiceInfo();
    console.log('🎯 当前使用服务:', serviceInfo.name, `(${serviceInfo.index + 1}/${serviceInfo.total})`);
    
    // 获取所有服务状态
    const allServicesStatus = await serviceManager.getAllServicesStatus();
    console.log('📊 所有服务状态:', allServicesStatus);

    // 第三步：使用LLM生成最终策展说明
    const curationPrompt = `基于以下分析结果和找到的艺术作品，生成一个专业的策展说明：

LLM分析结果: ${JSON.stringify(analysisResult, null, 2)}
找到的作品数量: ${artworkResult.artworks.length}
数据来源: ${artworkResult.source}

请生成一个简洁而专业的策展说明，解释这个展览如何体现"${emotion}"这个情绪主题。`;

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
        model: 'glm-4.5',
        temperature: 0.8,
        max_tokens: 512
      });
      curationDescription = response.choices[0]?.message?.content || '这是一个精心策划的艺术展览，展现了情感的深度和艺术的魅力。';
    } catch (error) {
      console.error('策展说明生成失败:', error);
      curationDescription = '这是一个精心策划的艺术展览，展现了情感的深度和艺术的魅力。';
    }

    console.log('🎯 最终返回数据 - 作品数量:', artworkResult.artworks.length);
    console.log('🎯 策展描述:', curationDescription);
    console.log('🎯 数据来源:', artworkResult.source);
    
    const response = {
      success: artworkResult.success,
      artworks: artworkResult.artworks,
      curation: {
        theme: emotion,
        description: curationDescription,
        emotionCurve: artworkResult.curation.emotionCurve,
        totalWorks: artworkResult.artworks.length
      },
      serviceInfo: {
        current: serviceInfo.name,
        source: artworkResult.source,
        allServices: allServicesStatus
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
