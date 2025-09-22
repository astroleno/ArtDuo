import { NextRequest, NextResponse } from 'next/server';
import { generateCurationSummary } from '@/lib/curation/artwork-explanation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { artworks = [], emotion = 'joy', explanations = [], userInput = '' } = body || {};
    const t0 = Date.now();
    const summary = await generateCurationSummary(artworks, emotion, explanations, userInput);
    const t = Date.now() - t0;
    return NextResponse.json({ durationMs: t, summary, length: summary?.length || 0 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}


