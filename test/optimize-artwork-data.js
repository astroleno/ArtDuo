#!/usr/bin/env node

/**
 * 作品数据优化工具
 *
 * 功能：
 * 1. 生成索引文件 (index.json) - 快速查询
 * 2. 验证图片URL有效性
 * 3. 生成精简版数据（可选）
 * 4. 统计报告
 *
 * 使用：
 *   node optimize-artwork-data.js --index              # 生成索引
 *   node optimize-artwork-data.js --validate-images    # 验证图片
 *   node optimize-artwork-data.js --compact            # 生成精简版
 *   node optimize-artwork-data.js --all                # 全部执行
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// 配置
const ARTWORKS_DIR = path.join(__dirname, 'met-artworks');
const INDEX_FILE = path.join(ARTWORKS_DIR, 'index.json');
const COMPACT_DIR = path.join(ARTWORKS_DIR, 'compact');

// 精简版保留的核心字段
const ESSENTIAL_FIELDS = [
  'id', 'source', 'objectID', 'objectURL',
  'title', 'artist', 'artistNationality', 'year',
  'imageUrl', 'imageThumbnail',
  'department', 'classification', 'medium',
  'tags', 'isPublicDomain'
];

/**
 * 扫描作品目录，生成索引
 */
function generateIndex() {
  console.log('📋 生成作品索引...\n');

  if (!fs.existsSync(ARTWORKS_DIR)) {
    console.error('❌ 作品目录不存在:', ARTWORKS_DIR);
    return null;
  }

  const files = fs.readdirSync(ARTWORKS_DIR)
    .filter(file => file.endsWith('.json') && file !== 'index.json');

  const index = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    total_emotions: files.length,
    total_artworks: 0,
    emotions: {},
    statistics: {
      by_phase: {},
      by_department: {},
      total_size_bytes: 0
    }
  };

  files.forEach(file => {
    const filepath = path.join(ARTWORKS_DIR, file);
    const stats = fs.statSync(filepath);

    try {
      const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      const artworkCount = data.artworks?.length || 0;

      index.emotions[data.emotion_id] = {
        file: file,
        emotion_cn: data.emotion_cn,
        emotion_en: data.emotion_en,
        phase: data.phase,
        artwork_count: artworkCount,
        file_size: stats.size,
        collected_at: data.metadata?.collected_at,
        keywords: data.keywords || []
      };

      index.total_artworks += artworkCount;
      index.statistics.total_size_bytes += stats.size;

      // 按阶段统计
      const phase = `phase_${data.phase}`;
      if (!index.statistics.by_phase[phase]) {
        index.statistics.by_phase[phase] = { emotions: 0, artworks: 0 };
      }
      index.statistics.by_phase[phase].emotions++;
      index.statistics.by_phase[phase].artworks += artworkCount;

      // 按部门统计
      data.artworks?.forEach(artwork => {
        const dept = artwork.department || 'Unknown';
        index.statistics.by_department[dept] = (index.statistics.by_department[dept] || 0) + 1;
      });

      console.log(`  ✅ ${data.emotion_cn} (${data.emotion_id}): ${artworkCount} 件`);
    } catch (error) {
      console.error(`  ❌ 解析失败: ${file}`, error.message);
    }
  });

  // 添加可读大小
  index.statistics.total_size_readable = formatBytes(index.statistics.total_size_bytes);

  // 保存索引
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));

  console.log(`\n📊 索引统计:`);
  console.log(`   情绪总数: ${index.total_emotions} 种`);
  console.log(`   作品总数: ${index.total_artworks} 件`);
  console.log(`   总大小: ${index.statistics.total_size_readable}`);
  console.log(`   平均每种情绪: ${(index.total_artworks / index.total_emotions).toFixed(1)} 件\n`);

  console.log(`💾 索引已保存: ${INDEX_FILE}\n`);

  return index;
}

/**
 * 验证图片URL有效性
 */
async function validateImages() {
  console.log('🖼️  验证图片URL有效性...\n');

  const files = fs.readdirSync(ARTWORKS_DIR)
    .filter(file => file.endsWith('.json') && file !== 'index.json');

  const report = {
    total_checked: 0,
    valid: 0,
    invalid: 0,
    failed_artworks: []
  };

  for (const file of files) {
    const filepath = path.join(ARTWORKS_DIR, file);
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

    console.log(`📂 检查 ${data.emotion_cn} (${data.artworks?.length || 0} 件)...`);

    if (!data.artworks) continue;

    for (const artwork of data.artworks.slice(0, 5)) {  // 每个情绪只验证前5件
      report.total_checked++;

      const isValid = await checkImageUrl(artwork.imageUrl);

      if (isValid) {
        report.valid++;
        process.stdout.write('.');
      } else {
        report.invalid++;
        report.failed_artworks.push({
          emotion: data.emotion_id,
          artwork: artwork.title,
          url: artwork.imageUrl
        });
        process.stdout.write('x');
      }
    }
    console.log('');
  }

  console.log(`\n📊 验证结果:`);
  console.log(`   检查总数: ${report.total_checked} 个`);
  console.log(`   有效: ${report.valid} 个 (${(report.valid/report.total_checked*100).toFixed(1)}%)`);
  console.log(`   无效: ${report.invalid} 个`);

  if (report.invalid > 0) {
    console.log(`\n⚠️  失效的图片:`);
    report.failed_artworks.forEach(item => {
      console.log(`   - ${item.emotion}: ${item.artwork}`);
    });
  }

  // 保存验证报告
  const reportPath = path.join(ARTWORKS_DIR, 'image-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 验证报告已保存: ${reportPath}\n`);

  return report;
}

/**
 * 检查图片URL是否有效
 */
function checkImageUrl(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }

    const timeout = 5000;
    const req = https.request(url, { method: 'HEAD', timeout }, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * 生成精简版数据
 */
function generateCompactData() {
  console.log('📦 生成精简版数据...\n');

  if (!fs.existsSync(COMPACT_DIR)) {
    fs.mkdirSync(COMPACT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(ARTWORKS_DIR)
    .filter(file => file.endsWith('.json') && file !== 'index.json');

  let totalOriginalSize = 0;
  let totalCompactSize = 0;

  files.forEach(file => {
    const filepath = path.join(ARTWORKS_DIR, file);
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

    // 创建精简版
    const compactData = {
      emotion_id: data.emotion_id,
      emotion_cn: data.emotion_cn,
      emotion_en: data.emotion_en,
      phase: data.phase,
      keywords: data.keywords,
      artworks: data.artworks?.map(artwork => {
        const compact = {};
        ESSENTIAL_FIELDS.forEach(field => {
          if (artwork[field] !== undefined) {
            compact[field] = artwork[field];
          }
        });
        return compact;
      }) || [],
      metadata: data.metadata
    };

    const compactPath = path.join(COMPACT_DIR, file);
    const compactJson = JSON.stringify(compactData, null, 2);
    fs.writeFileSync(compactPath, compactJson);

    const originalSize = fs.statSync(filepath).size;
    const compactSize = fs.statSync(compactPath).size;
    const savedPercent = ((1 - compactSize/originalSize) * 100).toFixed(1);

    totalOriginalSize += originalSize;
    totalCompactSize += compactSize;

    console.log(`  ✅ ${data.emotion_cn}: ${formatBytes(originalSize)} → ${formatBytes(compactSize)} (省${savedPercent}%)`);
  });

  const totalSavedPercent = ((1 - totalCompactSize/totalOriginalSize) * 100).toFixed(1);

  console.log(`\n📊 压缩统计:`);
  console.log(`   原始总大小: ${formatBytes(totalOriginalSize)}`);
  console.log(`   精简总大小: ${formatBytes(totalCompactSize)}`);
  console.log(`   节省空间: ${totalSavedPercent}%`);
  console.log(`\n💾 精简版已保存到: ${COMPACT_DIR}\n`);

  return { totalOriginalSize, totalCompactSize };
}

/**
 * 格式化字节大小
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 生成统计报告
 */
function generateReport() {
  console.log('📊 生成统计报告...\n');

  const indexPath = INDEX_FILE;
  if (!fs.existsSync(indexPath)) {
    console.error('❌ 索引文件不存在，请先运行 --index');
    return;
  }

  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  console.log('='.repeat(70));
  console.log('作品数据统计报告');
  console.log('='.repeat(70));
  console.log(`\n生成时间: ${index.generated_at}`);
  console.log(`\n总览:`);
  console.log(`  - 情绪总数: ${index.total_emotions} 种`);
  console.log(`  - 作品总数: ${index.total_artworks} 件`);
  console.log(`  - 数据大小: ${index.statistics.total_size_readable}`);

  console.log(`\n按阶段分布:`);
  Object.entries(index.statistics.by_phase).forEach(([phase, stats]) => {
    console.log(`  ${phase}: ${stats.emotions} 种情绪, ${stats.artworks} 件作品`);
  });

  console.log(`\n按部门分布 (Top 10):`);
  const topDepartments = Object.entries(index.statistics.by_department)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  topDepartments.forEach(([dept, count]) => {
    console.log(`  ${dept}: ${count} 件`);
  });

  console.log(`\n作品数量 Top 5 情绪:`);
  const topEmotions = Object.entries(index.emotions)
    .sort((a, b) => b[1].artwork_count - a[1].artwork_count)
    .slice(0, 5);
  topEmotions.forEach(([id, info], i) => {
    console.log(`  ${i + 1}. ${info.emotion_cn} (${id}): ${info.artwork_count} 件`);
  });

  console.log(`\n作品数量 Bottom 5 情绪:`);
  const bottomEmotions = Object.entries(index.emotions)
    .sort((a, b) => a[1].artwork_count - b[1].artwork_count)
    .slice(0, 5);
  bottomEmotions.forEach(([id, info], i) => {
    console.log(`  ${i + 1}. ${info.emotion_cn} (${id}): ${info.artwork_count} 件`);
  });

  console.log('\n' + '='.repeat(70) + '\n');
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  console.log('\n🔧 作品数据优化工具\n');

  if (args.includes('--index')) {
    generateIndex();
  } else if (args.includes('--validate-images')) {
    await validateImages();
  } else if (args.includes('--compact')) {
    generateCompactData();
  } else if (args.includes('--report')) {
    generateReport();
  } else if (args.includes('--all')) {
    console.log('🚀 执行全部优化任务...\n');
    generateIndex();
    console.log('\n' + '-'.repeat(70) + '\n');
    generateCompactData();
    console.log('\n' + '-'.repeat(70) + '\n');
    await validateImages();
    console.log('\n' + '-'.repeat(70) + '\n');
    generateReport();
  } else {
    console.log(`
使用说明:
  node optimize-artwork-data.js --index              # 生成索引文件
  node optimize-artwork-data.js --validate-images    # 验证图片URL
  node optimize-artwork-data.js --compact            # 生成精简版
  node optimize-artwork-data.js --report             # 生成统计报告
  node optimize-artwork-data.js --all                # 执行全部任务

选项:
  --index              生成 index.json 索引文件（快速查询）
  --validate-images    检查图片URL是否有效
  --compact            生成精简版数据（只保留核心字段）
  --report             显示详细统计报告
  --all                执行全部优化任务

示例:
  # 采集完数据后，生成索引
  node optimize-artwork-data.js --index

  # 定期验证图片链接
  node optimize-artwork-data.js --validate-images

  # 生成用于前端的精简版
  node optimize-artwork-data.js --compact
    `);
  }
}

// 运行
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  generateIndex,
  validateImages,
  generateCompactData,
  generateReport
};
