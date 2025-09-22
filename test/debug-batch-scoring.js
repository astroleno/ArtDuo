// 调试批量评分 - 检查LLM响应格式
const API_BASE = 'http://localhost:3002';

async function debugBatchScoring() {
  console.log('🔍 调试批量评分 - 检查LLM响应格式');
  console.log('=' * 50);
  
  try {
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
    
    if (!response.ok) {
      console.log(`❌ API调用失败: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    
    console.log(`✅ API调用成功`);
    
    // 检查诊断信息
    if (data.diagnostics) {
      console.log(`\n📊 诊断信息:`);
      console.log(`  - 搜索计划构建时间: ${data.diagnostics.planBuildTime}ms`);
      console.log(`  - 总处理时间: ${data.diagnostics.processingTime}ms`);
      
      if (data.diagnostics.scoringResult) {
        const scoring = data.diagnostics.scoringResult;
        console.log(`\n🧠 评分结果:`);
        console.log(`  - 总处理数量: ${scoring.totalProcessed}`);
        console.log(`  - 成功数量: ${scoring.successCount}`);
        console.log(`  - 失败数量: ${scoring.failureCount}`);
        console.log(`  - 评分时间: ${scoring.scoringTime}ms`);
      }
      
      if (data.diagnostics.selectionResult) {
        const selection = data.diagnostics.selectionResult;
        console.log(`\n🎯 选择结果:`);
        console.log(`  - 选择数量: ${selection.selectedCount}`);
        console.log(`  - 选择理由: ${selection.selectionReasoning}`);
        console.log(`  - 多样性指标:`, selection.diversityMetrics);
      }
    }
    
    // 检查最终结果
    console.log(`\n🎨 最终结果:`);
    console.log(`  - 成功状态: ${data.success}`);
    console.log(`  - 作品数量: ${data.artworks?.length || 0}`);
    console.log(`  - 策展主题: ${data.curation?.theme}`);
    
    if (data.artworks && data.artworks.length > 0) {
      console.log(`  - 作品示例: "${data.artworks[0].title}" by ${data.artworks[0].artist}`);
    }
    
    // 检查服务信息
    if (data.serviceInfo) {
      console.log(`\n🔧 服务信息:`);
      console.log(`  - 当前服务: ${data.serviceInfo.current}`);
      console.log(`  - 数据来源: ${data.serviceInfo.source}`);
    }
    
  } catch (error) {
    console.error(`❌ 调试失败: ${error.message}`);
  }
}

// 运行调试
debugBatchScoring();
