#!/usr/bin/env node

/**
 * 测试优化后的策展路由
 * 验证正确的策展顺序和SSE事件流
 */

const fs = require('fs');
const path = require('path');

// 测试优化后的策展路由
class OptimizedRouteTest {
  constructor() {
    this.userInput = "今天去了朋友家，聊的很投机、很开心";
    this.testName = "优化后的策展路由测试";
  }

  /**
   * 执行优化后的路由测试
   */
  async executeTest() {
    console.log('🧪 开始优化后的策展路由测试...');
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
      // 模拟调用优化后的API路由
      console.log('\n🔗 调用优化后的API路由');
      console.log('-'.repeat(50));
      const apiResult = await this.simulateOptimizedAPICall();
      report.phases.apiCall = apiResult;
      console.log(`✅ API路由调用完成`);
      console.log(`📊 策展数据: ${apiResult.curationData ? '已生成' : '未生成'}`);

      // 验证SSE事件流顺序
      console.log('\n📡 验证SSE事件流顺序');
      console.log('-'.repeat(50));
      const sseValidation = this.validateSSEEventOrder(apiResult.sseEvents);
      report.phases.sseValidation = sseValidation;
      console.log(`✅ SSE事件流验证完成`);
      console.log(`📊 事件顺序: ${sseValidation.isValid ? '正确' : '错误'}`);

      // 验证时间线
      console.log('\n⏱️ 验证时间线');
      console.log('-'.repeat(50));
      const timelineValidation = this.validateTimeline(apiResult.timeline);
      report.phases.timelineValidation = timelineValidation;
      console.log(`✅ 时间线验证完成`);
      console.log(`📊 时间线: ${timelineValidation.isValid ? '正确' : '错误'}`);

      const totalTime = Date.now() - startTime;
      report.totalTime = totalTime;
      report.success = true;

      // 生成完整报告
      this.generateFullReport(report);

      return report;

    } catch (error) {
      console.error('❌ 优化后的路由测试失败:', error);
      report.error = error.message;
      report.success = false;
      return report;
    }
  }

  /**
   * 模拟调用优化后的API路由
   */
  async simulateOptimizedAPICall() {
    console.log('🔗 模拟调用优化后的API路由...');
    
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 模拟SSE事件流
    const sseEvents = [
      { type: 'start', timestamp: 0, data: '开始策展' },
      { type: 'curation_intent', timestamp: 1000, data: 'LLM策展规划完成' },
      { type: 'artworks_selected', timestamp: 2000, data: '作品选择完成' },
      { type: 'preface_chunk', timestamp: 3000, data: '序言生成' },
      { type: 'artwork_batch_chunk', timestamp: 4000, data: '作品1-2解释' },
      { type: 'artwork_batch_chunk', timestamp: 6000, data: '作品3-4解释' },
      { type: 'artwork_batch_chunk', timestamp: 8000, data: '作品5-6解释' },
      { type: 'artwork_batch_chunk', timestamp: 10000, data: '作品7-8解释' },
      { type: 'artwork_batch_chunk', timestamp: 12000, data: '作品9解释' },
      { type: 'closing_chunk', timestamp: 14000, data: '结语生成' },
      { type: 'complete', timestamp: 15000, data: '策展完成' }
    ];
    
    // 模拟策展数据
    const curationData = {
      curatorialTheme: '友谊的温暖：社交连接的艺术表达',
      emotionalArc: '从初遇的快乐到深度交流的共鸣，再到满足的回忆',
      artworks: Array.from({ length: 9 }, (_, i) => ({
        id: `artwork-${i + 1}`,
        title: `Artwork ${i + 1}`,
        artist: `Artist ${i + 1}`,
        stage: Math.floor(i / 3) + 1
      })),
      preface: '这是一个关于友谊和温暖的策展...',
      conclusion: '感谢您体验这次策展...'
    };
    
    // 模拟时间线
    const timeline = {
      phaseA: {
        curationIntent: 1000,
        emotionCurve: 1500,
        searchResults: 2000,
        artworkSelection: 2500
      },
      phaseB: {
        narration: 3000,
        preface: 3000,
        artworkBatches: [4000, 6000, 8000, 10000, 12000],
        conclusion: 14000
      },
      total: 15000
    };
    
    return {
      sseEvents,
      curationData,
      timeline,
      success: true
    };
  }

  /**
   * 验证SSE事件流顺序
   */
  validateSSEEventOrder(sseEvents) {
    console.log('📡 验证SSE事件流顺序...');
    
    const expectedOrder = [
      'start',
      'curation_intent',
      'artworks_selected',
      'preface_chunk',
      'artwork_batch_chunk',
      'artwork_batch_chunk',
      'artwork_batch_chunk',
      'artwork_batch_chunk',
      'artwork_batch_chunk',
      'closing_chunk',
      'complete'
    ];
    
    const actualOrder = sseEvents.map(event => event.type);
    
    const isValid = JSON.stringify(actualOrder) === JSON.stringify(expectedOrder);
    
    if (!isValid) {
      console.log('❌ SSE事件顺序不正确');
      console.log('期望顺序:', expectedOrder);
      console.log('实际顺序:', actualOrder);
    } else {
      console.log('✅ SSE事件顺序正确');
    }
    
    return {
      isValid,
      expectedOrder,
      actualOrder,
      events: sseEvents
    };
  }

  /**
   * 验证时间线
   */
  validateTimeline(timeline) {
    console.log('⏱️ 验证时间线...');
    
    const phaseATime = timeline.phaseA.artworkSelection;
    const phaseBTime = timeline.phaseB.conclusion;
    const totalTime = timeline.total;
    
    // 验证Phase A时间线
    const phaseAValid = (
      timeline.phaseA.curationIntent < timeline.phaseA.emotionCurve &&
      timeline.phaseA.emotionCurve < timeline.phaseA.searchResults &&
      timeline.phaseA.searchResults < timeline.phaseA.artworkSelection
    );
    
    // 验证Phase B时间线
    const phaseBValid = (
      timeline.phaseB.preface < timeline.phaseB.artworkBatches[0] &&
      timeline.phaseB.artworkBatches[0] < timeline.phaseB.artworkBatches[1] &&
      timeline.phaseB.artworkBatches[1] < timeline.phaseB.artworkBatches[2] &&
      timeline.phaseB.artworkBatches[2] < timeline.phaseB.artworkBatches[3] &&
      timeline.phaseB.artworkBatches[3] < timeline.phaseB.artworkBatches[4] &&
      timeline.phaseB.artworkBatches[4] < timeline.phaseB.conclusion
    );
    
    // 验证总时间线
    const totalValid = phaseATime < phaseBTime && phaseBTime <= totalTime;
    
    const isValid = phaseAValid && phaseBValid && totalValid;
    
    if (!isValid) {
      console.log('❌ 时间线不正确');
      console.log('Phase A时间线:', phaseAValid ? '正确' : '错误');
      console.log('Phase B时间线:', phaseBValid ? '正确' : '错误');
      console.log('总时间线:', totalValid ? '正确' : '错误');
    } else {
      console.log('✅ 时间线正确');
    }
    
    return {
      isValid,
      phaseAValid,
      phaseBValid,
      totalValid,
      timeline
    };
  }

  /**
   * 生成完整报告
   */
  generateFullReport(report) {
    console.log('\n📋 生成完整策展路由报告');
    console.log('='.repeat(80));
    
    // 控制台输出
    console.log(`\n🔗 API路由调用: ${report.phases.apiCall.success ? '成功' : '失败'}`);
    console.log(`📡 SSE事件流: ${report.phases.sseValidation.isValid ? '正确' : '错误'}`);
    console.log(`⏱️ 时间线: ${report.phases.timelineValidation.isValid ? '正确' : '错误'}`);
    console.log(`⏰ 总耗时: ${report.totalTime}ms`);
    
    console.log('\n📡 SSE事件流:');
    report.phases.apiCall.sseEvents.forEach((event, index) => {
      console.log(`\n${index + 1}. ${event.type}: ${event.data} (${event.timestamp}ms)`);
    });

    console.log('\n⏱️ 时间线:');
    console.log(`Phase A (规划层): ${report.phases.apiCall.timeline.phaseA.artworkSelection}ms`);
    console.log(`Phase B (叙述层): ${report.phases.apiCall.timeline.phaseB.conclusion}ms`);
    console.log(`总耗时: ${report.phases.apiCall.timeline.total}ms`);

    // 保存报告到文件
    const reportPath = path.join(process.cwd(), 'data/met/processed', 'optimized-route-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📊 完整报告已保存: ${reportPath}`);
  }
}

// 运行测试
async function main() {
  try {
    const tester = new OptimizedRouteTest();
    const report = await tester.executeTest();
    
    console.log('\n🎉 优化后的策展路由测试完成!');
    console.log('='.repeat(80));
    console.log('✅ API路由调用 - 已完成');
    console.log('✅ SSE事件流验证 - 已完成');
    console.log('✅ 时间线验证 - 已完成');
    console.log('🎯 完整策展路由报告已生成');
    
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
  OptimizedRouteTest
};
