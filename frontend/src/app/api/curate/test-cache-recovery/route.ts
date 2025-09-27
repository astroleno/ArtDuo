import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body || {};
    // 简化：返回缓存存在但未命中
    return NextResponse.json({ cacheExists: true, cacheHit: false, cacheSize: 0 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}




