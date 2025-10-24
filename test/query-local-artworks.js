#!/usr/bin/env node

/**
 * 本地作品查询工具
 *
 * 功能：
 * 1. 根据情绪ID快速查询作品
 * 2. 按关键词搜索
 * 3. 随机推荐
 * 4. 支持过滤（部门、年代等）
 *
 * 使用：
 *   node query-local-artworks.js --emotion joy              # 查询"快乐"的所有作品
 *   node query-local-artworks.js --emotion joy --limit 5    # 只返回5件
 *   node query-local-artworks.js --random 10                # 随机10件
 *   node query-local-artworks.js --list                     # 列出所有情绪
 */

const fs = require('fs');
const path = require('path');

// 配置
const ARTWORKS_DIR = path.join(__dirname, 'met-artworks');
const INDEX_FILE = path.join(ARTWORKS_DIR, 'index.json');
const USE_COMPACT = false; // 是否使用精简版数据

class ArtworkDatabase {
  constructor() {
    this.indexPath = INDEX_FILE;
    this.artworksDir = ARTWORKS_DIR;
    this.index = null;
    this.cache = new Map(); // 缓存已加载的数据
  }

  /**
   * 加载索引
   */
  loadIndex() {
    if (this.index) return this.index;

    if (!fs.existsSync(this.indexPath)) {
      throw new Error('索引文件不存在，请先运行: node optimize-artwork-data.js --index');
    }

    this.index = JSON.parse(fs.readFileSync(this.indexPath, 'utf8'));
    return this.index;
  }

  /**
   * 根据情绪ID查询作品
   */
  queryByEmotion(emotionId, options = {}) {
    const index = this.loadIndex();
    const emotionInfo = index.emotions[emotionId];

    if (!emotionInfo) {
      throw new Error(`情绪 "${emotionId}" 不存在`);
    }

    // 从缓存或文件加载数据
    let data = this.cache.get(emotionId);
    if (!data) {
      const filepath = path.join(this.artworksDir, emotionInfo.file);
      data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      this.cache.set(emotionId, data);
    }

    let artworks = data.artworks || [];

    // 应用过滤
    if (options.department) {
      artworks = artworks.filter(a =>
        a.department?.toLowerCase().includes(options.department.toLowerCase())
      );
    }

    if (options.hasImage) {
      artworks = artworks.filter(a => a.imageUrl);
    }

    if (options.publicDomain) {
      artworks = artworks.filter(a => a.isPublicDomain);
    }

    // 应用限制
    if (options.limit) {
      artworks = artworks.slice(0, options.limit);
    }

    // 随机排序
    if (options.random) {
      artworks = this.shuffleArray(artworks);
    }

    return {
      emotion: {
        id: emotionId,
        name_cn: emotionInfo.emotion_cn,
        name_en: emotionInfo.emotion_en,
        phase: emotionInfo.phase
      },
      total: artworks.length,
      artworks: artworks
    };
  }

  /**
   * 根据多个情绪ID查询（用于情绪曲线）
   */
  queryByEmotions(emotionIds, options = {}) {
    const results = [];

    emotionIds.forEach(emotionId => {
      try {
        const result = this.queryByEmotion(emotionId, options);
        results.push(result);
      } catch (error) {
        console.warn(`⚠️  跳过情绪 "${emotionId}": ${error.message}`);
      }
    });

    return results;
  }

  /**
   * 随机推荐作品（跨情绪）
   */
  randomRecommend(count = 10, options = {}) {
    const index = this.loadIndex();
    const emotionIds = Object.keys(index.emotions);

    // 从每个情绪随机抽取
    const allArtworks = [];
    emotionIds.forEach(emotionId => {
      try {
        const result = this.queryByEmotion(emotionId, { ...options, random: true });
        allArtworks.push(...result.artworks.map(a => ({
          ...a,
          emotion_id: emotionId,
          emotion_cn: result.emotion.name_cn
        })));
      } catch (error) {
        // 跳过错误
      }
    });

    // 随机打乱并取指定数量
    const shuffled = this.shuffleArray(allArtworks);
    return shuffled.slice(0, count);
  }

  /**
   * 按关键词搜索（在标题、艺术家、标签中）
   */
  searchByKeyword(keyword, options = {}) {
    const index = this.loadIndex();
    const results = [];

    Object.keys(index.emotions).forEach(emotionId => {
      try {
        const result = this.queryByEmotion(emotionId, { hasImage: true });

        const matches = result.artworks.filter(artwork => {
          const searchText = [
            artwork.title,
            artwork.artist,
            artwork.medium,
            ...(artwork.tags?.map(t => t.term) || [])
          ].join(' ').toLowerCase();

          return searchText.includes(keyword.toLowerCase());
        });

        if (matches.length > 0) {
          results.push({
            emotion: result.emotion,
            matches: matches.length,
            artworks: matches
          });
        }
      } catch (error) {
        // 跳过错误
      }
    });

    // 按匹配数量排序
    results.sort((a, b) => b.matches - a.matches);

    if (options.limit) {
      return results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * 列出所有可用的情绪
   */
  listEmotions() {
    const index = this.loadIndex();
    return Object.entries(index.emotions).map(([id, info]) => ({
      id,
      name_cn: info.emotion_cn,
      name_en: info.emotion_en,
      phase: info.phase,
      artwork_count: info.artwork_count,
      keywords: info.keywords
    }));
  }

  /**
   * 获取统计信息
   */
  getStatistics() {
    const index = this.loadIndex();
    return {
      total_emotions: index.total_emotions,
      total_artworks: index.total_artworks,
      total_size: index.statistics.total_size_readable,
      by_phase: index.statistics.by_phase,
      by_department: index.statistics.by_department
    };
  }

  /**
   * 随机打乱数组
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

// ===== CLI 接口 =====

function displayArtwork(artwork, index) {
  console.log(`\n${index}. 《${artwork.title}》`);
  console.log(`   艺术家: ${artwork.artist} ${artwork.year ? `(${artwork.year})` : ''}`);
  console.log(`   部门: ${artwork.department}`);
  console.log(`   图片: ${artwork.imageUrl ? '✅' : '❌'}`);
  if (artwork.emotion_cn) {
    console.log(`   情绪: ${artwork.emotion_cn}`);
  }
  if (artwork.tags && artwork.tags.length > 0) {
    console.log(`   标签: ${artwork.tags.slice(0, 3).map(t => t.term).join(', ')}`);
  }
}

function displayResults(results) {
  if (Array.isArray(results.artworks)) {
    // 单个情绪查询
    console.log(`\n📊 情绪: ${results.emotion.name_cn} (${results.emotion.name_en})`);
    console.log(`   阶段: Phase ${results.emotion.phase}`);
    console.log(`   作品数: ${results.total} 件\n`);

    results.artworks.forEach((artwork, i) => {
      displayArtwork(artwork, i + 1);
    });
  } else if (Array.isArray(results)) {
    // 多情绪查询或随机推荐
    console.log(`\n📊 共找到 ${results.length} 件作品\n`);
    results.forEach((artwork, i) => {
      displayArtwork(artwork, i + 1);
    });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const db = new ArtworkDatabase();

  try {
    if (args.includes('--list')) {
      // 列出所有情绪
      console.log('\n📋 可用的情绪列表:\n');
      const emotions = db.listEmotions();

      const byPhase = {};
      emotions.forEach(e => {
        if (!byPhase[e.phase]) byPhase[e.phase] = [];
        byPhase[e.phase].push(e);
      });

      Object.entries(byPhase).forEach(([phase, items]) => {
        console.log(`\nPhase ${phase}:`);
        items.forEach(e => {
          console.log(`  ${e.id.padEnd(20)} ${e.name_cn.padEnd(10)} (${e.name_en}) - ${e.artwork_count} 件`);
        });
      });

    } else if (args.includes('--stats')) {
      // 显示统计信息
      const stats = db.getStatistics();
      console.log('\n📊 数据库统计:\n');
      console.log(`  情绪总数: ${stats.total_emotions} 种`);
      console.log(`  作品总数: ${stats.total_artworks} 件`);
      console.log(`  数据大小: ${stats.total_size}`);
      console.log(`\n  按阶段分布:`);
      Object.entries(stats.by_phase).forEach(([phase, data]) => {
        console.log(`    ${phase}: ${data.emotions} 种情绪, ${data.artworks} 件作品`);
      });

    } else if (args.includes('--emotion')) {
      // 查询指定情绪
      const emotionId = args[args.indexOf('--emotion') + 1];
      const limit = args.includes('--limit')
        ? parseInt(args[args.indexOf('--limit') + 1])
        : undefined;

      const results = db.queryByEmotion(emotionId, {
        limit,
        hasImage: true,
        random: args.includes('--random')
      });

      displayResults(results);

    } else if (args.includes('--search')) {
      // 关键词搜索
      const keyword = args[args.indexOf('--search') + 1];
      console.log(`\n🔍 搜索关键词: "${keyword}"\n`);

      const results = db.searchByKeyword(keyword);

      console.log(`📊 在 ${results.length} 个情绪中找到匹配:\n`);
      results.forEach(result => {
        console.log(`\n${result.emotion.name_cn} (${result.emotion.name_en}): ${result.matches} 件`);
        result.artworks.slice(0, 3).forEach((artwork, i) => {
          displayArtwork(artwork, i + 1);
        });
      });

    } else if (args.includes('--random')) {
      // 随机推荐
      const count = parseInt(args[args.indexOf('--random') + 1]) || 10;
      console.log(`\n🎲 随机推荐 ${count} 件作品:\n`);

      const results = db.randomRecommend(count, { hasImage: true });
      displayResults(results);

    } else {
      // 显示帮助
      console.log(`
本地作品查询工具

用法:
  node query-local-artworks.js --list                     # 列出所有情绪
  node query-local-artworks.js --stats                    # 显示统计信息
  node query-local-artworks.js --emotion joy              # 查询"快乐"的作品
  node query-local-artworks.js --emotion joy --limit 5    # 限制返回5件
  node query-local-artworks.js --emotion joy --random     # 随机排序
  node query-local-artworks.js --search landscape         # 关键词搜索
  node query-local-artworks.js --random 10                # 随机推荐10件

选项:
  --list                列出所有可用的情绪
  --stats               显示数据库统计信息
  --emotion <id>        查询指定情绪的作品
  --search <keyword>    搜索关键词（标题、艺术家、标签）
  --random [count]      随机推荐作品（默认10件）
  --limit <n>           限制返回结果数量
      `);
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

// 运行
if (require.main === module) {
  main().catch(console.error);
}

// 导出供其他模块使用
module.exports = { ArtworkDatabase };
