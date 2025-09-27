import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // 读取 HTML 文件
    const htmlPath = path.join(process.cwd(), 'src/app/gallery/page.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // 返回 HTML 内容
    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error serving gallery HTML:', error);
    return NextResponse.json(
      { error: 'Failed to load gallery page' },
      { status: 500 }
    );
  }
}