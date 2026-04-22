#!/usr/bin/env node

/**
 * 增强向量生成脚本
 * 基于新的分离数据架构，使用增强的搜索文本生成向量嵌入
 * 包含情感关键词的384维向量表示
 */

const fs = require('fs');
const path = require('path');
const natural = require('natural');

// 配置
const CONFIG = {
  processedDir: 'data/met/processed',
  embeddingsDir: 'data/met/embeddings',
  searchFile: 'artworks-search.json',
  embeddingsFile: 'artworks-embeddings.json'
};

/**
 * 增强文本向量化器
 * 使用TF-IDF和情感关键词权重生成向量表示
 */
class EnhancedTextVectorizer {
  constructor() {
    this.vocabulary = new Map();
    this.idf = new Map();
    this.docCount = 0;
    this.vectorSize = 384; // 目标向量维度
    this.emotionKeywords = new Set(); // 情感关键词集合
  }
  
  /**
   * 训练向量化器
   */
  train(searchData) {
    console.log(`🔧 开始训练增强向量化器，处理 ${searchData.length} 个文本...`);
    
    this.docCount = searchData.length;
    
    // 提取所有情感关键词
    this.extractEmotionKeywords(searchData);
    
    // 构建词汇表
    this.buildVocabulary(searchData);
    
    // 计算IDF
    this.calculateIDF(searchData);
    
    console.log(`✅ 增强向量化器训练完成，词汇表大小: ${this.vocabulary.size}`);
    console.log(`🎭 情感关键词数量: ${this.emotionKeywords.size}`);
  }
  
  /**
   * 提取情感关键词
   */
  extractEmotionKeywords(searchData) {
    searchData.forEach(item => {
      if (item.emotion && item.emotion.keywords) {
        item.emotion.keywords.forEach(keyword => {
          this.emotionKeywords.add(keyword.toLowerCase());
        });
      }
    });
    console.log(`🎭 提取到 ${this.emotionKeywords.size} 个情感关键词`);
  }
  
  /**
   * 构建词汇表
   */
  buildVocabulary(searchData) {
    const wordCounts = new Map();
    
    searchData.forEach(item => {
      const text = item.searchText || '';
      const words = this.tokenize(text);
      
      words.forEach(word => {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      });
    });
    
    // 过滤低频词，保留高频词
    const minCount = Math.max(2, Math.floor(this.docCount * 0.001));
    let vocabIndex = 0;
    
    for (const [word, count] of wordCounts) {
      if (count >= minCount) {
        this.vocabulary.set(word, vocabIndex++);
      }
    }
    
    console.log(`📚 词汇表构建完成，保留 ${this.vocabulary.size} 个词汇`);
  }
  
  /**
   * 计算IDF
   */
  calculateIDF(searchData) {
    this.vocabulary.forEach((_, word) => {
      let docFreq = 0;
      
      searchData.forEach(item => {
        const text = item.searchText || '';
        const words = this.tokenize(text);
        
        if (words.includes(word)) {
          docFreq++;
        }
      });
      
      this.idf.set(word, Math.log(this.docCount / (docFreq + 1)));
    });
  }
  
  /**
   * 文本分词
   */
  tokenize(text) {
    if (!text) return [];
    
    // 转换为小写并分词
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ') // 移除标点符号
      .split(/\s+/)
      .filter(word => word.length > 1); // 过滤单字符词
    
    return words;
  }
  
  /**
   * 生成单个文本的向量
   */
  vectorize(text, emotionKeywords = []) {
    const words = this.tokenize(text);
    const vector = new Array(this.vectorSize).fill(0);
    
    // 计算TF-IDF向量
    const wordCounts = new Map();
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });
    
    // 填充向量
    wordCounts.forEach((count, word) => {
      if (this.vocabulary.has(word)) {
        const vocabIndex = this.vocabulary.get(word);
        const tf = count / words.length;
        const idf = this.idf.get(word) || 0;
        let weight = tf * idf;
        
        // 情感关键词加权
        if (this.emotionKeywords.has(word) || emotionKeywords.includes(word)) {
          weight *= 1.5; // 情感关键词权重增加50%
        }
        
        // 将权重映射到向量维度
        const vectorIndex = vocabIndex % this.vectorSize;
        vector[vectorIndex] += weight;
      }
    });
    
    // 归一化向量
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }
    
    return vector;
  }
  
  /**
   * 为所有作品生成向量
   */
  generateVectors(searchData) {
    console.log(`🔄 开始生成 ${searchData.length} 个向量...`);
    
    const vectors = searchData.map((item, index) => {
      if (index % 1000 === 0) {
        console.log(`📊 进度: ${index}/${searchData.length}`);
      }
      
      const emotionKeywords = item.emotion ? item.emotion.keywords : [];
      const vector = this.vectorize(item.searchText, emotionKeywords);
      
      return {
        id: item.id,
        title: item.title,
        artist: item.artist,
        vector: vector,
        emotion: item.emotion
      };
    });
    
    console.log(`✅ 向量生成完成，共 ${vectors.length} 个向量`);
    return vectors;
  }
}

/**
 * 主处理函数
 */
async function generateEnhancedEmbeddings() {
  console.log('🚀 开始生成增强向量嵌入...');
  
  try {
    // 读取搜索数据
    const searchDataPath = path.join(process.cwd(), CONFIG.processedDir, CONFIG.searchFile);
    if (!fs.existsSync(searchDataPath)) {
      throw new Error(`搜索数据文件不存在: ${searchDataPath}`);
    }
    
    const searchData = JSON.parse(fs.readFileSync(searchDataPath, 'utf8'));
    console.log(`📊 加载了 ${searchData.length} 件作品搜索数据`);
    
    // 创建向量化器
    const vectorizer = new EnhancedTextVectorizer();
    
    // 训练向量化器
    vectorizer.train(searchData);
    
    // 生成向量
    const vectors = vectorizer.generateVectors(searchData);
    
    // 确保输出目录存在
    const embeddingsDir = path.join(process.cwd(), CONFIG.embeddingsDir);
    if (!fs.existsSync(embeddingsDir)) {
      fs.mkdirSync(embeddingsDir, { recursive: true });
    }
    
    // 保存向量数据
    const embeddingsPath = path.join(embeddingsDir, CONFIG.embeddingsFile);
    fs.writeFileSync(embeddingsPath, JSON.stringify(vectors, null, 2));
    console.log(`✅ 向量嵌入已保存: ${embeddingsPath}`);
    
    // 复制到前端目录
    const frontendPath = path.join(process.cwd(), 'frontend', 'public', 'data', CONFIG.embeddingsFile);
    fs.writeFileSync(frontendPath, JSON.stringify(vectors, null, 2));
    console.log(`✅ 向量嵌入已复制到前端: ${frontendPath}`);
    
    // 统计信息
    const stats = {
      total: vectors.length,
      vectorSize: vectors[0]?.vector?.length || 0,
      withEmotion: vectors.filter(v => v.emotion).length,
      emotionTypes: new Set(vectors.map(v => v.emotion?.id).filter(Boolean)).size
    };
    
    console.log('\n📊 增强向量嵌入统计:');
    console.log('='.repeat(50));
    console.log(`总向量数: ${stats.total}`);
    console.log(`向量维度: ${stats.vectorSize}`);
    console.log(`有情感标签: ${stats.withEmotion}`);
    console.log(`情感类型数: ${stats.emotionTypes}`);
    
    console.log('\n✅ 增强向量嵌入生成完成!');
    
  } catch (error) {
    console.error('❌ 生成增强向量嵌入失败:', error);
    process.exit(1);
  }
}

// 运行脚本
if (require.main === module) {
  generateEnhancedEmbeddings();
}

module.exports = { generateEnhancedEmbeddings, EnhancedTextVectorizer };






