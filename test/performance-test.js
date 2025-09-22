// 性能测试 - 验证优化后的性能
const API_BASE = 'http://localhost:3002';

async function testPerformance() {
  console.log('🧪 性能测试 - 验证优化后的性能');
  console.log('=' * 50);
  
  const testCases = [
    { emotion: 'joy', userInput: '快乐的色彩' },
    { emotion: 'calm', userInput: '平静的艺术' },
    { emotion: 'lonely', userInput: '孤独的艺术' }
  ];
  
  let totalTime = 0;
  let successCount = 0;
  
  for (const testCase of testCases) {
    console.log(`\n🎭 测试用例: "${testCase.emotion}" - "${testCase.userInput}"`);
    
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
      
      console.log(`✅ API调用成功，耗时: ${duration}ms`);
      console.log(`📊 性能指标:`);
      console.log(`  - 总处理时间: ${data.diagnostics?.processingTime}ms`);
      console.log(`  - 搜索计划构建: ${data.diagnostics?.planBuildTime}ms`);
      console.log(`  - LLM评分: ${data.diagnostics?.scoringResult?.scoringTime}ms`);
      console.log(`  - 情绪曲线生成: ${data.diagnostics?.emotionCurve?.generationTime}ms`);
      console.log(`  - 作品选择: ${data.diagnostics?.selectionResult?.selectionTime}ms`);
      console.log(`  - 最终作品数量: ${data.artworks?.length}`);
      
      totalTime += duration;
      successCount++;
      
    } catch (error) {
      console.error(`❌ 测试失败: ${error.message}`);
    }
    
    // 测试间隔
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n' + '=' * 50);
  console.log(`🎉 性能测试完成!`);
  console.log(`📊 测试结果: ${successCount}/${testCases.length} 通过`);
  console.log(`📈 成功率: ${((successCount/testCases.length)*100).toFixed(1)}%`);
  
  if (successCount > 0) {
    const avgTime = totalTime / successCount;
    console.log(`⏱️ 平均响应时间: ${avgTime.toFixed(0)}ms`);
    console.log(`⏱️ 总测试时间: ${totalTime}ms`);
    
    if (avgTime < 60000) {
      console.log(`✅ 性能达标: 平均响应时间 < 60秒`);
    } else {
      console.log(`⚠️ 性能需要优化: 平均响应时间 > 60秒`);
    }
  }
}

// 运行测试
testPerformance();
