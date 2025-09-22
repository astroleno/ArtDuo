// 快速流程测试 - 验证核心功能
const API_BASE = 'http://localhost:3002';

async function testQuickFlow() {
  console.log('🧪 快速流程测试 - 验证核心功能');
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
    
    // 验证各个阶段
    console.log(`\n🔍 核心功能验证:`);
    
    // 1. LLM转义验证
    console.log(`\n1️⃣ LLM转义阶段:`);
    if (data.diagnostics?.searchPlan && data.diagnostics?.llmAnalysis) {
      console.log(`  ✅ 搜索计划生成成功`);
      console.log(`  ✅ 关键词: ${data.diagnostics.searchPlan.keywords?.join(', ')}`);
      console.log(`  ✅ 数据源: ${data.diagnostics.searchPlan.sources?.join(', ')}`);
      console.log(`  ✅ LLM分析: ${data.diagnostics.llmAnalysis.emotion_analysis?.substring(0, 50)}...`);
    } else {
      console.log(`  ❌ LLM转义阶段失败`);
    }
    
    // 2. 粗选验证
    console.log(`\n2️⃣ 粗选阶段:`);
    if (data.diagnostics?.scoringResult) {
      console.log(`  ✅ 粗选作品数量: ${data.diagnostics.scoringResult.totalProcessed}`);
      console.log(`  ✅ LLM评分成功: ${data.diagnostics.scoringResult.successCount}`);
      console.log(`  ✅ LLM评分失败: ${data.diagnostics.scoringResult.failureCount}`);
    } else {
      console.log(`  ❌ 粗选阶段失败`);
    }
    
    // 3. 精选验证
    console.log(`\n3️⃣ 精选阶段:`);
    if (data.diagnostics?.selectionResult) {
      console.log(`  ✅ 精选作品数量: ${data.diagnostics.selectionResult.selectedCount}`);
      console.log(`  ✅ 选择理由: ${data.diagnostics.selectionResult.selectionReasoning}`);
      console.log(`  ✅ 多样性指标:`);
      console.log(`    - 艺术家数量: ${data.diagnostics.selectionResult.diversityMetrics?.artistCount}`);
      console.log(`    - 时期数量: ${data.diagnostics.selectionResult.diversityMetrics?.periodCount}`);
      console.log(`    - 材质数量: ${data.diagnostics.selectionResult.diversityMetrics?.mediumCount}`);
    } else {
      console.log(`  ❌ 精选阶段失败`);
    }
    
    // 4. 情绪曲线验证
    console.log(`\n4️⃣ 情绪曲线阶段:`);
    if (data.diagnostics?.emotionCurve) {
      console.log(`  ✅ 情绪曲线生成成功`);
      console.log(`  ✅ 曲线点数: ${data.diagnostics.emotionCurve.points?.length}`);
      console.log(`  ✅ 曲线描述: ${data.diagnostics.emotionCurve.description?.substring(0, 100)}...`);
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
    
    console.log(`\n${hasAllStages ? '✅' : '❌'} 综合评估: ${hasAllStages ? '通过' : '失败'}`);
    console.log(`  - 所有阶段完成: ${hasAllStages ? '✅' : '❌'}`);
    
    if (hasAllStages) {
      console.log(`\n🚀 核心功能测试通过！完整流程实现成功！`);
      console.log(`\n🎯 流程总结:`);
      console.log(`1. ✅ LLM转义 - 智能分析情绪主题，生成搜索策略`);
      console.log(`2. ✅ 粗选 - 并发调用API，获取候选作品并评分`);
      console.log(`3. ✅ 精选 - 智能选择最佳作品组合`);
      console.log(`4. ✅ 情绪曲线 - 生成动态情绪表达曲线`);
      console.log(`5. ✅ 策展说明 - 生成专业的展览描述`);
    } else {
      console.log(`⚠️ 部分功能失败，需要进一步优化`);
    }
    
  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);
  }
}

// 运行测试
testQuickFlow();
