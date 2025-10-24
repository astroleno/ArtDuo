#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DATA_DIR = path.resolve(__dirname, '../../data/met/artworks');
const REPORT_DIR = path.resolve(__dirname, '../../data/met/reports');
const DEFAULT_FETCH_DELAY = 1200; // ms
const FETCH_MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 2000;
const USER_AGENT = 'Mozilla/5.0 (compatible; ArtDuoBot/1.0; +https://github.com)';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

async function fetchHtml(url) {
  for (let attempt = 1; attempt <= FETCH_MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000 + (attempt - 1) * 5000);
      const res = await fetch(url, {
        headers: {
          'user-agent': USER_AGENT,
          'accept-language': 'en-US,en;q=0.9'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.status === 403 || res.status === 429) {
        const wait = RETRY_BASE_DELAY * attempt;
        console.warn(`   ⚠️ ${url} 返回 ${res.status}，${wait}ms 后重试 (${attempt}/${FETCH_MAX_RETRIES})`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        console.warn(`   ⚠️ 请求 ${url} 失败: HTTP ${res.status}`);
        return null;
      }
      return await res.text();
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`   ⚠️ 请求 ${url} 超时 (${attempt}/${FETCH_MAX_RETRIES})`);
      } else {
        console.warn(`   ⚠️ 请求 ${url} 异常 (${attempt}/${FETCH_MAX_RETRIES}): ${error.message}`);
      }
      if (attempt === FETCH_MAX_RETRIES) {
        return null;
      }
      const wait = RETRY_BASE_DELAY * attempt;
      await sleep(wait);
    }
  }
  return null;
}

function cleanDescription(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s([,.;:!?])/g, '$1')
    .trim();
}

function extractDescriptionFromHtml(html) {
  if (!html) return null;
  const $ = cheerio.load(html);

  const texts = [];
  const selectors = [
    'span[data-sentry-component*="Markdown"]',
    'p[data-sentry-component*="Markdown"]',
    '[data-sentry-component="MarkdownRenderer"]'
  ];
  selectors.forEach(selector => {
    $(selector).each((_, el) => {
      const text = $(el).text().trim();
      if (text) {
        texts.push(text);
      }
    });
  });

  const candidates = texts
    .map(cleanDescription)
    .filter(text => text.length >= 60 && !/^The Met /i.test(text));

  if (candidates.length > 0) {
    const unique = [];
    const seen = new Set();
    for (const text of candidates) {
      const key = text.toLowerCase();
      if (!seen.has(key)) {
        unique.push(text);
        seen.add(key);
      }
      if (unique.length >= 3) break;
    }
    return unique.join(' ');
  }

  const metaDesc = $('meta[property="og:description"], meta[name="description"]').attr('content');
  if (metaDesc && !/^The Met presents/i.test(metaDesc)) {
    return cleanDescription(metaDesc);
  }
  return null;
}

function loadEmotionFiles({ phase, emotionId }) {
  const files = fs.readdirSync(DATA_DIR).filter(name => name.endsWith('.json'));
  return files
    .map(name => {
      const content = JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf-8'));
      return { name, content };
    })
    .filter(({ content }) => {
      if (!content || !content.artworks) return false;
      if (phase && content.phase !== phase) return false;
      if (emotionId && content.emotion_id !== emotionId) return false;
      return true;
    })
    .sort((a, b) => (a.content.emotion_index ?? 999) - (b.content.emotion_index ?? 999));
}

async function enrichEmotion({ name, content }, options) {
  const emotionId = content.emotion_id;
  console.log(`\n${'='.repeat(70)}`);
  console.log(`✨ 丰富情绪: ${content.emotion_cn} (${content.emotion_en}) [${emotionId}]`);
  console.log(`${'='.repeat(70)}`);

  const artworks = content.artworks || [];
  let updatedCount = 0;
  let attempted = 0;
  let skippedNoURL = 0;
  let failedFetch = 0;

  for (let i = 0; i < artworks.length; i++) {
    const artwork = artworks[i];
    if (options.limit && attempted >= options.limit) {
      break;
    }
    if (artwork.description && artwork.description.trim().length > 0 && !options.force) {
      continue;
    }
    if (!artwork.objectURL) {
      skippedNoURL += 1;
      continue;
    }
    attempted += 1;
    console.log(`   [${attempted}] 抓取 ${artwork.objectURL}`);
    const html = await fetchHtml(artwork.objectURL);
    if (!html) {
      failedFetch += 1;
      continue;
    }
    const description = extractDescriptionFromHtml(html);
    if (description) {
      artwork.description = description;
      artwork.descriptionSource = 'met_web';
      updatedCount += 1;
      console.log(`      ✅ 捕获 ${description.length} 字符`);
    } else {
      console.log('      ⚠️ 未找到有效简介');
    }
    await sleep(options.delay);
  }

  const validation = validateEmotionData(content);
  content.metadata = content.metadata || {};
  content.metadata.validation = validation.summary;
  content.metadata.enrichment = {
    ...(content.metadata.enrichment || {}),
    description_enriched_at: new Date().toISOString(),
    attempted,
    updated: updatedCount,
    skipped_no_url: skippedNoURL,
    fetch_failed: failedFetch
  };

  const filePath = path.join(DATA_DIR, name);
  if (!options.dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
    const validationPath = path.join(REPORT_DIR, `${path.parse(name).name}-validation.json`);
    ensureDir(REPORT_DIR);
    fs.writeFileSync(validationPath, JSON.stringify(validation, null, 2));
  }

  return {
    emotionId,
    emotionCn: content.emotion_cn,
    emotionEn: content.emotion_en,
    totalArtworks: artworks.length,
    attempted,
    updated: updatedCount,
    skippedNoURL,
    failedFetch,
    descriptionCoverage: validation.summary.descriptionCoverage
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    phase: null,
    emotion: null,
    limit: null,
    dryRun: false,
    force: false,
    delay: DEFAULT_FETCH_DELAY
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--phase') {
      options.phase = parseInt(args[++i], 10);
    } else if (arg === '--emotion') {
      options.emotion = args[++i];
    } else if (arg === '--limit') {
      options.limit = parseInt(args[++i], 10);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--delay') {
      options.delay = Math.max(200, parseInt(args[++i], 10));
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const files = loadEmotionFiles({ phase: options.phase, emotionId: options.emotion });

  if (files.length === 0) {
    console.log('未找到需要处理的情绪数据文件');
    return;
  }

  ensureDir(REPORT_DIR);

  const summary = [];
  for (const file of files) {
    const stats = await enrichEmotion(file, options);
    summary.push(stats);
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('📋 丰富摘要');
  console.log(`${'='.repeat(70)}`);
  summary.forEach(item => {
    console.log(`- ${item.emotionCn} (${item.emotionEn}): ${item.updated}/${item.totalArtworks} 更新，描述覆盖率 ${item.descriptionCoverage}`);
  });
}

main().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});
