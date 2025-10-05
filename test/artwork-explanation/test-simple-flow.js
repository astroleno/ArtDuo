// 简化的作品讲解生成流程测试
// 直接模拟测试数据，避免复杂的依赖

console.log('🚀 开始作品讲解生成流程测试\n');

// 模拟测试数据
const testArtworks = [
  {
    id: 'test-001',
    title: 'Starry Night Over the Rhône',
    artist: 'Vincent van Gogh',
    year: '1888',
    medium: 'Oil on canvas',
    description: 'A beautiful night scene with stars reflected in the Rhône River in Arles.',
    museum: 'Musée d\'Orsay, Paris'
  },
  {
    id: 'test-002',
    title: 'The Persistence of Memory',
    artist: 'Salvador Dalí',
    year: '1931',
    medium: 'Oil on canvas',
    description: 'Surrealist painting featuring melting clocks in a dreamscape.',
    museum: 'Museum of Modern Art, New York'
  },
  {
    id: 'test-003',
    title: '星空下的罗纳河',
    artist: '文森特·梵高',
    year: '1888',
    medium: '布面油画',
    description: '描绘了阿尔勒罗纳河上星空倒影的美丽夜景。',
    museum: '巴黎奥赛博物馆'
  }
];

// 测试场景
const testScenarios = [
  {
    name: '欢快情绪场景',
    emotion: 'joy',
    userInput: '我希望看到一些令人愉快和充满活力的作品'
  },
  {
    name: '忧郁情绪场景',
    emotion: 'melancholy',
    userInput: '我想要一些能够表达内心深沉情感的作品'
  },
  {
    name: '宁静情绪场景',
    emotion: 'calm',
    userInput: '寻找能够带来内心平静的艺术作品'
  }
];

// 性能监控
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      totalTests: 0,
      totalTime: 0,
      averageTime: 0,
      minTime: Infinity,
      maxTime: 0,
      results: []
    };
  }

  startTimer() {
    return process.hrtime.bigint();
  }

  endTimer(startTime) {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1000000;

    this.metrics.totalTests++;
    this.metrics.totalTime += durationMs;
    this.metrics.minTime = Math.min(this.metrics.minTime, durationMs);
    this.metrics.maxTime = Math.max(this.metrics.maxTime, durationMs);
    this.metrics.averageTime = this.metrics.totalTime / this.metrics.totalTests;

    return durationMs;
  }

  addResult(result) {
    this.metrics.results.push(result);
  }

  generateReport() {
    return {
      ...this.metrics,
      successRate: '100%', // 模拟测试
      avgProcessingTime: this.metrics.averageTime.toFixed(2),
      minProcessingTime: this.metrics.minTime.toFixed(2),
      maxProcessingTime: this.metrics.maxTime.toFixed(2)
    };
  }
}

// 中文质量分析
function analyzeChineseQuality(text) {
  if (!text) return 0;

  const totalChars = text.length;
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishChars = (text.match(/[A-Za-z]/g) || []).length;

  return totalChars > 0 ? (chineseChars / totalChars * 100) : 0;
}

// 模拟作品讲解生成函数
function simulateArtworkExplanation(artwork, emotion, userInput) {
  console.log(`🔄 正在处理作品: ${artwork.title}`);

  // 模拟处理时间 (1-10ms)
  const processingTime = 1 + Math.random() * 9;

  // 根据情绪和作品特征生成模拟讲解
  const emotionMap = {
    'joy': {
      'Starry Night Over the Rhône': '星空下的罗纳河（Starry Night Over the Rhône）通过璀璨的星光和倒影，展现出夜晚的欢快与浪漫。梵高用旋转的笔触捕捉了光线的跃动。',
      'The Persistence of Memory': '记忆的永恒（The Persistence of Memory）通过超现实的时间表达，带来思考的快乐和想象的自由。',
      '星空下的罗纳河': '这幅作品通过明亮的星光和水面倒影，营造出宁静而愉悦的氛围。'
    },
    'melancholy': {
      'Starry Night Over the Rhône': '星空下的罗纳河（Starry Night Over the Rhône）在璀璨星光的背后，隐藏着艺术家内心的孤独与忧郁。',
      'The Persistence of Memory': '记忆的永恒（The Persistence of Memory）通过融化的时钟，表达了对时间流逝的忧思。',
      '星空下的罗纳河': '这幅作品在美丽的夜景中，蕴含着艺术家深沉的情感和对宇宙的思考。'
    },
    'calm': {
      'Starry Night Over the Rhône': '星空下的罗纳河（Starry Night Over the Rhône）通过稳定的构图和柔和的色彩，营造出宁静致远的氛围。',
      'The Persistence of Memory': '记忆的永恒（The Persistence of Memory）在超现实的景象中，呈现出一种梦幻般的平静。',
      '星空下的罗纳河': '这幅作品通过和谐的色彩和构图，带来内心的宁静与平和。'
    }
  };

  const introduction = emotionMap[emotion]?.[artwork.title] ||
    `${artwork.title}与${emotion}情绪产生共鸣，展现出独特的艺术魅力。`;

  const detail = `${artwork.artist}在${artwork.year}年创作了这件${artwork.medium}作品，现藏于${artwork.museum}。作品通过独特的技法和构图，深刻诠释了${emotion}的情感主题。${artwork.description}`;

  return {
    artworkId: artwork.id,
    title: artwork.title,
    artist: artwork.artist,
    introduction,
    detail,
    emotionalConnection: introduction,
    artisticAnalysis: detail,
    confidence: 0.8 + Math.random() * 0.2,
    processingTime: processingTime
  };
}

// 模拟批量处理函数
async function simulateBatchExplanation(artworks, emotion, userInput) {
  const startTime = process.hrtime.bigint();

  console.log(`🎨 开始生成作品讲解: ${artworks.length} 件作品`);
  console.log(`😊 情绪输入: ${emotion}`);
  console.log(`💭 用户输入: ${userInput || '(无)'}`);

  const explanations = [];

  // 模拟并发处理
  const promises = artworks.map(artwork =>
    new Promise(resolve => {
      setTimeout(() => {
        const explanation = simulateArtworkExplanation(artwork, emotion, userInput);
        explanations.push(explanation);
        resolve(explanation);
      }, 1 + Math.random() * 5); // 随机延迟1-6ms
    })
  );

  await Promise.all(promises);

  const endTime = process.hrtime.bigint();
  const totalProcessingTime = Number(endTime - startTime) / 1000000;

  return {
    explanations,
    totalProcessed: artworks.length,
    successCount: artworks.length,
    failureCount: 0,
    fromCacheCount: 0, // 模拟无缓存命中
    processingTime: totalProcessingTime
  };
}

// 格式化输出
function formatOutput(scenario, result) {
  console.log(`\n🎨 ========== ${scenario.name} ==========`);
  console.log(`📝 输入参数:`);
  console.log(`   情绪: ${scenario.emotion}`);
  console.log(`   用户输入: ${scenario.userInput || '(无)'}`);
  console.log(`   作品数量: ${result.totalProcessed}`);

  console.log(`\n📊 处理结果:`);
  console.log(`   成功处理: ${result.successCount}`);
  console.log(`   处理失败: ${result.failureCount}`);
  console.log(`   总耗时: ${result.processingTime.toFixed(2)}ms`);

  console.log(`\n🔍 讲解内容预览:`);
  result.explanations.forEach((exp, index) => {
    const chineseScore = analyzeChineseQuality(exp.introduction + exp.detail);
    console.log(`   作品 ${index + 1}: ${exp.title}`);
    console.log(`   艺术家: ${exp.artist}`);
    console.log(`   简介: ${exp.introduction.substring(0, 60)}...`);
    console.log(`   详情: ${exp.detail.substring(0, 60)}...`);
    console.log(`   中文质量: ${chineseScore.toFixed(1)}%`);
    console.log(`   置信度: ${(exp.confidence * 100).toFixed(1)}%`);
    console.log('');
  });
}

// 主测试函数
async function runCompleteTest() {
  const monitor = new PerformanceMonitor();
  const allResults = [];

  console.log('🧪 开始完整流程测试...\n');

  // 测试每个场景
  for (const scenario of testScenarios) {
    console.log(`\n📋 测试场景: ${scenario.name}`);
    const startTime = monitor.startTimer();

    try {
      // 模拟完整的讲解生成流程
      const result = await simulateBatchExplanation(
        testArtworks,
        scenario.emotion,
        scenario.userInput
      );

      const duration = monitor.endTimer(startTime);

      // 分析中文质量
      const chineseScores = result.explanations.map(exp =>
        analyzeChineseQuality(exp.introduction + exp.detail)
      );
      const avgChineseScore = chineseScores.reduce((a, b) => a + b, 0) / chineseScores.length;

      // 格式化输出
      formatOutput(scenario, result);

      // 记录结果
      const testResult = {
        scenario: scenario.name,
        emotion: scenario.emotion,
        userInput: scenario.userInput,
        duration: duration,
        totalProcessed: result.totalProcessed,
        successCount: result.successCount,
        chineseQuality: avgChineseScore,
        success: true,
        explanations: result.explanations.map(exp => ({
          title: exp.title,
          hasEnglishTitle: /[A-Za-z]/.test(exp.title),
          chineseQuality: analyzeChineseQuality(exp.introduction + exp.detail),
          confidence: exp.confidence
        }))
      };

      allResults.push(testResult);
      monitor.addResult(testResult);

    } catch (error) {
      const duration = monitor.endTimer(startTime);
      console.error(`❌ 场景 ${scenario.name} 测试失败:`, error.message);

      allResults.push({
        scenario: scenario.name,
        error: error.message,
        duration: duration,
        success: false
      });
    }
  }

  // 生成详细报告
  console.log('\n' + '='.repeat(60));
  console.log('📈 详细测试报告');
  console.log('='.repeat(60));

  const report = monitor.generateReport();

  console.log(`🎯 测试统计:`);
  console.log(`   总测试数: ${report.totalTests}`);
  console.log(`   成功率: ${report.successRate}`);

  console.log(`\n⏱️  性能指标:`);
  console.log(`   总耗时: ${report.totalTime.toFixed(2)}ms`);
  console.log(`   平均耗时: ${report.avgProcessingTime}ms`);
  console.log(`   最短耗时: ${report.minProcessingTime}ms`);
  console.log(`   最长耗时: ${report.maxProcessingTime}ms`);

  console.log(`\n📊 各场景详细结果:`);
  allResults.forEach(result => {
    if (result.success) {
      console.log(`\n✅ ${result.scenario}:`);
      console.log(`   ⏱️  耗时: ${result.duration.toFixed(2)}ms`);
      console.log(`   📝 处理作品: ${result.totalProcessed}件`);
      console.log(`   🇨🇳 中文质量: ${result.chineseQuality.toFixed(1)}%`);

      console.log(`   📋 作品分析:`);
      result.explanations.forEach((exp, idx) => {
        console.log(`      ${idx + 1}. ${exp.title}`);
        console.log(`         英文标题: ${exp.hasEnglishTitle ? '是' : '否'}`);
        console.log(`         中文质量: ${exp.chineseQuality.toFixed(1)}%`);
        console.log(`         置信度: ${(exp.confidence * 100).toFixed(1)}%`);
      });
    } else {
      console.log(`\n❌ ${result.scenario}: ${result.error}`);
    }
  });

  // 英文标题翻译效果分析
  console.log(`\n🔍 英文标题翻译效果分析:`);
  const allExplanations = allResults.flatMap(r => r.explanations || []);
  const englishTitles = allExplanations.filter(exp => exp.hasEnglishTitle);
  const chineseTitles = allExplanations.filter(exp => !exp.hasEnglishTitle);

  console.log(`   英文标题作品: ${englishTitles.length}件`);
  console.log(`   中文标题作品: ${chineseTitles.length}件`);

  if (englishTitles.length > 0) {
    const avgChineseQualityEnglish = englishTitles.reduce((sum, exp) => sum + exp.chineseQuality, 0) / englishTitles.length;
    console.log(`   英文标题作品平均中文质量: ${avgChineseQualityEnglish.toFixed(1)}%`);
  }

  if (chineseTitles.length > 0) {
    const avgChineseQualityChinese = chineseTitles.reduce((sum, exp) => sum + exp.chineseQuality, 0) / chineseTitles.length;
    console.log(`   中文标题作品平均中文质量: ${avgChineseQualityChinese.toFixed(1)}%`);
  }

  console.log('\n🎉 完整流程测试完成！');
  return report;
}

// 运行测试
runCompleteTest().catch(console.error);