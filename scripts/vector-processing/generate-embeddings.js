#!/usr/bin/env node

/**
 * 向量生成脚本
 * 使用轻量级文本相似度算法生成向量表示
 * 为9000件作品生成384维向量表示
 */

const fs = require('fs');
const path = require('path');
const natural = require('natural');

// 配置
const CONFIG = {
  processedDir: 'data/met/processed',
  embeddingsDir: 'data/met/embeddings',
  cleanedFile: 'artworks-cleaned.json',
  embeddingsFile: 'artworks-embeddings.json',
  vectorsFile: 'artworks-vectors.bin'
};

/**
 * 文本向量化器
 * 使用TF-IDF和词频统计生成向量表示
 */
class TextVectorizer {
  constructor() {
    this.vocabulary = new Map();
    this.idf = new Map();
    this.docCount = 0;
    this.vectorSize = 384; // 目标向量维度
  }
  
  /**
   * 训练向量化器
   */
  train(texts) {
    console.log(`🔧 开始训练向量化器，处理 ${texts.length} 个文本...`);
    
    this.docCount = texts.length;
    
    // 第一步：构建词汇表
    this.buildVocabulary(texts);
    
    // 第二步：计算IDF
    this.calculateIDF(texts);
    
    console.log(`✅ 向量化器训练完成，词汇表大小: ${this.vocabulary.size}`);
  }
  
  /**
   * 构建词汇表
   */
  buildVocabulary(texts) {
    const tokenizer = new natural.WordTokenizer();
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should']);
    
    let wordIndex = 0;
    
    texts.forEach(text => {
      if (!text) return;
      
      const tokens = tokenizer.tokenize(text.toLowerCase());
      if (!tokens) return;
      
      const words = tokens
        .filter(word => word.length > 2 && !stopWords.has(word))
        .filter(word => /^[a-zA-Z]+$/.test(word));
      
      words.forEach(word => {
        if (!this.vocabulary.has(word)) {
          this.vocabulary.set(word, wordIndex++);
        }
      });
    });
  }
  
  /**
   * 计算逆文档频率 (IDF)
   */
  calculateIDF(texts) {
    const tokenizer = new natural.WordTokenizer();
    
    texts.forEach(text => {
      if (!text) return;
      
      const tokens = tokenizer.tokenize(text.toLowerCase());
      if (!tokens) return;
      
      const words = tokens
        .filter(word => word.length > 2)
        .filter(word => /^[a-zA-Z]+$/.test(word));
      
      const uniqueWords = new Set(words);
      uniqueWords.forEach(word => {
        if (this.vocabulary.has(word)) {
          this.idf.set(word, (this.idf.get(word) || 0) + 1);
        }
      });
    });
    
    // 计算IDF值
    this.idf.forEach((count, word) => {
      this.idf.set(word, Math.log(this.docCount / count));
    });
  }
  
  /**
   * 将文本转换为向量
   */
  vectorize(text) {
    if (!text) return new Array(this.vectorSize).fill(0);
    
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(text.toLowerCase());
    if (!tokens) return new Array(this.vectorSize).fill(0);
    
    const words = tokens
      .filter(word => word.length > 2)
      .filter(word => /^[a-zA-Z]+$/.test(word));
    
    // 计算词频
    const wordFreq = new Map();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });
    
    // 生成TF-IDF向量
    const vector = new Array(this.vectorSize).fill(0);
    const maxFreq = Math.max(...wordFreq.values());
    
    wordFreq.forEach((freq, word) => {
      if (this.vocabulary.has(word)) {
        const wordIndex = this.vocabulary.get(word);
        const tf = freq / maxFreq;
        const idf = this.idf.get(word) || 0;
        const tfidf = tf * idf;
        
        // 将向量映射到目标维度
        const mappedIndex = wordIndex % this.vectorSize;
        vector[mappedIndex] += tfidf;
      }
    });
    
    // 归一化向量
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return vector.map(val => val / magnitude);
    }
    
    return vector;
  }
  
  /**
   * 计算向量相似度
   */
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }
}

/**
 * 生成作品向量
 */
async function generateArtworkVectors() {
  console.log('🚀 开始生成作品向量...');
  
  try {
    // 读取清洗后的数据
    const cleanedPath = path.join(process.cwd(), CONFIG.processedDir, CONFIG.cleanedFile);
    if (!fs.existsSync(cleanedPath)) {
      throw new Error(`清洗数据文件不存在: ${cleanedPath}`);
    }
    
    const artworks = JSON.parse(fs.readFileSync(cleanedPath, 'utf8'));
    console.log(`📊 加载了 ${artworks.length} 件作品数据`);
    
    // 提取搜索文本
    const searchTexts = artworks.map(artwork => artwork.enhancedSearchText || artwork.searchText || '');
    console.log(`📝 提取了 ${searchTexts.length} 个搜索文本`);
    
    // 训练向量化器
    const vectorizer = new TextVectorizer();
    vectorizer.train(searchTexts);
    
    // 生成向量
    console.log('🔄 开始生成向量...');
    const embeddings = [];
    
    for (let i = 0; i < artworks.length; i++) {
      const artwork = artworks[i];
      const searchText = artwork.enhancedSearchText || artwork.searchText || '';
      
      // 生成向量
      const vector = vectorizer.vectorize(searchText);
      
      // 添加质量权重
      const qualityWeight = artwork.dataQuality?.weight || 1.0;
      const weightedVector = vector.map(val => val * qualityWeight);
      
      embeddings.push({
        id: artwork.id,
        title: artwork.title,
        artist: artwork.artist,
        vector: weightedVector,
        qualityLevel: artwork.dataQuality?.level || 'good',
        qualityWeight: qualityWeight,
        searchText: searchText,
        searchTextLength: searchText.length
      });
      
      if ((i + 1) % 1000 === 0) {
        console.log(`✅ 已处理 ${i + 1}/${artworks.length} 件作品`);
      }
    }
    
    // 保存向量数据
    const embeddingsPath = path.join(process.cwd(), CONFIG.embeddingsDir, CONFIG.embeddingsFile);
    fs.writeFileSync(embeddingsPath, JSON.stringify(embeddings, null, 2));
    console.log(`✅ 向量数据已保存: ${embeddingsPath}`);
    
    // 生成统计报告
    const stats = {
      totalArtworks: embeddings.length,
      vectorSize: vectorizer.vectorSize,
      vocabularySize: vectorizer.vocabulary.size,
      averageVectorMagnitude: 0,
      qualityDistribution: {
        excellent: embeddings.filter(e => e.qualityLevel === 'excellent').length,
        good: embeddings.filter(e => e.qualityLevel === 'good').length,
        basic: embeddings.filter(e => e.qualityLevel === 'basic').length,
        minimal: embeddings.filter(e => e.qualityLevel === 'minimal').length
      }
    };
    
    // 计算平均向量幅度
    const totalMagnitude = embeddings.reduce((sum, e) => {
      const magnitude = Math.sqrt(e.vector.reduce((s, v) => s + v * v, 0));
      return sum + magnitude;
    }, 0);
    stats.averageVectorMagnitude = totalMagnitude / embeddings.length;
    
    // 保存统计报告
    const statsPath = path.join(process.cwd(), CONFIG.embeddingsDir, 'vector-stats.json');
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    console.log(`✅ 统计报告已保存: ${statsPath}`);
    
    // 输出结果
    console.log('\n📊 向量生成结果:');
    console.log('='.repeat(50));
    console.log(`总作品数: ${stats.totalArtworks}`);
    console.log(`向量维度: ${stats.vectorSize}`);
    console.log(`词汇表大小: ${stats.vocabularySize}`);
    console.log(`平均向量幅度: ${stats.averageVectorMagnitude.toFixed(4)}`);
    console.log('\n质量分布:');
    console.log(`  Excellent: ${stats.qualityDistribution.excellent}`);
    console.log(`  Good: ${stats.qualityDistribution.good}`);
    console.log(`  Basic: ${stats.qualityDistribution.basic}`);
    console.log(`  Minimal: ${stats.qualityDistribution.minimal}`);
    
    console.log('\n✅ 向量生成完成!');
    
    return {
      embeddings,
      vectorizer,
      stats
    };
    
  } catch (error) {
    console.error('❌ 向量生成过程中出现错误:', error);
    throw error;
  }
}

/**
 * 测试向量检索性能
 */
async function testVectorSearch(embeddings, vectorizer) {
  console.log('\n🧪 开始测试向量检索性能...');
  
  try {
    const testQueries = [
      'joy happiness celebration',
      'sadness melancholy grief',
      'love romance passion',
      'fear anxiety terror',
      'anger rage fury'
    ];
    
    const results = [];
    
    testQueries.forEach(query => {
      console.log(`\n🔍 测试查询: "${query}"`);
      
      const queryVector = vectorizer.vectorize(query);
      const similarities = embeddings.map(embedding => ({
        id: embedding.id,
        title: embedding.title,
        artist: embedding.artist,
        similarity: vectorizer.cosineSimilarity(queryVector, embedding.vector),
        qualityLevel: embedding.qualityLevel
      }));
      
      // 按相似度排序
      similarities.sort((a, b) => b.similarity - a.similarity);
      
      // 取前5个结果
      const topResults = similarities.slice(0, 5);
      
      console.log('Top 5 结果:');
      topResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.title} by ${result.artist} (相似度: ${result.similarity.toFixed(4)}, 质量: ${result.qualityLevel})`);
      });
      
      results.push({
        query,
        topResults,
        averageSimilarity: topResults.reduce((sum, r) => sum + r.similarity, 0) / topResults.length
      });
    });
    
    // 计算平均检索时间
    const startTime = Date.now();
    for (let i = 0; i < 100; i++) {
      const queryVector = vectorizer.vectorize('test query');
      const similarities = embeddings.map(embedding => 
        vectorizer.cosineSimilarity(queryVector, embedding.vector)
      );
      similarities.sort((a, b) => b - a);
    }
    const endTime = Date.now();
    const avgSearchTime = (endTime - startTime) / 100;
    
    console.log(`\n⚡ 性能测试结果:`);
    console.log(`平均检索时间: ${avgSearchTime.toFixed(2)}ms`);
    console.log(`每秒可处理查询: ${Math.round(1000 / avgSearchTime)}`);
    
    return {
      results,
      avgSearchTime,
      queriesPerSecond: Math.round(1000 / avgSearchTime)
    };
    
  } catch (error) {
    console.error('❌ 性能测试过程中出现错误:', error);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始向量生成...');
  console.log('='.repeat(50));
  
  try {
    // 确保输出目录存在
    const embeddingsDir = path.join(process.cwd(), CONFIG.embeddingsDir);
    if (!fs.existsSync(embeddingsDir)) {
      fs.mkdirSync(embeddingsDir, { recursive: true });
    }
    
    // 生成向量
    const { embeddings, vectorizer, stats } = await generateArtworkVectors();
    
    // 测试检索性能
    await testVectorSearch(embeddings, vectorizer);
    
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
  generateArtworkVectors,
  TextVectorizer,
  testVectorSearch
};
