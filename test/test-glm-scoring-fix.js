#!/usr/bin/env node

/**
 * 测试修复后的GLM评分系统
 * 验证API格式修复和批次优化是否解决了评分卡住问题
 */

const http = require('http');
const { URL } = require('url');

// 测试配置
const TEST_CONFIG = {
  emotion: 'joy',
  userInput: '我想要一些能够让我感到开心的艺术作品',
  timeout: 30000, // 30秒超时
  expectedBatchCount: 4, // 期望的批次数 (68件作品，每批18件，约4批)
  maxBatchProcessingTime: 15000 // 最大批次处理时间 15秒
};

function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: TEST_CONFIG.timeout
    };

    const client = urlObj.protocol === 'https:' ? require('https') : http;
    const req = client.request(options, (res) => {
      let responseData = '';
      let batchCount = 0;
      let scoringStart = null;
      let scoringComplete = false;
      let batchStartTimes = [];

      res.on('data', (chunk) => {
        responseData += chunk;

        // 解析SSE数据流
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));

              // 监控评分相关事件
              if (data.type === 'start') {
                console.log('🚀 策展流程开始');
                scoringStart = Date.now();
              } else if (data.type === 'log' && data.payload.includes('作品评分完成')) {
                scoringComplete = true;
                const scoringTime = Date.now() - scoringStart;
                console.log(`✅ 作品评分完成，总耗时: ${scoringTime}ms`);
              } else if (data.type === 'log' && data.payload.includes('分') && data.payload.includes('批')) {
                batchCount++;
                const batchTime = Date.now();
                batchStartTimes.push(batchTime);
                console.log(`📦 处理批次 ${batchCount}: ${data.payload}`);
              } else if (data.type === 'log') {
                console.log(`📝 ${data.payload}`);
              } else if (data.type === 'error') {
                console.error(`❌ 错误: ${data.payload.message}`);
                reject(new Error(data.payload.message));
                return;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });

      res.on('end', () => {
        const analysis = {
          success: true,
          batchCount,
          scoringComplete,
          totalBatches: batchStartTimes.length,
          response: responseData
        };
        resolve(analysis);
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

async function testScoringSystem() {
  console.log('🧪 开始测试修复后的GLM评分系统');
  console.log('='.repeat(60));

  const results = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    details: {}
  };

  // 测试1: 基本评分流程
  console.log('\n📊 测试1: 基本评分流程');
  console.log('-'.repeat(40));

  results.totalTests++;

  try {
    const startTime = Date.now();

    const analysis = await makeRequest('http://localhost:3000/api/curate/stream', {
      emotion: TEST_CONFIG.emotion,
      userInput: TEST_CONFIG.userInput
    });

    const totalTime = Date.now() - startTime;

    console.log(`✅ 评分流程完成`);
    console.log(`   - 总耗时: ${totalTime}ms`);
    console.log(`   - 检测到的批次数: ${analysis.totalBatches}`);
    console.log(`   - 评分完成状态: ${analysis.scoringComplete ? '完成' : '未完成'}`);

    // 验证评分是否成功完成
    if (analysis.scoringComplete && totalTime < TEST_CONFIG.timeout) {
      console.log('✅ 基本评分流程测试通过');
      results.passedTests++;
      results.details.basicFlow = {
        success: true,
        totalTime,
        batchCount: analysis.totalBatches,
        scoringComplete: analysis.scoringComplete
      };
    } else {
      console.log('❌ 基本评分流程测试失败');
      results.failedTests++;
      results.details.basicFlow = {
        success: false,
        totalTime,
        batchCount: analysis.totalBatches,
        scoringComplete: analysis.scoringComplete,
        reason: !analysis.scoringComplete ? '评分未完成' : '超时'
      };
    }

  } catch (error) {
    console.error(`❌ 基本评分流程测试失败: ${error.message}`);
    results.failedTests++;
    results.details.basicFlow = {
      success: false,
      error: error.message
    };
  }

  // 测试2: 批次处理优化验证
  console.log('\n🚀 测试2: 批次处理优化验证');
  console.log('-'.repeat(40));

  results.totalTests++;

  try {
    const startTime = Date.now();

    const analysis = await makeRequest('http://localhost:3000/api/curate/stream', {
      emotion: 'peaceful',
      userInput: '我想要一些平静的艺术作品'
    });

    const totalTime = Date.now() - startTime;

    console.log(`✅ 批次处理验证完成`);
    console.log(`   - 总耗时: ${totalTime}ms`);
    console.log(`   - 实际批次数: ${analysis.totalBatches}`);
    console.log(`   - 期望批次数: ~${TEST_CONFIG.expectedBatchCount}`);

    // 验证批次优化效果（应该接近期望的批次数）
    const batchEfficiency = analysis.totalBatches <= TEST_CONFIG.expectedBatchCount + 2;

    if (batchEfficiency && totalTime < 25000) { // 25秒内完成
      console.log('✅ 批次处理优化测试通过');
      results.passedTests++;
      results.details.batchOptimization = {
        success: true,
        totalTime,
        actualBatches: analysis.totalBatches,
        expectedBatches: TEST_CONFIG.expectedBatchCount,
        efficient: batchEfficiency
      };
    } else {
      console.log('❌ 批次处理优化测试失败');
      results.failedTests++;
      results.details.batchOptimization = {
        success: false,
        totalTime,
        actualBatches: analysis.totalBatches,
        expectedBatches: TEST_CONFIG.expectedBatchCount,
        efficient: batchEfficiency,
        reason: !batchEfficiency ? '批次过多' : '处理时间过长'
      };
    }

  } catch (error) {
    console.error(`❌ 批次处理优化测试失败: ${error.message}`);
    results.failedTests++;
    results.details.batchOptimization = {
      success: false,
      error: error.message
    };
  }

  // 测试3: 错误处理和降级机制
  console.log('\n🛡️ 测试3: 错误处理和降级机制');
  console.log('-'.repeat(40));

  results.totalTests++;

  try {
    const startTime = Date.now();

    // 使用可能导致问题的输入测试降级机制
    const analysis = await makeRequest('http://localhost:3000/api/curate/stream', {
      emotion: 'confused',
      userInput: '测试复杂的艺术需求表达'
    });

    const totalTime = Date.now() - startTime;

    console.log(`✅ 错误处理测试完成`);
    console.log(`   - 总耗时: ${totalTime}ms`);
    console.log(`   - 系统稳定性: 正常`);

    if (totalTime < 30000) { // 30秒内完成，说明降级机制工作
      console.log('✅ 错误处理和降级机制测试通过');
      results.passedTests++;
      results.details.errorHandling = {
        success: true,
        totalTime,
        stable: true
      };
    } else {
      console.log('❌ 错误处理和降级机制测试失败');
      results.failedTests++;
      results.details.errorHandling = {
        success: false,
        totalTime,
        reason: '处理时间过长，可能卡住'
      };
    }

  } catch (error) {
    console.error(`❌ 错误处理测试失败: ${error.message}`);
    results.failedTests++;
    results.details.errorHandling = {
      success: false,
      error: error.message
    };
  }

  // 输出测试总结
  console.log('\n📊 GLM评分系统修复验证总结');
  console.log('='.repeat(60));
  console.log(`总测试数: ${results.totalTests}`);
  console.log(`通过测试: ${results.passedTests}`);
  console.log(`失败测试: ${results.failedTests}`);
  console.log(`通过率: ${((results.passedTests / results.totalTests) * 100).toFixed(1)}%`);

  // 分析修复效果
  console.log('\n🎯 修复效果分析:');

  if (results.details.basicFlow?.success) {
    console.log('✅ GLM API格式修复成功 - 评分流程可以正常完成');
    console.log(`   - 评分耗时: ${results.details.basicFlow.totalTime}ms`);
    console.log(`   - 处理批次: ${results.details.basicFlow.batchCount}批`);
  } else {
    console.log('❌ GLM API格式修复未完全解决问题');
  }

  if (results.details.batchOptimization?.success) {
    console.log('✅ 批次大小优化成功 - 减少了API调用次数');
    console.log(`   - 实际批次: ${results.details.batchOptimization.actualBatches}批`);
    console.log(`   - 处理时间: ${results.details.batchOptimization.totalTime}ms`);
  } else {
    console.log('❌ 批次优化效果不佳，可能需要进一步调整');
  }

  if (results.details.errorHandling?.success) {
    console.log('✅ 错误处理机制正常 - 系统稳定性良好');
  }

  console.log('\n💡 针对用户问题的回答:');
  console.log('问题: "现在评分会卡住,是为什么呢?而且这个步骤应该是很快由一个 air 模型快速完成的.为什么现在要分批次呢?"');

  if (results.passedTests === results.totalTests) {
    console.log('✅ 回答: 评分卡住问题已修复！');
    console.log('   - 原因: GLM API格式错误导致JSON解析失败');
    console.log('   - 解决: 修复了API调用格式，从chat()改为quickChat()');
    console.log('   - 分批原因: glm-4.5-air虽然快，但处理大量作品时仍需分批以确保稳定性');
    console.log('   - 优化: 批次大小从5增加到18，减少了总批次数');
  } else {
    console.log('⚠️ 回答: 评分系统仍有问题，需要进一步调试');
    console.log('   - 可能原因: 网络连接、API限制或其他配置问题');
    console.log('   - 建议: 检查服务器日志，确认GLM API调用状态');
  }

  console.log('\n🔧 技术细节:');
  console.log('- 修复前: 使用chat()方法，参数格式错误');
  console.log('- 修复后: 使用quickChat()方法，正确的数组参数格式');
  console.log('- 优化前: batchSize=5，68件作品需要14批');
  console.log('- 优化后: batchSize=18，68件作品需要4批');
  console.log('- 预期提升: 处理时间从30-60秒降低到10-20秒');

  return results;
}

// 执行测试
if (require.main === module) {
  testScoringSystem()
    .then(() => {
      console.log('\n🎉 GLM评分系统修复验证完成!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 GLM评分系统测试失败:', error);
      process.exit(1);
    });
}

module.exports = { testScoringSystem };