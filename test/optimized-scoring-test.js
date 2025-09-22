// 优化后的LLM评分系统测试
const API_BASE = 'http://localhost:3002';

async function testOptimizedScoring() {
  console.log('🚀 优化后的LLM评分系统测试');
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
    
    // 详细分析优化后的评分系统
    console.log(`\n📊 优化后的评分系统分析:`);
    
    // 1. 检查搜索计划
    if (data.diagnostics?.searchPlan) {
      console.log(`\n1️⃣ 搜索计划:`);
      console.log(`  - 关键词: ${data.diagnostics.searchPlan.keywords?.join(', ')}`);
      console.log(`  - 数据源: ${data.diagnostics.searchPlan.sources?.join(', ')}`);
    }
    
    // 2. 检查评分结果
    if (data.diagnostics?.scoringResult) {
      const scoring = data.diagnostics.scoringResult;
      console.log(`\n2️⃣ 评分结果:`);
      console.log(`  - 总处理数量: ${scoring.totalProcessed}`);
      console.log(`  - 成功数量: ${scoring.successCount}`);
      console.log(`  - 失败数量: ${scoring.failureCount}`);
      console.log(`  - 评分耗时: ${scoring.scoringTime}ms`);
      console.log(`  - 成功率: ${((scoring.successCount/scoring.totalProcessed)*100).toFixed(1)}%`);
    }
    
    // 3. 检查选择结果
    if (data.diagnostics?.selectionResult) {
      const selection = data.diagnostics.selectionResult;
      console.log(`\n3️⃣ 选择结果:`);
      console.log(`  - 选择数量: ${selection.selectedCount}`);
      console.log(`  - 选择理由: ${selection.selectionReasoning}`);
      console.log(`  - 多样性指标:`);
      console.log(`    - 艺术家数量: ${selection.diversityMetrics?.artistCount}`);
      console.log(`    - 时期数量: ${selection.diversityMetrics?.periodCount}`);
      console.log(`    - 材质数量: ${selection.diversityMetrics?.mediumCount}`);
      console.log(`    - 平均评分: ${selection.diversityMetrics?.avgScore}`);
      console.log(`    - 情绪契合度: ${selection.diversityMetrics?.emotionFit}`);
    }
    
    // 4. 检查最终结果
    console.log(`\n4️⃣ 最终结果:`);
    console.log(`  - 最终作品数量: ${data.artworks?.length || 0}`);
    console.log(`  - 策展主题: ${data.curation?.theme}`);
    console.log(`  - 总作品数: ${data.curation?.totalWorks}`);
    
    // 5. 优化效果分析
    console.log(`\n🎯 优化效果分析:`);
    
    const totalProcessed = data.diagnostics?.scoringResult?.totalProcessed || 0;
    const successCount = data.diagnostics?.scoringResult?.successCount || 0;
    const finalCount = data.artworks?.length || 0;
    const scoringTime = data.diagnostics?.scoringResult?.scoringTime || 0;
    
    console.log(`  - 总作品数量: ${totalProcessed} (API返回的所有作品)`);
    console.log(`  - 筛选后评分数量: ${successCount} (智能筛选出的作品)`);
    console.log(`  - 最终精选数量: ${finalCount} (最终展出的作品)`);
    
    // 计算筛选效率
    const filterEfficiency = totalProcessed > 0 ? (successCount / totalProcessed * 100).toFixed(1) : 0;
    console.log(`  - 筛选效率: ${filterEfficiency}% (${successCount}/${totalProcessed})`);
    
    // 性能评估
    const avgTimePerArtwork = scoringTime / successCount;
    console.log(`  - 评分总耗时: ${scoringTime}ms`);
    console.log(`  - 平均每件作品评分时间: ${avgTimePerArtwork.toFixed(0)}ms`);
    
    // 6. 优化成果评估
    console.log(`\n🚀 优化成果评估:`);
    
    // 作品数量优化
    if (totalProcessed > 30) {
      console.log(`  ✅ 作品数量优化成功: 处理了 ${totalProcessed} 件作品 (vs 之前的20件)`);
    } else {
      console.log(`  ⚠️ 作品数量仍需优化: 只处理了 ${totalProcessed} 件作品`);
    }
    
    // 评分效率优化
    if (parseFloat(filterEfficiency) > 40) {
      console.log(`  ✅ 筛选效率优化成功: ${filterEfficiency}% (vs 之前的100%)`);
    } else {
      console.log(`  ⚠️ 筛选效率需要优化: ${filterEfficiency}%`);
    }
    
    // 性能优化
    if (scoringTime < 60000) {
      console.log(`  ✅ 性能优化成功: 评分时间 ${scoringTime}ms < 60秒`);
    } else {
      console.log(`  ⚠️ 性能需要进一步优化: 评分时间 ${scoringTime}ms > 60秒`);
    }
    
    // 最终作品质量
    if (finalCount >= 9) {
      console.log(`  ✅ 最终作品数量充足: ${finalCount} 件作品`);
    } else {
      console.log(`  ⚠️ 最终作品数量不足: ${finalCount} < 9 件作品`);
    }
    
    // 7. 综合评估
    const hasGoodQuantity = totalProcessed > 30;
    const hasGoodEfficiency = parseFloat(filterEfficiency) > 40;
    const hasGoodPerformance = scoringTime < 60000;
    const hasGoodFinalCount = finalCount >= 9;
    
    console.log(`\n${hasGoodQuantity && hasGoodEfficiency && hasGoodPerformance && hasGoodFinalCount ? '✅' : '❌'} 综合评估: ${hasGoodQuantity && hasGoodEfficiency && hasGoodPerformance && hasGoodFinalCount ? '优化成功' : '需要进一步优化'}`);
    console.log(`  - 作品数量充足: ${hasGoodQuantity ? '✅' : '❌'}`);
    console.log(`  - 筛选效率良好: ${hasGoodEfficiency ? '✅' : '❌'}`);
    console.log(`  - 性能表现良好: ${hasGoodPerformance ? '✅' : '❌'}`);
    console.log(`  - 最终作品充足: ${hasGoodFinalCount ? '✅' : '❌'}`);
    
    if (hasGoodQuantity && hasGoodEfficiency && hasGoodPerformance && hasGoodFinalCount) {
      console.log(`\n🎉 优化成功！系统现在能够:`);
      console.log(`  📈 处理更多作品: ${totalProcessed} 件 (vs 之前的20件)`);
      console.log(`  🎯 智能筛选: ${filterEfficiency}% 效率`);
      console.log(`  ⚡ 高效评分: ${avgTimePerArtwork.toFixed(0)}ms/件`);
      console.log(`  🎨 优质输出: ${finalCount} 件精选作品`);
    }
    
  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);
  }
}

// 运行测试
testOptimizedScoring();
