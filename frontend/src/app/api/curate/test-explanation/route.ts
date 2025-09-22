import { NextRequest, NextResponse } from 'next/server';
import { generateArtworkExplanations } from '@/lib/curation/artwork-explanation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { artworks = [], emotion = 'joy', userInput = '', curationStrategy } = body || {};
    const t0 = Date.now();
    const result = await generateArtworkExplanations(artworks, emotion, userInput, curationStrategy);
    const t = Date.now() - t0;
    return NextResponse.json({ durationMs: t, result });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}


