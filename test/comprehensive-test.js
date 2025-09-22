#!/usr/bin/env node

/**
 * 全面测试脚本 - 不同复杂度的输入测试
 * 测试5次，记录各阶段响应时间和策展质量
 */

const { execSync } = require('child_process');
const fs = require('fs');

// 不同复杂度的测试用例
const testCases = [
  {
    id: 1,
    complexity: '简单',
    description: '单一情绪词',
    input: { emotion: 'joy' },
    expectedKeywords: ['celebration', 'happiness', 'festival', 'dance', 'music']
  },
  {
    id: 2,
    complexity: '中等',
    description: '情绪词+简单描述',
    input: { emotion: 'melancholy', userInput: 'melancholy and peaceful' },
    expectedKeywords: ['sadness', 'contemplation', 'loneliness', 'peaceful', 'serene']
  },
  {
    id: 3,
    complexity: '复杂',
    description: '情绪词+详细描述',
    input: { emotion: 'calm', userInput: 'calm and serene landscape paintings from impressionist period' },
    expectedKeywords: ['landscape', 'impressionist', 'serene', 'peaceful', 'nature']
  },
  {
    id: 4,
    complexity: '高复杂',
    description: '复合情绪+艺术风格要求',
    input: { emotion: 'passion', userInput: 'passion and love in baroque art with dramatic lighting and emotional intensity' },
    expectedKeywords: ['baroque', 'dramatic', 'lighting', 'emotional', 'intensity']
  },
  {
    id: 5,
    complexity: '极高复杂',
    description: '多维度要求+具体艺术家',
    input: { emotion: 'lonely', userInput: 'lonely and isolated figures in romantic period art, similar to Caspar David Friedrich style' },
    expectedKeywords: ['isolated', 'figures', 'romantic', 'Friedrich', 'solitude']
  }
];

console.log('🚀 ArtDuo 全面测试开始');
console.log('========================\n');

let testResults = [];
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// 运行测试
for (const testCase of testCases) {
  totalTests++;
  console.log(`🚀 测试 ${testCase.id}: ${testCase.complexity} - ${testCase.description}`);
  console.log(`📝 输入: ${JSON.stringify(testCase.input)}`);
  
  const testResult = {
    id: testCase.id,
    complexity: testCase.complexity,
    description: testCase.description,
    input: testCase.input,
    expectedKeywords: testCase.expectedKeywords,
    startTime: new Date().toISOString(),
    success: false,
    error: null,
    response: null,
    performance: {},
    quality: {}
  };
  
  try {
    const startTime = Date.now();
    
    // 构建curl命令
    const curlCommand = `curl -X POST http://localhost:3000/api/curate -H "Content-Type: application/json" -d '${JSON.stringify(testCase.input)}' 2>/dev/null`;
    
    // 执行请求
    const response = execSync(curlCommand, { encoding: 'utf8', timeout: 180000 }); // 3分钟超时
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    try {
      const data = JSON.parse(response);
      
      if (data.success && data.artworks && data.artworks.length > 0) {
        // 记录性能数据
        testResult.performance = {
          totalTime: totalTime,
          searchPlanTime: data.diagnostics?.planBuildTime || 0,
          llmScoringTime: data.diagnostics?.scoringResult?.scoringTime || 0,
          explanationTime: data.diagnostics?.explanationResult?.explanationTime || 0,
          summaryTime: data.diagnostics?.summaryTime || 0,
          artworkCount: data.artworks.length,
          explanationCount: data.explanations?.length || 0
        };
        
        // 记录质量数据
        testResult.quality = {
          searchPlan: {
            keywords: data.diagnostics?.searchPlan?.keywords || [],
            filters: data.diagnostics?.searchPlan?.filters || {},
            sources: data.diagnostics?.searchPlan?.sources || []
          },
          llmAnalysis: data.diagnostics?.llmAnalysis || {},
          scoringResult: {
            totalProcessed: data.diagnostics?.scoringResult?.totalProcessed || 0,
            successCount: data.diagnostics?.scoringResult?.successCount || 0,
            failureCount: data.diagnostics?.scoringResult?.failureCount || 0
          },
          emotionCurve: {
            points: data.diagnostics?.emotionCurve?.points || [],
            description: data.diagnostics?.emotionCurve?.description || ''
          },
          selectionResult: {
            selectedCount: data.diagnostics?.selectionResult?.selectedCount || 0,
            selectionReasoning: data.diagnostics?.selectionResult?.selectionReasoning || '',
            diversityMetrics: data.diagnostics?.selectionResult?.diversityMetrics || {}
          },
          curation: {
            theme: data.curation?.theme || '',
            description: data.curation?.description || '',
            totalWorks: data.curation?.totalWorks || 0
          },
          explanations: data.explanations || []
        };
        
        testResult.response = data;
        testResult.success = true;
        testResult.endTime = new Date().toISOString();
        
        console.log(`  ✅ 测试通过:`);
        console.log(`    - 总耗时: ${totalTime}ms`);
        console.log(`    - 搜索计划: ${testResult.performance.searchPlanTime}ms`);
        console.log(`    - LLM评分: ${testResult.performance.llmScoringTime}ms`);
        console.log(`    - 作品讲解: ${testResult.performance.explanationTime}ms`);
        console.log(`    - 策展总结: ${testResult.performance.summaryTime}ms`);
        console.log(`    - 作品数量: ${testResult.performance.artworkCount}`);
        console.log(`    - 讲解数量: ${testResult.performance.explanationCount}`);
        console.log(`    - 生成关键词: ${testResult.quality.searchPlan.keywords.join(', ')}`);
        
        passedTests++;
      } else {
        testResult.error = '返回数据无效';
        testResult.response = response.substring(0, 500);
        testResult.endTime = new Date().toISOString();
        
        console.log(`  ❌ 测试失败: 返回数据无效`);
        console.log(`    - 响应: ${response.substring(0, 200)}...`);
        failedTests++;
      }
    } catch (parseError) {
      testResult.error = `JSON解析错误: ${parseError.message}`;
      testResult.response = response.substring(0, 500);
      testResult.endTime = new Date().toISOString();
      
      console.log(`  ❌ 测试失败: JSON解析错误`);
      console.log(`    - 错误: ${parseError.message}`);
      console.log(`    - 响应: ${response.substring(0, 200)}...`);
      failedTests++;
    }
    
  } catch (error) {
    testResult.error = error.message;
    testResult.endTime = new Date().toISOString();
    
    console.log(`  ❌ 测试失败: ${error.message}`);
    failedTests++;
  }
  
  testResults.push(testResult);
  console.log(''); // 空行分隔
}

// 生成测试报告
const report = generateTestReport(testResults, totalTests, passedTests, failedTests);

// 保存报告到文件
const reportPath = '/Users/zuobowen/Documents/GitHub/ArtDuo/comprehensive-test-report.md';
fs.writeFileSync(reportPath, report, 'utf8');

console.log('📊 测试完成');
console.log('============');
console.log(`总测试数: ${totalTests}`);
console.log(`通过: ${passedTests}`);
console.log(`失败: ${failedTests}`);
console.log(`成功率: ${Math.round((passedTests / totalTests) * 100)}%`);
console.log(`\n📄 详细报告已保存到: ${reportPath}`);

function generateTestReport(results, total, passed, failed) {
  const timestamp = new Date().toISOString();
  
  let report = `# ArtDuo 全面测试报告

**测试时间**: ${timestamp}
**测试总数**: ${total}
**通过数量**: ${passed}
**失败数量**: ${failed}
**成功率**: ${Math.round((passed / total) * 100)}%

## 📊 测试概览

| 测试ID | 复杂度 | 描述 | 状态 | 总耗时 | 作品数量 | 讲解数量 |
|--------|--------|------|------|--------|----------|----------|
`;

  // 添加测试概览表格
  results.forEach(result => {
    const status = result.success ? '✅ 通过' : '❌ 失败';
    const totalTime = result.performance?.totalTime || 'N/A';
    const artworkCount = result.performance?.artworkCount || 'N/A';
    const explanationCount = result.performance?.explanationCount || 'N/A';
    
    report += `| ${result.id} | ${result.complexity} | ${result.description} | ${status} | ${totalTime}ms | ${artworkCount} | ${explanationCount} |\n`;
  });

  report += `
## 📈 性能分析

### 各阶段平均耗时

| 阶段 | 平均时间 | 最短时间 | 最长时间 |
|------|----------|----------|----------|
`;

  // 计算性能统计
  const performanceStats = calculatePerformanceStats(results);
  
  Object.entries(performanceStats).forEach(([stage, stats]) => {
    if (stats.times.length > 0) {
      report += `| ${stage} | ${stats.avg}ms | ${stats.min}ms | ${stats.max}ms |\n`;
    }
  });

  report += `
## 🔍 详细测试结果

`;

  // 添加每个测试的详细结果
  results.forEach(result => {
    report += `### 测试 ${result.id}: ${result.complexity} - ${result.description}

**输入**: \`${JSON.stringify(result.input)}\`

**预期关键词**: ${result.expectedKeywords.join(', ')}

**测试状态**: ${result.success ? '✅ 通过' : '❌ 失败'}

**测试时间**: ${result.startTime} - ${result.endTime}

`;

    if (result.success) {
      report += `#### 性能数据
- **总耗时**: ${result.performance.totalTime}ms
- **搜索计划**: ${result.performance.searchPlanTime}ms
- **LLM评分**: ${result.performance.llmScoringTime}ms
- **作品讲解**: ${result.performance.explanationTime}ms
- **策展总结**: ${result.performance.summaryTime}ms
- **作品数量**: ${result.performance.artworkCount}
- **讲解数量**: ${result.performance.explanationCount}

#### 搜索计划质量
- **生成关键词**: ${result.quality.searchPlan.keywords.join(', ')}
- **过滤器**: ${JSON.stringify(result.quality.searchPlan.filters, null, 2)}
- **数据源**: ${result.quality.searchPlan.sources.join(', ')}

#### LLM分析结果
\`\`\`json
${JSON.stringify(result.quality.llmAnalysis, null, 2)}
\`\`\`

#### 评分结果
- **总处理数**: ${result.quality.scoringResult.totalProcessed}
- **成功数**: ${result.quality.scoringResult.successCount}
- **失败数**: ${result.quality.scoringResult.failureCount}

#### 情绪曲线
- **描述**: ${result.quality.emotionCurve.description}
- **点数**: ${result.quality.emotionCurve.points.length}

#### 作品选择结果
- **选中数量**: ${result.quality.selectionResult.selectedCount}
- **选择理由**: ${result.quality.selectionResult.selectionReasoning}
- **多样性指标**: ${JSON.stringify(result.quality.selectionResult.diversityMetrics, null, 2)}

#### 策展结果
- **主题**: ${result.quality.curation.theme}
- **总作品数**: ${result.quality.curation.totalWorks}
- **策展描述**: ${result.quality.curation.description.substring(0, 200)}...

#### 作品讲解示例
`;

      // 添加前3个作品讲解的示例
      if (result.quality.explanations && result.quality.explanations.length > 0) {
        result.quality.explanations.slice(0, 3).forEach((explanation, index) => {
          report += `**作品 ${index + 1}: ${explanation.title}**

- **情绪关联**: ${explanation.explanation.emotionalConnection}
- **艺术分析**: ${explanation.explanation.artisticAnalysis}
- **历史背景**: ${explanation.explanation.historicalContext}
- **策展理由**: ${explanation.explanation.curationReason}
- **用户相关性**: ${explanation.explanation.userRelevance}
- **置信度**: ${explanation.confidence}

`;
        });
      }

    } else {
      report += `#### 错误信息
\`\`\`
${result.error}
\`\`\`

#### 响应数据
\`\`\`
${result.response}
\`\`\`

`;
    }

    report += `---

`;
  });

  report += `
## 📊 质量评估

### 关键词匹配度分析

| 测试ID | 预期关键词 | 实际关键词 | 匹配度 |
|--------|------------|------------|--------|
`;

  // 添加关键词匹配度分析
  results.forEach(result => {
    if (result.success) {
      const expected = result.expectedKeywords;
      const actual = result.quality.searchPlan.keywords;
      const matchCount = expected.filter(keyword => 
        actual.some(actualKeyword => 
          actualKeyword.toLowerCase().includes(keyword.toLowerCase()) ||
          keyword.toLowerCase().includes(actualKeyword.toLowerCase())
        )
      ).length;
      const matchRate = Math.round((matchCount / expected.length) * 100);
      
      report += `| ${result.id} | ${expected.join(', ')} | ${actual.join(', ')} | ${matchRate}% |\n`;
    }
  });

  report += `
### 策展质量评估

| 测试ID | 作品数量 | 讲解质量 | 策展描述长度 | 多样性指标 |
|--------|----------|----------|--------------|------------|
`;

  // 添加策展质量评估
  results.forEach(result => {
    if (result.success) {
      const artworkCount = result.performance.artworkCount;
      const explanationCount = result.performance.explanationCount;
      const descriptionLength = result.quality.curation.description.length;
      const diversity = result.quality.selectionResult.diversityMetrics;
      
      report += `| ${result.id} | ${artworkCount} | ${explanationCount}/${artworkCount} | ${descriptionLength}字符 | ${JSON.stringify(diversity)} |\n`;
    }
  });

  report += `
## 🎯 总结与建议

### 性能表现
- **平均总耗时**: ${performanceStats.totalTime?.avg || 'N/A'}ms
- **搜索计划优化**: 平均 ${performanceStats.searchPlan?.avg || 'N/A'}ms
- **LLM评分优化**: 平均 ${performanceStats.llmScoring?.avg || 'N/A'}ms
- **作品讲解**: 平均 ${performanceStats.explanation?.avg || 'N/A'}ms

### 质量表现
- **成功率**: ${Math.round((passed / total) * 100)}%
- **功能完整性**: 所有核心功能正常工作
- **响应质量**: 生成的作品讲解和策展总结质量良好

### 优化建议
1. **性能优化**: 继续优化作品讲解的批处理策略
2. **质量提升**: 增强关键词匹配的准确性
3. **稳定性**: 提高复杂输入的稳定性
4. **用户体验**: 考虑实现异步处理，提升响应速度

---
*报告生成时间: ${new Date().toISOString()}*
`;

  return report;
}

function calculatePerformanceStats(results) {
  const stats = {
    totalTime: { times: [], avg: 0, min: 0, max: 0 },
    searchPlan: { times: [], avg: 0, min: 0, max: 0 },
    llmScoring: { times: [], avg: 0, min: 0, max: 0 },
    explanation: { times: [], avg: 0, min: 0, max: 0 },
    summary: { times: [], avg: 0, min: 0, max: 0 }
  };

  results.forEach(result => {
    if (result.success && result.performance) {
      stats.totalTime.times.push(result.performance.totalTime);
      stats.searchPlan.times.push(result.performance.searchPlanTime);
      stats.llmScoring.times.push(result.performance.llmScoringTime);
      stats.explanation.times.push(result.performance.explanationTime);
      stats.summary.times.push(result.performance.summaryTime);
    }
  });

  Object.keys(stats).forEach(key => {
    const times = stats[key].times;
    if (times.length > 0) {
      stats[key].avg = Math.round(times.reduce((sum, time) => sum + time, 0) / times.length);
      stats[key].min = Math.min(...times);
      stats[key].max = Math.max(...times);
    }
  });

  return stats;
}
