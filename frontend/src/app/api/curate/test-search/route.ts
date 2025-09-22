import { NextRequest, NextResponse } from 'next/server';
import { ArtworkServiceManager } from '@/lib/artwork-services';
import { buildSearchPlanUltraOptimized, generateDeterministicSeed } from '@/lib/curation/search-plan-ultra-optimized';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emotion, userInput, testMode } = body || {};
    if (!emotion) {
      return NextResponse.json({ error: 'Missing emotion' }, { status: 400 });
    }
    // 在测试模式下返回稳定伪数据，避免外部依赖不稳定
    if (testMode === 'mock') {
      const mockArtworks = Array.from({ length: 12 }).map((_, i) => ({
        id: `${emotion}-mock-${i + 1}`,
        title: `${emotion} Mock Artwork ${i + 1}`,
        artist: `Artist ${i % 4}`,
        source: i % 2 === 0 ? 'met' : 'rijks',
        year: 1800 + (i * 10),
        medium: 'Oil on canvas',
        image: 'https://example.com/image.jpg'
      }));
      return NextResponse.json({ success: true, artworks: mockArtworks, source: 'mock' });
    }
    const seed = generateDeterministicSeed(emotion, userInput);
    const { llmAnalysis } = await buildSearchPlanUltraOptimized(emotion, userInput, seed);
    const serviceManager = new ArtworkServiceManager();
    const result = await serviceManager.searchArtworks(emotion, userInput, llmAnalysis);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}


