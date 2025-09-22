// 智能筛选测试 - 验证从大量作品中筛选出最相关的作品
const API_BASE = 'http://localhost:3002';

async function testSmartFiltering() {
  console.log('🔍 智能筛选测试 - 验证从大量作品中筛选出最相关的作品');
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
    
    // 详细分析智能筛选结果
    console.log(`\n📊 智能筛选分析:`);
    
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
    
    // 5. 检查服务信息
    if (data.serviceInfo) {
      console.log(`\n5️⃣ 服务信息:`);
      console.log(`  - 当前服务: ${data.serviceInfo.current}`);
      console.log(`  - 数据来源: ${data.serviceInfo.source}`);
    }
    
    // 6. 智能筛选效果分析
    console.log(`\n🎯 智能筛选效果分析:`);
    
    const totalProcessed = data.diagnostics?.scoringResult?.totalProcessed || 0;
    const successCount = data.diagnostics?.scoringResult?.successCount || 0;
    const finalCount = data.artworks?.length || 0;
    
    console.log(`  - 总作品数量: ${totalProcessed} (API返回的所有作品)`);
    console.log(`  - 筛选后评分数量: ${successCount} (智能筛选出的作品)`);
    console.log(`  - 最终精选数量: ${finalCount} (最终展出的作品)`);
    
    // 计算筛选效率
    const filterEfficiency = totalProcessed > 0 ? (successCount / totalProcessed * 100).toFixed(1) : 0;
    console.log(`  - 筛选效率: ${filterEfficiency}% (${successCount}/${totalProcessed})`);
    
    // 性能评估
    const scoringTime = data.diagnostics?.scoringResult?.scoringTime || 0;
    const avgTimePerArtwork = scoringTime / successCount;
    
    console.log(`\n⏱️ 性能评估:`);
    console.log(`  - 评分总耗时: ${scoringTime}ms`);
    console.log(`  - 平均每件作品评分时间: ${avgTimePerArtwork.toFixed(0)}ms`);
    
    if (scoringTime < 45000) {
      console.log(`  🚀 性能优秀: 评分时间 < 45秒`);
    } else if (scoringTime < 60000) {
      console.log(`  ✅ 性能良好: 评分时间 < 60秒`);
    } else {
      console.log(`  ⚠️ 性能需要优化: 评分时间 > 60秒`);
    }
    
    // 7. 智能筛选质量评估
    console.log(`\n💡 智能筛选质量评估:`);
    
    if (totalProcessed > 50) {
      console.log(`  ✅ 处理了大量作品 (${totalProcessed} > 50)`);
    } else if (totalProcessed > 20) {
      console.log(`  ✅ 处理了中等数量作品 (${totalProcessed} > 20)`);
    } else {
      console.log(`  ⚠️ 作品数量较少 (${totalProcessed} <= 20)`);
    }
    
    if (parseFloat(filterEfficiency) > 10) {
      console.log(`  ✅ 筛选效率合理 (${filterEfficiency}% > 10%)`);
    } else {
      console.log(`  ⚠️ 筛选效率偏低 (${filterEfficiency}% <= 10%)`);
    }
    
    if (finalCount >= 6) {
      console.log(`  ✅ 最终作品数量充足 (${finalCount} >= 6)`);
    } else {
      console.log(`  ⚠️ 最终作品数量偏少 (${finalCount} < 6)`);
    }
    
    // 综合评估
    const hasLargeDataset = totalProcessed > 20;
    const hasGoodFiltering = parseFloat(filterEfficiency) > 5;
    const hasGoodPerformance = scoringTime < 60000;
    const hasGoodFinalCount = finalCount >= 6;
    
    console.log(`\n${hasLargeDataset && hasGoodFiltering && hasGoodPerformance && hasGoodFinalCount ? '✅' : '❌'} 综合评估: ${hasLargeDataset && hasGoodFiltering && hasGoodPerformance && hasGoodFinalCount ? '智能筛选成功' : '需要进一步优化'}`);
    console.log(`  - 处理大量作品: ${hasLargeDataset ? '✅' : '❌'}`);
    console.log(`  - 筛选效率良好: ${hasGoodFiltering ? '✅' : '❌'}`);
    console.log(`  - 性能表现良好: ${hasGoodPerformance ? '✅' : '❌'}`);
    console.log(`  - 最终作品充足: ${hasGoodFinalCount ? '✅' : '❌'}`);
    
    if (hasLargeDataset && hasGoodFiltering && hasGoodPerformance && hasGoodFinalCount) {
      console.log(`\n🚀 智能筛选优化成功！`);
      console.log(`📈 优化成果:`);
      console.log(`  - 处理作品数量: ${totalProcessed}件 (vs 之前的固定数量)`);
      console.log(`  - 智能筛选效率: ${filterEfficiency}% (${successCount}/${totalProcessed})`);
      console.log(`  - 最终作品数量: ${finalCount}件`);
      console.log(`  - 总处理时间: ${duration}ms`);
      console.log(`  - 平均评分时间: ${avgTimePerArtwork.toFixed(0)}ms/件`);
    }
    
  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);
  }
}

// 运行测试
testSmartFiltering();
