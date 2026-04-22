#!/usr/bin/env node

/**
 * 数据清洗和智能补全脚本
 * 为无描述作品生成综合搜索文本，实现数据质量权重调整
 */

const fs = require('fs');
const path = require('path');
const natural = require('natural');

// 配置
const CONFIG = {
  processedDir: 'data/met/processed',
  outputDir: 'data/met/processed',
  enhancedFile: 'artworks-enhanced.json',
  searchTextsFile: 'search-texts.json',
  cleanedFile: 'artworks-cleaned.json'
};

/**
 * 数据质量权重配置
 */
const QUALITY_WEIGHTS = {
  excellent: 1.0,    // 完整信息
  good: 0.9,         // 基础信息完整
  basic: 0.7,         // 仅基础信息
  minimal: 0.5        // 仅标题
};

/**
 * 智能补全搜索文本
 */
function generateEnhancedSearchText(artwork) {
  const parts = [];
  
  // 基础信息 (必须)
  if (artwork.title) {
    parts.push(artwork.title);
  }
  
  // 艺术家信息
  if (artwork.artist) {
    parts.push(artwork.artist);
  }
  
  // 描述信息 (优先使用原始描述)
  if (artwork.description && artwork.description.trim().length > 20) {
    parts.push(artwork.description);
  } else {
    // 智能补全描述
    const generatedDescription = generateDescription(artwork);
    if (generatedDescription) {
      parts.push(generatedDescription);
    }
  }
  
  // 标签信息
  if (artwork.tags && artwork.tags.length > 0) {
    const tagTerms = artwork.tags.map(tag => tag.term).join(' ');
    parts.push(tagTerms);
  }
  
  // 媒介和材质
  if (artwork.medium) {
    parts.push(artwork.medium);
  }
  
  // 文化背景
  if (artwork.culture) {
    parts.push(artwork.culture);
  }
  
  // 年代信息
  if (artwork.period) {
    parts.push(artwork.period);
  }
  
  // 尺寸信息
  if (artwork.dimensions) {
    parts.push(artwork.dimensions);
  }
  
  // 来源信息
  if (artwork.creditLine) {
    parts.push(artwork.creditLine);
  }
  
  return parts.filter(Boolean).join(' | ');
}

/**
 * 智能生成描述
 */
function generateDescription(artwork) {
  const descriptionParts = [];
  
  // 从标题提取关键词
  if (artwork.title) {
    const titleKeywords = extractKeywords(artwork.title);
    if (titleKeywords.length > 0) {
      descriptionParts.push(`Artwork featuring ${titleKeywords.join(', ')}`);
    }
  }
  
  // 从艺术家信息生成描述
  if (artwork.artist) {
    const artistInfo = artwork.artistBio || artwork.artist;
    if (artistInfo.includes(',')) {
      const [name, period] = artistInfo.split(',');
      descriptionParts.push(`Created by ${name.trim()}${period ? ` (${period.trim()})` : ''}`);
    } else {
      descriptionParts.push(`Created by ${artistInfo}`);
    }
  }
  
  // 从媒介生成描述
  if (artwork.medium) {
    descriptionParts.push(`Medium: ${artwork.medium}`);
  }
  
  // 从文化背景生成描述
  if (artwork.culture) {
    descriptionParts.push(`Cultural context: ${artwork.culture}`);
  }
  
  // 从年代生成描述
  if (artwork.period) {
    descriptionParts.push(`Period: ${artwork.period}`);
  }
  
  return descriptionParts.join('. ');
}

/**
 * 提取关键词
 */
function extractKeywords(text) {
  if (!text) return [];
  
  // 使用自然语言处理提取关键词
  const tokenizer = new natural.WordTokenizer();
  const tokens = tokenizer.tokenize(text.toLowerCase());
  
  // 过滤停用词和短词
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
  const keywords = tokens
    .filter(token => token.length > 2 && !stopWords.has(token))
    .filter(token => /^[a-zA-Z]+$/.test(token)); // 只保留纯字母词
  
  // 去重并限制数量
  return [...new Set(keywords)].slice(0, 5);
}

/**
 * 计算数据质量权重
 */
function calculateQualityWeight(artwork) {
  // 如果数据已经被分析过，使用已有的质量信息
  if (artwork.dataQuality) {
    return artwork.dataQuality.weight;
  }
  
  const hasDescription = !!(artwork.description && artwork.description.trim().length > 50);
  const hasTags = !!(artwork.tags && artwork.tags.length > 0);
  const hasArtist = !!(artwork.artist && artwork.artist.trim().length > 0);
  const hasMedium = !!(artwork.medium && artwork.medium.trim().length > 0);
  const hasCulture = !!(artwork.culture && artwork.culture.trim().length > 0);
  
  // 根据数据完整性计算权重
  if (hasDescription && hasTags && hasArtist && hasMedium && hasCulture) {
    return QUALITY_WEIGHTS.excellent;
  } else if (hasArtist && hasMedium) {
    return QUALITY_WEIGHTS.good;
  } else if (hasArtist) {
    return QUALITY_WEIGHTS.basic;
  } else {
    return QUALITY_WEIGHTS.minimal;
  }
}

/**
 * 清洗和增强作品数据
 */
function cleanAndEnhanceArtwork(artwork) {
  // 生成增强搜索文本
  const enhancedSearchText = generateEnhancedSearchText(artwork);
  
  // 计算质量权重
  const qualityWeight = calculateQualityWeight(artwork);
  
  // 确定质量等级
  let qualityLevel = 'minimal';
  if (qualityWeight === QUALITY_WEIGHTS.excellent) qualityLevel = 'excellent';
  else if (qualityWeight === QUALITY_WEIGHTS.good) qualityLevel = 'good';
  else if (qualityWeight === QUALITY_WEIGHTS.basic) qualityLevel = 'basic';
  
  // 如果数据已经被分析过，使用已有的质量信息
  if (artwork.dataQuality) {
    qualityLevel = artwork.dataQuality.level;
  }
  
  // 生成建议
  const recommendations = [];
  if (!artwork.description || artwork.description.trim().length < 50) {
    recommendations.push('使用智能补全描述');
  }
  if (!artwork.tags || artwork.tags.length === 0) {
    recommendations.push('从标题和描述中提取标签');
  }
  if (!artwork.medium) {
    recommendations.push('补充媒介信息');
  }
  
  return {
    ...artwork,
    enhanced: true,
    enhancedSearchText,
    searchTextLength: enhancedSearchText.length,
    // 确保保留图片URL字段
    imageUrl: artwork.imageUrl || null,
    imageThumbnail: artwork.imageThumbnail || null,
    additionalImages: artwork.additionalImages || [],
    dataQuality: {
      level: qualityLevel,
      weight: qualityWeight,
      hasDescription: !!(artwork.description && artwork.description.trim().length > 50),
      hasTags: !!(artwork.tags && artwork.tags.length > 0),
      hasArtist: !!(artwork.artist && artwork.artist.trim().length > 0),
      hasMedium: !!(artwork.medium && artwork.medium.trim().length > 0),
      hasCulture: !!(artwork.culture && artwork.culture.trim().length > 0),
      hasImageUrl: !!(artwork.imageUrl && artwork.imageUrl.trim().length > 0)
    },
    recommendations,
    processedAt: new Date().toISOString()
  };
}

/**
 * 主清洗函数
 */
async function cleanData() {
  console.log('🧹 开始数据清洗和智能补全...');
  
  try {
    // 读取增强数据
    const enhancedPath = path.join(process.cwd(), CONFIG.processedDir, CONFIG.enhancedFile);
    if (!fs.existsSync(enhancedPath)) {
      throw new Error(`增强数据文件不存在: ${enhancedPath}`);
    }
    
    const enhancedData = JSON.parse(fs.readFileSync(enhancedPath, 'utf8'));
    console.log(`📊 加载了 ${enhancedData.length} 件作品数据`);
    
    // 清洗和增强每件作品
    const cleanedArtworks = enhancedData.map(artwork => {
      return cleanAndEnhanceArtwork(artwork);
    });
    
    // 统计清洗结果
    const stats = {
      total: cleanedArtworks.length,
      excellent: cleanedArtworks.filter(a => a.dataQuality.level === 'excellent').length,
      good: cleanedArtworks.filter(a => a.dataQuality.level === 'good').length,
      basic: cleanedArtworks.filter(a => a.dataQuality.level === 'basic').length,
      minimal: cleanedArtworks.filter(a => a.dataQuality.level === 'minimal').length,
      noDescription: cleanedArtworks.filter(a => !a.dataQuality.hasDescription).length,
      averageSearchTextLength: Math.round(
        cleanedArtworks.reduce((sum, a) => sum + a.searchTextLength, 0) / cleanedArtworks.length
      )
    };
    
    // 保存清洗后的数据
    const cleanedPath = path.join(process.cwd(), CONFIG.outputDir, CONFIG.cleanedFile);
    fs.writeFileSync(cleanedPath, JSON.stringify(cleanedArtworks, null, 2));
    console.log(`✅ 清洗后数据已保存: ${cleanedPath}`);
    
    // 生成搜索文本索引
    const searchTexts = cleanedArtworks.map(artwork => ({
      id: artwork.id,
      title: artwork.title,
      artist: artwork.artist,
      searchText: artwork.enhancedSearchText,
      qualityLevel: artwork.dataQuality.level,
      qualityWeight: artwork.dataQuality.weight,
      searchTextLength: artwork.searchTextLength
    }));
    
    const searchTextsPath = path.join(process.cwd(), CONFIG.outputDir, CONFIG.searchTextsFile);
    fs.writeFileSync(searchTextsPath, JSON.stringify(searchTexts, null, 2));
    console.log(`✅ 搜索文本索引已保存: ${searchTextsPath}`);
    
    // 输出统计结果
    console.log('\n📊 数据清洗结果:');
    console.log('='.repeat(50));
    console.log(`总作品数: ${stats.total}`);
    console.log(`平均搜索文本长度: ${stats.averageSearchTextLength} 字符`);
    console.log(`无描述作品: ${stats.noDescription} (${Math.round(stats.noDescription / stats.total * 100 * 100) / 100}%)`);
    console.log('\n质量分布:');
    console.log(`  Excellent: ${stats.excellent} (${Math.round(stats.excellent / stats.total * 100 * 100) / 100}%)`);
    console.log(`  Good: ${stats.good} (${Math.round(stats.good / stats.total * 100 * 100) / 100}%)`);
    console.log(`  Basic: ${stats.basic} (${Math.round(stats.basic / stats.total * 100 * 100) / 100}%)`);
    console.log(`  Minimal: ${stats.minimal} (${Math.round(stats.minimal / stats.total * 100 * 100) / 100}%)`);
    
    console.log('\n✅ 数据清洗完成!');
    
    return {
      cleanedArtworks,
      stats,
      searchTexts
    };
    
  } catch (error) {
    console.error('❌ 数据清洗过程中出现错误:', error);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始数据清洗和智能补全...');
  console.log('='.repeat(50));
  
  try {
    await cleanData();
  } catch (error) {
    console.error('❌ 执行失败:', error);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = {
  cleanData,
  cleanAndEnhanceArtwork,
  generateEnhancedSearchText,
  calculateQualityWeight,
  QUALITY_WEIGHTS
};
