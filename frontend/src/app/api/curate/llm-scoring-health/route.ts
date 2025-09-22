import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ enabled: true, capabilities: ['single', 'batch', 'zod-validated'] });
}


