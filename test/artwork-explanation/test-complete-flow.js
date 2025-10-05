// 完整的端到端流程测试 - 获取所有讲解和详细时间分析
console.log('🚀 开始完整流程测试 - 获取所有讲解');
console.log('📋 测试目标：验证从用户输入到所有讲解生成的完整流程\n');

const https = require('https');
const http = require('http');

// 真实的用户情绪表达
const testScenario = {
  name: '深夜加班后的孤独与疲惫',
  emotion: 'exhausted',
  userInput: '今天加班到很晚，感觉整个人都被掏空了，地铁上看着窗外灯火突然觉得很孤独',
  description: '测试都市人群的深夜孤独情绪处理'
};

class CompleteFlowTester {
  constructor() {
    this.metrics = {
      startTime: null,
      endTime: null,
      totalTime: 0,
      phases: {},
      explanations: [],
      batches: [],
      imagesPreloaded: [],
      errors: []
    };
  }

  startTimer() {
    return process.hrtime.bigint();
  }

  endTimer(startTime) {
    return Number(process.hrtime.bigint() - startTime) / 1000000;
  }

  // 测试完整的流式策展流程
  async testCompleteStreamingFlow() {
    console.log(`\n🎭 ========== ${testScenario.name} ==========`);
    console.log(`💭 用户表达: "${testScenario.userInput}"`);
    console.log(`🎯 检测情绪: ${testScenario.emotion}`);
    console.log(`📡 使用流式API: /api/curate/stream\n`);

    this.metrics.startTime = Date.now();
    const flowStartTime = this.startTimer();

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        emotion: testScenario.emotion,
        userInput: testScenario.userInput
      });

      const options = {
        hostname: 'localhost',
        port: 3002,
        path: '/api/curate/stream',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      console.log(`📡 发送流式请求...`);
      const phaseStarts = {};

      const req = http.request(options, (response) => {
        let buffer = '';

        response.on('data', (chunk) => {
          buffer += chunk;

          // 处理SSE数据
          const lines = buffer.split('\n');
          buffer = lines.pop(); // 保留未完成的行

          lines.forEach(line => {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                this.handleStreamEvent(data, phaseStarts);
              } catch (error) {
                console.log(`⚠️ 解析SSE数据失败:`, error.message);
              }
            }
          });
        });

        response.on('end', () => {
          const totalDuration = this.endTimer(flowStartTime);
          this.metrics.totalTime = totalDuration;
          this.metrics.endTime = Date.now();

          console.log(`\n🎯 流程完成总结:`);
          console.log(`   ⏱️  总耗时: ${totalDuration.toFixed(2)}ms (${(totalDuration/1000).toFixed(1)}秒)`);

          this.generateDetailedReport();
          resolve(this.metrics);
        });
      });

      req.on('error', (error) => {
        console.error(`❌ 流式请求失败:`, error.message);
        this.metrics.errors.push(error.message);
        reject(error);
      });

      req.setTimeout(120000, () => {
        req.destroy();
        reject(new Error('请求超时'));
      });

      req.write(postData);
      req.end();
    });
  }

  // 处理流式事件
  handleStreamEvent(data, phaseStarts) {
    const timestamp = Date.now();

    switch (data.type) {
      case 'start':
        console.log(`🚀 流程开始: ${data.payload.emotion}`);
        phaseStarts.flow = timestamp;
        break;

      case 'emotion_curve':
        const curveTime = timestamp - (phaseStarts.searchPlan || timestamp);
        console.log(`📈 情绪曲线生成完成 (${curveTime}ms)`);
        this.metrics.phases.emotionCurve = { duration: curveTime, timestamp };
        break;

      case 'artworks_selected':
        const selectionTime = timestamp - (phaseStarts.scoring || timestamp);
        console.log(`🎨 作品选择完成: ${data.payload.count}件作品 (${selectionTime}ms)`);
        this.metrics.phases.artworkSelection = { duration: selectionTime, timestamp, count: data.payload.count };
        break;

      case 'introduction':
        const introTime = timestamp - (phaseStarts.selection || timestamp);
        console.log(`📝 策展序言完成 (${introTime}ms)`);
        this.metrics.phases.introduction = { duration: introTime, timestamp };
        break;

      case 'conclusion':
        const conclusionTime = timestamp - (phaseStarts.introduction || timestamp);
        console.log(`🎭 策展结语完成 (${conclusionTime}ms)`);
        this.metrics.phases.conclusion = { duration: conclusionTime, timestamp };
        break;

      case 'explanations_batch':
        this.handleExplanationBatch(data, timestamp, phaseStarts);
        break;

      case 'image_preload_progress':
        this.handleImagePreload(data, timestamp);
        break;

      case 'image_preload_complete':
        console.log(`🖼️ 图片预加载完成: ${data.payload.successful}/${data.payload.total}`);
        this.metrics.phases.imagePreload = {
          duration: timestamp - (phaseStarts.selection || timestamp),
          timestamp,
          ...data.payload
        };
        break;

      case 'complete':
        const completeTime = timestamp - phaseStarts.flow;
        console.log(`🎉 流程全部完成 (${completeTime}ms)`);
        break;

      case 'error':
        console.error(`❌ 流程错误: ${data.payload.message}`);
        this.metrics.errors.push(data.payload);
        break;

      default:
        console.log(`📄 其他事件: ${data.type}`);
    }
  }

  // 处理讲解批次
  handleExplanationBatch(data, timestamp, phaseStarts) {
    const { batchIndex, batchSize, explanations, successCount, failureCount, durationMs, isFirstBatch } = data.payload;

    const batchInfo = {
      batchIndex,
      batchSize,
      successCount,
      failureCount,
      duration: durationMs,
      timestamp,
      isFirstBatch,
      explanations: explanations.map(exp => ({
        artworkId: exp.artworkId,
        title: exp.title,
        artist: exp.artist,
        hasExplanation: !!(exp.explanation?.introduction && exp.explanation?.introduction.length > 20),
        introLength: exp.explanation?.introduction?.length || 0,
        detailLength: exp.explanation?.artisticAnalysis?.length || 0,
        confidence: exp.confidence
      }))
    };

    this.metrics.batches.push(batchInfo);
    this.metrics.explanations.push(...batchInfo.explanations);

    const status = isFirstBatch ? '首批' : `第${batchIndex}批`;
    console.log(`📚 ${status}讲解完成: ${successCount}/${batchSize}件 (${durationMs}ms)`);

    if (isFirstBatch) {
      this.metrics.phases.firstExplanation = { duration: durationMs, timestamp };
    }

    // 显示讲解样例
    if (explanations.length > 0) {
      const sample = explanations[0];
      const preview = sample.explanation?.introduction?.substring(0, 60) || '';
      console.log(`   📖 样例: "${preview}..."`);
    }
  }

  // 处理图片预加载
  handleImagePreload(data, timestamp) {
    const { artworkId, artworkIndex, status, title } = data.payload;

    this.metrics.imagesPreloaded.push({
      artworkId,
      artworkIndex,
      title,
      status,
      timestamp
    });

    if (status === 'loaded') {
      console.log(`   🖼️ 图片预加载: ${title} (第${artworkIndex + 1}件)`);
    }
  }

  // 生成详细报告
  generateDetailedReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📈 完整流程详细报告');
    console.log('='.repeat(80));

    // 基本统计
    console.log('\n🎯 基本统计:');
    console.log(`   测试场景: ${testScenario.name}`);
    console.log(`   用户情绪: ${testScenario.emotion}`);
    console.log(`   总耗时: ${this.metrics.totalTime.toFixed(2)}ms (${(this.metrics.totalTime/1000).toFixed(1)}秒)`);
    console.log(`   开始时间: ${new Date(this.metrics.startTime).toLocaleTimeString()}`);
    console.log(`   结束时间: ${new Date(this.metrics.endTime).toLocaleTimeString()}`);

    // 阶段时间分析
    console.log('\n⏱️ 阶段时间分析:');
    Object.entries(this.metrics.phases).forEach(([phase, info]) => {
      if (info.duration) {
        console.log(`   ${phase}: ${info.duration.toFixed(2)}ms`);
      }
    });

    // 讲解生成分析
    console.log('\n📚 讲解生成分析:');
    const totalBatches = this.metrics.batches.length;
    const totalExplanations = this.metrics.explanations.length;
    const successfulExplanations = this.metrics.explanations.filter(exp => exp.hasExplanation).length;
    const avgConfidence = this.metrics.explanations.reduce((sum, exp) => sum + exp.confidence, 0) / this.metrics.explanations.length;

    console.log(`   总批次数: ${totalBatches}`);
    console.log(`   总讲解数: ${totalExplanations}`);
    console.log(`   成功讲解: ${successfulExplanations}`);
    console.log(`   成功率: ${(successfulExplanations / totalExplanations * 100).toFixed(1)}%`);
    console.log(`   平均置信度: ${(avgConfidence * 100).toFixed(1)}%`);

    // 分批次详情
    console.log('\n📋 分批次详情:');
    this.metrics.batches.forEach(batch => {
      const status = batch.isFirstBatch ? '首批' : `第${batch.batchIndex}批`;
      console.log(`   ${status}:`);
      console.log(`     作品数: ${batch.batchSize}`);
      console.log(`     成功: ${batch.successCount}, 失败: ${batch.failureCount}`);
      console.log(`     耗时: ${batch.duration.toFixed(2)}ms`);

      // 显示该批次的作品
      batch.explanations.forEach((exp, idx) => {
        const status = exp.hasExplanation ? '✅' : '❌';
        console.log(`       ${idx + 1}. ${status} ${exp.title} (${(exp.confidence * 100).toFixed(1)}%)`);
        if (exp.hasExplanation) {
          console.log(`          简介: ${exp.introLength}字符, 详情: ${exp.detailLength}字符`);
        }
      });
    });

    // 图片预加载分析
    console.log('\n🖼️ 图片预加载分析:');
    const totalImages = this.metrics.imagesPreloaded.length;
    const successfulImages = this.metrics.imagesPreloaded.filter(img => img.status === 'loaded').length;

    console.log(`   总图片数: ${totalImages}`);
    console.log(`   预加载成功: ${successfulImages}`);
    console.log(`   预加载成功率: ${(successfulImages / totalImages * 100).toFixed(1)}%`);

    // 时间分布图
    console.log('\n📊 时间分布:');
    const phases = [
      { name: '搜索计划构建', key: 'searchPlan' },
      { name: '作品搜索', key: 'artworkSearch' },
      { name: 'LLM评分', key: 'scoring' },
      { name: '情绪曲线', key: 'emotionCurve' },
      { name: '作品选择', key: 'artworkSelection' },
      { name: '首批讲解', key: 'firstExplanation' },
      { name: '策展序言', key: 'introduction' },
      { name: '策展结语', key: 'conclusion' }
    ];

    phases.forEach(phase => {
      const info = this.metrics.phases[phase.key];
      if (info) {
        const percentage = (info.duration / this.metrics.totalTime * 100).toFixed(1);
        console.log(`   ${phase.name}: ${info.duration.toFixed(2)}ms (${percentage}%)`);
      }
    });

    // 错误统计
    if (this.metrics.errors.length > 0) {
      console.log('\n⚠️ 错误统计:');
      this.metrics.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.message || error}`);
      });
    }

    // 质量评估
    console.log('\n🏆 质量评估:');
    const avgIntroLength = this.metrics.explanations.reduce((sum, exp) => sum + exp.introLength, 0) / this.metrics.explanations.length;
    const avgDetailLength = this.metrics.explanations.reduce((sum, exp) => sum + exp.detailLength, 0) / this.metrics.explanations.length;

    console.log(`   平均讲解长度: ${avgIntroLength.toFixed(0)}字符 (简介) + ${avgDetailLength.toFixed(0)}字符 (详情)`);
    console.log(`   讲解完整性: ${successfulExplanations === totalExplanations ? '✅ 完整' : '⚠️ 部分缺失'}`);
    console.log(`   流程稳定性: ${this.metrics.errors.length === 0 ? '✅ 无错误' : '❌ 有错误'}`);

    console.log('\n🎉 完整流程测试完成！');
  }
}

// 主测试函数
async function runCompleteFlowTest() {
  const tester = new CompleteFlowTester();

  try {
    await tester.testCompleteStreamingFlow();
    return tester.metrics;
  } catch (error) {
    console.error('❌ 完整流程测试失败:', error.message);
    throw error;
  }
}

// 运行测试
if (require.main === module) {
  runCompleteFlowTest().catch(console.error);
}

module.exports = { runCompleteFlowTest, CompleteFlowTester };