import { NextRequest, NextResponse } from 'next/server';
import { ArtworkServiceManager } from '@/lib/artwork-services';
import { buildSearchPlanUltraOptimized, generateDeterministicSeed } from '@/lib/curation/search-plan-ultra-optimized';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emotion, userInput, simulateFailure } = body || {};
    if (!emotion) {
      return NextResponse.json({ error: 'Missing emotion' }, { status: 400 });
    }

    const seed = generateDeterministicSeed(emotion, userInput);
    const { llmAnalysis } = await buildSearchPlanUltraOptimized(emotion, userInput, seed);
    const manager = new ArtworkServiceManager();

    // 简化：当模拟全部失败时，返回错误；否则调用正常搜索
    if (simulateFailure === 'both') {
      return NextResponse.json({ error: 'All providers unavailable', userMessage: '服务繁忙，请稍后重试' }, { status: 503 });
    }

    const result = await manager.searchArtworks(emotion, userInput, llmAnalysis);
    return NextResponse.json({ ...result, diagnostics: { simulateFailure } });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}




