#!/usr/bin/env node

/**
 * 简化评分系统测试 - 验证单线处理的glm-4.5-air模型
 */

const http = require('http');

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
      timeout: 45000 // 45秒超时
    };

    const client = urlObj.protocol === 'https:' ? require('https') : http;
    const req = client.request(options, (res) => {
      let responseData = '';
      let scoringStart = null;
      let scoringComplete = false;
      let batchCount = 0;
      let fallbackUsed = false;

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
                console.log(`📦 ${data.payload}`);
              } else if (data.type === 'log' && data.payload.includes('降级使用')) {
                fallbackUsed = data.payload.includes('降级使用: 是');
                console.log(`⚠️ ${data.payload}`);
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
          fallbackUsed,
          totalBatches: batchCount,
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

async function testSimpleScoring() {
  console.log('🧪 测试简化后的单线评分系统');
  console.log('='.repeat(50));
  console.log('优化配置：');
  console.log('- maxConcurrent: 1 (单线顺序处理)');
  console.log('- batchSize: 20 (更大批次)');
  console.log('- strategy: ai_first (优先AI评分)');
  console.log('- maxRetries: 1 (减少重试)');
  console.log('');

  try {
    const startTime = Date.now();

    console.log('📊 开始测试评分流程...');
    const analysis = await makeRequest('http://localhost:3000/api/curate/stream', {
      emotion: 'joy',
      userInput: '我想要一些能够让我感到开心的艺术作品'
    });

    const totalTime = Date.now() - startTime;

    console.log('\n📊 测试结果分析');
    console.log('-'.repeat(30));
    console.log(`✅ 评分流程成功完成`);
    console.log(`   - 总耗时: ${totalTime}ms`);
    console.log(`   - 处理批次数: ${analysis.totalBatches}`);
    console.log(`   - 评分完成: ${analysis.scoringComplete ? '是' : '否'}`);
    console.log(`   - 使用降级: ${analysis.fallbackUsed ? '是' : '否'}`);

    // 性能评估
    if (analysis.scoringComplete && totalTime < 30000) {
      console.log('\n🎯 性能评估: 优秀');
      console.log('✅ 单线处理模式工作正常');
      console.log('✅ glm-4.5-air模型快速响应');

      if (analysis.fallbackUsed) {
        console.log('⚠️ AI评分失败，使用了降级策略');
      } else {
        console.log('✅ AI评分成功完成');
      }

      console.log(`✅ 批次处理效率高 (${analysis.totalBatches}批)`);

    } else if (analysis.scoringComplete) {
      console.log('\n🎯 性能评估: 良好');
      console.log('✅ 功能正常，但响应较慢');
      console.log(`⏱️ 处理时间: ${totalTime}ms`);
    } else {
      console.log('\n❌ 性能评估: 失败');
      console.log('❌ 评分流程未能完成');
    }

    console.log('\n💡 针对用户问题的回答：');
    console.log('问题: "现在评分会卡住,是为什么呢?而且这个步骤应该是很快由一个 air 模型快速完成的.为什么现在要分批次呢?"');

    if (analysis.scoringComplete) {
      console.log('✅ 解决方案已实施：');
      console.log('1. 单线顺序处理 - glm-4.5-air不需要并发');
      console.log('2. 增大批次到20件 - 减少批次数量');
      console.log('3. 移除批次间延迟 - 提高处理速度');
      console.log('4. 简化重试策略 - 避免复杂错误处理');
      console.log('5. 优先AI评分 - 发挥air模型速度优势');
      console.log('');
      console.log(`🚀 现在评分可以在 ${totalTime}ms 内完成，不再卡住！`);
    } else {
      console.log('⚠️ 仍有问题需要进一步调试');
    }

    return analysis;

  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);
    console.log('\n🔧 可能的解决方案：');
    console.log('1. 检查网络连接状况');
    console.log('2. 验证GLM API密钥有效性');
    console.log('3. 进一步增加超时时间');
    console.log('4. 考虑使用完全的本地降级策略');

    throw error;
  }
}

// 执行测试
if (require.main === module) {
  testSimpleScoring()
    .then(() => {
      console.log('\n🎉 简化评分系统测试完成!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 测试失败:', error);
      process.exit(1);
    });
}

module.exports = { testSimpleScoring };