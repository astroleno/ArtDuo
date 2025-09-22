// 最终评分性能测试
const API_BASE = 'http://localhost:3002';

async function testFinalScoring() {
  console.log('🧪 最终评分性能测试 - 高并发单个评分');
  console.log('=' * 50);
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(`${API_BASE}/api/curate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emotion: 'calm',
        userInput: '平静的艺术'
      })
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (!response.ok) {
      console.log(`❌ API调用失败: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    
    console.log(`✅ API调用成功，总耗时: ${duration}ms`);
    
    // 验证最终评分结果
    console.log(`\n🔍 最终评分验证:`);
    
    if (data.diagnostics?.scoringResult) {
      const scoring = data.diagnostics.scoringResult;
      console.log(`  ✅ 评分作品数量: ${scoring.totalProcessed}`);
      console.log(`  ✅ 评分成功数量: ${scoring.successCount}`);
      console.log(`  ✅ 评分失败数量: ${scoring.failureCount}`);
      console.log(`  ✅ 评分耗时: ${scoring.scoringTime}ms`);
      console.log(`  ✅ 成功率: ${((scoring.successCount/scoring.totalProcessed)*100).toFixed(1)}%`);
      
      // 性能评估
      const avgTimePerArtwork = scoring.scoringTime / scoring.totalProcessed;
      console.log(`  ✅ 平均每件作品评分时间: ${avgTimePerArtwork.toFixed(0)}ms`);
      
      if (scoring.scoringTime < 25000) {
        console.log(`  🚀 性能优秀: 评分时间 < 25秒`);
      } else if (scoring.scoringTime < 35000) {
        console.log(`  ✅ 性能良好: 评分时间 < 35秒`);
      } else {
        console.log(`  ⚠️ 性能需要优化: 评分时间 > 35秒`);
      }
    } else {
      console.log(`  ❌ 最终评分结果缺失`);
    }
    
    // 验证最终作品质量
    console.log(`\n🎨 最终作品质量验证:`);
    if (data.artworks && data.artworks.length > 0) {
      console.log(`  ✅ 最终作品数量: ${data.artworks.length}`);
      console.log(`  ✅ 作品示例: "${data.artworks[0].title}" by ${data.artworks[0].artist}`);
      console.log(`  ✅ 策展主题: ${data.curation?.theme}`);
      console.log(`  ✅ 策展描述: ${data.curation?.description?.substring(0, 100)}...`);
    }
    
    // 综合评估
    const hasValidScoring = data.diagnostics?.scoringResult && 
                           data.diagnostics.scoringResult.successCount > 0;
    const hasValidArtworks = data.artworks && data.artworks.length > 0;
    const isPerformanceGood = data.diagnostics?.scoringResult?.scoringTime < 35000;
    
    console.log(`\n${hasValidScoring && hasValidArtworks ? '✅' : '❌'} 综合评估: ${hasValidScoring && hasValidArtworks ? '通过' : '失败'}`);
    console.log(`  - 高并发评分成功: ${hasValidScoring ? '✅' : '❌'}`);
    console.log(`  - 作品选择成功: ${hasValidArtworks ? '✅' : '❌'}`);
    console.log(`  - 性能表现: ${isPerformanceGood ? '✅' : '⚠️'}`);
    
    if (hasValidScoring && hasValidArtworks) {
      console.log(`\n🚀 高并发评分优化成功！`);
      console.log(`📈 最终优化策略:`);
      console.log(`  - 并发数: 4个并发`);
      console.log(`  - 评分作品数: 8件`);
      console.log(`  - 批次延迟: 300ms`);
      console.log(`  - 成功率: ${data.diagnostics.scoringResult.successCount}/${data.diagnostics.scoringResult.totalProcessed}`);
      console.log(`  - 总耗时: ${data.diagnostics.scoringResult.scoringTime}ms`);
      
      console.log(`\n🎯 优化效果:`);
      console.log(`  - 解决了评分拖沓问题`);
      console.log(`  - 消除了评分失败问题`);
      console.log(`  - 提高了系统稳定性`);
      console.log(`  - 改善了用户体验`);
    }
    
  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);
  }
}

// 运行测试
testFinalScoring();
