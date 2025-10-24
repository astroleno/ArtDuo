#!/usr/bin/env node

/**
 * ArtDuo 策展流程完整测试脚本
 * 测试输入: "今天感觉不错,逛了一天街"
 *
 * 此脚本将:
 * 1. 使用 env.local.json 配置
 * 2. 测试完整的策展流程
 * 3. 记录所有输入输出和耗时
 * 4. 生成详细的测试报告
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// 从 env.local.json 读取配置
const ENV_CONFIG_PATH = path.join(__dirname, '..', 'frontend', 'env.local.json');
let envConfig = {};

try {
  const envContent = fs.readFileSync(ENV_CONFIG_PATH, 'utf8');
  envConfig = JSON.parse(envContent);
  console.log('✅ 成功读取 env.local.json 配置');
} catch (error) {
  console.error('❌ 无法读取 env.local.json 配置:', error.message);
  process.exit(1);
}

// 测试配置
const CONFIG = {
  baseUrl: 'http://localhost:3001', // 使用实际运行的端口
  endpoint: '/api/curate/stream',
  timeout: 300000, // 5分钟超时
  testInput: {
    emotion: '今天感觉不错,逛了一天街',
    userInput: ''
  }
};

// 性能追踪器
class PerformanceTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.startTime = null;
    this.events = [];
    this.timings = {};
    this.currentStep = null;
  }

  start() {
    this.startTime = Date.now();
    this.addEvent('test_start', { timestamp: this.startTime });
  }

  startStep(stepName) {
    this.currentStep = stepName;
    const stepStart = Date.now();
    this.addEvent('step_start', { step: stepName, timestamp: stepStart });
    return stepStart;
  }

  endStep(stepName, startTime) {
    const duration = Date.now() - startTime;
    this.timings[stepName] = duration;
    this.addEvent('step_end', { step: stepName, duration, timestamp: Date.now() });
    return duration;
  }

  addEvent(eventType, data = {}) {
    const timestamp = Date.now();
    const elapsed = this.startTime ? timestamp - this.startTime : 0;

    const event = {
      type: eventType,
      timestamp,
      elapsed,
      ...data
    };

    this.events.push(event);
    console.log(`📍 ${eventType}: ${elapsed}ms`, data || '');
    return event;
  }

  getTotalDuration() {
    return this.startTime ? Date.now() - this.startTime : 0;
  }

  getSummary() {
    return {
      totalDuration: this.getTotalDuration(),
      eventCount: this.events.length,
      timings: this.timings,
      events: this.events
    };
  }
}

// SSE 流解析器
class SSEStreamParser {
  constructor() {
    this.buffer = '';
    this.events = [];
    this.debug = true;
  }

  parseChunk(chunk) {
    this.buffer += chunk.toString();
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          this.events.push({
            ...data,
            timestamp: Date.now()
          });

          if (this.debug) {
            console.log(`📨 SSE Event: ${data.type}`, data.payload ? {
              duration: data.payload.durationMs,
              count: data.payload.artworks?.length || data.payload.explanations?.length || 'N/A'
            } : '');
          }
        } catch (error) {
          console.warn('Failed to parse SSE data:', line, error.message);
        }
      }
    }

    return this.events;
  }

  getEvents() {
    return this.events;
  }

  reset() {
    this.buffer = '';
    this.events = [];
  }
}

// HTTP 客户端
class HttpClient {
  constructor(baseUrl = CONFIG.baseUrl) {
    this.baseUrl = baseUrl;
  }

  async request(method, endpoint, data = null, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.baseUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const requestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...options.headers
        },
        timeout: options.timeout || CONFIG.timeout
      };

      console.log(`🚀 发送 ${method} 请求到: ${url.toString()}`);
      if (data) {
        console.log('📤 请求体:', JSON.stringify(data, null, 2));
      }

      const req = httpModule.request(requestOptions, (res) => {
        let response = {
          statusCode: res.statusCode,
          headers: res.headers,
          body: '',
          events: []
        };

        console.log(`📥 收到响应: ${res.statusCode} ${res.statusMessage}`);
        console.log('📥 响应头:', res.headers);

        const parser = new SSEStreamParser();

        res.on('data', (chunk) => {
          if (res.headers['content-type']?.includes('text/event-stream')) {
            const events = parser.parseChunk(chunk);
            response.events.push(...events);
          } else {
            response.body += chunk.toString();
          }
        });

        res.on('end', () => {
          response.events = parser.getEvents();
          console.log(`✅ 响应完成，收到 ${response.events.length} 个事件`);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${response.body}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ 请求错误:', error);
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });

      if (data && method !== 'GET') {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  async post(endpoint, data = {}, options = {}) {
    return this.request('POST', endpoint, data, options);
  }
}

// 结果验证器
class ResultValidator {
  static validateWorkflow(events, testInput) {
    const results = {
      passed: true,
      issues: [],
      scores: {},
      details: {},
      summary: {}
    };

    // 检查必需的事件
    const requiredEvents = ['start', 'emotion_curve', 'artworks_selected', 'introduction', 'conclusion', 'explanations_batch', 'complete'];
    const eventCounts = {};
    events.forEach(event => {
      eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
    });

    requiredEvents.forEach(requiredEvent => {
      if (!eventCounts[requiredEvent]) {
        results.passed = false;
        results.issues.push(`缺少必需事件: ${requiredEvent}`);
      }
    });

    results.details.eventCounts = eventCounts;

    // 验证输入情绪
    const startEvent = events.find(e => e.type === 'start');
    if (!startEvent || !startEvent.payload?.emotion) {
      results.passed = false;
      results.issues.push('开始事件缺少情绪参数');
    } else {
      results.summary.inputEmotion = startEvent.payload.emotion;
      console.log(`🎭 输入情绪: ${startEvent.payload.emotion}`);
    }

    // 验证情绪曲线
    const emotionCurveEvent = events.find(e => e.type === 'emotion_curve');
    if (emotionCurveEvent) {
      const curve = emotionCurveEvent.payload?.curve;
      if (!Array.isArray(curve) || curve.length === 0) {
        results.passed = false;
        results.issues.push('情绪曲线数据无效');
      } else {
        results.summary.emotionCurve = {
          points: curve.length,
          range: [Math.min(...curve), Math.max(...curve)],
          average: curve.reduce((a, b) => a + b, 0) / curve.length,
          duration: emotionCurveEvent.payload.durationMs
        };
        console.log(`📈 情绪曲线: ${curve.length} 个点，范围: ${results.summary.emotionCurve.range[0].toFixed(2)}-${results.summary.emotionCurve.range[1].toFixed(2)}`);
      }
    }

    // 验证作品选择
    const artworkEvent = events.find(e => e.type === 'artworks_selected');
    if (artworkEvent) {
      const artworks = artworkEvent.payload?.artworks;
      if (!Array.isArray(artworks) || artworks.length === 0) {
        results.passed = false;
        results.issues.push('未选择任何作品');
      } else {
        results.summary.artworks = {
          count: artworks.length,
          selectionTime: artworkEvent.payload.durationMs,
          selectionReasoning: artworkEvent.payload.selectionReasoning || '未提供',
          diversityMetrics: artworkEvent.payload.diversityMetrics || {}
        };

        // 显示作品信息
        console.log(`🎨 选择了 ${artworks.length} 件作品:`);
        artworks.forEach((artwork, index) => {
          console.log(`  ${index + 1}. 《${artwork.title}》- ${artwork.artist} (${artwork.year})`);
        });
      }
    }

    // 验证讲解生成
    const explanationEvents = events.filter(e => e.type === 'explanations_batch');
    if (explanationEvents.length > 0) {
      const totalExplanations = explanationEvents.reduce((sum, event) => {
        return sum + (event.payload?.explanations?.length || 0);
      }, 0);

      results.summary.explanations = {
        batchCount: explanationEvents.length,
        totalExplanations,
        batches: explanationEvents.map(event => ({
          batchIndex: event.payload.batchIndex,
          count: event.payload.explanations?.length || 0,
          duration: event.payload.durationMs,
          isFirstBatch: event.payload.isFirstBatch
        }))
      };

      console.log(`📝 生成了 ${totalExplanations} 条讲解，分 ${explanationEvents.length} 批次`);
    } else {
      results.passed = false;
      results.issues.push('未生成任何作品讲解');
    }

    // 验证策展序言和结语
    const introEvent = events.find(e => e.type === 'introduction');
    const conclusionEvent = events.find(e => e.type === 'conclusion');

    if (introEvent) {
      results.summary.introduction = {
        length: introEvent.introduction?.length || 0,
        duration: introEvent.durationMs
      };
      console.log(`📖 策展序言: ${introEvent.introduction?.length || 0} 字符`);
    }

    if (conclusionEvent) {
      results.summary.conclusion = {
        length: conclusionEvent.conclusion?.length || 0,
        duration: conclusionEvent.durationMs
      };
      console.log(`🎯 策展结语: ${conclusionEvent.conclusion?.length || 0} 字符`);
    }

    // 验证完成状态
    const completeEvent = events.find(e => e.type === 'complete');
    if (!completeEvent) {
      results.passed = false;
      results.issues.push('工作流未正常完成');
    } else {
      results.summary.totalDuration = completeEvent.elapsedMs;
    }

    return results;
  }
}

// 主测试类
class CurateWorkflowTest {
  constructor() {
    this.httpClient = new HttpClient();
    this.performanceTracker = new PerformanceTracker();
    this.results = {
      startTime: new Date().toISOString(),
      input: CONFIG.testInput,
      config: CONFIG,
      performance: {},
      validation: {},
      events: [],
      error: null,
      success: false
    };
  }

  async runTest() {
    console.log('🚀 开始 ArtDuo 策展流程完整测试');
    console.log('='.repeat(50));
    console.log(`📥 测试输入: "${CONFIG.testInput.emotion}"`);
    console.log(`🌐 服务地址: ${CONFIG.baseUrl}`);
    console.log(`⏱️  超时时间: ${CONFIG.timeout}ms`);
    console.log('='.repeat(50));

    try {
      this.performanceTracker.start();

      // 发送请求
      const requestStart = this.performanceTracker.startStep('http_request');
      const response = await this.httpClient.post(CONFIG.endpoint, CONFIG.testInput);
      this.performanceTracker.endStep('http_request', requestStart);

      this.results.events = response.events;

      // 分析性能
      const performanceAnalysis = this.analyzePerformance(response.events);
      this.results.performance = performanceAnalysis;

      // 验证结果
      const validation = ResultValidator.validateWorkflow(response.events, CONFIG.testInput);
      this.results.validation = validation;
      this.results.success = validation.passed;

      console.log('\n' + '='.repeat(50));
      console.log('📊 测试结果摘要');
      console.log('='.repeat(50));
      console.log(`✅ 测试状态: ${this.results.success ? '通过' : '失败'}`);
      console.log(`⏱️  总耗时: ${this.performanceTracker.getTotalDuration()}ms`);
      console.log(`📨 事件数量: ${response.events.length}`);

      if (validation.issues.length > 0) {
        console.log('\n❌ 发现的问题:');
        validation.issues.forEach(issue => console.log(`  - ${issue}`));
      }

      return this.results;

    } catch (error) {
      this.results.error = {
        message: error.message,
        stack: error.stack
      };
      this.results.success = false;

      console.error('❌ 测试失败:', error.message);
      throw error;

    } finally {
      this.results.endTime = new Date().toISOString();
      this.results.totalDuration = this.performanceTracker.getTotalDuration();
    }
  }

  analyzePerformance(events) {
    const performance = {
      totalDuration: this.performanceTracker.getTotalDuration(),
      steps: {},
      eventTiming: {},
      summary: {}
    };

    // 从事件中提取时间信息
    events.forEach(event => {
      if (event.payload?.durationMs) {
        switch (event.type) {
          case 'emotion_curve':
            performance.steps.emotionCurve = event.payload.durationMs;
            break;
          case 'artworks_selected':
            performance.steps.artworkSelection = event.payload.durationMs;
            break;
          case 'introduction':
            performance.steps.introduction = event.payload.durationMs;
            break;
          case 'conclusion':
            performance.steps.conclusion = event.payload.durationMs;
            break;
          case 'explanations_batch':
            if (!performance.steps.explanations) {
              performance.steps.explanations = [];
            }
            performance.steps.explanations.push({
              batchIndex: event.payload.batchIndex,
              duration: event.payload.durationMs,
              count: event.payload.explanations?.length || 0,
              isFirstBatch: event.payload.isFirstBatch
            });
            break;
        }
      }

      // 跟踪事件时间
      if (!performance.eventTiming[event.type]) {
        performance.eventTiming[event.type] = [];
      }
      if (events[0]) {
        performance.eventTiming[event.type].push(event.timestamp - events[0].timestamp);
      }
    });

    // 计算总讲解时间
    if (performance.steps.explanations) {
      performance.steps.totalExplanationTime = performance.steps.explanations
        .reduce((sum, exp) => sum + exp.duration, 0);
    }

    // 生成性能摘要
    performance.summary = {
      longestStep: Object.entries(performance.steps).reduce((a, b) =>
        typeof a[1] === 'object' ? a[1].reduce((x, y) => x + y.duration, 0) : a[1] >
        (typeof b[1] === 'object' ? b[1].reduce((x, y) => x + y.duration, 0) : b[1]) ? a : b
      )[0],
      stepCount: Object.keys(performance.steps).length,
      avgEventInterval: events.length > 1 ?
        (events[events.length - 1].timestamp - events[0].timestamp) / (events.length - 1) : 0
    };

    return performance;
  }

  async generateReport() {
    const reportPath = path.join(__dirname, `curate-workflow-test-report-${Date.now()}.json`);

    const reportData = {
      ...this.results,
      generatedAt: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

    // 生成 Markdown 报告
    const markdownPath = path.join(__dirname, `curate-workflow-test-report-${Date.now()}.md`);
    const markdownReport = this.generateMarkdownReport(reportData);
    fs.writeFileSync(markdownPath, markdownReport);

    console.log(`\n📊 报告已生成:`);
    console.log(`  JSON: ${reportPath}`);
    console.log(`  Markdown: ${markdownPath}`);

    return { jsonPath: reportPath, markdownPath };
  }

  generateMarkdownReport(data) {
    const { validation, performance, summary } = data;

    return `# ArtDuo 策展流程测试报告

## 测试信息

- **测试时间**: ${data.startTime}
- **测试输入**: "${data.input.emotion}"
- **服务地址**: ${data.config.baseUrl}
- **测试状态**: ${data.success ? '✅ 通过' : '❌ 失败'}
- **总耗时**: ${data.totalDuration}ms

## 输入输出记录

### 输入数据
\`\`\`json
{
  "emotion": "${data.input.emotion}",
  "userInput": "${data.input.userInput}"
}
\`\`\`

### 输出摘要
${summary ? `
- **选择作品数**: ${summary.artworks?.count || 0}
- **生成讲解数**: ${summary.explanations?.totalExplanations || 0}
- **情绪曲线点数**: ${summary.emotionCurve?.points || 0}
- **序言长度**: ${summary.introduction?.length || 0} 字符
- **结语长度**: ${summary.conclusion?.length || 0} 字符
` : '无输出数据'}

## 性能分析

### 各步骤耗时
${Object.entries(performance.steps || {}).map(([step, timing]) => {
  if (Array.isArray(timing)) {
    return `- **${step}**: ${timing.reduce((sum, t) => sum + t.duration, 0)}ms (${timing.length}批次)`;
  } else {
    return `- **${step}**: ${timing}ms`;
  }
}).join('\n')}

### 性能指标
- **总耗时**: ${performance.totalDuration}ms
- **平均事件间隔**: ${Math.round(performance.summary?.avgEventInterval || 0)}ms
- **最长步骤**: ${performance.summary?.longestStep || 'N/A'}

## 验证结果

${validation ? `
- **验证状态**: ${validation.passed ? '✅ 通过' : '❌ 失败'}
- **发现问题**: ${validation.issues.length} 个

${validation.issues.length > 0 ? '### 问题列表\n' + validation.issues.map(issue => `- ${issue}`).join('\n') : ''}
` : '无验证数据'}

## 详细事件日志

${data.events.map(event => `
- **${event.type}** (${event.elapsed}ms)
  ${event.payload ? `
  - 耗时: ${event.payload.durationMs || 'N/A'}ms
  ${event.payload.artworks ? `- 作品数: ${event.payload.artworks.length}` : ''}
  ${event.payload.explanations ? `- 讲解数: ${event.payload.explanations.length}` : ''}
  ` : ''}
`).join('')}

## 环境信息

- **Node.js 版本**: ${data.environment.nodeVersion}
- **平台**: ${data.environment.platform}
- **架构**: ${data.environment.arch}

---
报告生成时间: ${data.generatedAt}
`;
  }
}

// 主执行函数
async function main() {
  const test = new CurateWorkflowTest();

  try {
    // 运行测试
    await test.runTest();

    // 生成报告
    await test.generateReport();

    console.log('\n🎉 测试完成！');

    // 根据测试结果设置退出码
    process.exit(test.results.success ? 0 : 1);

  } catch (error) {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { CurateWorkflowTest };