#!/usr/bin/env node

/**
 * 完整策展流程测试
 * 验证整个系统从输入到输出的完整功能
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
      timeout: 120000 // 2分钟超时
    };

    const client = urlObj.protocol === 'https:' ? require('https') : http;
    const req = client.request(options, (res) => {
      let responseData = '';
      let events = [];
      let startTime = Date.now();

      res.on('data', (chunk) => {
        responseData += chunk;

        // 解析SSE数据流
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              events.push({
                type: data.type,
                payload: data.payload,
                timestamp: Date.now() - startTime
              });

              // 实时输出事件
              console.log(`[${((Date.now() - startTime) / 1000).toFixed(1)}s] ${data.type}: ${JSON.stringify(data.payload).substring(0, 100)}...`);
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });

      res.on('end', () => {
        resolve({
          success: true,
          events,
          totalTime: Date.now() - startTime,
          response: responseData
        });
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

async function testCompleteFlow() {
  console.log('🎨 完整策展流程测试');
  console.log('='.repeat(50));

  const testCases = [
    {
      name: '基础喜悦情绪',
      data: {
        emotion: 'joy',
        userInput: '我想要一些能够让我感到开心的艺术作品'
      }
    },
    {
      name: '复杂情感需求',
      data: {
        emotion: 'melancholy',
        userInput: '我感到有些忧郁，想要一些能够表达这种情感的艺术作品'
      }
    },
    {
      name: '简单情绪表达',
      data: {
        emotion: 'calm',
        userInput: '我想要一些平静的艺术作品'
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 测试案例: ${testCase.name}`);
    console.log('-'.repeat(30));

    try {
      const startTime = Date.now();
      const result = await makeRequest('http://localhost:3000/api/curate/stream', testCase.data);
      const totalTime = Date.now() - startTime;

      // 分析结果
      const eventTypes = result.events.map(e => e.type);
      const hasAllRequiredEvents = ['start', 'emotion_curve', 'artworks_selected', 'introduction', 'conclusion', 'complete'].every(type => eventTypes.includes(type));

      const artworkSelectedEvent = result.events.find(e => e.type === 'artworks_selected');
      const artworkCount = artworkSelectedEvent?.payload?.artworks?.length || 0;

      const explanationEvents = result.events.filter(e => e.type === 'explanations_batch');
      const totalExplanations = explanationEvents.reduce((sum, e) => sum + (e.payload?.explanations?.length || 0), 0);

      console.log(`\n📊 测试结果:`);
      console.log(`✅ 流程完成: ${result.success ? '是' : '否'}`);
      console.log(`⏱️ 总耗时: ${totalTime}ms`);
      console.log(`📦 事件数量: ${result.events.length}`);
      console.log(`🎨 作品数量: ${artworkCount}`);
      console.log(`📝 讲解数量: ${totalExplanations}`);
      console.log(`🔍 事件类型: ${eventTypes.join(', ')}`);

      if (hasAllRequiredEvents) {
        console.log('✅ 所有必要事件都已触发');
      } else {
        console.log('❌ 缺少必要事件');
        const missingEvents = ['start', 'emotion_curve', 'artworks_selected', 'introduction', 'conclusion', 'complete'].filter(type => !eventTypes.includes(type));
        console.log(`   缺失: ${missingEvents.join(', ')}`);
      }

      // 性能评估
      if (totalTime < 60000) {
        console.log('⚡ 性能: 优秀 (< 60秒)');
      } else if (totalTime < 120000) {
        console.log('⚡ 性能: 良好 (60-120秒)');
      } else {
        console.log('⚡ 性能: 较慢 (> 120秒)');
      }

      console.log(`\n🎯 ${testCase.name}测试完成!\n`);

    } catch (error) {
      console.error(`❌ ${testCase.name}测试失败: ${error.message}`);
    }
  }

  console.log('\n🎉 完整策展流程测试完成!');
}

// 执行测试
if (require.main === module) {
  testCompleteFlow()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 测试失败:', error);
      process.exit(1);
    });
}

module.exports = { testCompleteFlow };