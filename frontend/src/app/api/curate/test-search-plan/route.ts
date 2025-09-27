import { NextRequest, NextResponse } from 'next/server';
import { buildSearchPlanUltraOptimized, generateDeterministicSeed } from '@/lib/curation/search-plan-ultra-optimized';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emotion, userInput } = body || {};
    if (!emotion) {
      return NextResponse.json({ error: 'Missing emotion' }, { status: 400 });
    }
    const seed = generateDeterministicSeed(emotion, userInput);
    const { searchPlan, llmAnalysis } = await buildSearchPlanUltraOptimized(emotion, userInput, seed);
    return NextResponse.json({ searchPlan, llmAnalysis });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}




