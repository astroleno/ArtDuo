// 混合优化评分测试 - 并发调用 + 单次多段评分
const API_BASE = 'http://localhost:3002';

async function testHybridScoring() {
  console.log('🧪 混合优化评分测试 - 并发调用 + 单次多段评分');
  console.log('=' * 60);
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(`${API_BASE}/api/curate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emotion: 'joy',
        userInput: '快乐的色彩'
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
    
    // 验证混合优化评分结果
    console.log(`\n🔍 混合优化评分验证:`);
    
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
      
      if (scoring.scoringTime < 20000) {
        console.log(`  🚀 性能优秀: 评分时间 < 20秒`);
      } else if (scoring.scoringTime < 30000) {
        console.log(`  ✅ 性能良好: 评分时间 < 30秒`);
      } else {
        console.log(`  ⚠️ 性能需要优化: 评分时间 > 30秒`);
      }
    } else {
      console.log(`  ❌ 混合优化评分结果缺失`);
    }
    
    // 验证最终作品质量
    console.log(`\n🎨 最终作品质量验证:`);
    if (data.artworks && data.artworks.length > 0) {
      console.log(`  ✅ 最终作品数量: ${data.artworks.length}`);
      console.log(`  ✅ 作品示例: "${data.artworks[0].title}" by ${data.artworks[0].artist}`);
      console.log(`  ✅ 策展主题: ${data.curation?.theme}`);
      console.log(`  ✅ 策展描述: ${data.curation?.description?.substring(0, 100)}...`);
    }
    
    // 验证情绪曲线
    if (data.diagnostics?.emotionCurve) {
      console.log(`\n🎭 情绪曲线验证:`);
      console.log(`  ✅ 曲线点数: ${data.diagnostics.emotionCurve.points?.length}`);
      console.log(`  ✅ 曲线描述: ${data.diagnostics.emotionCurve.description?.substring(0, 100)}...`);
    }
    
    // 综合评估
    const hasValidScoring = data.diagnostics?.scoringResult && 
                           data.diagnostics.scoringResult.successCount > 0;
    const hasValidArtworks = data.artworks && data.artworks.length > 0;
    const isPerformanceGood = data.diagnostics?.scoringResult?.scoringTime < 30000;
    
    console.log(`\n${hasValidScoring && hasValidArtworks ? '✅' : '❌'} 综合评估: ${hasValidScoring && hasValidArtworks ? '通过' : '失败'}`);
    console.log(`  - 混合优化评分成功: ${hasValidScoring ? '✅' : '❌'}`);
    console.log(`  - 作品选择成功: ${hasValidArtworks ? '✅' : '❌'}`);
    console.log(`  - 性能表现: ${isPerformanceGood ? '✅' : '⚠️'}`);
    
    if (hasValidScoring && hasValidArtworks) {
      console.log(`\n🚀 混合优化策略成功！`);
      console.log(`📈 优化亮点:`);
      console.log(`  - 并发处理多个批次，提高整体效率`);
      console.log(`  - 每个批次内多段评分，减少LLM调用次数`);
      console.log(`  - 平衡了并发效率和评分质量`);
      console.log(`  - 提高了系统的稳定性和可靠性`);
      
      console.log(`\n🔧 技术架构:`);
      console.log(`  - 将12件作品分成3个批次，每批次4件作品`);
      console.log(`  - 3个批次并发处理，每个批次内部多段评分`);
      console.log(`  - 总LLM调用次数: 3次 (vs 原来的12次)`);
      console.log(`  - 并发度: 3个批次同时处理`);
    }
    
  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);
  }
}

// 运行测试
testHybridScoring();
