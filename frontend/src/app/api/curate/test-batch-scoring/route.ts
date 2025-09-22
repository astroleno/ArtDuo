import { NextRequest, NextResponse } from 'next/server';
import { batchJudgeArtworksUltraOptimized } from '@/lib/curation/llm-judge-ultra-optimized';

export async function POST(request: NextRequest) {
  const start = Date.now();
  try {
    const body = await request.json();
    const { artworks, emotion, userInput } = body || {};
    if (!emotion || !Array.isArray(artworks)) {
      return NextResponse.json({ error: 'Missing emotion or artworks' }, { status: 400 });
    }
    const result = await batchJudgeArtworksUltraOptimized(artworks, emotion, userInput, 5);
    const duration = Date.now() - start;
    return NextResponse.json({
      scoredArtworks: result.scores.map(s => ({ artworkId: s.artworkId, llmScore: s })),
      timing: { duration },
      optimization: { concurrentRequests: 5, batchSize: 6, timeSaved: 0 }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}


