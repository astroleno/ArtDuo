import { NextRequest, NextResponse } from 'next/server';
import { openaiClient } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { artwork, message, conversationHistory = [] } = body;

    if (!artwork || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: artwork and message' },
        { status: 400 }
      );
    }

    // 创建流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 发送开始标记
          controller.enqueue(encoder.encode('data: {"type":"start"}\n\n'));

          // 流式调用 OpenAI API
          for await (const chunk of openaiClient.chatAboutArtworkStream(
            artwork,
            message,
            conversationHistory
          )) {
            // 发送内容块
            const data = JSON.stringify({
              type: 'content',
              content: chunk
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }

          // 发送结束标记
          controller.enqueue(encoder.encode('data: {"type":"end"}\n\n'));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          const errorData = JSON.stringify({
            type: 'error',
            error: 'Failed to generate response'
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
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
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 处理 OPTIONS 请求（CORS）
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
