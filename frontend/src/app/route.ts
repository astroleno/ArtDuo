import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // 读取主页 HTML 文件
    const htmlPath = path.join(process.cwd(), 'src/app/page.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // 返回 HTML 内容
    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error serving HTML:', error);
    return NextResponse.json(
      { error: 'Failed to load homepage' },
      { status: 500 }
    );
  }
}
