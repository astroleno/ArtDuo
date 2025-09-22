import { NextRequest, NextResponse } from 'next/server';
import { batchJudgeArtworksUltraOptimized } from '@/lib/curation/llm-judge-ultra-optimized';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { artworks, emotion, userInput, testMode } = body || {};
    const validEmotions = ['joy', 'melancholy', 'calm', 'passion', 'lonely'];
    if (!emotion || !Array.isArray(artworks)) {
      return NextResponse.json({ error: 'Missing emotion or artworks' }, { status: 400 });
    }
    // 错误处理覆盖：空列表
    if (artworks.length === 0) {
      return NextResponse.json({ error: 'Artwork list cannot be empty' }, { status: 400 });
    }
    // 错误处理覆盖：无效情绪
    if (!validEmotions.includes(emotion)) {
      return NextResponse.json({ error: 'Invalid emotion' }, { status: 400 });
    }
    // 错误处理覆盖：无效作品（缺少必要字段）
    const hasInvalid = artworks.some((a: any) => !a || !a.id || typeof a.id !== 'string' || !a.title || typeof a.title !== 'string');
    if (hasInvalid) {
      return NextResponse.json({ error: 'Invalid artwork data' }, { status: 400 });
    }
    // 错误处理覆盖：超大批次
    if (artworks.length >= 20) {
      return NextResponse.json({ error: 'Batch too large for test mode' }, { status: 400 });
    }
    if (testMode === 'mock') {
      const scores = artworks.map(a => ({
        artworkId: a.id,
        emotionFit: 7,
        artisticValue: 7,
        visualImpact: 7,
        overallRecommendation: 7,
        confidence: 0.8,
        reasoning: 'mock score'
      }));
      const scoredArtworks = artworks.map(a => ({
        ...a,
        llmScore: {
          emotionalFit: 7,
          artisticValue: 7,
          visualExpression: 7,
          overallRecommendation: 7,
          confidence: 0.8
        }
      }));
      return NextResponse.json({
        scores,
        scoredArtworks,
        totalProcessed: artworks.length,
        successCount: scores.length,
        failureCount: 0,
        processingTime: 10
      });
    }
    const result = await batchJudgeArtworksUltraOptimized(artworks, emotion, userInput, 5);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}


