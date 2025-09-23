import { NextRequest, NextResponse } from 'next/server';
import { generateArtworkExplanations } from '@/lib/curation/artwork-explanation';
import { Artwork } from '@/lib/curation/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      artworks,
      artworkIds,
      emotion,
      userInput,
      curationStrategy,
      batchIndex = 1,
      batchSize = 3
    } = body || {};

    if ((!artworks && !artworkIds) || !emotion) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 允许两种输入：完整作品对象数组，或仅ID数组+最少字段
    let items: Artwork[] = Array.isArray(artworks) ? artworks : [];
    if (!items.length && Array.isArray(artworkIds)) {
      // 仅有ID时，最小化占位（title/artist可由前端一并传入artworks更佳）
      items = artworkIds.map((id: string) => ({
        id,
        title: '',
        artist: '',
        year: '',
        medium: '',
        description: '',
        imageUrl: '',
        museum: ''
      }));
    }

    const start = (Number(batchIndex) - 1) * Number(batchSize);
    const end = start + Number(batchSize);
    const batch = items.slice(start, end);

    if (batch.length === 0) {
      return NextResponse.json({ explanations: [], total: items.length, batchIndex, batchSize });
    }

    const result = await generateArtworkExplanations(batch, emotion, userInput, curationStrategy);
    return NextResponse.json({
      success: true,
      explanations: result.explanations,
      total: items.length,
      batchIndex: Number(batchIndex),
      batchSize: Number(batchSize),
      processed: batch.length,
      processingTime: result.processingTime
    });
  } catch (error) {
    console.error('Explain batch API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


