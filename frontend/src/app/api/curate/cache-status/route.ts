import { NextResponse } from 'next/server';

export async function GET() {
  // 简化返回示意数据
  return NextResponse.json({ size: 0, limit: 1024 * 1024 });
}


