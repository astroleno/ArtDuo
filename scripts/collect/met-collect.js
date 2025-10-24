/**
 * Met Museum 艺术作品采集脚本
 *
 * 功能：
 * 1. 基于 emotion-4.json 的情绪分类
 * 2. 用英文关键词搜索 Met Museum API
 * 3. 获取完整的作品信息（名称、作者、图片、讲解等）
 * 4. 按情绪分类保存到 JSON 文件
 *
 * 使用：
 *   node scripts/collect/met-collect.js --phase 1              # 采集 Phase 1 核心情绪
 *   node scripts/collect/met-collect.js --emotion loneliness   # 采集单个情绪
 *   node scripts/collect/met-collect.js --test                 # 测试模式（每个情绪只采集5件）
 */

const fs = require('fs');
const path = require('path');

// 配置
const MET_API_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';
const OUTPUT_DIR = path.resolve(__dirname, '../../data/met/artworks');
const REPORT_DIR = path.resolve(__dirname, '../../data/met/reports');
const BATCH_DELAY = 500;  // 每批次延迟（毫秒）
const DETAIL_DELAY = 100; // 获取详情延迟（毫秒）
const SEARCH_MAX_RETRIES = 3;
const DETAIL_MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 2000;

// 加载情绪分类
const emotions = require(path.resolve(__dirname, '../../frontend/data/emotion-4.json'));

/**
 * 工具函数：延迟
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 工具函数：安全的文件名
 */
function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function normalize(str) {
  return (str || '').toLowerCase();
}

function collectTextForMatching(artwork) {
  const segments = [
    artwork.title,
    artwork.artist,
    artwork.medium,
    artwork.classification,
    artwork.objectName,
    artwork.galleryLabelText,
    artwork.additionalText,
    artwork.description,
    (artwork.tags || []).map(tag => tag.term).join(' ')
  ].filter(Boolean);

  return normalize(segments.join(' \n '));
}

function validateEmotionData(results) {
  const keywords = (results.keywords || []).map(k => normalize(k));
  const totalArtworks = results.artworks.length;

  const issues = {
    missingDescriptionIDs: [],
    missingImageIDs: [],
    weakKeywordMatchIDs: []
  };

  let withDescription = 0;
  let withKeywordMatch = 0;
  let withImage = 0;
  let aggregateAdditionalImages = 0;

  results.artworks.forEach(artwork => {
    const hasDescription = Boolean(artwork.description && artwork.description.trim());
    const hasImage = Boolean(artwork.imageThumbnail || artwork.imageUrl);
    const keywordText = collectTextForMatching(artwork);
    const hasKeywordMatch = keywords.length === 0
      ? true
      : keywords.some(keyword => keyword && keywordText.includes(keyword));

    if (hasDescription) {
      withDescription += 1;
    } else {
      issues.missingDescriptionIDs.push(artwork.id);
    }

    if (hasImage) {
      withImage += 1;
    } else {
      issues.missingImageIDs.push(artwork.id);
    }

    if (hasKeywordMatch) {
      withKeywordMatch += 1;
    } else {
      issues.weakKeywordMatchIDs.push(artwork.id);
    }

    if (Array.isArray(artwork.additionalImages)) {
      aggregateAdditionalImages += artwork.additionalImages.length;
    }
  });

  const summary = {
    totalArtworks,
    withDescription,
    descriptionCoverage: totalArtworks ? +(withDescription / totalArtworks).toFixed(3) : 0,
    withKeywordMatch,
    keywordCoverage: totalArtworks ? +(withKeywordMatch / totalArtworks).toFixed(3) : 0,
    withImage,
    imageCoverage: totalArtworks ? +(withImage / totalArtworks).toFixed(3) : 0,
    avgAdditionalImages: totalArtworks ? +(aggregateAdditionalImages / totalArtworks).toFixed(2) : 0
  };

  return {
    generatedAt: new Date().toISOString(),
    summary,
    sampleIssues: {
      missingDescriptionIDs: issues.missingDescriptionIDs.slice(0, 20),
      missingImageIDs: issues.missingImageIDs.slice(0, 20),
      weakKeywordMatchIDs: issues.weakKeywordMatchIDs.slice(0, 20)
    },
    totals: {
      missingDescription: issues.missingDescriptionIDs.length,
      missingImage: issues.missingImageIDs.length,
      weakKeywordMatch: issues.weakKeywordMatchIDs.length
    }
  };
}

function writeValidationReport(emotionId, validation) {
  ensureDir(REPORT_DIR);
  const reportPath = path.join(REPORT_DIR, `${sanitizeFilename(emotionId)}-validation.json`);
  fs.writeFileSync(reportPath, JSON.stringify(validation, null, 2));
  return reportPath;
}

/**
 * 搜索 Met Museum（获取作品ID列表）
 *
 * @param {string} keyword - 搜索关键词
 * @param {object} options - 搜索选项
 * @param {boolean} options.titleOnly - 是否只在标题中搜索（更精准）
 */
async function searchMetMuseum(keyword, options = {}) {
  // 构建搜索参数
  const params = new URLSearchParams({
    hasImages: 'true',
    q: keyword
  });

  // 可选：只在标题中搜索（更精准，结果更少）
  if (options.titleOnly) {
    params.append('title', 'true');
  }

  const url = `${MET_API_BASE}/search?${params.toString()}`;

  for (let attempt = 1; attempt <= SEARCH_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 403 || response.status === 429) {
        const wait = RETRY_BASE_DELAY * attempt;
        console.warn(`   ⚠️ 搜索 "${keyword}" 遭遇 ${response.status}, ${wait}ms 后重试 (${attempt}/${SEARCH_MAX_RETRIES})`);
        await sleep(wait);
        continue;
      }

      if (!response.ok) {
        console.error(`   ❌ HTTP ${response.status}: ${response.statusText}`);
        return { total: 0, objectIDs: [] };
      }

      const data = await response.json();

      return {
        total: data.total || 0,
        objectIDs: data.objectIDs || []
      };
    } catch (error) {
      const wait = RETRY_BASE_DELAY * attempt;
      console.warn(`   ⚠️ 搜索 "${keyword}" 失败(${attempt}/${SEARCH_MAX_RETRIES}): ${error.message}`);
      if (attempt === SEARCH_MAX_RETRIES) {
        console.error(`   ❌ 搜索 "${keyword}" 多次失败，放弃`);
        return { total: 0, objectIDs: [] };
      }
      await sleep(wait);
    }
  }

  return { total: 0, objectIDs: [] };
}

/**
 * 获取作品详情
 */
async function getArtworkDetail(objectID) {
  const url = `${MET_API_BASE}/objects/${objectID}`;

  for (let attempt = 1; attempt <= DETAIL_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 403 || response.status === 429) {
        const wait = RETRY_BASE_DELAY * attempt;
        console.warn(`   ⚠️ 作品 ${objectID} 遭遇 ${response.status}, ${wait}ms 后重试 (${attempt}/${DETAIL_MAX_RETRIES})`);
        await sleep(wait);
        continue;
      }

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      // 二次验证：确保有图片（hasImages=true 可能返回空图）
      if (!data.primaryImage && !data.primaryImageSmall) {
        return null;
      }

      // 提取我们需要的字段
      return {
      // ===== 基础标识 =====
      id: `met-${data.objectID}`,
      source: 'met',
      objectID: data.objectID,                    // 主键（objectURL可能404）
      objectURL: data.objectURL || '',

      // ===== 作品信息 =====
      title: data.title || 'Untitled',
      artist: data.artistDisplayName || 'Unknown Artist',
      artistNationality: data.artistNationality || '',
      artistBio: data.artistDisplayBio || '',     // ✅ 新增：艺术家生平（重要的讲解内容）

      // 年代信息
      year: data.objectDate || data.objectEndDate || 'Unknown',
      dateBegin: data.objectBeginDate || null,
      dateEnd: data.objectEndDate || null,

      // ===== 图片 =====
      imageUrl: data.primaryImage || '',                    // 高清大图
      imageThumbnail: data.primaryImageSmall || '',         // 缩略图
      additionalImages: data.additionalImages || [],        // ✅ 新增：额外图片（细节图）

      // ===== 分类 =====
      department: data.department || '',
      classification: data.classification || '',
      objectName: data.objectName || '',          // ✅ 对象类型（如 "Painting", "Statue"）
      objectType: data.objectName || '',          // 保持向后兼容
      culture: data.culture || '',
      period: data.period || '',

      // ===== 材质和尺寸 =====
      medium: data.medium || '',
      dimensions: data.dimensions || '',

      // ===== 讲解相关字段 =====
      creditLine: data.creditLine || '',          // 藏品来源/致谢
      galleryNumber: data.GalleryNumber || '',    // ✅ 新增：展厅号（前端可用）
      galleryLabelText: data.galleryLabelText || '',
      labelDate: data.labelDate || '',
      additionalText: data.additionalText || '',
      description: data.galleryLabelText || data.additionalText || '',
      provenance: data.provenance || '',

      // ===== 版权 =====
      isPublicDomain: data.isPublicDomain || false,
      rightsAndReproduction: data.rightsAndReproduction || '',

      // ===== 标签（保存完整对象，包括AAT_URL）=====
      tags: (data.tags || []).map(tag => ({
        term: tag.term || '',
        AAT_URL: tag.AAT_URL || '',
        Wikidata_URL: tag.Wikidata_URL || ''
      })).filter(tag => tag.term),

      // ===== Wikidata 链接（用于扩展数据）=====
      artistWikidata_URL: data.artistWikidata_URL || '',     // ✅ 新增
      objectWikidata_URL: data.objectWikidata_URL || '',     // ✅ 新增

      // ===== 地理位置 =====
      geographyType: data.geographyType || '',
      city: data.city || '',
      country: data.country || '',
      region: data.region || '',

      // ===== 收藏信息 =====
      accessionNumber: data.accessionNumber || '',
      accessionYear: data.accessionYear || '',

      // ===== 元数据 =====
      metadataDate: data.metadataDate || '',
      repository: data.repository || ''
      };
    } catch (error) {
      const wait = RETRY_BASE_DELAY * attempt;
      console.warn(`   ⚠️ 获取作品 ${objectID} 失败(${attempt}/${DETAIL_MAX_RETRIES}): ${error.message}`);
      if (attempt === DETAIL_MAX_RETRIES) {
        console.error(`   ❌ 作品 ${objectID} 多次拉取失败，跳过`);
        return null;
      }
      await sleep(wait);
    }
  }

  return null;
}

/**
 * 采集单个情绪的作品
 */
async function collectEmotionArtworks(emotionId, options = {}) {
  const emotion = emotions.emotions[emotionId];

  if (!emotion) {
    console.error(`❌ 情绪 "${emotionId}" 不存在`);
    return null;
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📂 采集情绪: ${emotion.name_cn} (${emotion.name_en})`);
  console.log(`   阶段: Phase ${emotion.phase}`);
  console.log(`${'='.repeat(70)}\n`);

  const results = {
    emotion_id: emotionId,
    emotion_cn: emotion.name_cn,
    emotion_en: emotion.name_en,
    emotion_index: emotion.index || null,
    phase: emotion.phase,
    keywords: emotion.keywords_en,
    artworks: [],
    metadata: {
      emotion_index: emotion.index || null,
      collected_at: new Date().toISOString(),
      total_keywords_searched: 0,
      total_objects_found: 0,
      total_details_fetched: 0,
      total_valid_artworks: 0
    }
  };

  // 收集所有作品ID（去重）
  const allObjectIDs = new Set();

  // 1. 搜索每个英文关键词
  console.log(`📌 搜索关键词:`);
  const keywordsToSearch = options.testMode
    ? emotion.keywords_en.slice(0, 2)  // 测试模式只用2个关键词
    : emotion.keywords_en;

  for (const keyword of keywordsToSearch) {
    console.log(`   🔍 "${keyword}"`);
    const searchResult = await searchMetMuseum(keyword);

    console.log(`      找到 ${searchResult.total} 件作品`);

    if (searchResult.objectIDs && searchResult.objectIDs.length > 0) {
      // 限制每个关键词最多取前100个
      const idsToAdd = searchResult.objectIDs.slice(0, 100);
      idsToAdd.forEach(id => allObjectIDs.add(id));
    }

    results.metadata.total_keywords_searched++;
    results.metadata.total_objects_found += searchResult.total;

    await sleep(BATCH_DELAY);
  }

  console.log(`\n📊 去重后共 ${allObjectIDs.size} 件独特作品\n`);

  // 2. 获取作品详情
  console.log(`📥 开始获取作品详情...\n`);

  const objectIDsArray = Array.from(allObjectIDs);
  const limit = options.testMode ? 5 : (options.limit || 200);  // 测试模式只取5件，默认最多200件
  const objectIDsToFetch = objectIDsArray.slice(0, limit);

  let fetchedCount = 0;
  let validCount = 0;

  for (let i = 0; i < objectIDsToFetch.length; i++) {
    const objectID = objectIDsToFetch[i];

    // 进度显示
    if ((i + 1) % 10 === 0) {
      console.log(`   进度: ${i + 1}/${objectIDsToFetch.length} (${validCount} 件有效)`);
    }

    const artwork = await getArtworkDetail(objectID);

    if (artwork) {
      results.artworks.push(artwork);
      validCount++;
    }

    fetchedCount++;
    results.metadata.total_details_fetched = fetchedCount;
    results.metadata.total_valid_artworks = validCount;

    // 避免过快请求
    await sleep(DETAIL_DELAY);
  }

  console.log(`\n✅ 采集完成: 共获得 ${validCount} 件有效作品\n`);

  const validation = validateEmotionData(results);
  results.metadata.validation = validation.summary;

  // 3. 保存到文件
  const outputPath = saveEmotionData(emotionId, results);
  const validationPath = writeValidationReport(emotionId, validation);

  console.log(`💾 数据: ${outputPath}`);
  console.log(`🧪 验证: ${validationPath}\n`);

  return results;
}

/**
 * 保存情绪数据到文件
 */
function saveEmotionData(emotionId, data) {
  // 确保输出目录存在
  ensureDir(OUTPUT_DIR);

  const filename = `${sanitizeFilename(emotionId)}.json`;
  const filepath = path.join(OUTPUT_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

  return filepath;
}

/**
 * 批量采集某个阶段的所有情绪
 */
async function collectPhaseEmotions(phase, options = {}) {
  console.log(`\n🚀 开始采集 Phase ${phase} 的所有情绪...\n`);

  const phaseEmotions = Object.entries(emotions.emotions)
    .filter(([_, emotion]) => emotion.phase === phase)
    .map(([id, _]) => id);

  console.log(`📋 将采集 ${phaseEmotions.length} 种情绪:\n`);
  console.log(phaseEmotions.map((id, i) =>
    `   ${i + 1}. ${emotions.emotions[id].name_cn} (${id})`
  ).join('\n'));
  console.log('');

  const allResults = [];

  for (let i = 0; i < phaseEmotions.length; i++) {
    const emotionId = phaseEmotions[i];

    console.log(`\n[${ i + 1}/${phaseEmotions.length}]`);

    const result = await collectEmotionArtworks(emotionId, options);
    if (result) {
      allResults.push({
        emotion_id: result.emotion_id,
        emotion_cn: result.emotion_cn,
        artworks_count: result.artworks.length,
        metadata: result.metadata
      });
    }

    // 避免请求过快
    await sleep(1000);
  }

  // 生成总结报告
  generatePhaseReport(phase, allResults);

  return allResults;
}

/**
 * 生成阶段总结报告
 */
function generatePhaseReport(phase, results) {
  console.log(`\n\n${'='.repeat(70)}`);
  console.log(`📊 Phase ${phase} 采集总结`);
  console.log(`${'='.repeat(70)}\n`);

  const summary = {
    phase,
    total_emotions: results.length,
    total_artworks: results.reduce((sum, r) => sum + r.artworks_count, 0),
    avg_per_emotion: 0,
    emotions: results
  };

  summary.avg_per_emotion = (summary.total_artworks / summary.total_emotions).toFixed(1);

  console.log(`采集情绪数: ${summary.total_emotions}`);
  console.log(`总作品数: ${summary.total_artworks}`);
  console.log(`平均每种情绪: ${summary.avg_per_emotion} 件\n`);

  console.log(`详细统计:`);
  results.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.emotion_cn}: ${r.artworks_count} 件`);
  });

  // 保存总结到文件
  ensureDir(REPORT_DIR);
  const timestamp = Date.now();
  const summaryPath = path.join(REPORT_DIR, `phase-${phase}-summary-${timestamp}.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log(`\n💾 总结已保存到: ${summaryPath}`);
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  const options = {
    testMode: args.includes('--test'),
    limit: 200  // 默认每个情绪最多200件
  };

  if (args.includes('--phase')) {
    // 采集某个阶段的所有情绪
    const phase = parseInt(args[args.indexOf('--phase') + 1]);
    if (phase && [1, 2, 3].includes(phase)) {
      await collectPhaseEmotions(phase, options);
    } else {
      console.error('❌ 请提供有效的阶段号: 1, 2, 或 3');
    }
  } else if (args.includes('--emotion')) {
    // 采集单个情绪
    const emotionId = args[args.indexOf('--emotion') + 1];
    if (emotionId) {
      await collectEmotionArtworks(emotionId, options);
    } else {
      console.error('❌ 请提供情绪ID，例如: --emotion loneliness');
    }
  } else if (args.includes('--test')) {
    // 测试模式：快速采集一个情绪
    console.log('🧪 测试模式: 采集 loneliness，每个关键词只取前5件\n');
    await collectEmotionArtworks('loneliness', { testMode: true });
  } else {
    // 默认：显示帮助
    console.log(`
Met Museum 艺术作品采集工具

用法:
  node scripts/collect/met-collect.js --phase 1              # 采集 Phase 1 所有情绪
  node scripts/collect/met-collect.js --emotion loneliness   # 采集单个情绪
  node scripts/collect/met-collect.js --test                 # 测试模式（快速验证）

选项:
  --phase <1|2|3>     采集指定阶段的所有情绪
  --emotion <id>      采集单个情绪
  --test              测试模式（每个情绪只采集5件作品）

输出:
  数据保存在 ./data/met/artworks/
  验证报告保存在 ./data/met/reports/
  `);
  }
}

// 运行
main().catch(console.error);
