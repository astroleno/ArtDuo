// 调试粗选阶段 - 检查实际获取了多少作品
const API_BASE = 'http://localhost:3002';

async function debugCoarseSelection() {
  console.log('🔍 调试粗选阶段 - 检查实际获取了多少作品');
  console.log('=' * 60);
  
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
    
    // 分析粗选结果
    console.log(`\n📊 粗选阶段分析:`);
    
    // 1. 检查搜索计划
    if (data.diagnostics?.searchPlan) {
      console.log(`\n1️⃣ 搜索计划:`);
      console.log(`  - 关键词: ${data.diagnostics.searchPlan.keywords?.join(', ')}`);
      console.log(`  - 数据源: ${data.diagnostics.searchPlan.sources?.join(', ')}`);
    }
    
    // 2. 检查服务信息
    if (data.serviceInfo) {
      console.log(`\n2️⃣ 服务信息:`);
      console.log(`  - 当前服务: ${data.serviceInfo.current}`);
      console.log(`  - 数据来源: ${data.serviceInfo.source}`);
      console.log(`  - 所有服务状态:`);
      if (data.serviceInfo.allServices) {
        data.serviceInfo.allServices.forEach(service => {
          console.log(`    - ${service.name}: ${service.available ? '✅ 可用' : '❌ 不可用'}`);
        });
      }
    }
    
    // 3. 检查评分结果
    if (data.diagnostics?.scoringResult) {
      const scoring = data.diagnostics.scoringResult;
      console.log(`\n3️⃣ 评分结果:`);
      console.log(`  - 总处理数量: ${scoring.totalProcessed}`);
      console.log(`  - 成功数量: ${scoring.successCount}`);
      console.log(`  - 失败数量: ${scoring.failureCount}`);
      console.log(`  - 评分耗时: ${scoring.scoringTime}ms`);
    }
    
    // 4. 检查选择结果
    if (data.diagnostics?.selectionResult) {
      const selection = data.diagnostics.selectionResult;
      console.log(`\n4️⃣ 选择结果:`);
      console.log(`  - 选择数量: ${selection.selectedCount}`);
      console.log(`  - 选择理由: ${selection.selectionReasoning}`);
    }
    
    // 5. 检查最终结果
    console.log(`\n5️⃣ 最终结果:`);
    console.log(`  - 最终作品数量: ${data.artworks?.length || 0}`);
    console.log(`  - 策展主题: ${data.curation?.theme}`);
    console.log(`  - 总作品数: ${data.curation?.totalWorks}`);
    
    // 6. 分析问题
    console.log(`\n🔍 问题分析:`);
    
    const totalProcessed = data.diagnostics?.scoringResult?.totalProcessed || 0;
    const finalCount = data.artworks?.length || 0;
    
    console.log(`  - 总处理数量: ${totalProcessed}`);
    console.log(`  - 最终作品数量: ${finalCount}`);
    
    // 分析粗选阶段的问题
    console.log(`\n📈 粗选阶段分析:`);
    
    if (totalProcessed === 20) {
      console.log(`  ⚠️ 问题: 总处理数量被限制为20件`);
      console.log(`    原因: 在curate/route.ts中，artworksToScore被限制为前20件作品`);
      console.log(`    代码: const artworksToScore = artworkResult.artworks.slice(0, 20);`);
      console.log(`    建议: 增加这个限制，或者让智能筛选来决定评分数量`);
    }
    
    // 7. 检查作品来源分布
    if (data.artworks && data.artworks.length > 0) {
      console.log(`\n6️⃣ 作品来源分布:`);
      const sourceCounts = {};
      data.artworks.forEach(artwork => {
        const source = artwork.source || '未知';
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      });
      
      Object.entries(sourceCounts).forEach(([source, count]) => {
        console.log(`  - ${source}: ${count} 件作品`);
      });
    }
    
    // 8. 优化建议
    console.log(`\n💡 优化建议:`);
    
    if (totalProcessed === 20) {
      console.log(`  🔧 增加评分作品数量:`);
      console.log(`    1. 修改curate/route.ts中的artworksToScore限制`);
      console.log(`    2. 从20件增加到50件或更多`);
      console.log(`    3. 让智能筛选来决定实际评分数量`);
    }
    
    if (finalCount < 9) {
      console.log(`  🔧 增加最终作品数量:`);
      console.log(`    1. 降低精选算法的最低评分要求`);
      console.log(`    2. 放宽多样性限制`);
      console.log(`    3. 增加目标作品数量`);
    }
    
  } catch (error) {
    console.error(`❌ 调试失败: ${error.message}`);
  }
}

// 运行调试
debugCoarseSelection();
