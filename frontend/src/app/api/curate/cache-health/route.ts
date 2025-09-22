import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ enabled: true, type: 'memory+indexeddb', storage: 'browser+server' });
}


