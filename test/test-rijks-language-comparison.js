/**
 * 测试 Rijksmuseum API 的多语言搜索效果对比
 *
 * 目标：验证荷兰语关键词是否比英文关键词搜索效果更好
 *
 * 测试方法：
 * 1. 选择 emotion-3.json 中的核心情绪（phase 1）
 * 2. 用英文关键词搜索
 * 3. 用荷兰语关键词搜索
 * 4. 对比结果数量和质量
 */

const fs = require('fs');
const path = require('path');

// 加载环境变量
const env = require('../frontend/env.local.json');
const RIJKS_API_KEY = env.NEXT_PUBLIC_RIJKS_API_KEY;

// 加载情绪分类
const emotions = require('../frontend/data/emotion-3.json');

/**
 * 搜索 Rijksmuseum（单个关键词）
 */
async function searchRijksmuseum(language, keyword) {
  const url = `https://www.rijksmuseum.nl/api/${language}/collection?key=${RIJKS_API_KEY}&q=${encodeURIComponent(keyword)}&imgonly=true&ps=100`;

  console.log(`   🔍 搜索: ${language.toUpperCase()} - "${keyword}"`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`   ❌ HTTP ${response.status}: ${response.statusText}`);
      return { count: 0, artworks: [], error: response.statusText };
    }

    const data = await response.json();

    console.log(`   ✅ 找到 ${data.count || 0} 件作品`);

    return {
      count: data.count || 0,
      artworks: data.artObjects || [],
      error: null
    };
  } catch (error) {
    console.error(`   ❌ 请求失败: ${error.message}`);
    return { count: 0, artworks: [], error: error.message };
  }
}

/**
 * 测试单个情绪的多语言搜索效果
 */
async function testEmotionLanguageComparison(emotionId) {
  const emotion = emotions.emotions[emotionId];

  if (!emotion) {
    console.error(`❌ 情绪 "${emotionId}" 不存在`);
    return null;
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 测试情绪: ${emotion.name_cn} (${emotion.name_en} / ${emotion.name_nl})`);
  console.log(`   阶段: Phase ${emotion.phase}`);
  console.log(`${'='.repeat(70)}\n`);

  const results = {
    emotion_id: emotionId,
    emotion_cn: emotion.name_cn,
    emotion_en: emotion.name_en,
    emotion_nl: emotion.name_nl,
    phase: emotion.phase,
    english: { total: 0, keywords: [] },
    dutch: { total: 0, keywords: [] }
  };

  // 1. 测试英文关键词
  console.log(`📌 英文关键词搜索:`);
  for (const keyword of emotion.keywords_en.slice(0, 3)) {  // 只测试前3个
    const result = await searchRijksmuseum('en', keyword);
    results.english.keywords.push({
      keyword,
      count: result.count,
      sample: result.artworks.slice(0, 3).map(a => ({
        title: a.title,
        artist: a.principalOrFirstMaker
      }))
    });
    results.english.total += result.count;

    // 避免API限流
    await new Promise(resolve => setTimeout(resolve, 600));
  }

  // 2. 测试荷兰语关键词
  console.log(`\n📌 荷兰语关键词搜索:`);
  for (const keyword of emotion.keywords_nl.slice(0, 3)) {  // 只测试前3个
    const result = await searchRijksmuseum('nl', keyword);
    results.dutch.keywords.push({
      keyword,
      count: result.count,
      sample: result.artworks.slice(0, 3).map(a => ({
        title: a.title,
        artist: a.principalOrFirstMaker
      }))
    });
    results.dutch.total += result.count;

    // 避免API限流
    await new Promise(resolve => setTimeout(resolve, 600));
  }

  // 3. 对比分析
  console.log(`\n📈 结果对比:`);
  console.log(`   英文总计: ${results.english.total} 件`);
  console.log(`   荷兰语总计: ${results.dutch.total} 件`);

  const diff = results.dutch.total - results.english.total;
  const diffPercent = results.english.total > 0
    ? ((diff / results.english.total) * 100).toFixed(1)
    : 'N/A';

  if (diff > 0) {
    console.log(`   ✅ 荷兰语多 ${diff} 件 (+${diffPercent}%)`);
  } else if (diff < 0) {
    console.log(`   ⚠️ 英文多 ${Math.abs(diff)} 件 (-${Math.abs(diffPercent)}%)`);
  } else {
    console.log(`   = 结果相同`);
  }

  results.comparison = {
    difference: diff,
    difference_percent: diffPercent,
    winner: diff > 0 ? 'dutch' : diff < 0 ? 'english' : 'tie'
  };

  return results;
}

/**
 * 批量测试 Phase 1 核心情绪
 */
async function testPhase1Emotions() {
  console.log('\n🚀 开始测试 Phase 1 核心情绪的多语言搜索效果...\n');

  const phase1Emotions = Object.entries(emotions.emotions)
    .filter(([_, emotion]) => emotion.phase === 1)
    .map(([id, _]) => id);

  console.log(`📋 将测试 ${phase1Emotions.length} 种核心情绪:\n`);
  console.log(phase1Emotions.map((id, i) =>
    `   ${i + 1}. ${emotions.emotions[id].name_cn} (${id})`
  ).join('\n'));

  const allResults = [];

  for (let i = 0; i < phase1Emotions.length; i++) {
    const emotionId = phase1Emotions[i];

    console.log(`\n[${ i + 1}/${phase1Emotions.length}]`);

    const result = await testEmotionLanguageComparison(emotionId);
    if (result) {
      allResults.push(result);
    }

    // 避免API限流
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 生成总结报告
  generateSummaryReport(allResults);

  return allResults;
}

/**
 * 生成总结报告
 */
function generateSummaryReport(results) {
  console.log(`\n\n${'='.repeat(70)}`);
  console.log(`📊 测试总结报告`);
  console.log(`${'='.repeat(70)}\n`);

  const summary = {
    total_emotions: results.length,
    english_total: results.reduce((sum, r) => sum + r.english.total, 0),
    dutch_total: results.reduce((sum, r) => sum + r.dutch.total, 0),
    dutch_wins: results.filter(r => r.comparison.winner === 'dutch').length,
    english_wins: results.filter(r => r.comparison.winner === 'english').length,
    ties: results.filter(r => r.comparison.winner === 'tie').length
  };

  console.log(`测试情绪总数: ${summary.total_emotions} 种`);
  console.log(`英文关键词总结果: ${summary.english_total} 件`);
  console.log(`荷兰语关键词总结果: ${summary.dutch_total} 件`);
  console.log(`\n胜负统计:`);
  console.log(`  🇳🇱 荷兰语更好: ${summary.dutch_wins} 次`);
  console.log(`  🇬🇧 英文更好: ${summary.english_wins} 次`);
  console.log(`  = 平局: ${summary.ties} 次`);

  const avgDiff = ((summary.dutch_total - summary.english_total) / summary.total_emotions).toFixed(1);
  console.log(`\n平均差异: 荷兰语每个情绪多 ${avgDiff} 件作品`);

  // Top 5 荷兰语优势最大的情绪
  console.log(`\n🏆 荷兰语优势最大的情绪 (Top 5):`);
  const topDutch = results
    .filter(r => r.comparison.difference > 0)
    .sort((a, b) => b.comparison.difference - a.comparison.difference)
    .slice(0, 5);

  topDutch.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.emotion_cn}: 荷兰语多 ${r.comparison.difference} 件 (+${r.comparison.difference_percent}%)`);
  });

  // 保存详细结果到文件
  const timestamp = Date.now();
  const reportPath = path.join(__dirname, `rijks-language-test-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({
    summary,
    details: results,
    test_date: new Date().toISOString()
  }, null, 2));

  console.log(`\n💾 详细结果已保存到: ${reportPath}`);
}

/**
 * 快速测试（单个情绪）
 */
async function quickTest() {
  console.log('🧪 快速测试: 对比 "loneliness" (孤独) 的英文和荷兰语搜索\n');

  const result = await testEmotionLanguageComparison('loneliness');

  console.log('\n📝 结论:');
  if (result.comparison.winner === 'dutch') {
    console.log(`✅ 荷兰语关键词搜索效果更好，多找到 ${result.comparison.difference} 件作品`);
  } else if (result.comparison.winner === 'english') {
    console.log(`⚠️ 英文关键词搜索效果更好，多找到 ${Math.abs(result.comparison.difference)} 件作品`);
  } else {
    console.log(`= 两种语言搜索结果相同`);
  }

  return result;
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--full')) {
    // 完整测试：所有 Phase 1 情绪
    await testPhase1Emotions();
  } else if (args.includes('--emotion')) {
    // 测试单个情绪
    const emotionId = args[args.indexOf('--emotion') + 1];
    if (emotionId) {
      await testEmotionLanguageComparison(emotionId);
    } else {
      console.error('❌ 请提供情绪ID，例如: --emotion loneliness');
    }
  } else {
    // 默认：快速测试
    await quickTest();
  }
}

// 运行测试
main().catch(console.error);
