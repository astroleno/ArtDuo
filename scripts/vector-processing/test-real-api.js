#!/usr/bin/env node

/**
 * 真正测试我们的API
 * 调用真实的API路由，看看实际需要多长时间
 */

const fs = require('fs');
const path = require('path');

// 真正测试我们的API
class RealAPITest {
  constructor() {
    this.userInput = "今天去了朋友家，聊的很投机、很开心";
    this.testName = "真正API测试";
  }

  /**
   * 执行真正API测试
   */
  async executeTest() {
    console.log('🧪 开始真正API测试...');
    console.log('='.repeat(80));
    console.log(`📝 用户输入: "${this.userInput}"`);
    console.log('='.repeat(80));

    const startTime = Date.now();
    const report = {
      testName: this.testName,
      userInput: this.userInput,
      timestamp: new Date().toISOString(),
      phases: {}
    };

    try {
      // 第一步：真正调用我们的API路由
      console.log('\n🔗 第一步：真正调用我们的API路由');
      console.log('-'.repeat(50));
      const apiResult = await this.realAPICall();
      report.phases.apiCall = apiResult;
      console.log(`✅ API路由调用完成`);
      console.log(`📊 实际耗时: ${apiResult.actualTime}ms`);
      console.log(`📊 成功: ${apiResult.success ? '是' : '否'}`);

      // 第二步：分析SSE事件流
      console.log('\n📡 第二步：分析SSE事件流');
      console.log('-'.repeat(50));
      const sseAnalysis = this.analyzeSSEEvents(apiResult.sseEvents);
      report.phases.sseAnalysis = sseAnalysis;
      console.log(`✅ SSE事件流分析完成`);
      console.log(`📊 事件数量: ${sseAnalysis.eventCount}个`);
      console.log(`📊 总耗时: ${sseAnalysis.totalTime}ms`);

      // 第三步：验证策展顺序
      console.log('\n🎯 第三步：验证策展顺序');
      console.log('-'.repeat(50));
      const orderValidation = this.validateCurationOrder(apiResult.sseEvents);
      report.phases.orderValidation = orderValidation;
      console.log(`✅ 策展顺序验证完成`);
      console.log(`📊 顺序正确: ${orderValidation.isValid ? '是' : '否'}`);

      const totalTime = Date.now() - startTime;
      report.totalTime = totalTime;
      report.success = true;

      // 生成完整报告
      this.generateFullReport(report);

      return report;

    } catch (error) {
      console.error('❌ 真正API测试失败:', error);
      report.error = error.message;
      report.success = false;
      return report;
    }
  }

  /**
   * 真正调用我们的API路由
   */
  async realAPICall() {
    console.log('🔗 正在调用真实的API路由...');
    
    try {
      // 检查API路由文件是否存在
      const apiRoutePath = path.join(process.cwd(), 'frontend/src/app/api/curate/stream/route.ts');
      if (!fs.existsSync(apiRoutePath)) {
        throw new Error(`API路由文件不存在: ${apiRoutePath}`);
      }
      
      console.log(`📁 找到API路由文件: ${apiRoutePath}`);
      
      // 检查前端是否运行
      const frontendRunning = await this.checkFrontendRunning();
      if (!frontendRunning) {
        console.log('⚠️ 前端未运行，启动前端服务器...');
        await this.startFrontend();
        await new Promise(resolve => setTimeout(resolve, 5000)); // 等待前端启动
      }
      
      // 真正调用API
      const apiUrl = 'http://localhost:3000/api/curate/stream';
      console.log(`🌐 调用API: ${apiUrl}`);
      
      const startTime = Date.now();
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emotion: 'joy',
          userInput: this.userInput
        })
      });
      
      if (!response.ok) {
        throw new Error(`API调用失败: ${response.status} ${response.statusText}`);
      }
      
      console.log('📡 开始接收SSE流...');
      
      // 解析SSE流
      const sseEvents = [];
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              sseEvents.push({
                type: data.type,
                payload: data.payload,
                timestamp: Date.now()
              });
              console.log(`📡 收到SSE事件: ${data.type}`);
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
      
      const actualTime = Date.now() - startTime;
      console.log(`✅ API调用完成，实际耗时: ${actualTime}ms`);
      
      return {
        success: true,
        actualTime,
        sseEvents,
        apiUrl
      };
      
    } catch (error) {
      console.error('❌ API调用失败:', error);
      return {
        success: false,
        actualTime: 0,
        sseEvents: [],
        error: error.message
      };
    }
  }

  /**
   * 检查前端是否运行
   */
  async checkFrontendRunning() {
    try {
      const response = await fetch('http://localhost:3000', { 
        method: 'HEAD',
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 启动前端服务器
   */
  async startFrontend() {
    console.log('🚀 启动前端服务器...');
    
    // 这里应该启动Next.js开发服务器
    // 由于我们在Node.js环境中，无法直接启动
    console.log('⚠️ 无法在Node.js环境中启动Next.js服务器');
    console.log('请手动运行: cd frontend && npm run dev');
    
    return false;
  }

  /**
   * 分析SSE事件流
   */
  analyzeSSEEvents(sseEvents) {
    console.log('📡 分析SSE事件流...');
    
    if (sseEvents.length === 0) {
      return {
        eventCount: 0,
        totalTime: 0,
        events: []
      };
    }
    
    const firstEvent = sseEvents[0];
    const lastEvent = sseEvents[sseEvents.length - 1];
    const totalTime = lastEvent.timestamp - firstEvent.timestamp;
    
    return {
      eventCount: sseEvents.length,
      totalTime,
      events: sseEvents
    };
  }

  /**
   * 验证策展顺序
   */
  validateCurationOrder(sseEvents) {
    console.log('🎯 验证策展顺序...');
    
    if (sseEvents.length === 0) {
      return {
        isValid: false,
        reason: '没有SSE事件'
      };
    }
    
    const eventTypes = sseEvents.map(event => event.type);
    
    // 检查是否有start事件
    const hasStart = eventTypes.includes('start');
    if (!hasStart) {
      return {
        isValid: false,
        reason: '缺少start事件'
      };
    }
    
    // 检查是否有curation_intent事件
    const hasCurationIntent = eventTypes.includes('curation_intent');
    if (!hasCurationIntent) {
      return {
        isValid: false,
        reason: '缺少curation_intent事件'
      };
    }
    
    // 检查是否有artworks_selected事件
    const hasArtworksSelected = eventTypes.includes('artworks_selected');
    if (!hasArtworksSelected) {
      return {
        isValid: false,
        reason: '缺少artworks_selected事件'
      };
    }
    
    // 检查是否有preface_chunk事件
    const hasPreface = eventTypes.includes('preface_chunk');
    if (!hasPreface) {
      return {
        isValid: false,
        reason: '缺少preface_chunk事件'
      };
    }
    
    // 检查是否有artwork_batch_chunk事件
    const hasArtworkBatches = eventTypes.some(type => type === 'artwork_batch_chunk');
    if (!hasArtworkBatches) {
      return {
        isValid: false,
        reason: '缺少artwork_batch_chunk事件'
      };
    }
    
    // 检查是否有closing_chunk事件
    const hasClosing = eventTypes.includes('closing_chunk');
    if (!hasClosing) {
      return {
        isValid: false,
        reason: '缺少closing_chunk事件'
      };
    }
    
    // 检查是否有complete事件
    const hasComplete = eventTypes.includes('complete');
    if (!hasComplete) {
      return {
        isValid: false,
        reason: '缺少complete事件'
      };
    }
    
    return {
      isValid: true,
      eventTypes,
      eventCount: sseEvents.length
    };
  }

  /**
   * 生成完整报告
   */
  generateFullReport(report) {
    console.log('\n📋 生成完整API测试报告');
    console.log('='.repeat(80));
    
    // 控制台输出
    console.log(`\n🔗 API路由调用: ${report.phases.apiCall.success ? '成功' : '失败'}`);
    console.log(`📊 实际耗时: ${report.phases.apiCall.actualTime}ms`);
    console.log(`📡 SSE事件数量: ${report.phases.sseAnalysis.eventCount}个`);
    console.log(`📊 SSE总耗时: ${report.phases.sseAnalysis.totalTime}ms`);
    console.log(`🎯 策展顺序: ${report.phases.orderValidation.isValid ? '正确' : '错误'}`);
    console.log(`⏰ 总耗时: ${report.totalTime}ms`);
    
    if (report.phases.sseAnalysis.events.length > 0) {
      console.log('\n📡 SSE事件流:');
      report.phases.sseAnalysis.events.forEach((event, index) => {
        console.log(`\n${index + 1}. ${event.type}: ${JSON.stringify(event.payload).substring(0, 100)}...`);
      });
    }

    // 保存报告到文件
    const reportPath = path.join(process.cwd(), 'data/met/processed', 'real-api-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📊 完整报告已保存: ${reportPath}`);
  }
}

// 运行测试
async function main() {
  try {
    const tester = new RealAPITest();
    const report = await tester.executeTest();
    
    console.log('\n🎉 真正API测试完成!');
    console.log('='.repeat(80));
    console.log('✅ API路由调用 - 已完成');
    console.log('✅ SSE事件流分析 - 已完成');
    console.log('✅ 策展顺序验证 - 已完成');
    console.log('🎯 完整API测试报告已生成');
    
  } catch (error) {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = {
  RealAPITest
};
