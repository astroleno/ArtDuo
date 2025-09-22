// 完整流程验证 - 两个数据源 + 粗筛 + 分析 + 分别请求
const API_BASE = 'http://localhost:3002';

async function verifyCompleteFlow() {
  console.log('🔍 完整流程验证 - 两个数据源 + 粗筛 + 分析 + 分别请求');
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
    
    // 验证完整流程的各个阶段
    console.log(`\n🔍 完整流程验证:`);
    
    // 1. 验证LLM转义阶段
    console.log(`\n1️⃣ LLM转义阶段:`);
    if (data.diagnostics?.searchPlan && data.diagnostics?.llmAnalysis) {
      console.log(`  ✅ 搜索计划生成成功`);
      console.log(`  ✅ 关键词: ${data.diagnostics.searchPlan.keywords?.join(', ')}`);
      console.log(`  ✅ 数据源: ${data.diagnostics.searchPlan.sources?.join(', ')}`);
      console.log(`  ✅ LLM分析: ${data.diagnostics.llmAnalysis.emotion_analysis?.substring(0, 50)}...`);
      console.log(`  ✅ 艺术风格: ${data.diagnostics.llmAnalysis.art_styles?.join(', ') || '无'}`);
      console.log(`  ✅ 推荐艺术家: ${data.diagnostics.llmAnalysis.recommended_artists?.join(', ') || '无'}`);
    } else {
      console.log(`  ❌ LLM转义阶段失败`);
    }
    
    // 2. 验证粗筛阶段（两个数据源）
    console.log(`\n2️⃣ 粗筛阶段（两个数据源）:`);
    if (data.diagnostics?.scoringResult) {
      const scoring = data.diagnostics.scoringResult;
      console.log(`  ✅ 粗筛作品数量: ${scoring.totalProcessed}`);
      console.log(`  ✅ LLM评分成功: ${scoring.successCount}`);
      console.log(`  ✅ LLM评分失败: ${scoring.failureCount}`);
      console.log(`  ✅ 评分耗时: ${scoring.scoringTime}ms`);
    } else {
      console.log(`  ❌ 粗筛阶段失败`);
    }
    
    // 3. 验证服务信息（两个数据源状态）
    console.log(`\n3️⃣ 数据源状态:`);
    if (data.serviceInfo) {
      console.log(`  ✅ 当前服务: ${data.serviceInfo.current}`);
      console.log(`  ✅ 数据来源: ${data.serviceInfo.source}`);
      console.log(`  ✅ 所有服务状态:`);
      if (data.serviceInfo.allServices) {
        data.serviceInfo.allServices.forEach(service => {
          console.log(`    - ${service.name}: ${service.available ? '✅ 可用' : '❌ 不可用'}`);
        });
      }
    } else {
      console.log(`  ❌ 服务信息缺失`);
    }
    
    // 4. 验证精选阶段
    console.log(`\n4️⃣ 精选阶段:`);
    if (data.diagnostics?.selectionResult) {
      const selection = data.diagnostics.selectionResult;
      console.log(`  ✅ 精选作品数量: ${selection.selectedCount}`);
      console.log(`  ✅ 选择理由: ${selection.selectionReasoning}`);
      console.log(`  ✅ 多样性指标:`);
      console.log(`    - 艺术家数量: ${selection.diversityMetrics?.artistCount}`);
      console.log(`    - 时期数量: ${selection.diversityMetrics?.periodCount}`);
      console.log(`    - 材质数量: ${selection.diversityMetrics?.mediumCount}`);
      console.log(`    - 平均评分: ${selection.diversityMetrics?.avgScore}`);
      console.log(`    - 情绪契合度: ${selection.diversityMetrics?.emotionFit}`);
    } else {
      console.log(`  ❌ 精选阶段失败`);
    }
    
    // 5. 验证情绪曲线阶段
    console.log(`\n5️⃣ 情绪曲线阶段:`);
    if (data.diagnostics?.emotionCurve) {
      console.log(`  ✅ 情绪曲线生成成功`);
      console.log(`  ✅ 曲线点数: ${data.diagnostics.emotionCurve.points?.length}`);
      console.log(`  ✅ 曲线描述: ${data.diagnostics.emotionCurve.description?.substring(0, 100)}...`);
      console.log(`  ✅ 生成耗时: ${data.diagnostics.emotionCurve.generationTime}ms`);
    } else {
      console.log(`  ❌ 情绪曲线阶段失败`);
    }
    
    // 6. 验证最终结果
    console.log(`\n6️⃣ 最终结果:`);
    console.log(`  ✅ 成功状态: ${data.success}`);
    console.log(`  ✅ 最终作品数量: ${data.artworks?.length}`);
    console.log(`  ✅ 策展主题: ${data.curation?.theme}`);
    console.log(`  ✅ 策展描述: ${data.curation?.description?.substring(0, 100)}...`);
    console.log(`  ✅ 情绪曲线数据: ${data.curation?.emotionCurve?.length} 个点`);
    
    // 验证作品数据质量
    if (data.artworks && data.artworks.length > 0) {
      console.log(`  ✅ 作品示例: "${data.artworks[0].title}" by ${data.artworks[0].artist}`);
      console.log(`  ✅ 图片URL: ${data.artworks[0].imageUrl ? '有' : '无'}`);
      console.log(`  ✅ 博物馆: ${data.artworks[0].museum}`);
      console.log(`  ✅ 数据源: ${data.artworks[0].source}`);
    }
    
    // 综合评估
    const hasLLMTransformation = data.diagnostics?.searchPlan && data.diagnostics?.llmAnalysis;
    const hasCoarseSelection = data.diagnostics?.scoringResult && data.diagnostics.scoringResult.totalProcessed > 0;
    const hasTwoDataSources = data.serviceInfo?.allServices && data.serviceInfo.allServices.length >= 2;
    const hasFineSelection = data.diagnostics?.selectionResult && data.diagnostics.selectionResult.selectedCount > 0;
    const hasEmotionCurve = data.diagnostics?.emotionCurve && data.diagnostics.emotionCurve.points?.length > 0;
    const hasFinalResult = data.artworks && data.artworks.length > 0;
    
    console.log(`\n${hasLLMTransformation && hasCoarseSelection && hasTwoDataSources && hasFineSelection && hasEmotionCurve && hasFinalResult ? '✅' : '❌'} 综合评估: ${hasLLMTransformation && hasCoarseSelection && hasTwoDataSources && hasFineSelection && hasEmotionCurve && hasFinalResult ? '通过' : '失败'}`);
    console.log(`  - LLM转义: ${hasLLMTransformation ? '✅' : '❌'}`);
    console.log(`  - 粗筛（两个数据源）: ${hasCoarseSelection ? '✅' : '❌'}`);
    console.log(`  - 两个数据源可用: ${hasTwoDataSources ? '✅' : '❌'}`);
    console.log(`  - 精选: ${hasFineSelection ? '✅' : '❌'}`);
    console.log(`  - 情绪曲线: ${hasEmotionCurve ? '✅' : '❌'}`);
    console.log(`  - 最终结果: ${hasFinalResult ? '✅' : '❌'}`);
    
    if (hasLLMTransformation && hasCoarseSelection && hasTwoDataSources && hasFineSelection && hasEmotionCurve && hasFinalResult) {
      console.log(`\n🚀 完整流程验证成功！`);
      console.log(`\n🎯 流程总结:`);
      console.log(`1. ✅ LLM转义 - 智能分析情绪主题，生成搜索策略`);
      console.log(`2. ✅ 粗筛 - 从两个数据源（Met + Rijks）获取作品并评分`);
      console.log(`3. ✅ 精选 - 智能选择最佳作品组合`);
      console.log(`4. ✅ 情绪曲线 - 生成动态情绪表达曲线`);
      console.log(`5. ✅ 策展说明 - 生成专业的展览描述`);
      
      console.log(`\n📊 数据源利用:`);
      console.log(`  - Met Museum API: ${data.serviceInfo.allServices.find(s => s.name === 'Met Museum API')?.available ? '✅ 可用' : '❌ 不可用'}`);
      console.log(`  - Rijks Museum API: ${data.serviceInfo.allServices.find(s => s.name === 'Rijks Museum API')?.available ? '✅ 可用' : '❌ 不可用'}`);
      console.log(`  - 当前使用: ${data.serviceInfo.current}`);
      console.log(`  - 数据来源: ${data.serviceInfo.source}`);
    } else {
      console.log(`⚠️ 部分流程失败，需要进一步优化`);
    }
    
  } catch (error) {
    console.error(`❌ 验证失败: ${error.message}`);
  }
}

// 运行验证
verifyCompleteFlow();
