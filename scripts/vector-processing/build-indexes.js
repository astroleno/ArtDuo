#!/usr/bin/env node

/**
 * HNSW索引构建脚本
 * 构建高性能向量索引，支持毫秒级检索
 */

const fs = require('fs');
const path = require('path');
const { HierarchicalNSW } = require('hnswlib-node');

// 配置
const CONFIG = {
  embeddingsDir: 'data/met/embeddings',
  indexesDir: 'data/met/indexes',
  embeddingsFile: 'artworks-embeddings.json',
  fullIndexFile: 'full.hnsw',
  emotionIndexDir: 'by-emotion',
  vectorSize: 384,
  maxElements: 10000,
  efConstruction: 200,
  M: 16
};

/**
 * 情绪分类映射
 */
const EMOTION_MAPPING = {
  'joy': ['joy', 'happiness', 'celebration', 'delight', 'glee'],
  'sadness': ['sadness', 'melancholy', 'grief', 'sorrow', 'despair'],
  'love': ['love', 'romance', 'passion', 'affection', 'tenderness'],
  'fear': ['fear', 'anxiety', 'terror', 'dread', 'panic'],
  'anger': ['anger', 'rage', 'fury', 'wrath', 'ire'],
  'surprise': ['surprise', 'amazement', 'wonder', 'astonishment'],
  'disgust': ['disgust', 'revulsion', 'repulsion', 'aversion'],
  'contemplation': ['contemplation', 'meditation', 'reflection', 'thought'],
  'awe': ['awe', 'reverence', 'wonder', 'amazement'],
  'peace': ['peace', 'serenity', 'tranquility', 'calm']
};

/**
 * 构建全量索引
 */
async function buildFullIndex(embeddings) {
  console.log('🔨 开始构建全量HNSW索引...');
  
  try {
    // 创建HNSW索引
    const index = new HierarchicalNSW('cosine', CONFIG.vectorSize);
    index.initIndex(CONFIG.maxElements, CONFIG.M, CONFIG.efConstruction);
    
    console.log(`📊 索引配置: 维度=${CONFIG.vectorSize}, 最大元素=${CONFIG.maxElements}, M=${CONFIG.M}`);
    
    // 添加向量到索引
    let addedCount = 0;
    for (let i = 0; i < embeddings.length; i++) {
      const embedding = embeddings[i];
      
      try {
        index.addPoint(embedding.vector, i);
        addedCount++;
        
        if ((i + 1) % 1000 === 0) {
          console.log(`✅ 已添加 ${i + 1}/${embeddings.length} 个向量`);
        }
      } catch (error) {
        console.warn(`⚠️ 跳过向量 ${embedding.id}: ${error.message}`);
      }
    }
    
    console.log(`✅ 全量索引构建完成，添加了 ${addedCount} 个向量`);
    
    // 保存索引
    const indexPath = path.join(process.cwd(), CONFIG.indexesDir, CONFIG.fullIndexFile);
    index.writeIndexSync(indexPath);
    console.log(`💾 全量索引已保存: ${indexPath}`);
    
    return {
      index,
      addedCount,
      indexPath
    };
    
  } catch (error) {
    console.error('❌ 构建全量索引失败:', error);
    throw error;
  }
}

/**
 * 构建情绪分类索引
 */
async function buildEmotionIndexes(embeddings) {
  console.log('🎭 开始构建情绪分类索引...');
  
  try {
    // 创建情绪索引目录
    const emotionIndexDir = path.join(process.cwd(), CONFIG.indexesDir, CONFIG.emotionIndexDir);
    if (!fs.existsSync(emotionIndexDir)) {
      fs.mkdirSync(emotionIndexDir, { recursive: true });
    }
    
    const emotionIndexes = {};
    
    // 为每个情绪构建索引
    for (const [emotion, keywords] of Object.entries(EMOTION_MAPPING)) {
      console.log(`\n🔍 构建 ${emotion} 情绪索引...`);
      
      // 筛选相关作品
      const relevantArtworks = embeddings.filter(embedding => {
        const searchText = embedding.searchText.toLowerCase();
        return keywords.some(keyword => searchText.includes(keyword));
      });
      
      if (relevantArtworks.length === 0) {
        console.log(`⚠️ ${emotion} 情绪没有找到相关作品，跳过`);
        continue;
      }
      
      // 创建情绪索引
      const emotionIndex = new HierarchicalNSW('cosine', CONFIG.vectorSize);
      const maxElements = Math.min(relevantArtworks.length * 2, CONFIG.maxElements);
      emotionIndex.initIndex(maxElements, CONFIG.M, CONFIG.efConstruction);
      
      // 添加向量
      let addedCount = 0;
      relevantArtworks.forEach((embedding, i) => {
        try {
          emotionIndex.addPoint(embedding.vector, i);
          addedCount++;
        } catch (error) {
          console.warn(`⚠️ 跳过向量 ${embedding.id}: ${error.message}`);
        }
      });
      
      // 保存情绪索引
      const emotionIndexPath = path.join(emotionIndexDir, `${emotion}.hnsw`);
      emotionIndex.writeIndexSync(emotionIndexPath);
      
      emotionIndexes[emotion] = {
        index: emotionIndex,
        artworks: relevantArtworks,
        count: addedCount,
        path: emotionIndexPath
      };
      
      console.log(`✅ ${emotion} 索引构建完成: ${addedCount} 件作品`);
    }
    
    console.log(`\n🎉 情绪分类索引构建完成，共 ${Object.keys(emotionIndexes).length} 个情绪`);
    
    return emotionIndexes;
    
  } catch (error) {
    console.error('❌ 构建情绪分类索引失败:', error);
    throw error;
  }
}

/**
 * 测试索引性能
 */
async function testIndexPerformance(fullIndex, embeddings) {
  console.log('\n🧪 开始测试索引性能...');
  
  try {
    const testQueries = [
      'joy happiness celebration',
      'sadness melancholy grief',
      'love romance passion',
      'fear anxiety terror',
      'anger rage fury'
    ];
    
    const results = [];
    
    for (const query of testQueries) {
      console.log(`\n🔍 测试查询: "${query}"`);
      
      // 生成查询向量 (简化版，实际应该使用相同的向量化器)
      const queryVector = new Array(CONFIG.vectorSize).fill(0);
      const words = query.toLowerCase().split(' ');
      words.forEach((word, i) => {
        const index = (word.charCodeAt(0) + i) % CONFIG.vectorSize;
        queryVector[index] = 1.0;
      });
      
      // 执行搜索
      const startTime = Date.now();
      const { neighbors, distances } = fullIndex.searchKnn(queryVector, 10);
      const endTime = Date.now();
      
      const searchTime = endTime - startTime;
      
      // 获取结果
      const topResults = neighbors.slice(0, 5).map((neighbor, index) => ({
        id: embeddings[neighbor].id,
        title: embeddings[neighbor].title,
        artist: embeddings[neighbor].artist,
        similarity: 1 - distances[index], // 转换为相似度
        qualityLevel: embeddings[neighbor].qualityLevel
      }));
      
      console.log('Top 5 结果:');
      topResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.title} by ${result.artist} (相似度: ${result.similarity.toFixed(4)}, 质量: ${result.qualityLevel})`);
      });
      
      results.push({
        query,
        topResults,
        searchTime,
        averageSimilarity: topResults.reduce((sum, r) => sum + r.similarity, 0) / topResults.length
      });
    }
    
    // 计算平均性能
    const avgSearchTime = results.reduce((sum, r) => sum + r.searchTime, 0) / results.length;
    const queriesPerSecond = Math.round(1000 / avgSearchTime);
    
    console.log(`\n⚡ 索引性能测试结果:`);
    console.log(`平均检索时间: ${avgSearchTime.toFixed(2)}ms`);
    console.log(`每秒可处理查询: ${queriesPerSecond}`);
    
    return {
      results,
      avgSearchTime,
      queriesPerSecond
    };
    
  } catch (error) {
    console.error('❌ 性能测试失败:', error);
    throw error;
  }
}

/**
 * 生成索引报告
 */
async function generateIndexReport(fullIndex, emotionIndexes, performanceResults) {
  console.log('\n📊 生成索引报告...');
  
  try {
    const report = {
      timestamp: new Date().toISOString(),
      indexConfig: {
        vectorSize: CONFIG.vectorSize,
        maxElements: CONFIG.maxElements,
        M: CONFIG.M,
        efConstruction: CONFIG.efConstruction
      },
      fullIndex: {
        totalVectors: fullIndex.addedCount,
        indexSize: 'N/A', // HNSW不直接提供大小信息
        performance: {
          avgSearchTime: performanceResults.avgSearchTime,
          queriesPerSecond: performanceResults.queriesPerSecond
        }
      },
      emotionIndexes: Object.keys(emotionIndexes).map(emotion => ({
        emotion,
        count: emotionIndexes[emotion].count,
        path: emotionIndexes[emotion].path
      })),
      recommendations: [
        '索引构建完成，可以开始集成到检索系统',
        '建议在检索时优先使用情绪分类索引',
        '全量索引作为备用方案',
        '考虑实现索引缓存机制'
      ]
    };
    
    // 保存报告
    const reportPath = path.join(process.cwd(), CONFIG.indexesDir, 'index-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`✅ 索引报告已保存: ${reportPath}`);
    
    return report;
    
  } catch (error) {
    console.error('❌ 生成索引报告失败:', error);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始构建HNSW索引...');
  console.log('='.repeat(50));
  
  try {
    // 确保输出目录存在
    const indexesDir = path.join(process.cwd(), CONFIG.indexesDir);
    if (!fs.existsSync(indexesDir)) {
      fs.mkdirSync(indexesDir, { recursive: true });
    }
    
    // 读取向量数据
    const embeddingsPath = path.join(process.cwd(), CONFIG.embeddingsDir, CONFIG.embeddingsFile);
    if (!fs.existsSync(embeddingsPath)) {
      throw new Error(`向量数据文件不存在: ${embeddingsPath}`);
    }
    
    const embeddings = JSON.parse(fs.readFileSync(embeddingsPath, 'utf8'));
    console.log(`📊 加载了 ${embeddings.length} 个向量`);
    
    // 构建全量索引
    const { index: fullIndex } = await buildFullIndex(embeddings);
    
    // 构建情绪分类索引
    const emotionIndexes = await buildEmotionIndexes(embeddings);
    
    // 测试性能
    const performanceResults = await testIndexPerformance(fullIndex, embeddings);
    
    // 生成报告
    await generateIndexReport(fullIndex, emotionIndexes, performanceResults);
    
    console.log('\n🎉 HNSW索引构建完成!');
    console.log('='.repeat(50));
    console.log(`全量索引: ${fullIndex.addedCount} 个向量`);
    console.log(`情绪索引: ${Object.keys(emotionIndexes).length} 个分类`);
    console.log(`平均检索时间: ${performanceResults.avgSearchTime.toFixed(2)}ms`);
    console.log(`每秒查询数: ${performanceResults.queriesPerSecond}`);
    
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
  buildFullIndex,
  buildEmotionIndexes,
  testIndexPerformance,
  generateIndexReport
};
