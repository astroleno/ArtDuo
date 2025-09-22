import { NextRequest, NextResponse } from 'next/server';
import { ArtworkSelector } from '@/lib/curation/artwork-selector';
import { EmotionCurveGenerator } from '@/lib/curation/emotion-curve';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { artworks, scores, emotion, count = 9 } = body || {};
    if (!emotion || !Array.isArray(artworks) || !Array.isArray(scores)) {
      return NextResponse.json({ error: 'Missing emotion, artworks or scores' }, { status: 400 });
    }
    const curve = EmotionCurveGenerator.generateCurve(artworks, scores, emotion);
    const optimized = EmotionCurveGenerator.optimizeCurve(curve);
    const selection = ArtworkSelector.selectBestArtworks(artworks, scores, optimized, { targetCount: count });
    return NextResponse.json(selection);
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}


