#!/usr/bin/env node
/**
 * Full flow smoke test for /api/curate.
 * Usage: node test/full-flow-run.js [emotion] [userInput]
 * Environment:
 *   API_BASE (default http://localhost:3000)
 */

const BASE_URL = process.env.API_BASE || 'http://localhost:3000';
const emotion = process.argv[2] || 'joy';
const userInput = process.argv.slice(3).join(' ') || '快乐的色彩';

async function main() {
  console.log('🔍 ArtDuo /api/curate 全流程测试');
  console.log('----------------------------------');
  console.log(`📍 API_BASE: ${BASE_URL}`);
  console.log(`🎭 Emotion : ${emotion}`);
  console.log(`🗒️  Input : ${userInput}`);
  console.log();

  const payload = { emotion, userInput };
  const overallStart = Date.now();

  let response;
  try {
    response = await fetch(`${BASE_URL}/api/curate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    process.exit(1);
  }

  const overallTime = Date.now() - overallStart;
  console.log(`⏱️ API 响应码: ${response.status}`);
  console.log(`⏱️ 总耗时: ${overallTime} ms`);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('❌ 响应错误内容:', errorBody);
    process.exit(1);
  }

  const data = await response.json();
  const diagnostics = data.diagnostics || {};

  console.log();
  console.log('📊 阶段耗时（来自 diagnostics ）');
  logStage('搜索计划构建', diagnostics.planBuildTime);
  logStage('LLM 评分', diagnostics.scoringResult?.scoringTime);
  logStage('情绪曲线生成', diagnostics.emotionCurve?.generationTime);
  logStage('作品精选', diagnostics.selectionResult?.selectionTime);
  logStage('作品讲解', diagnostics.explanationResult?.explanationTime);
  logStage('策展总结', diagnostics.summaryTime);
  logStage('总处理时间', diagnostics.processingTime);

  console.log();
  console.log('📈 阶段数据统计');
  logMetric('粗选作品数', diagnostics.scoringResult?.totalProcessed);
  logMetric('评分成功数', diagnostics.scoringResult?.successCount);
  logMetric('评分失败数', diagnostics.scoringResult?.failureCount);
  logMetric('精选作品数', diagnostics.selectionResult?.selectedCount);
  logMetric('情绪曲线点数', diagnostics.emotionCurve?.points?.length);
  logMetric('讲解成功数', diagnostics.explanationResult?.successCount);
  logMetric('讲解失败数', diagnostics.explanationResult?.failureCount);

  console.log();
  console.log('🎨 作品示例');
  if (Array.isArray(data.artworks) && data.artworks.length > 0) {
    const sample = data.artworks.slice(0, 3);
    sample.forEach((artwork, index) => {
      console.log(`  ${index + 1}. "${artwork.title}" - ${artwork.artist} (${artwork.year || '年份未知'})`);
    });
  } else {
    console.log('  暂无作品返回');
  }

  console.log();
  console.log('📝 策展摘要预览');
  if (data.curation?.description) {
    console.log(`  ${truncate(data.curation.description, 180)}`);
  } else {
    console.log('  未返回策展描述');
  }

  console.log();
  console.log('✅ 测试完成');
}

function logStage(label, duration) {
  if (typeof duration === 'number') {
    console.log(`  ${label.padEnd(10, ' ')}: ${duration} ms`);
  } else {
    console.log(`  ${label.padEnd(10, ' ')}: (无数据)`);
  }
}

function logMetric(label, value) {
  if (typeof value === 'number') {
    console.log(`  ${label.padEnd(10, ' ')}: ${value}`);
  } else {
    console.log(`  ${label.padEnd(10, ' ')}: (无数据)`);
  }
}

function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

main().catch(err => {
  console.error('❌ 脚本异常:', err);
  process.exit(1);
});
