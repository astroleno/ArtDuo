import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ enabled: true, capabilities: ['generate', 'optimize', 'describe'] });
}


