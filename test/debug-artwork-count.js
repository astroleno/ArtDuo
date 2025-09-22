// 调试作品数量 - 检查为什么只拿到8个结果
const API_BASE = 'http://localhost:3002';

async function debugArtworkCount() {
  console.log('🔍 调试作品数量 - 检查为什么只拿到8个结果');
  console.log('=' * 50);
  
  try {
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
    
    if (!response.ok) {
      console.log(`❌ API调用失败: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    
    console.log(`✅ API调用成功`);
    
    // 详细分析作品数量
    console.log(`\n📊 作品数量分析:`);
    
    // 1. 检查搜索计划
    if (data.diagnostics?.searchPlan) {
      console.log(`\n1️⃣ 搜索计划:`);
      console.log(`  - 关键词: ${data.diagnostics.searchPlan.keywords?.join(', ')}`);
      console.log(`  - 数据源: ${data.diagnostics.searchPlan.sources?.join(', ')}`);
      console.log(`  - 过滤器:`, data.diagnostics.searchPlan.filters);
    }
    
    // 2. 检查评分结果
    if (data.diagnostics?.scoringResult) {
      const scoring = data.diagnostics.scoringResult;
      console.log(`\n2️⃣ 评分结果:`);
      console.log(`  - 总处理数量: ${scoring.totalProcessed}`);
      console.log(`  - 成功数量: ${scoring.successCount}`);
      console.log(`  - 失败数量: ${scoring.failureCount}`);
      console.log(`  - 评分耗时: ${scoring.scoringTime}ms`);
    }
    
    // 3. 检查选择结果
    if (data.diagnostics?.selectionResult) {
      const selection = data.diagnostics.selectionResult;
      console.log(`\n3️⃣ 选择结果:`);
      console.log(`  - 选择数量: ${selection.selectedCount}`);
      console.log(`  - 选择理由: ${selection.selectionReasoning}`);
      console.log(`  - 多样性指标:`, selection.diversityMetrics);
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
    
    // 6. 分析问题
    console.log(`\n🔍 问题分析:`);
    
    const totalProcessed = data.diagnostics?.scoringResult?.totalProcessed || 0;
    const successCount = data.diagnostics?.scoringResult?.successCount || 0;
    const finalCount = data.artworks?.length || 0;
    
    console.log(`  - 评分处理数量: ${totalProcessed}`);
    console.log(`  - 评分成功数量: ${successCount}`);
    console.log(`  - 最终作品数量: ${finalCount}`);
    
    if (totalProcessed < 20) {
      console.log(`  ⚠️ 问题1: 评分处理数量较少 (${totalProcessed} < 20)`);
      console.log(`    可能原因: 限制了评分作品数量`);
    }
    
    if (successCount < totalProcessed) {
      console.log(`  ⚠️ 问题2: 评分成功率不足 (${successCount}/${totalProcessed})`);
      console.log(`    可能原因: LLM评分失败`);
    }
    
    if (finalCount < successCount) {
      console.log(`  ⚠️ 问题3: 最终作品数量少于评分成功数量 (${finalCount} < ${successCount})`);
      console.log(`    可能原因: 精选算法过滤了太多作品`);
    }
    
    // 7. 检查代码限制
    console.log(`\n🔧 代码限制检查:`);
    console.log(`  - LLM评分限制: 前8件作品 (在llm-judge.ts中)`);
    console.log(`  - 精选目标数量: 9件作品 (在artwork-selector.ts中)`);
    console.log(`  - 实际精选数量: ${finalCount}件`);
    
    if (finalCount < 9) {
      console.log(`  ⚠️ 精选数量不足，可能原因:`);
      console.log(`    1. 评分作品数量限制 (8件)`);
      console.log(`    2. 精选算法过于严格`);
      console.log(`    3. 作品质量不达标`);
    }
    
  } catch (error) {
    console.error(`❌ 调试失败: ${error.message}`);
  }
}

// 运行调试
debugArtworkCount();
