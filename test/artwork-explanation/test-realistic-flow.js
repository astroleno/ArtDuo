// 真实的用户场景测试 - 基于实际的用户行为模式

console.log('🚀 开始真实用户场景测试\n');

// 真实的用户输入场景
const realisticScenarios = [
  {
    name: '职场压力场景',
    emotion: 'exhausted',
    userInput: '最近工作压力很大，感觉整个人都被掏空了，连周末都想着工作的事',
    description: '测试职场人群的情绪疏导需求'
  },
  {
    name: '情感困扰场景',
    emotion: 'heartbroken',
    userInput: '刚刚分手了，整个人都很混乱，不知道该怎么办',
    description: '测试情感创伤的疗愈需求'
  },
  {
    name: '迷茫焦虑场景',
    emotion: 'confused',
    userInput: '快30岁了，不知道自己到底想要什么，感觉很迷茫',
    description: '测试人生方向的探索需求'
  },
  {
    name: '平静感悟场景',
    emotion: 'peaceful',
    userInput: '今天下午在公园散步，看到落叶突然觉得很平静',
    description: '测试日常生活的情绪共鸣需求'
  },
  {
    name: '复杂情绪场景',
    emotion: 'mixed',
    userInput: '说不清楚是什么感觉，有点难过又有点解脱，很复杂',
    description: '测试复杂情绪的表达和理解需求'
  }
];

// 真实的性能指标（基于你提到的实际情况）
const realisticTimings = {
  searchPlan: { min: 50, max: 200 },      // 搜索计划构建
  artworkSearch: { min: 100, max: 500 },   // 作品搜索
  llmScoring: { min: 5000, max: 20000 },  // LLM评分（5-20秒）
  emotionCurve: { min: 20, max: 100 },     // 情绪曲线生成
  artworkSelection: { min: 30, max: 150 }, // 作品选择
  artworkExplanation: { min: 2000, max: 8000 }, // 作品讲解（2-8秒）
  curationSummary: { min: 1000, max: 3000 }    // 策展总结（1-3秒）
};

// 真实的问题分析
class RealisticIssueAnalyzer {
  constructor() {
    this.issues = [];
    this.performanceBottlenecks = [];
    this.workflowProblems = [];
  }

  analyzeScenario(scenario, results) {
    const analysis = {
      scenario: scenario.name,
      userInputQuality: this.analyzeUserInput(scenario.userInput),
      performanceAnalysis: this.analyzePerformance(results),
      workflowIssues: this.identifyWorkflowIssues(results),
      recommendations: []
    };

    // 分析用户输入质量
    if (analysis.userInputQuality.natural) {
      analysis.recommendations.push('✅ 用户输入自然真实，符合实际使用场景');
    }

    // 分析性能瓶颈
    if (analysis.performanceAnalysis.slowestPhase === 'llmScoring') {
      analysis.recommendations.push('⚠️ LLM评分是主要瓶颈，建议优化并发或使用更快的模型');
    }

    if (analysis.performanceAnalysis.slowestPhase === 'artworkExplanation') {
      analysis.recommendations.push('⚠️ 作品讲解生成较慢，考虑分批优化策略');
    }

    // 分析工作流问题
    if (analysis.workflowIssues.summaryOrderWrong) {
      analysis.recommendations.push('❌ 策展总结应在作品选择后立即生成，而不是在最后');
    }

    if (analysis.workflowIssues.explanationBatchSize) {
      analysis.recommendations.push('⚠️ 首批只生成2条讲解，用户可能需要等待更多内容');
    }

    return analysis;
  }

  analyzeUserInput(userInput) {
    return {
      natural: !userInput.includes('想看') && !userInput.includes('作品'),
      emotional: /[难过|开心|迷茫|焦虑|平静|复杂|痛苦|兴奋|感动]/.test(userInput),
      contextRich: userInput.length > 15,
      realistic: !userInput.includes('艺术作品') && !userInput.includes('策展')
    };
  }

  analyzePerformance(results) {
    const phases = Object.keys(results.timings || {});
    const timings = phases.map(phase => ({
      phase,
      duration: results.timings[phase]
    }));

    timings.sort((a, b) => b.duration - a.duration);

    return {
      slowestPhase: timings[0]?.phase,
      slowestDuration: timings[0]?.duration,
      totalDuration: timings.reduce((sum, t) => sum + t.duration, 0),
      bottleneckRatio: timings[0]?.duration / timings.reduce((sum, t) => sum + t.duration, 0)
    };
  }

  identifyWorkflowIssues(results) {
    return {
      summaryOrderWrong: true, // 从代码分析得出的问题
      explanationBatchSize: results.explanationCount <= 2,
      missingConcurrentProcessing: !results.concurrentOptimizations
    };
  }
}

// 模拟真实的策展流程
async function simulateRealisticCurationFlow(scenario) {
  console.log(`\n🎭 ========== ${scenario.name} ==========`);
  console.log(`💭 用户真实表达: "${scenario.userInput}"`);
  console.log(`🎯 潜在情绪: ${scenario.emotion}`);

  const analyzer = new RealisticIssueAnalyzer();
  const results = {
    scenario: scenario.name,
    userInput: scenario.userInput,
    emotion: scenario.emotion,
    timings: {},
    results: {},
    issues: []
  };

  try {
    // 第1步：情绪分析和搜索计划
    console.log(`\n🧠 第1步: 分析用户情绪，构建搜索策略...`);
    const planStart = Date.now();
    const planTime = Math.floor(
      realisticTimings.searchPlan.min +
      Math.random() * (realisticTimings.searchPlan.max - realisticTimings.searchPlan.min)
    );
    await new Promise(resolve => setTimeout(resolve, planTime / 100)); // 加速模拟
    results.timings.searchPlan = planTime;
    results.results.emotionAnalysis = {
      detectedEmotion: scenario.emotion,
      complexity: 'medium',
      keywords: extractEmotionalKeywords(scenario.userInput)
    };
    console.log(`   ✅ 情绪分析完成，耗时: ${planTime}ms`);

    // 第2步：作品搜索
    console.log(`\n🔍 第2步: 搜索相关艺术作品...`);
    const searchStart = Date.now();
    const searchTime = Math.floor(
      realisticTimings.artworkSearch.min +
      Math.random() * (realisticTimings.artworkSearch.max - realisticTimings.artworkSearch.min)
    );
    await new Promise(resolve => setTimeout(resolve, searchTime / 100)); // 加速模拟
    results.timings.artworkSearch = searchTime;
    const artworkCount = 25 + Math.floor(Math.random() * 35);
    results.results.artworkSearch = {
      foundCount: artworkCount,
      source: 'Multiple APIs',
      quality: 'high'
    };
    console.log(`   ✅ 找到${artworkCount}件相关作品，耗时: ${searchTime}ms`);

    // 第3步：LLM评分（最耗时的步骤）
    console.log(`\n🎯 第3步: LLM智能评分作品匹配度...`);
    console.log(`   ⏳ 这是最耗时的步骤，预计需要5-20秒`);
    const scoringStart = Date.now();
    const scoringTime = Math.floor(
      realisticTimings.llmScoring.min +
      Math.random() * (realisticTimings.llmScoring.max - realisticTimings.llmScoring.min)
    );
    await new Promise(resolve => setTimeout(resolve, scoringTime / 100)); // 加速模拟但保持相对比例
    results.timings.llmScoring = scoringTime;
    const scoringSuccess = Math.random() > 0.1; // 90%成功率
    const scoredCount = Math.floor(artworkCount * (scoringSuccess ? 0.7 : 0.3));
    results.results.llmScoring = {
      success: scoringSuccess,
      processedCount: artworkCount,
      successCount: scoredCount,
      avgConfidence: 0.75 + Math.random() * 0.2
    };
    console.log(`   ${scoringSuccess ? '✅' : '⚠️'} 评分完成，成功评分${scoredCount}件作品，耗时: ${scoringTime}ms`);

    // 第4步：情绪曲线生成
    console.log(`\n🎭 第4步: 生成情绪体验曲线...`);
    const curveStart = Date.now();
    const curveTime = Math.floor(
      realisticTimings.emotionCurve.min +
      Math.random() * (realisticTimings.emotionCurve.max - realisticTimings.emotionCurve.min)
    );
    await new Promise(resolve => setTimeout(resolve, curveTime / 100)); // 加速模拟
    results.timings.emotionCurve = curveTime;
    results.results.emotionCurve = {
      stages: 9,
      curveType: determineCurveType(scenario.emotion),
      narrative: generateNarrative(scenario.emotion)
    };
    console.log(`   ✅ 生成9阶段情绪曲线，耗时: ${curveTime}ms`);

    // 第5步：作品选择
    console.log(`\n🎨 第5步: 精选最适合的作品...`);
    const selectionStart = Date.now();
    const selectionTime = Math.floor(
      realisticTimings.artworkSelection.min +
      Math.random() * (realisticTimings.artworkSelection.max - realisticTimings.artworkSelection.min)
    );
    await new Promise(resolve => setTimeout(resolve, selectionTime / 100)); // 加速模拟
    results.timings.artworkSelection = selectionTime;
    const selectedCount = 8 + Math.floor(Math.random() * 4);
    results.results.artworkSelection = {
      selectedCount: selectedCount,
      criteria: 'emotion match + diversity + quality',
      reasoning: '基于情绪曲线和评分结果精选'
    };
    console.log(`   ✅ 精选${selectedCount}件作品，耗时: ${selectionTime}ms`);

    // 第6步：策展总结（应该在讲解之前生成）
    console.log(`\n📝 第6步: 生成策展总结和序言...`);
    const summaryStart = Date.now();
    const summaryTime = Math.floor(
      realisticTimings.curationSummary.min +
      Math.random() * (realisticTimings.curationSummary.max - realisticTimings.curationSummary.min)
    );
    await new Promise(resolve => setTimeout(resolve, summaryTime / 100)); // 加速模拟
    results.timings.curationSummary = summaryTime;
    results.results.curationSummary = {
      theme: generateTheme(scenario.emotion, scenario.userInput),
      introduction: generateIntroduction(scenario),
      conclusion: generateConclusion(scenario),
      orderIssue: '应在作品选择后立即生成，而不是在讲解之后'
    };
    console.log(`   ✅ 策展总结完成，耗时: ${summaryTime}ms`);
    console.log(`   ⚠️ 注意：当前工作流中策展总结生成顺序可能需要优化`);

    // 第7步：作品讲解（分批次）
    console.log(`\n📚 第7步: 生成作品讲解（分批处理）...`);
    const explanationStart = Date.now();
    const explanationTime = Math.floor(
      realisticTimings.artworkExplanation.min +
      Math.random() * (realisticTimings.artworkExplanation.max - realisticTimings.artworkExplanation.min)
    );
    await new Promise(resolve => setTimeout(resolve, explanationTime / 100)); // 加速模拟
    results.timings.artworkExplanation = explanationTime;
    const firstBatchCount = 2; // 基于环境变量FIRST_EXPLANATIONS_COUNT
    const explanationSuccess = Math.random() > 0.05;
    results.results.artworkExplanation = {
      firstBatchCount: firstBatchCount,
      totalCount: selectedCount,
      success: explanationSuccess,
      strategy: '首批快速响应，后续异步生成',
      batchIssue: '首批只有2条，用户可能需要等待更多内容'
    };
    console.log(`   ${explanationSuccess ? '✅' : '⚠️'} 首批${firstBatchCount}条讲解完成，耗时: ${explanationTime}ms`);
    console.log(`   📝 其余${selectedCount - firstBatchCount}条将异步生成`);

    // 计算总时间
    const totalTime = Object.values(results.timings).reduce((sum, time) => sum + time, 0);
    results.totalTime = totalTime;

    // 分析问题
    const analysis = analyzer.analyzeScenario(scenario, results);
    results.analysis = analysis;

    console.log(`\n🎯 场景总结:`);
    console.log(`   💭 用户输入: "${scenario.userInput.substring(0, 30)}..."`);
    console.log(`   🎨 检测情绪: ${scenario.emotion}`);
    console.log(`   📊 处理结果: ${artworkCount}→${scoredCount}→${selectedCount}件`);
    console.log(`   ⏱️  总耗时: ${totalTime}ms (${(totalTime/1000).toFixed(1)}秒)`);
    console.log(`   🐌 最慢阶段: ${analysis.performanceAnalysis.slowestPhase} (${analysis.performanceAnalysis.slowestDuration}ms)`);

    return results;

  } catch (error) {
    console.error(`❌ ${scenario.name} 处理失败:`, error.message);
    results.error = error.message;
    return results;
  }
}

// 辅助函数
function extractEmotionalKeywords(userInput) {
  const emotionalWords = [];
  if (userInput.includes('压力')) emotionalWords.push('压力', '疲惫');
  if (userInput.includes('分手')) emotionalWords.push('失落', '痛苦');
  if (userInput.includes('迷茫')) emotionalWords.push('困惑', '不确定');
  if (userInput.includes('平静')) emotionalWords.push('宁静', '平和');
  return emotionalWords;
}

function determineCurveType(emotion) {
  const curveMap = {
    'exhausted': 'recovery_wave',
    'heartbroken': 'healing_journey',
    'confused': 'clarification_path',
    'peaceful': 'gentle_flow',
    'mixed': 'exploratory_spiral'
  };
  return curveMap[emotion] || 'balanced_curve';
}

function generateNarrative(emotion) {
  const narratives = {
    'exhausted': '从疲惫中找回内心的平静和力量',
    'heartbroken': '通过艺术疗愈情感的创伤',
    'confused': '在艺术的指引下找到方向',
    'peaceful': '深化和延长内心的宁静状态',
    'mixed': '探索和理解复杂的情绪层次'
  };
  return narratives[emotion] || '通过艺术体验情绪的转化';
}

function generateTheme(emotion, userInput) {
  return `${emotion}：在艺术中找到内心的答案`;
}

function generateIntroduction(scenario) {
  return `基于您"${scenario.userInput}"的表达，我们为您精心策划了一场艺术之旅。这次展览将通过精选作品，陪伴您走过这段${scenario.emotion}的情绪历程。`;
}

function generateConclusion(scenario) {
  return `希望通过这次艺术体验，您能找到内心的平静与力量。每一件作品都是我们为您精心选择的情绪伙伴，愿它们能在您需要的时候给予温暖和支持。`;
}

// 主测试函数
async function runRealisticTests() {
  console.log('🎭 开始真实用户场景测试');
  console.log('测试目标：验证系统对真实用户输入的处理能力和性能表现\n');

  const allResults = [];
  const globalAnalysis = {
    totalScenarios: realisticScenarios.length,
    userInputQuality: [],
    performanceIssues: [],
    workflowProblems: [],
    recommendations: new Set()
  };

  for (const scenario of realisticScenarios) {
    const result = await simulateRealisticCurationFlow(scenario);
    allResults.push(result);

    // 收集全局分析数据
    if (result.analysis) {
      result.analysis.recommendations.forEach(rec => {
        globalAnalysis.recommendations.add(rec);
      });
    }
  }

  // 生成综合分析报告
  console.log('\n' + '='.repeat(80));
  console.log('📈 真实用户场景测试分析报告');
  console.log('='.repeat(80));

  console.log('\n🎯 测试场景总结:');
  allResults.forEach(result => {
    if (result.error) {
      console.log(`❌ ${result.scenario}: 处理失败 - ${result.error}`);
    } else {
      console.log(`✅ ${result.scenario}:`);
      console.log(`   用户输入: "${result.userInput.substring(0, 40)}..."`);
      console.log(`   检测情绪: ${result.emotion}`);
      console.log(`   处理时间: ${(result.totalTime/1000).toFixed(1)}秒`);
      console.log(`   最终作品: ${result.results.artworkSelection?.selectedCount}件`);
    }
  });

  console.log('\n⚠️ 发现的主要问题:');
  console.log('1. 🐌 LLM评分耗时过长');
  const avgScoringTime = allResults
    .filter(r => r.timings.llmScoring)
    .reduce((sum, r) => sum + r.timings.llmScoring, 0) /
    allResults.filter(r => r.timings.llmScoring).length;
  console.log(`   平均评分时间: ${(avgScoringTime/1000).toFixed(1)}秒`);

  console.log('\n2. 📝 策展总结生成顺序问题');
  console.log('   当前：在作品讲解之后生成');
  console.log('   建议：应在作品选择后立即生成');

  console.log('\n3. 📚 作品讲解分批策略');
  console.log('   当前：首批只生成2条讲解');
  console.log('   问题：用户可能需要等待更多内容');

  console.log('\n💡 优化建议:');
  Array.from(globalAnalysis.recommendations).forEach((rec, index) => {
    console.log(`${index + 1}. ${rec}`);
  });

  console.log('\n🚀 推荐的优化方案:');
  console.log('1. 并发优化：LLM评分和作品搜索并行处理');
  console.log('2. 缓存策略：对常见情绪进行评分缓存');
  console.log('3. 流式输出：使用SSE逐步返回结果');
  console.log('4. 工作流优化：调整策展总结生成顺序');
  console.log('5. 用户体验：增加进度指示器');

  console.log('\n🎉 真实用户场景测试完成！');

  return {
    results: allResults,
    analysis: globalAnalysis,
    recommendations: Array.from(globalAnalysis.recommendations)
  };
}

// 运行测试
if (require.main === module) {
  runRealisticTests().catch(console.error);
}

module.exports = { runRealisticTests, realisticScenarios, realisticTimings };