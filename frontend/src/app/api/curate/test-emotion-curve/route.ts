import { NextRequest, NextResponse } from 'next/server';
import { EmotionCurveGenerator } from '@/lib/curation/emotion-curve';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emotion, artworks, scores } = body || {};
    if (!emotion || !Array.isArray(artworks)) {
      return NextResponse.json({ error: 'Missing emotion or artworks' }, { status: 400 });
    }
    // 如果未提供scores，则从artworks.llmScore构建一个简单的scores数组
    const derivedScores = Array.isArray(scores) && scores.length > 0 ? scores : artworks.map((a: any) => ({
      artworkId: a.id,
      emotionFit: a.llmScore?.emotionalFit ?? 6,
      artisticValue: a.llmScore?.artisticValue ?? 6,
      visualImpact: a.llmScore?.visualExpression ?? a.llmScore?.visualImpact ?? 6,
      overallRecommendation: a.llmScore?.overallRecommendation ?? 6,
      confidence: 0.5,
      reasoning: 'derived from llmScore'
    }));
    const curve = EmotionCurveGenerator.generateCurve(artworks, derivedScores, emotion);
    const optimized = EmotionCurveGenerator.optimizeCurve(curve);
    const description = EmotionCurveGenerator.generateCurveDescription(optimized, emotion);
    return NextResponse.json({ curve: optimized, description, emotionCurve: optimized });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}


