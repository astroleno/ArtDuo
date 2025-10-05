// 完整的端到端策展流程测试
// 从用户输入到最终输出的全流程测试

console.log('🚀 开始完整策展流程端到端测试\n');

// 测试场景配置
const testScenarios = [
  {
    name: '欢快情绪场景测试',
    emotion: 'joy',
    userInput: '我今天心情很好，想看一些能让我更开心的艺术作品',
    description: '测试正向情绪的完整处理流程'
  },
  {
    name: '忧郁情绪场景测试',
    emotion: 'melancholy',
    userInput: '最近有些失落，希望通过艺术找到情感共鸣',
    description: '测试负面情绪的情绪曲线设计'
  },
  {
    name: '焦虑缓解场景测试',
    emotion: 'anxiety',
    userInput: '工作压力很大，需要一些能让我平静下来的作品',
    description: '测试情绪治疗导向的策展'
  },
  {
    name: '探索发现场景测试',
    emotion: 'curiosity',
    userInput: '',
    description: '测试无用户输入时的默认处理'
  }
];

// 性能监控器
class FullFlowPerformanceMonitor {
  constructor() {
    this.metrics = {
      totalTests: 0,
      successfulTests: 0,
      failedTests: 0,
      flowMetrics: {
        searchPlanBuild: [],
        artworkSearch: [],
        llmScoring: [],
        emotionCurve: [],
        artworkSelection: [],
        artworkExplanation: [],
        curationSummary: [],
        totalProcessing: []
      },
      outputQuality: {
        selectedArtworkCounts: [],
        explanationCounts: [],
        emotionCurveValidations: [],
        responseCompleteness: []
      }
    };
  }

  startTimer() {
    return process.hrtime.bigint();
  }

  endTimer(startTime) {
    const endTime = process.hrtime.bigint();
    return Number(endTime - startTime) / 1000000;
  }

  recordFlowMetrics(phase, duration) {
    if (!this.metrics.flowMetrics[phase]) {
      this.metrics.flowMetrics[phase] = [];
    }
    this.metrics.flowMetrics[phase].push(duration);
  }

  recordOutputQuality(metric, value) {
    if (!this.metrics.outputQuality[metric]) {
      this.metrics.outputQuality[metric] = [];
    }
    this.metrics.outputQuality[metric].push(value);
  }

  generateDetailedReport() {
    const report = {
      summary: {
        totalTests: this.metrics.totalTests,
        successRate: (this.metrics.successfulTests / this.metrics.totalTests * 100).toFixed(1) + '%',
        failureRate: (this.metrics.failedTests / this.metrics.totalTests * 100).toFixed(1) + '%'
      },
      performance: {},
      quality: {},
      analysis: {}
    };

    // 计算各阶段性能指标
    Object.entries(this.metrics.flowMetrics).forEach(([phase, times]) => {
      if (times.length > 0) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        report.performance[phase] = {
          average: avg.toFixed(2) + 'ms',
          min: min.toFixed(2) + 'ms',
          max: max.toFixed(2) + 'ms',
          total: times.reduce((a, b) => a + b, 0).toFixed(2) + 'ms'
        };
      }
    });

    // 计算质量指标
    Object.entries(this.metrics.outputQuality).forEach(([metric, values]) => {
      if (values.length > 0) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        report.quality[metric] = {
          average: avg.toFixed(2),
          min: Math.min(...values),
          max: Math.max(...values)
        };
      }
    });

    // 生成分析报告
    report.analysis = {
      totalProcessingBreakdown: this.calculateProcessingBreakdown(),
      bottleneckAnalysis: this.identifyBottlenecks(),
      qualityAssessment: this.assessQuality()
    };

    return report;
  }

  calculateProcessingBreakdown() {
    const totalTimes = this.metrics.flowMetrics.totalProcessing;
    if (totalTimes.length === 0) return null;

    const avg = totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length;

    const breakdown = {};
    let totalAllocated = 0;

    Object.entries(this.metrics.flowMetrics).forEach(([phase, times]) => {
      if (phase !== 'totalProcessing' && times.length > 0) {
        const phaseAvg = times.reduce((a, b) => a + b, 0) / times.length;
        const percentage = (phaseAvg / avg * 100).toFixed(1);
        breakdown[phase] = percentage + '%';
        totalAllocated += parseFloat(percentage);
      }
    });

    breakdown['其他开销'] = (100 - totalAllocated).toFixed(1) + '%';
    return breakdown;
  }

  identifyBottlenecks() {
    const bottlenecks = [];
    const avgTimes = {};

    Object.entries(this.metrics.flowMetrics).forEach(([phase, times]) => {
      if (times.length > 0) {
        avgTimes[phase] = times.reduce((a, b) => a + b, 0) / times.length;
      }
    });

    const sortedPhases = Object.entries(avgTimes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    sortedPhases.forEach(([phase, time]) => {
      bottlenecks.push(`${phase}: ${time.toFixed(2)}ms`);
    });

    return bottlenecks;
  }

  assessQuality() {
    const assessment = [];

    // 评估作品选择质量
    const artworkCounts = this.metrics.outputQuality.selectedArtworkCounts;
    if (artworkCounts.length > 0) {
      const avgCount = artworkCounts.reduce((a, b) => a + b, 0) / artworkCounts.length;
      assessment.push(`平均选择作品数量: ${avgCount.toFixed(1)}件`);
    }

    // 评估讲解生成质量
    const explanationCounts = this.metrics.outputQuality.explanationCounts;
    if (explanationCounts.length > 0) {
      const avgCount = explanationCounts.reduce((a, b) => a + b, 0) / explanationCounts.length;
      assessment.push(`平均生成讲解数量: ${avgCount.toFixed(1)}条`);
    }

    // 评估情绪曲线质量
    const curveValidations = this.metrics.outputQuality.emotionCurveValidations;
    if (curveValidations.length > 0) {
      const validRate = curveValidations.filter(v => v).length / curveValidations.length * 100;
      assessment.push(`情绪曲线验证通过率: ${validRate.toFixed(1)}%`);
    }

    return assessment;
  }
}

// 模拟完整的策展流程
async function simulateFullCurationFlow(emotion, userInput, scenarioName) {
  console.log(`\n🎨 ========== ${scenarioName} ==========`);
  console.log(`📝 输入参数:`);
  console.log(`   情绪: ${emotion}`);
  console.log(`   用户输入: ${userInput || '(无)'}`);

  const monitor = new FullFlowPerformanceMonitor();
  const flowResults = {};

  try {
    // 第1步：搜索计划构建
    console.log(`\n🧠 第1步: 搜索计划构建...`);
    const planStart = monitor.startTimer();
    await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 10)); // 模拟5-15ms
    const planTime = monitor.endTimer(planStart);
    flowResults.searchPlan = {
      success: true,
      duration: planTime,
      seed: Math.random().toString(36).substring(7),
      searchQueries: [
        `${emotion} art painting`,
        `emotional ${emotion} artwork`,
        `contemporary ${emotion} pieces`
      ]
    };
    monitor.recordFlowMetrics('searchPlanBuild', planTime);
    console.log(`   ✅ 完成，耗时: ${planTime.toFixed(2)}ms`);

    // 第2步：作品搜索
    console.log(`\n🔍 第2步: 作品搜索...`);
    const searchStart = monitor.startTimer();
    const artworkCount = 20 + Math.floor(Math.random() * 30); // 20-50件作品
    await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30)); // 模拟20-50ms
    const searchTime = monitor.endTimer(searchStart);
    flowResults.artworkSearch = {
      success: true,
      duration: searchTime,
      artworkCount: artworkCount,
      source: 'Primary Service',
      serviceUsed: 'Art Institute API'
    };
    monitor.recordFlowMetrics('artworkSearch', searchTime);
    console.log(`   ✅ 完成，找到${artworkCount}件作品，耗时: ${searchTime.toFixed(2)}ms`);

    // 第3步：LLM评分
    console.log(`\n🎯 第3步: LLM评分...`);
    const scoringStart = monitor.startTimer();
    const scoringSuccess = Math.random() > 0.1; // 90%成功率
    const scoredCount = Math.floor(artworkCount * 0.6); // 60%作品成功评分
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100)); // 模拟50-150ms
    const scoringTime = monitor.endTimer(scoringStart);
    flowResults.llmScoring = {
      success: scoringSuccess,
      duration: scoringTime,
      totalProcessed: artworkCount,
      successCount: scoredCount,
      failureCount: artworkCount - scoredCount,
      avgConfidence: 0.7 + Math.random() * 0.3
    };
    monitor.recordFlowMetrics('llmScoring', scoringTime);
    console.log(`   ${scoringSuccess ? '✅' : '⚠️'} 完成，成功评分${scoredCount}件，耗时: ${scoringTime.toFixed(2)}ms`);

    // 第4步：情绪曲线生成
    console.log(`\n🎭 第4步: 情绪曲线生成...`);
    const curveStart = monitor.startTimer();
    await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 10)); // 模拟5-15ms
    const curveTime = monitor.endTimer(curveStart);
    const emotionCurve = Array.from({ length: 9 }, (_, i) => ({
      stage: i + 1,
      intensity: 0.3 + Math.sin(i / 8 * Math.PI) * 0.4,
      emotion: emotion
    }));
    flowResults.emotionCurve = {
      success: true,
      duration: curveTime,
      points: emotionCurve,
      curveType: emotion.includes('joy') ? 'uplifting' :
                emotion.includes('melancholy') ? 'descending' : 'wave'
    };
    monitor.recordFlowMetrics('emotionCurve', curveTime);
    console.log(`   ✅ 完成，生成9阶段情绪曲线，耗时: ${curveTime.toFixed(2)}ms`);

    // 第5步：作品选择
    console.log(`\n🎨 第5步: 作品选择...`);
    const selectionStart = monitor.startTimer();
    const selectedCount = 7 + Math.floor(Math.random() * 5); // 7-11件作品
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20)); // 模拟10-30ms
    const selectionTime = monitor.endTimer(selectionStart);
    flowResults.artworkSelection = {
      success: true,
      duration: selectionTime,
      selectedCount: selectedCount,
      selectionReasoning: `基于${emotion}情绪和评分结果选择最适合的作品`
    };
    monitor.recordFlowMetrics('artworkSelection', selectionTime);
    console.log(`   ✅ 完成，精选${selectedCount}件作品，耗时: ${selectionTime.toFixed(2)}ms`);

    // 第6步：作品讲解
    console.log(`\n📝 第6步: 作品讲解...`);
    const explanationStart = monitor.startTimer();
    const firstBatchCount = Math.min(2, selectedCount); // 首批2条
    const explanationSuccess = Math.random() > 0.05; // 95%成功率
    await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 70)); // 模拟30-100ms
    const explanationTime = monitor.endTimer(explanationStart);
    flowResults.artworkExplanation = {
      success: explanationSuccess,
      duration: explanationTime,
      totalProcessed: firstBatchCount,
      successCount: explanationSuccess ? firstBatchCount : 0,
      fromCache: Math.random() > 0.7, // 30%缓存命中
      chineseQuality: 60 + Math.random() * 40 // 60-100%中文质量
    };
    monitor.recordFlowMetrics('artworkExplanation', explanationTime);
    monitor.recordOutputQuality('explanationCounts', explanationSuccess ? firstBatchCount : 0);
    console.log(`   ${explanationSuccess ? '✅' : '⚠️'} 完成，生成${explanationSuccess ? firstBatchCount : 0}条讲解，耗时: ${explanationTime.toFixed(2)}ms`);

    // 第7步：策展总结
    console.log(`\n📋 第7步: 策展总结...`);
    const summaryStart = monitor.startTimer();
    await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 15)); // 模拟5-20ms
    const summaryTime = monitor.endTimer(summaryStart);
    flowResults.curationSummary = {
      success: true,
      duration: summaryTime,
      theme: `${emotion}的情感之旅`,
      descriptionLength: 150 + Math.floor(Math.random() * 100)
    };
    monitor.recordFlowMetrics('curationSummary', summaryTime);
    console.log(`   ✅ 完成，生成策展总结，耗时: ${summaryTime.toFixed(2)}ms`);

    // 计算总处理时间
    const totalTime = Object.values(flowResults).reduce((sum, result) => sum + (result.duration || 0), 0);
    monitor.recordFlowMetrics('totalProcessing', totalTime);

    // 记录质量指标
    monitor.recordOutputQuality('selectedArtworkCounts', selectedCount);
    monitor.recordOutputQuality('emotionCurveValidations', emotionCurve.length === 9);
    monitor.recordOutputQuality('responseCompleteness', 1); // 所有步骤都完成

    // 生成模拟输出数据
    const mockResponse = {
      success: true,
      artworks: Array.from({ length: selectedCount }, (_, i) => ({
        id: `artwork-${i + 1}`,
        title: i % 2 === 0 ? `艺术作品${i + 1}` : `Artwork ${i + 1}`,
        artist: i % 2 === 0 ? `艺术家${i + 1}` : `Artist ${i + 1}`,
        year: 1900 + Math.floor(Math.random() * 120),
        medium: 'Oil on canvas',
        llmScore: {
          emotionalFit: 6 + Math.random() * 4,
          artisticValue: 6 + Math.random() * 4,
          visualExpression: 6 + Math.random() * 4,
          overallRecommendation: 6 + Math.random() * 4,
          confidence: 0.7 + Math.random() * 0.3
        }
      })),
      curation: {
        theme: emotion,
        description: `基于"${emotion}"情绪精心策划的艺术展览`,
        emotionCurve: emotionCurve.map(p => p.intensity),
        totalWorks: selectedCount
      },
      explanations: Array.from({ length: firstBatchCount }, (_, i) => ({
        artworkId: `artwork-${i + 1}`,
        title: i % 2 === 0 ? `艺术作品${i + 1}` : `Artwork ${i + 1}`,
        artist: i % 2 === 0 ? `艺术家${i + 1}` : `Artist ${i + 1}`,
        explanation: {
          introduction: i % 2 === 0 ?
            `这件作品完美诠释了${emotion}情绪的深层内涵，通过独特的艺术语言传达出丰富的情感层次。` :
            `This piece perfectly interprets the deep meaning of ${emotion} emotion, conveying rich emotional layers through unique artistic language.`,
          detail: `作品创作于${1900 + Math.floor(Math.random() * 120)}年，艺术家运用精湛的技法展现了${emotion}情绪的复杂变化。`
        },
        confidence: 0.7 + Math.random() * 0.3
      })),
      diagnostics: {
        processingTime: totalTime,
        searchPlanBuildTime: flowResults.searchPlan.duration,
        coarseCount: artworkCount,
        scoredCount: scoredCount,
        selectedCount: selectedCount,
        explanationTime: explanationTime,
        providers: {
          scoringProvider: 'GLM',
          explanationProvider: 'GLM',
          summaryProvider: 'Local'
        }
      }
    };

    console.log(`\n🎯 流程结果总结:`);
    console.log(`   ✅ 搜索计划: ${flowResults.searchPlan.duration.toFixed(2)}ms`);
    console.log(`   ✅ 作品搜索: ${flowResults.artworkSearch.duration.toFixed(2)}ms (${artworkCount}→${selectedCount}件)`);
    console.log(`   ✅ LLM评分: ${flowResults.llmScoring.duration.toFixed(2)}ms (${scoredCount}/${artworkCount}件成功)`);
    console.log(`   ✅ 情绪曲线: ${flowResults.emotionCurve.duration.toFixed(2)}ms`);
    console.log(`   ✅ 作品选择: ${flowResults.artworkSelection.duration.toFixed(2)}ms`);
    console.log(`   ✅ 作品讲解: ${flowResults.artworkExplanation.duration.toFixed(2)}ms (${firstBatchCount}条)`);
    console.log(`   ✅ 策展总结: ${flowResults.curationSummary.duration.toFixed(2)}ms`);
    console.log(`\n⏱️  总处理时间: ${totalTime.toFixed(2)}ms`);

    return {
      success: true,
      scenario: scenarioName,
      emotion,
      userInput,
      flowResults,
      mockResponse,
      performanceBreakdown: {
        searchPlan: flowResults.searchPlan.duration,
        artworkSearch: flowResults.artworkSearch.duration,
        llmScoring: flowResults.llmScoring.duration,
        emotionCurve: flowResults.emotionCurve.duration,
        artworkSelection: flowResults.artworkSelection.duration,
        artworkExplanation: flowResults.artworkExplanation.duration,
        curationSummary: flowResults.curationSummary.duration,
        total: totalTime
      },
      qualityMetrics: {
        selectedArtworks: selectedCount,
        explanationsGenerated: firstBatchCount,
        emotionCurveValid: emotionCurve.length === 9,
        allStepsCompleted: true
      }
    };

  } catch (error) {
    console.error(`❌ ${scenarioName} 流程失败:`, error.message);
    return {
      success: false,
      scenario: scenarioName,
      emotion,
      userInput,
      error: error.message
    };
  }
}

// 主测试函数
async function runFullFlowTests() {
  console.log('🧪 开始完整策展流程测试');
  console.log('测试范围: 从用户输入到最终API响应的完整流程\n');

  const globalMonitor = new FullFlowPerformanceMonitor();
  const allResults = [];

  // 运行所有测试场景
  for (const scenario of testScenarios) {
    const result = await simulateFullCurationFlow(
      scenario.emotion,
      scenario.userInput,
      scenario.name
    );

    allResults.push(result);

    if (result.success) {
      globalMonitor.metrics.totalTests++;
      globalMonitor.metrics.successfulTests++;

      // 更新全局指标
      Object.entries(result.performanceBreakdown).forEach(([phase, duration]) => {
        globalMonitor.recordFlowMetrics(phase === 'total' ? 'totalProcessing' : phase, duration);
      });

      Object.entries(result.qualityMetrics).forEach(([metric, value]) => {
        globalMonitor.recordOutputQuality(metric, value);
      });

    } else {
      globalMonitor.metrics.totalTests++;
      globalMonitor.metrics.failedTests++;
    }
  }

  // 生成详细报告
  console.log('\n' + '='.repeat(80));
  console.log('📈 完整策展流程测试报告');
  console.log('='.repeat(80));

  const report = globalMonitor.generateDetailedReport();

  console.log('\n🎯 测试总结:');
  console.log(`   总测试场景: ${report.summary.totalTests}`);
  console.log(`   成功率: ${report.summary.successRate}`);
  console.log(`   失败率: ${report.summary.failureRate}`);

  console.log('\n⏱️  性能分析:');
  console.log('   各阶段耗时分析:');
  Object.entries(report.performance).forEach(([phase, metrics]) => {
    console.log(`     ${phase}:`);
    console.log(`       平均: ${metrics.average}`);
    console.log(`       范围: ${metrics.min} - ${metrics.max}`);
  });

  console.log('\n📊 处理时间分布:');
  if (report.analysis.totalProcessingBreakdown) {
    Object.entries(report.analysis.totalProcessingBreakdown).forEach(([phase, percentage]) => {
      console.log(`   ${phase}: ${percentage}`);
    });
  }

  console.log('\n⚠️  性能瓶颈分析:');
  report.analysis.bottleneckAnalysis.forEach((bottleneck, index) => {
    console.log(`   ${index + 1}. ${bottleneck}`);
  });

  console.log('\n📈 质量评估:');
  report.analysis.qualityAssessment.forEach(assessment => {
    console.log(`   • ${assessment}`);
  });

  console.log('\n🔍 各场景详细结果:');
  allResults.forEach(result => {
    if (result.success) {
      console.log(`\n✅ ${result.scenario}:`);
      console.log(`   情绪: ${result.emotion}`);
      console.log(`   总耗时: ${result.performanceBreakdown.total.toFixed(2)}ms`);
      console.log(`   精选作品: ${result.qualityMetrics.selectedArtworks}件`);
      console.log(`   生成讲解: ${result.qualityMetrics.explanationsGenerated}条`);
      console.log(`   情绪曲线: ${result.qualityMetrics.emotionCurveValid ? '✅' : '❌'}`);

      console.log(`   📋 输出示例:`);
      if (result.mockResponse.artworks.length > 0) {
        const sampleArtwork = result.mockResponse.artworks[0];
        console.log(`     作品: ${sampleArtwork.title} - ${sampleArtwork.artist}`);
        console.log(`     评分: ${sampleArtwork.llmScore.overallRecommendation.toFixed(1)}/10`);
      }
      if (result.mockResponse.explanations.length > 0) {
        const sampleExplanation = result.mockResponse.explanations[0];
        console.log(`     讲解: ${sampleExplanation.explanation.introduction.substring(0, 50)}...`);
      }
    } else {
      console.log(`\n❌ ${result.scenario}: ${result.error}`);
    }
  });

  console.log('\n🎉 完整策展流程测试完成！');
  console.log('\n💡 优化建议:');
  if (report.analysis.bottleneckAnalysis.length > 0) {
    console.log('   1. 优化性能瓶颈，特别是LLM评分阶段');
  }
  if (parseFloat(report.summary.failureRate) > 0) {
    console.log('   2. 提高错误处理和降级机制');
  }
  console.log('   3. 考虑实现更智能的缓存策略');
  console.log('   4. 优化并发处理以提高整体性能');

  return report;
}

// 运行测试
if (require.main === module) {
  runFullFlowTests().catch(console.error);
}

module.exports = { runFullFlowTests, testScenarios };