#!/usr/bin/env node

/**
 * 数据分离脚本
 * 将原始数据分离为：检索数据、图片映射、元数据
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  inputDir: 'data/met/artworks',
  outputDir: 'data/met/processed',
  searchFile: 'artworks-search.json',
  imagesFile: 'artworks-images.json',
  metadataFile: 'artworks-metadata.json'
};

/**
 * 生成多种图片URL模式
 */
function generateImageUrlPatterns(artworkId, originalUrl) {
  const numericId = artworkId.replace('met-', '');
  
  // 如果原始URL存在，优先使用
  if (originalUrl) {
    return {
      primary: originalUrl,
      alternatives: [
        `https://images.metmuseum.org/CRDImages/dp/original/DP${numericId}.jpg`,
        `https://images.metmuseum.org/CRDImages/ep/original/DT${numericId}.jpg`,
        `https://images.metmuseum.org/CRDImages/es/original/DP${numericId}.jpg`,
        `https://images.metmuseum.org/CRDImages/eg/original/DP${numericId}.jpg`,
        `https://images.metmuseum.org/CRDImages/ao/original/DP${numericId}.jpg`
      ]
    };
  }
  
  // 如果没有原始URL，生成所有可能的模式
  return {
    primary: `https://images.metmuseum.org/CRDImages/dp/original/DP${numericId}.jpg`,
    alternatives: [
      `https://images.metmuseum.org/CRDImages/ep/original/DT${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/es/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/eg/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/ao/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/aa/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/ad/original/DP${numericId}.jpg`,
      `https://images.metmuseum.org/CRDImages/ag/original/DP${numericId}.jpg`
    ]
  };
}

/**
 * 处理单个作品数据
 */
function processArtwork(artwork, emotionContext = null) {
  // 构建增强的搜索文本，包含情感关键词
  let enhancedSearchText = artwork.searchText || `${artwork.title} ${artwork.artist} ${artwork.description}`.trim();
  
  // 如果有情感上下文，添加情感关键词
  if (emotionContext) {
    const emotionKeywords = emotionContext.keywords || [];
    const emotionLabels = [
      emotionContext.emotion_cn,
      emotionContext.emotion_en,
      emotionContext.emotion_id
    ].filter(Boolean);
    
    // 将情感关键词和标签添加到搜索文本中
    const emotionText = [...emotionLabels, ...emotionKeywords].join(' ');
    enhancedSearchText = `${enhancedSearchText} ${emotionText}`.trim();
  }
  
  // 检索数据 - 用于向量搜索（增强版）
  const searchData = {
    id: artwork.id,
    title: artwork.title || '未知标题',
    artist: artwork.artist || '未知艺术家',
    description: artwork.description || '',
    searchText: enhancedSearchText,
    year: artwork.year || '未知年代',
    medium: artwork.medium || '未知媒介',
    qualityLevel: artwork.qualityLevel || 'basic',
    qualityWeight: artwork.qualityScore || 0.5,
    // 新增：情感标签信息
    emotion: emotionContext ? {
      id: emotionContext.emotion_id,
      cn: emotionContext.emotion_cn,
      en: emotionContext.emotion_en,
      index: emotionContext.emotion_index,
      phase: emotionContext.phase,
      keywords: emotionContext.keywords || []
    } : null
  };
  
  // 图片映射数据
  const imageData = {
    id: artwork.id,
    ...generateImageUrlPatterns(artwork.id, artwork.imageUrl),
    thumbnail: artwork.imageThumbnail || null,
    additionalImages: artwork.additionalImages || []
  };
  
  // 元数据 - 用于展示和详细信息（包含情感信息）
  const metadata = {
    id: artwork.id,
    title: artwork.title || '未知标题',
    artist: artwork.artist || '未知艺术家',
    year: artwork.year || '未知年代',
    medium: artwork.medium || '未知媒介',
    culture: artwork.culture || null,
    period: artwork.period || null,
    department: artwork.department || null,
    classification: artwork.classification || null,
    objectName: artwork.objectName || null,
    objectType: artwork.objectType || null,
    dimensions: artwork.dimensions || null,
    creditLine: artwork.creditLine || null,
    description: artwork.description || '',
    tags: artwork.tags || [],
    qualityLevel: artwork.qualityLevel || 'basic',
    qualityScore: artwork.qualityScore || 0.5,
    hasTitle: artwork.hasTitle || false,
    hasArtist: artwork.hasArtist || false,
    hasDescription: artwork.hasDescription || false,
    hasTags: artwork.hasTags || false,
    hasMedium: artwork.hasMedium || false,
    hasCulture: artwork.hasCulture || false,
    hasPeriod: artwork.hasPeriod || false,
    hasDimensions: artwork.hasDimensions || false,
    hasCreditLine: artwork.hasCreditLine || false,
    // 新增：情感标签信息
    emotion: emotionContext ? {
      id: emotionContext.emotion_id,
      cn: emotionContext.emotion_cn,
      en: emotionContext.emotion_en,
      index: emotionContext.emotion_index,
      phase: emotionContext.phase,
      keywords: emotionContext.keywords || []
    } : null
  };
  
  return { searchData, imageData, metadata };
}

/**
 * 主处理函数
 */
async function separateData() {
  console.log('🔄 开始数据分离处理...');
  
  try {
    // 读取所有原始数据文件
    const artworksDir = path.join(process.cwd(), CONFIG.inputDir);
    const files = fs.readdirSync(artworksDir).filter(f => f.endsWith('.json'));
    
    console.log(`📁 找到 ${files.length} 个数据文件`);
    
    let allSearchData = [];
    let allImageData = [];
    let allMetadata = [];
    
    // 处理每个文件
    for (const file of files) {
      console.log(`📖 处理文件: ${file}`);
      const filePath = path.join(artworksDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(fileContent);
      
      // 提取情感上下文信息
      const emotionContext = {
        emotion_id: data.emotion_id,
        emotion_cn: data.emotion_cn,
        emotion_en: data.emotion_en,
        emotion_index: data.emotion_index,
        phase: data.phase,
        keywords: data.keywords || []
      };
      
      if (data.artworks && Array.isArray(data.artworks)) {
        for (const artwork of data.artworks) {
          const { searchData, imageData, metadata } = processArtwork(artwork, emotionContext);
          allSearchData.push(searchData);
          allImageData.push(imageData);
          allMetadata.push(metadata);
        }
      }
    }
    
    console.log(`📊 处理完成，共 ${allSearchData.length} 件作品`);
    
    // 确保输出目录存在
    const outputDir = path.join(process.cwd(), CONFIG.outputDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 保存分离后的数据
    const searchPath = path.join(outputDir, CONFIG.searchFile);
    fs.writeFileSync(searchPath, JSON.stringify(allSearchData, null, 2));
    console.log(`✅ 检索数据已保存: ${searchPath}`);
    
    const imagesPath = path.join(outputDir, CONFIG.imagesFile);
    fs.writeFileSync(imagesPath, JSON.stringify(allImageData, null, 2));
    console.log(`✅ 图片映射已保存: ${imagesPath}`);
    
    const metadataPath = path.join(outputDir, CONFIG.metadataFile);
    fs.writeFileSync(metadataPath, JSON.stringify(allMetadata, null, 2));
    console.log(`✅ 元数据已保存: ${metadataPath}`);
    
    // 统计信息
    const imageStats = {
      total: allImageData.length,
      withPrimaryUrl: allImageData.filter(item => item.primary && !item.primary.includes('DP')).length,
      withThumbnail: allImageData.filter(item => item.thumbnail).length,
      withAdditionalImages: allImageData.filter(item => item.additionalImages.length > 0).length
    };
    
    console.log('\n📊 数据分离统计:');
    console.log('='.repeat(50));
    console.log(`总作品数: ${allSearchData.length}`);
    console.log(`有原始图片URL: ${imageStats.withPrimaryUrl}`);
    console.log(`有缩略图: ${imageStats.withThumbnail}`);
    console.log(`有额外图片: ${imageStats.withAdditionalImages}`);
    
    console.log('\n✅ 数据分离完成!');
    
  } catch (error) {
    console.error('❌ 数据分离失败:', error);
    process.exit(1);
  }
}

// 运行脚本
if (require.main === module) {
  separateData();
}

module.exports = { separateData, processArtwork, generateImageUrlPatterns };
