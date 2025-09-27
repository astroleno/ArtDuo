import { NextResponse } from 'next/server';

export async function POST() {
  // 简化为返回清理完成（实际前端IndexedDB清理需在客户端触发）
  return NextResponse.json({ cleared: true });
}




