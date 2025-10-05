// 真实API测试 - 直接测试MET API和策展接口
console.log('🚀 开始真实API集成测试');
console.log('📋 测试目标：验证MET API和完整策展流程的真实运行\n');

const https = require('https');
const http = require('http');

// 真实的用户情绪表达
const realUserScenarios = [
  {
    name: '深夜加班后的疲惫',
    emotion: 'exhausted',
    userInput: '今天加班到很晚，感觉整个人都被掏空了，地铁上看着窗外灯火突然觉得很孤独',
    description: '测试都市人群的深夜孤独情绪'
  },
  {
    name: '失恋后的混乱',
    emotion: 'heartbroken',
    userInput: '刚整理完他的东西，看到我们曾经的合影，眼泪突然就掉下来了',
    description: '测试情感创伤的真实表达'
  },
  {
    name: '周末午后的平静',
    emotion: 'peaceful',
    userInput: '在阳台晒着太阳看猫睡觉，觉得这样简单的生活真好',
    description: '测试日常小确幸的情绪'
  }
];

class RealAPITester {
  constructor() {
    this.metrics = {
      totalTests: 0,
      successfulTests: 0,
      failedTests: 0,
      apiTests: {
        metDirect: { success: 0, failed: 0, avgTime: 0 },
        curationAPI: { success: 0, failed: 0, avgTime: 0 }
      },
      timings: {
        metDirect: [],
        curationAPI: []
      },
      errors: [],
      qualityChecks: {
        realArtworksFound: 0,
        realExplanationsGenerated: 0,
        mockDataDetected: 0
      }
    };
  }

  startTimer() {
    return process.hrtime.bigint();
  }

  endTimer(startTime) {
    return Number(process.hrtime.bigint() - startTime) / 1000000;
  }

  // 直接测试MET API
  async testMetDirectAPI(emotion, userInput) {
    console.log('\n🏛️ 测试MET Museum API直接调用...');

    return new Promise((resolve) => {
      const startTime = this.startTimer();

      // 构建搜索查询
      const emotionMap = {
        'exhausted': 'lonely',
        'heartbroken': 'sad',
        'peaceful': 'calm'
      };

      const query = emotionMap[emotion] || emotion;
      const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(query)}&hasImages=true`;

      console.log(`📡 搜索URL: ${searchUrl}`);

      const request = https.get(searchUrl, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          const duration = this.endTimer(startTime);
          this.metrics.timings.metDirect.push(duration);

          try {
            const result = JSON.parse(data);
            console.log(`✅ MET API响应成功，耗时: ${duration.toFixed(2)}ms`);
            console.log(`📊 搜索结果: ${result.total || result.objectIDs?.length || 0}件作品`);

            if (result.objectIDs && result.objectIDs.length > 0) {
              // 获取第一个作品的详情
              this.getArtworkDetails(result.objectIDs[0], duration).then(resolve);
            } else {
              resolve({
                success: true,
                artworkCount: 0,
                duration: duration,
                sampleArtwork: null
              });
            }
          } catch (error) {
            console.log(`❌ MET API响应解析失败: ${error.message}`);
            this.metrics.apiTests.metDirect.failed++;
            resolve({
              success: false,
              error: error.message,
              duration: duration
            });
          }
        });
      });

      request.on('error', (error) => {
        const duration = this.endTimer(startTime);
        console.log(`❌ MET API请求失败: ${error.message}`);
        this.metrics.apiTests.metDirect.failed++;
        this.metrics.timings.metDirect.push(duration);
        resolve({
          success: false,
          error: error.message,
          duration: duration
        });
      });

      request.setTimeout(10000, () => {
        request.destroy();
        const duration = this.endTimer(startTime);
        console.log(`❌ MET API请求超时`);
        this.metrics.apiTests.metDirect.failed++;
        this.metrics.timings.metDirect.push(duration);
        resolve({
          success: false,
          error: 'Request timeout',
          duration: duration
        });
      });
    });
  }

  // 获取作品详情
  async getArtworkDetails(objectId, searchDuration) {
    return new Promise((resolve) => {
      const startTime = this.startTimer();
      const detailUrl = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`;

      console.log(`🔍 获取作品详情，ID: ${objectId}`);

      const request = https.get(detailUrl, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          const duration = this.endTimer(startTime);

          try {
            const artwork = JSON.parse(data);
            const totalDuration = searchDuration + duration;

            console.log(`✅ 作品详情获取成功，总耗时: ${totalDuration.toFixed(2)}ms`);
            console.log(`📋 作品: ${artwork.title || '未知标题'} - ${artwork.artistDisplayName || '未知艺术家'}`);
            console.log(`📅 年代: ${artwork.objectDate || '未知'}`);
            console.log(`🎨 材质: ${artwork.medium || '未知'}`);

            // 检查是否有图片
            const hasImage = artwork.primaryImage && artwork.primaryImage !== '';
            console.log(`📸 有图片: ${hasImage ? '是' : '否'}`);

            if (hasImage) {
              this.metrics.qualityChecks.realArtworksFound++;
            }

            this.metrics.apiTests.metDirect.success++;

            resolve({
              success: true,
              artworkCount: 1,
              duration: totalDuration,
              sampleArtwork: {
                id: artwork.objectID,
                title: artwork.title,
                artist: artwork.artistDisplayName,
                year: artwork.objectDate,
                medium: artwork.medium,
                hasImage: hasImage,
                museum: '大都会艺术博物馆'
              }
            });
          } catch (error) {
            console.log(`❌ 作品详情解析失败: ${error.message}`);
            resolve({
              success: false,
              error: error.message,
              artworkCount: 0,
              duration: searchDuration + duration,
              sampleArtwork: null
            });
          }
        });
      });

      request.on('error', (error) => {
        console.log(`❌ 作品详情请求失败: ${error.message}`);
        resolve({
          success: false,
          error: error.message,
          artworkCount: 0,
          duration: searchDuration,
          sampleArtwork: null
        });
      });

      request.setTimeout(5000, () => {
        request.destroy();
        resolve({
          success: false,
          error: 'Detail request timeout',
          artworkCount: 0,
          duration: searchDuration,
          sampleArtwork: null
        });
      });
    });
  }

  // 测试策展API
  async testCurationAPI(emotion, userInput) {
    console.log('\n🎨 测试策展API (/api/curate)...');

    return new Promise((resolve) => {
      const startTime = this.startTimer();

      // 构建请求数据
      const postData = JSON.stringify({
        emotion: emotion,
        userInput: userInput
      });

      const options = {
        hostname: 'localhost',
        port: 3002,
        path: '/api/curate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      console.log(`📡 请求: http://${options.hostname}:${options.port}${options.path}`);
      console.log(`📝 数据: ${postData}`);

      const req = http.request(options, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          const duration = this.endTimer(startTime);
          this.metrics.timings.curationAPI.push(duration);

          try {
            const result = JSON.parse(data);
            console.log(`✅ 策展API响应成功，耗时: ${duration.toFixed(2)}ms`);
            console.log(`📊 状态码: ${response.statusCode}`);

            // 分析响应内容
            const analysis = this.analyzeCurationResponse(result, emotion, userInput);

            this.metrics.apiTests.curationAPI.success++;

            resolve({
              success: true,
              statusCode: response.statusCode,
              duration: duration,
              responseSize: data.length,
              analysis: analysis,
              fullResponse: result
            });
          } catch (error) {
            console.log(`❌ 策展API响应解析失败: ${error.message}`);
            console.log(`📄 原始响应: ${data.substring(0, 200)}...`);

            this.metrics.apiTests.curationAPI.failed++;
            resolve({
              success: false,
              error: error.message,
              statusCode: response.statusCode,
              duration: duration,
              rawResponse: data.substring(0, 500)
            });
          }
        });
      });

      req.on('error', (error) => {
        const duration = this.endTimer(startTime);
        console.log(`❌ 策展API请求失败: ${error.message}`);

        this.metrics.apiTests.curationAPI.failed++;
        this.metrics.timings.curationAPI.push(duration);

        resolve({
          success: false,
          error: error.message,
          duration: duration
        });
      });

      req.setTimeout(60000, () => {
        req.destroy();
        const duration = this.endTimer(startTime);
        console.log(`❌ 策展API请求超时`);

        this.metrics.apiTests.curationAPI.failed++;
        this.metrics.timings.curationAPI.push(duration);

        resolve({
          success: false,
          error: 'Request timeout',
          duration: duration
        });
      });

      req.write(postData);
      req.end();
    });
  }

  // 分析策展API响应
  analyzeCurationResponse(response, emotion, userInput) {
    const analysis = {
      hasArtworks: false,
      artworkCount: 0,
      hasExplanations: false,
      explanationCount: 0,
      hasEmotionCurve: false,
      dataSource: 'unknown',
      qualityScore: 0,
      issues: []
    };

    try {
      // 检查作品数据
      if (response.artworks && Array.isArray(response.artworks)) {
        analysis.hasArtworks = true;
        analysis.artworkCount = response.artworks.length;

        // 检查数据源
        if (response.serviceInfo?.source) {
          analysis.dataSource = response.serviceInfo.source;
        }

        // 检查是否使用Mock数据
        const mockTitles = ['星夜', '蒙娜丽莎', '呐喊', '向日葵'];
        const hasMockData = response.artworks.some(artwork =>
          mockTitles.some(title => artwork.title?.includes(title))
        );

        if (hasMockData) {
          analysis.issues.push('检测到Mock数据');
          this.metrics.qualityChecks.mockDataDetected++;
        } else {
          this.metrics.qualityChecks.realArtworksFound += response.artworks.length;
        }
      }

      // 检查讲解数据
      if (response.explanations && Array.isArray(response.explanations)) {
        const validExplanations = response.explanations.filter(exp =>
          exp.explanation?.introduction && exp.explanation.introduction.length > 20
        );

        analysis.hasExplanations = validExplanations.length > 0;
        analysis.explanationCount = validExplanations.length;

        if (validExplanations.length > 0) {
          // 检查讲解是否模板化
          const templatePhrases = ['欢快明亮的色彩', '深沉内敛的色调', '强烈对比的色彩'];
          const hasTemplateContent = validExplanations.some(exp =>
            templatePhrases.some(phrase =>
              exp.explanation.introduction.includes(phrase) ||
              exp.explanation.artisticAnalysis.includes(phrase)
            )
          );

          if (hasTemplateContent) {
            analysis.issues.push('检测到模板化讲解内容');
          } else {
            this.metrics.qualityChecks.realExplanationsGenerated += validExplanations.length;
          }
        }
      }

      // 检查情绪曲线
      if (response.curation?.emotionCurve && Array.isArray(response.curation.emotionCurve)) {
        analysis.hasEmotionCurve = true;
      }

      // 计算质量分数
      let score = 0;
      if (analysis.hasArtworks) score += 25;
      if (analysis.artworkCount >= 5) score += 15;
      if (analysis.hasExplanations) score += 25;
      if (analysis.explanationCount >= 2) score += 15;
      if (analysis.hasEmotionCurve) score += 10;
      if (analysis.dataSource === 'api') score += 10;

      analysis.qualityScore = score;

    } catch (error) {
      analysis.issues.push(`响应分析失败: ${error.message}`);
    }

    return analysis;
  }

  // 生成测试报告
  generateReport(results) {
    console.log('\n' + '='.repeat(80));
    console.log('📈 真实API集成测试报告');
    console.log('='.repeat(80));

    console.log('\n🎯 测试统计:');
    console.log(`   总测试场景: ${this.metrics.totalTests}`);
    console.log(`   成功场景: ${this.metrics.successfulTests}`);
    console.log(`   失败场景: ${this.metrics.failedTests}`);
    console.log(`   成功率: ${(this.metrics.successfulTests / this.metrics.totalTests * 100).toFixed(1)}%`);

    console.log('\n📊 API测试结果:');
    console.log(`   MET API直接调用:`);
    console.log(`     成功: ${this.metrics.apiTests.metDirect.success}次`);
    console.log(`     失败: ${this.metrics.apiTests.metDirect.failed}次`);
    if (this.metrics.timings.metDirect.length > 0) {
      const avgTime = this.metrics.timings.metDirect.reduce((a, b) => a + b, 0) / this.metrics.timings.metDirect.length;
      console.log(`     平均响应: ${avgTime.toFixed(2)}ms`);
    }

    console.log(`   策展API调用:`);
    console.log(`     成功: ${this.metrics.apiTests.curationAPI.success}次`);
    console.log(`     失败: ${this.metrics.apiTests.curationAPI.failed}次`);
    if (this.metrics.timings.curationAPI.length > 0) {
      const avgTime = this.metrics.timings.curationAPI.reduce((a, b) => a + b, 0) / this.metrics.timings.curationAPI.length;
      console.log(`     平均响应: ${avgTime.toFixed(2)}ms`);
    }

    console.log('\n📈 质量检查:');
    console.log(`   真实作品获取: ${this.metrics.qualityChecks.realArtworksFound}件`);
    console.log(`   真实讲解生成: ${this.metrics.qualityChecks.realExplanationsGenerated}条`);
    console.log(`   Mock数据检测: ${this.metrics.qualityChecks.mockDataDetected}次`);

    console.log('\n🔍 详细结果:');
    results.forEach(result => {
      console.log(`\n✅ ${result.scenario}:`);
      console.log(`   用户输入: "${result.userInput.substring(0, 40)}..."`);
      console.log(`   情绪: ${result.emotion}`);

      if (result.metDirect) {
        console.log(`   MET API: ${result.metDirect.success ? '✅' : '❌'} (${result.metDirect.duration?.toFixed(2)}ms)`);
        if (result.metDirect.sampleArtwork) {
          console.log(`   作品样例: ${result.metDirect.sampleArtwork.title}`);
        }
      }

      if (result.curationAPI) {
        console.log(`   策展API: ${result.curationAPI.success ? '✅' : '❌'} (${result.curationAPI.duration?.toFixed(2)}ms)`);
        if (result.curationAPI.analysis) {
          const analysis = result.curationAPI.analysis;
          console.log(`   作品数量: ${analysis.artworkCount}`);
          console.log(`   讲解数量: ${analysis.explanationCount}`);
          console.log(`   质量分数: ${analysis.qualityScore}/100`);
          if (analysis.issues.length > 0) {
            console.log(`   问题: ${analysis.issues.join(', ')}`);
          }
        }
      }
    });

    if (this.metrics.errors.length > 0) {
      console.log('\n⚠️ 错误统计:');
      this.metrics.errors.forEach(error => {
        console.log(`   • ${error}`);
      });
    }

    console.log('\n💡 AI-Native 验证:');
    if (this.metrics.qualityChecks.mockDataDetected === 0) {
      console.log('   ✅ 无Mock数据依赖');
    } else {
      console.log('   ❌ 检测到Mock数据使用');
    }

    if (this.metrics.qualityChecks.realExplanationsGenerated > 0) {
      console.log('   ✅ 真实AI讲解生成');
    } else {
      console.log('   ❌ 缺少真实AI讲解');
    }

    console.log('\n🎉 真实API集成测试完成！');

    return this.metrics;
  }

  // 主测试方法
  async runTests() {
    console.log('🧪 开始真实API集成测试');
    console.log('🎯 测试MET API和策展API的真实运行情况\n');

    const results = [];

    // 首先测试本地服务器是否运行
    console.log('🔍 检查本地开发服务器...');
    try {
      const serverCheck = await this.testCurationAPI('joy', '测试服务器');
      if (!serverCheck.success && serverCheck.error?.includes('ECONNREFUSED')) {
        console.log('❌ 本地开发服务器未运行 (端口3000)');
        console.log('💡 请先启动开发服务器: npm run dev');
        return;
      }
    } catch (error) {
      console.log('❌ 服务器检查失败:', error.message);
      return;
    }

    // 运行测试场景
    for (const scenario of realUserScenarios) {
      console.log(`\n🎭 ========== ${scenario.name} ==========`);
      console.log(`💭 用户表达: "${scenario.userInput}"`);
      console.log(`🎯 检测情绪: ${scenario.emotion}`);

      const result = {
        scenario: scenario.name,
        emotion: scenario.emotion,
        userInput: scenario.userInput,
        metDirect: null,
        curationAPI: null
      };

      try {
        // 测试MET API直接调用
        result.metDirect = await this.testMetDirectAPI(scenario.emotion, scenario.userInput);

        // 测试策展API
        result.curationAPI = await this.testCurationAPI(scenario.emotion, scenario.userInput);

        if (result.metDirect.success || result.curationAPI.success) {
          this.metrics.successfulTests++;
        } else {
          this.metrics.failedTests++;
        }

      } catch (error) {
        console.log(`❌ 场景测试失败: ${error.message}`);
        this.metrics.failedTests++;
        this.metrics.errors.push(`${scenario.name}: ${error.message}`);
      }

      this.metrics.totalTests++;
      results.push(result);

      // 场景间延迟
      if (realUserScenarios.indexOf(scenario) < realUserScenarios.length - 1) {
        console.log('\n⏳ 等待3秒避免API限制...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // 生成报告
    const report = this.generateReport(results);
    return report;
  }
}

// 运行测试
if (require.main === module) {
  const tester = new RealAPITester();
  tester.runTests().catch(console.error);
}

module.exports = { RealAPITester, realUserScenarios };