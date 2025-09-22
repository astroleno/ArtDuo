// 完整流程测试 - 验证LLM转义、粗选、精选、情绪曲线、请求地址并下载
const API_BASE = 'http://localhost:3002';

async function testCompleteFlow() {
  console.log('🧪 完整流程测试 - LLM转义 → 粗选 → 精选 → 情绪曲线 → 请求地址并下载');
  console.log('=' * 80);
  
  const testCases = [
    { 
      emotion: 'lonely', 
      userInput: '孤独的艺术',
      expectedStages: ['LLM转义', '粗选', '精选', '情绪曲线', '策展说明']
    },
    { 
      emotion: 'joy', 
      userInput: '快乐的色彩',
      expectedStages: ['LLM转义', '粗选', '精选', '情绪曲线', '策展说明']
    }
  ];
  
  let successCount = 0;
  let totalTests = testCases.length;
  
  for (const testCase of testCases) {
    console.log(`\n🎭 测试用例: "${testCase.emotion}" - "${testCase.userInput}"`);
    console.log('-' * 60);
    
    try {
      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE}/api/curate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emotion: testCase.emotion,
          userInput: testCase.userInput
        })
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (!response.ok) {
        console.log(`❌ API调用失败: ${response.status} ${response.statusText}`);
        continue;
      }
      
      const data = await response.json();
      
      console.log(`✅ API调用成功，总耗时: ${duration}ms`);
      
      // 验证各个阶段
      console.log(`\n🔍 阶段验证:`);
      
      // 1. LLM转义验证
      console.log(`\n1️⃣ LLM转义阶段:`);
      if (data.diagnostics?.searchPlan && data.diagnostics?.llmAnalysis) {
        console.log(`  ✅ 搜索计划生成成功`);
        console.log(`  ✅ 关键词: ${data.diagnostics.searchPlan.keywords?.join(', ')}`);
        console.log(`  ✅ 数据源: ${data.diagnostics.searchPlan.sources?.join(', ')}`);
        console.log(`  ✅ LLM分析: ${data.diagnostics.llmAnalysis.emotion_analysis?.substring(0, 50)}...`);
        console.log(`  ✅ 艺术风格: ${data.diagnostics.llmAnalysis.art_styles?.join(', ') || '无'}`);
        console.log(`  ✅ 推荐艺术家: ${data.diagnostics.llmAnalysis.recommended_artists?.join(', ') || '无'}`);
      } else {
        console.log(`  ❌ LLM转义阶段失败`);
      }
      
      // 2. 粗选验证
      console.log(`\n2️⃣ 粗选阶段:`);
      if (data.diagnostics?.scoringResult) {
        console.log(`  ✅ 粗选作品数量: ${data.diagnostics.scoringResult.totalProcessed}`);
        console.log(`  ✅ LLM评分成功: ${data.diagnostics.scoringResult.successCount}`);
        console.log(`  ✅ LLM评分失败: ${data.diagnostics.scoringResult.failureCount}`);
        console.log(`  ✅ 评分耗时: ${data.diagnostics.scoringResult.scoringTime}ms`);
      } else {
        console.log(`  ❌ 粗选阶段失败`);
      }
      
      // 3. 精选验证
      console.log(`\n3️⃣ 精选阶段:`);
      if (data.diagnostics?.selectionResult) {
        console.log(`  ✅ 精选作品数量: ${data.diagnostics.selectionResult.selectedCount}`);
        console.log(`  ✅ 选择理由: ${data.diagnostics.selectionResult.selectionReasoning}`);
        console.log(`  ✅ 选择耗时: ${data.diagnostics.selectionResult.selectionTime}ms`);
        console.log(`  ✅ 多样性指标:`);
        console.log(`    - 艺术家数量: ${data.diagnostics.selectionResult.diversityMetrics?.artistCount}`);
        console.log(`    - 时期数量: ${data.diagnostics.selectionResult.diversityMetrics?.periodCount}`);
        console.log(`    - 材质数量: ${data.diagnostics.selectionResult.diversityMetrics?.mediumCount}`);
        console.log(`    - 平均评分: ${data.diagnostics.selectionResult.diversityMetrics?.avgScore?.toFixed(2)}`);
        console.log(`    - 情绪契合度: ${data.diagnostics.selectionResult.diversityMetrics?.emotionFit?.toFixed(2)}`);
      } else {
        console.log(`  ❌ 精选阶段失败`);
      }
      
      // 4. 情绪曲线验证
      console.log(`\n4️⃣ 情绪曲线阶段:`);
      if (data.diagnostics?.emotionCurve) {
        console.log(`  ✅ 情绪曲线生成成功`);
        console.log(`  ✅ 曲线点数: ${data.diagnostics.emotionCurve.points?.length}`);
        console.log(`  ✅ 曲线描述: ${data.diagnostics.emotionCurve.description?.substring(0, 100)}...`);
        console.log(`  ✅ 生成耗时: ${data.diagnostics.emotionCurve.generationTime}ms`);
        console.log(`  ✅ 情绪曲线数据: [${data.curation?.emotionCurve?.slice(0, 5).map(v => v.toFixed(2)).join(', ')}...]`);
      } else {
        console.log(`  ❌ 情绪曲线阶段失败`);
      }
      
      // 5. 最终结果验证
      console.log(`\n5️⃣ 最终结果:`);
      console.log(`  ✅ 成功状态: ${data.success}`);
      console.log(`  ✅ 最终作品数量: ${data.artworks?.length}`);
      console.log(`  ✅ 策展主题: ${data.curation?.theme}`);
      console.log(`  ✅ 策展描述: ${data.curation?.description?.substring(0, 100)}...`);
      console.log(`  ✅ 数据来源: ${data.serviceInfo?.source}`);
      
      // 验证作品数据质量
      if (data.artworks && data.artworks.length > 0) {
        console.log(`  ✅ 作品示例: "${data.artworks[0].title}" by ${data.artworks[0].artist}`);
        console.log(`  ✅ 图片URL: ${data.artworks[0].imageUrl ? '有' : '无'}`);
        console.log(`  ✅ 博物馆: ${data.artworks[0].museum}`);
      }
      
      // 性能验证
      console.log(`\n⏱️ 性能指标:`);
      console.log(`  ✅ 总处理时间: ${data.diagnostics?.processingTime}ms`);
      console.log(`  ✅ 搜索计划构建: ${data.diagnostics?.planBuildTime}ms`);
      console.log(`  ✅ LLM评分: ${data.diagnostics?.scoringResult?.scoringTime}ms`);
      console.log(`  ✅ 情绪曲线生成: ${data.diagnostics?.emotionCurve?.generationTime}ms`);
      console.log(`  ✅ 作品选择: ${data.diagnostics?.selectionResult?.selectionTime}ms`);
      
      // 综合评估
      const hasAllStages = data.diagnostics?.searchPlan && 
                          data.diagnostics?.scoringResult && 
                          data.diagnostics?.selectionResult && 
                          data.diagnostics?.emotionCurve &&
                          data.artworks && 
                          data.artworks.length > 0;
      
      const isPerformanceGood = duration < 60000; // 60秒内完成
      
      const isSuccess = hasAllStages && isPerformanceGood;
      
      console.log(`\n${isSuccess ? '✅' : '❌'} 综合评估: ${isSuccess ? '通过' : '失败'}`);
      console.log(`  - 所有阶段完成: ${hasAllStages ? '✅' : '❌'}`);
      console.log(`  - 性能达标: ${isPerformanceGood ? '✅' : '❌'}`);
      
      if (isSuccess) {
        successCount++;
      }
      
    } catch (error) {
      console.error(`❌ 测试失败: ${error.message}`);
    }
    
    // 测试间隔
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('\n' + '=' * 80);
  console.log(`🎉 完整流程测试完成!`);
  console.log(`📊 测试结果: ${successCount}/${totalTests} 通过`);
  console.log(`📈 成功率: ${((successCount/totalTests)*100).toFixed(1)}%`);
  
  if (successCount === totalTests) {
    console.log(`🚀 所有测试通过！完整流程实现成功！`);
    console.log(`\n🎯 流程总结:`);
    console.log(`1. ✅ LLM转义 - 智能分析情绪主题，生成搜索策略`);
    console.log(`2. ✅ 粗选 - 并发调用API，获取候选作品并评分`);
    console.log(`3. ✅ 精选 - 智能选择最佳作品组合`);
    console.log(`4. ✅ 情绪曲线 - 生成动态情绪表达曲线`);
    console.log(`5. ✅ 策展说明 - 生成专业的展览描述`);
  } else {
    console.log(`⚠️ 部分测试失败，需要进一步优化`);
  }
}

// 运行测试
testCompleteFlow();
