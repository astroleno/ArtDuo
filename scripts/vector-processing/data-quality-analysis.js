#!/usr/bin/env node

/**
 * 数据质量分析脚本
 * 分析231件无描述作品的数据质量，生成详细报告
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  artworksDir: 'data/met/artworks',
  outputDir: 'data/met/processed',
  reportFile: 'data-quality-report.json'
};

/**
 * 数据质量分级标准
 */
const DATA_QUALITY_LEVELS = {
  excellent: {
    description: '完整信息',
    criteria: ['hasDescription', 'hasTags', 'hasArtist', 'hasMedium', 'hasCulture'],
    weight: 1.0
  },
  good: {
    description: '基础信息完整',
    criteria: ['hasTitle', 'hasArtist', 'hasMedium'],
    weight: 0.9
  },
  basic: {
    description: '仅基础信息',
    criteria: ['hasTitle', 'hasArtist'],
    weight: 0.7
  },
  minimal: {
    description: '仅标题',
    criteria: ['hasTitle'],
    weight: 0.5
  }
};

/**
 * 检查作品数据质量
 */
function analyzeArtworkQuality(artwork) {
  const analysis = {
    id: artwork.id,
    title: artwork.title,
    artist: artwork.artist,
    
    // 字段完整性检查
    hasTitle: !!(artwork.title && artwork.title.trim().length > 0),
    hasArtist: !!(artwork.artist && artwork.artist.trim().length > 0),
    hasDescription: !!(artwork.description && artwork.description.trim().length > 50),
    hasTags: !!(artwork.tags && artwork.tags.length > 0),
    hasMedium: !!(artwork.medium && artwork.medium.trim().length > 0),
    hasCulture: !!(artwork.culture && artwork.culture.trim().length > 0),
    hasPeriod: !!(artwork.period && artwork.period.trim().length > 0),
    hasDimensions: !!(artwork.dimensions && artwork.dimensions.trim().length > 0),
    hasCreditLine: !!(artwork.creditLine && artwork.creditLine.trim().length > 0),
    
    // 计算质量等级
    qualityLevel: 'minimal',
    qualityScore: 0,
    missingFields: [],
    recommendations: []
  };
  
  // 计算质量分数
  let score = 0;
  const fields = ['hasTitle', 'hasArtist', 'hasDescription', 'hasTags', 'hasMedium', 'hasCulture', 'hasPeriod', 'hasDimensions', 'hasCreditLine'];
  
  fields.forEach(field => {
    if (analysis[field]) {
      score += 1;
    } else {
      const fieldName = field.replace('has', '').toLowerCase();
      analysis.missingFields.push(fieldName);
    }
  });
  
  analysis.qualityScore = score / fields.length;
  
  // 确定质量等级
  if (analysis.hasDescription && analysis.hasTags && analysis.hasArtist && analysis.hasMedium && analysis.hasCulture) {
    analysis.qualityLevel = 'excellent';
  } else if (analysis.hasTitle && analysis.hasArtist && analysis.hasMedium) {
    analysis.qualityLevel = 'good';
  } else if (analysis.hasTitle && analysis.hasArtist) {
    analysis.qualityLevel = 'basic';
  } else {
    analysis.qualityLevel = 'minimal';
  }
  
  // 生成建议
  if (!analysis.hasDescription) {
    analysis.recommendations.push('缺少描述，建议使用现有字段生成综合搜索文本');
  }
  if (!analysis.hasTags) {
    analysis.recommendations.push('缺少标签，建议从标题和描述中提取关键词');
  }
  if (!analysis.hasMedium) {
    analysis.recommendations.push('缺少媒介信息，建议补充');
  }
  
  return analysis;
}

/**
 * 生成综合搜索文本
 */
function generateSearchText(artwork) {
  const parts = [
    artwork.title,
    artwork.artist,
    artwork.description,
    artwork.tags?.map(t => t.term).join(' '),
    artwork.medium,
    artwork.culture,
    artwork.period,
    artwork.creditLine
  ].filter(Boolean);
  
  return parts.join(' | ');
}

/**
 * 加载所有艺术作品数据
 */
async function loadAllArtworks() {
  console.log('📊 开始加载艺术作品数据...');
  
  const artworksDir = path.join(process.cwd(), CONFIG.artworksDir);
  const files = fs.readdirSync(artworksDir).filter(f => f.endsWith('.json'));
  
  let allArtworks = [];
  let totalFiles = files.length;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(artworksDir, file);
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data.artworks && Array.isArray(data.artworks)) {
        allArtworks = allArtworks.concat(data.artworks);
        console.log(`✅ 已加载 ${file}: ${data.artworks.length} 件作品 (${i + 1}/${totalFiles})`);
      }
    } catch (error) {
      console.error(`❌ 加载文件失败 ${file}:`, error.message);
    }
  }
  
  console.log(`📈 总计加载 ${allArtworks.length} 件作品`);
  return allArtworks;
}

/**
 * 分析数据质量
 */
async function analyzeDataQuality() {
  console.log('🔍 开始数据质量分析...');
  
  // 加载所有作品
  const artworks = await loadAllArtworks();
  
  // 分析每件作品
  const qualityAnalysis = artworks.map(artwork => {
    const analysis = analyzeArtworkQuality(artwork);
    
    // 生成搜索文本
    analysis.searchText = generateSearchText(artwork);
    analysis.searchTextLength = analysis.searchText.length;
    
    return analysis;
  });
  
  // 统计质量分布
  const qualityStats = {
    total: qualityAnalysis.length,
    excellent: qualityAnalysis.filter(a => a.qualityLevel === 'excellent').length,
    good: qualityAnalysis.filter(a => a.qualityLevel === 'good').length,
    basic: qualityAnalysis.filter(a => a.qualityLevel === 'basic').length,
    minimal: qualityAnalysis.filter(a => a.qualityLevel === 'minimal').length
  };
  
  // 找出无描述作品
  const noDescriptionArtworks = qualityAnalysis.filter(a => !a.hasDescription);
  
  // 计算平均质量分数
  const avgQualityScore = qualityAnalysis.reduce((sum, a) => sum + a.qualityScore, 0) / qualityAnalysis.length;
  
  // 生成报告
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalArtworks: qualityStats.total,
      qualityDistribution: qualityStats,
      averageQualityScore: Math.round(avgQualityScore * 100) / 100,
      noDescriptionCount: noDescriptionArtworks.length,
      noDescriptionPercentage: Math.round((noDescriptionArtworks.length / qualityStats.total) * 100 * 100) / 100
    },
    qualityLevels: DATA_QUALITY_LEVELS,
    noDescriptionArtworks: noDescriptionArtworks.map(a => ({
      id: a.id,
      title: a.title,
      artist: a.artist,
      qualityLevel: a.qualityLevel,
      qualityScore: a.qualityScore,
      missingFields: a.missingFields,
      searchText: a.searchText,
      recommendations: a.recommendations
    })),
    recommendations: {
      immediate: [
        '为无描述作品生成综合搜索文本',
        '实现数据质量权重调整机制',
        '优先选择excellent和good级别的作品'
      ],
      longTerm: [
        '人工或AI补全缺失的描述信息',
        '建立数据质量监控机制',
        '定期更新和优化数据质量'
      ]
    }
  };
  
  return { report, qualityAnalysis };
}

/**
 * 保存分析结果
 */
async function saveResults(report, qualityAnalysis) {
  console.log('💾 保存分析结果...');
  
  // 确保输出目录存在
  const outputDir = path.join(process.cwd(), CONFIG.outputDir);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 保存质量报告
  const reportPath = path.join(outputDir, CONFIG.reportFile);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`✅ 质量报告已保存: ${reportPath}`);
  
  // 保存增强后的作品数据
  const enhancedArtworks = qualityAnalysis.map(analysis => ({
    ...analysis,
    enhanced: true,
    dataQuality: {
      level: analysis.qualityLevel,
      score: analysis.qualityScore,
      weight: DATA_QUALITY_LEVELS[analysis.qualityLevel].weight
    }
  }));
  
  const enhancedPath = path.join(outputDir, 'artworks-enhanced.json');
  fs.writeFileSync(enhancedPath, JSON.stringify(enhancedArtworks, null, 2));
  console.log(`✅ 增强数据已保存: ${enhancedPath}`);
  
  // 保存搜索文本
  const searchTexts = qualityAnalysis.map(analysis => ({
    id: analysis.id,
    searchText: analysis.searchText,
    qualityLevel: analysis.qualityLevel,
    qualityScore: analysis.qualityScore
  }));
  
  const searchTextsPath = path.join(outputDir, 'search-texts.json');
  fs.writeFileSync(searchTextsPath, JSON.stringify(searchTexts, null, 2));
  console.log(`✅ 搜索文本已保存: ${searchTextsPath}`);
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始数据质量分析...');
  console.log('='.repeat(50));
  
  try {
    // 分析数据质量
    const { report, qualityAnalysis } = await analyzeDataQuality();
    
    // 保存结果
    await saveResults(report, qualityAnalysis);
    
    // 输出摘要
    console.log('\n📊 分析结果摘要:');
    console.log('='.repeat(50));
    console.log(`总作品数: ${report.summary.totalArtworks}`);
    console.log(`平均质量分数: ${report.summary.averageQualityScore}`);
    console.log(`无描述作品: ${report.summary.noDescriptionCount} (${report.summary.noDescriptionPercentage}%)`);
    console.log('\n质量分布:');
    console.log(`  Excellent: ${report.summary.qualityDistribution.excellent}`);
    console.log(`  Good: ${report.summary.qualityDistribution.good}`);
    console.log(`  Basic: ${report.summary.qualityDistribution.basic}`);
    console.log(`  Minimal: ${report.summary.qualityDistribution.minimal}`);
    
    console.log('\n✅ 数据质量分析完成!');
    
  } catch (error) {
    console.error('❌ 分析过程中出现错误:', error);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = {
  analyzeDataQuality,
  analyzeArtworkQuality,
  generateSearchText,
  DATA_QUALITY_LEVELS
};
