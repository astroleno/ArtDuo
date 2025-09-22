/**
 * MCP代理服务 - 为前端提供MCP调用接口
 * 真实调用失败时返回明确的错误码，禁止默认mock污染数据
 */

import { NextRequest, NextResponse } from 'next/server';

const MCP_UPSTREAM_URL = process.env.MCP_UPSTREAM_URL;
const MCP_UPSTREAM_API_KEY = process.env.MCP_UPSTREAM_API_KEY;
const MCP_REQUEST_TIMEOUT = Number(process.env.MCP_REQUEST_TIMEOUT ?? 20000);
const NEXT_PUBLIC_MCP_MOCK_ENABLED = process.env.NEXT_PUBLIC_MCP_MOCK_ENABLED === 'true';
const IS_DEV = process.env.NODE_ENV !== 'production';

export async function POST(request: NextRequest) {
  let requestBody: any;

  try {
    requestBody = await request.json();
  } catch (error) {
    console.error('❌ MCP代理解析请求失败:', error);
    return buildErrorResponse(400, 'MCP_BAD_REQUEST', 'Invalid JSON payload');
  }

  const { id = '1', method, params } = requestBody ?? {};

  if (!method) {
    return buildErrorResponse(400, 'MCP_METHOD_REQUIRED', 'Missing MCP method', id);
  }

  const allowMock = NEXT_PUBLIC_MCP_MOCK_ENABLED && IS_DEV;

  if (!allowMock) {
    try {
      const upstreamResult = await callUpstream(requestBody);
      return NextResponse.json(upstreamResult);
    } catch (error) {
      if (error instanceof MCPUpstreamError) {
        console.error('❌ MCP上游错误:', error.message, error.details);
        return buildErrorResponse(error.status, error.code, error.message, id, error.details);
      }

      console.error('❌ MCP代理未知错误:', error);
      return buildErrorResponse(500, 'MCP_PROXY_ERROR', 'Unexpected MCP proxy error', id);
    }
  }

  // 仅在允许mock的开发模式下返回模拟数据
  try {
    const mockResponse = await handleMockMCPCall(method, params);
    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      result: mockResponse
    });
  } catch (error) {
    console.error('❌ MCP mock处理失败:', error);
    return buildErrorResponse(500, 'MCP_MOCK_ERROR', 'Mock MCP handler failed', id);
  }
}

class MCPUpstreamError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function callUpstream(body: any) {
  if (!MCP_UPSTREAM_URL) {
    throw new MCPUpstreamError(503, 'MCP_UPSTREAM_UNAVAILABLE', 'MCP upstream URL is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MCP_REQUEST_TIMEOUT);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (MCP_UPSTREAM_API_KEY) {
      headers['Authorization'] = `Bearer ${MCP_UPSTREAM_API_KEY}`;
    }

    const response = await fetch(MCP_UPSTREAM_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await safeReadText(response);
      throw new MCPUpstreamError(
        response.status === 404 ? 502 : response.status,
        'MCP_UPSTREAM_FAILED',
        `MCP upstream responded with status ${response.status}`,
        text
      );
    }

    const data = await response.json();

    if (!data || typeof data !== 'object') {
      throw new MCPUpstreamError(502, 'MCP_UPSTREAM_INVALID', 'MCP upstream returned invalid JSON');
    }

    return data;
  } catch (error) {
    if (error instanceof MCPUpstreamError) {
      throw error;
    }

    if ((error as Error).name === 'AbortError') {
      throw new MCPUpstreamError(504, 'MCP_UPSTREAM_TIMEOUT', 'MCP upstream request timed out');
    }

    throw new MCPUpstreamError(503, 'MCP_UPSTREAM_UNAVAILABLE', 'Failed to reach MCP upstream', {
      message: error instanceof Error ? error.message : String(error)
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildErrorResponse(status: number, code: string, message: string, id: string | number = '1', details?: unknown) {
  return NextResponse.json({
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      details
    }
  }, { status });
}

async function safeReadText(response: Response) {
  try {
    return await response.text();
  } catch {
    return null;
  }
}

// 以下为开发模式下的模拟实现（保留以便本地调试）

async function handleMockMCPCall(method: string, params: any): Promise<any> {
  switch (method) {
    case 'search-museum-objects':
      return handleSearchObjects(params);
    case 'get-museum-object':
      return handleGetObject(params);
    default:
      throw new Error(`Unknown MCP method: ${method}`);
  }
}

async function handleSearchObjects(params: any): Promise<string> {
  const { query, llm_analysis } = params;
  console.log('🔍 [Mock] MCP搜索请求:', { query, llm_analysis });
  await new Promise(resolve => setTimeout(resolve, 300));
  const searchResults = await simulateMCPSearch(query, llm_analysis);
  return `Found ${searchResults.length} objects: ${searchResults.join(', ')}`;
}

async function simulateMCPSearch(query: string, llmAnalysis?: any): Promise<number[]> {
  const queryLower = (query || '').toLowerCase();

  if (queryLower.includes('happiness') || queryLower.includes('joy') || 
      queryLower.includes('积极') || queryLower.includes('快乐') || 
      queryLower.includes('开心') || queryLower.includes('不错')) {
    return [101, 102, 103, 104, 105, 106, 107, 108, 109];
  }
  
  if (queryLower.includes('loneliness') || queryLower.includes('solitude') || 
      queryLower.includes('孤独') || queryLower.includes('寂寞')) {
    return [201, 202, 203, 204, 205, 206, 207, 208, 209];
  }
  
  if (queryLower.includes('peace') || queryLower.includes('calm') || 
      queryLower.includes('平静') || queryLower.includes('宁静')) {
    return [301, 302, 303, 304, 305, 306, 307, 308, 309];
  }
  
  if (queryLower.includes('melancholy') || queryLower.includes('sadness') || 
      queryLower.includes('忧郁') || queryLower.includes('悲伤')) {
    return [401, 402, 403, 404, 405, 406, 407, 408, 409];
  }
  
  if (queryLower.includes('excitement') || queryLower.includes('passion') || 
      queryLower.includes('激动') || queryLower.includes('兴奋')) {
    return [501, 502, 503, 504, 505, 506, 507, 508, 509];
  }
  
  return [1, 2, 3, 4, 5, 6, 7, 8, 9];
}

function getArtworkImageUrl(title: string): string {
  const imageMap: Record<string, string> = {
    '向日葵': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
    '睡莲': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
    '舞蹈': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
    '春': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
    '星夜': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
    '日出': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
    '花园': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
    '节日': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
    '阳光': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
    '呐喊': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
    '孤独的树': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
    '夜巡': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
    '沉思者': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
    '孤独的街道': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
    '月光': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
    '荒原': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
    '孤独的船': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg',
    '夜晚': 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg'
  };
  
  return imageMap[title] || 'https://images.metmuseum.org/CRDImages/ep/original/DT28_DT29.jpg';
}

async function handleGetObject(params: any): Promise<string> {
  const { objectID } = params;
  console.log('📋 [Mock] 获取对象详情:', objectID);
  await new Promise(resolve => setTimeout(resolve, 200));

  const mockDetails = {
    objectID,
    title: `艺术作品 ${objectID}`,
    artistDisplayName: '未知艺术家',
    objectDate: '未知年代',
    medium: '未知材质',
    dimensions: '未知尺寸',
    culture: '未知文化',
    period: '未知时期',
    description: '这是一件优秀的艺术作品',
    primaryImage: getArtworkImageUrl('默认')
  };

  return JSON.stringify(mockDetails);
}
