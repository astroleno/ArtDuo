// 作品数量优化测试 - 验证增加作品数量后的效果
const API_BASE = 'http://localhost:3002';

async function testArtworkCountOptimization() {
  console.log('🔍 作品数量优化测试 - 验证增加作品数量后的效果');
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
    
    // 详细分析作品数量
    console.log(`\n📊 作品数量分析:`);
    
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
      console.log(`  - 所有服务状态:`);
      if (data.serviceInfo.allServices) {
        data.serviceInfo.allServices.forEach(service => {
          console.log(`    - ${service.name}: ${service.available ? '✅ 可用' : '❌ 不可用'}`);
        });
      }
    }
    
    // 6. 优化效果分析
    console.log(`\n🎯 优化效果分析:`);
    
    const totalProcessed = data.diagnostics?.scoringResult?.totalProcessed || 0;
    const successCount = data.diagnostics?.scoringResult?.successCount || 0;
    const finalCount = data.artworks?.length || 0;
    
    console.log(`  - 评分处理数量: ${totalProcessed} (目标: 20)`);
    console.log(`  - 评分成功数量: ${successCount}`);
    console.log(`  - 最终作品数量: ${finalCount} (目标: 9)`);
    
    // 性能评估
    const scoringTime = data.diagnostics?.scoringResult?.scoringTime || 0;
    const avgTimePerArtwork = scoringTime / totalProcessed;
    
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
    
    // 7. 优化建议
    console.log(`\n💡 优化建议:`);
    
    if (totalProcessed < 15) {
      console.log(`  ⚠️ 评分作品数量仍然偏少 (${totalProcessed} < 15)`);
      console.log(`    建议: 检查API服务是否返回了足够的作品`);
    } else {
      console.log(`  ✅ 评分作品数量充足 (${totalProcessed} >= 15)`);
    }
    
    if (finalCount < 6) {
      console.log(`  ⚠️ 最终作品数量偏少 (${finalCount} < 6)`);
      console.log(`    建议: 进一步降低精选算法的筛选标准`);
    } else {
      console.log(`  ✅ 最终作品数量充足 (${finalCount} >= 6)`);
    }
    
    if (avgTimePerArtwork > 3000) {
      console.log(`  ⚠️ 单件作品评分时间过长 (${avgTimePerArtwork.toFixed(0)}ms > 3000ms)`);
      console.log(`    建议: 考虑进一步优化LLM调用或增加并发数`);
    } else {
      console.log(`  ✅ 单件作品评分时间合理 (${avgTimePerArtwork.toFixed(0)}ms <= 3000ms)`);
    }
    
    // 综合评估
    const hasEnoughArtworks = totalProcessed >= 15 && finalCount >= 6;
    const hasGoodPerformance = scoringTime < 60000;
    const hasGoodSuccessRate = (successCount / totalProcessed) >= 0.8;
    
    console.log(`\n${hasEnoughArtworks && hasGoodPerformance && hasGoodSuccessRate ? '✅' : '❌'} 综合评估: ${hasEnoughArtworks && hasGoodPerformance && hasGoodSuccessRate ? '优化成功' : '需要进一步优化'}`);
    console.log(`  - 作品数量充足: ${hasEnoughArtworks ? '✅' : '❌'}`);
    console.log(`  - 性能表现良好: ${hasGoodPerformance ? '✅' : '❌'}`);
    console.log(`  - 评分成功率良好: ${hasGoodSuccessRate ? '✅' : '❌'}`);
    
    if (hasEnoughArtworks && hasGoodPerformance && hasGoodSuccessRate) {
      console.log(`\n🚀 作品数量优化成功！`);
      console.log(`📈 优化成果:`);
      console.log(`  - 评分作品数量: ${totalProcessed}件 (vs 之前的12件)`);
      console.log(`  - 最终作品数量: ${finalCount}件 (vs 之前的2-3件)`);
      console.log(`  - 评分成功率: ${((successCount/totalProcessed)*100).toFixed(1)}%`);
      console.log(`  - 总处理时间: ${duration}ms`);
    }
    
  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);
  }
}

// 运行测试
testArtworkCountOptimization();
