#!/usr/bin/env node

/**
 * GLM API 诊断测试脚本
 * 测试各种API调用，找出返回空结果的原因
 */

// 设置环境变量
const fs = require('fs');
const path = require('path');

// 读取 env.local.json 并设置环境变量
const envConfigPath = path.join(__dirname, '..', 'frontend', 'env.local.json');
try {
  const envContent = fs.readFileSync(envConfigPath, 'utf8');
  const envConfig = JSON.parse(envContent);

  // 设置关键环境变量
  process.env.NEXT_PUBLIC_GLM_API_KEY = envConfig.NEXT_PUBLIC_GLM_API_KEY;
  process.env.NEXT_PUBLIC_GLM_URL = envConfig.NEXT_PUBLIC_GLM_URL;
  process.env.NEXT_PUBLIC_GLM_MODEL = envConfig.NEXT_PUBLIC_GLM_MODEL;

  console.log('✅ 环境配置加载成功');
} catch (error) {
  console.error('❌ 环境配置加载失败:', error.message);
  process.exit(1);
}

// 动态导入客户端
const { glmOptimizedClient } = require('../frontend/src/lib/glm-optimized-client.ts');

async function testGLMAPI() {
  console.log('🔍 开始GLM API诊断测试...\n');

  // 测试1: 简单对话
  console.log('📝 测试1: 简单对话');
  try {
    const response1 = await glmOptimizedClient.quickChat([
      { role: 'system', content: '你是一个测试助手。' },
      { role: 'user', content: '请说"测试成功"' }
    ]);
    console.log('✅ 简单对话成功:', response1.choices[0]?.message?.content?.slice(0, 100));
  } catch (error) {
    console.log('❌ 简单对话失败:', error.message);
  }
  console.log('');

  // 测试2: 关键词生成
  console.log('📝 测试2: 关键词生成');
  try {
    const keywords = await glmOptimizedClient.generateOptimizedKeywords('今天感觉不错,逛了一天街');
    console.log('✅ 关键词生成成功:', keywords);
    console.log('🔍 关键词数量:', keywords.length);
  } catch (error) {
    console.log('❌ 关键词生成失败:', error.message);
    console.log('🔍 错误详情:', error);
  }
  console.log('');

  // 测试3: JSON格式输出
  console.log('📝 测试3: JSON格式输出');
  try {
    const response3 = await glmOptimizedClient.quickChat([
      { role: 'system', content: '你是一个JSON生成器。' },
      { role: 'user', content: '请生成一个JSON：{"test": "value"}' }
    ], { response_format: { type: 'json_object' } });
    console.log('✅ JSON输出成功:', response3.choices[0]?.message?.content?.slice(0, 100));
  } catch (error) {
    console.log('❌ JSON输出失败:', error.message);
  }
  console.log('');

  // 测试4: 评分格式
  console.log('📝 测试4: 评分格式');
  try {
    const response4 = await glmOptimizedClient.quickChat([
      { role: 'system', content: '你是专业的艺术作品评分专家。请严格按照指定的JSON格式返回评分结果。' },
      { role: 'user', content: `请为以下艺术作品评分：
作品ID: test123
标题: 测试作品
艺术家: 测试艺术家
情绪: 今天感觉不错,逛了一天街

请返回JSON格式：
{
  "artworkId": "test123",
  "emotionFit": 8.5,
  "artisticValue": 7.0,
  "visualImpact": 6.5,
  "overallRecommendation": 7.5,
  "confidence": 0.8,
  "reasoning": "测试评分理由"
}` }
    ]);
    console.log('✅ 评分格式成功:', response4.choices[0]?.message?.content?.slice(0, 200));
  } catch (error) {
    console.log('❌ 评分格式失败:', error.message);
  }
  console.log('');

  // 测试5: 长文本讲解
  console.log('📝 测试5: 长文本讲解');
  try {
    const response5 = await glmOptimizedClient.chat([
      { role: 'system', content: '你是一位资深的艺术史学家的策展人，擅长深度解读艺术作品。' },
      { role: 'user', content: `请为"今天感觉不错,逛了一天街"情绪的用户深度解读《蒙娜丽莎》这件作品。要求400-600字的深度分析。` }
    ], { max_tokens: 800, temperature: 0.8 });
    console.log('✅ 长文本讲解成功:', response5.choices[0]?.message?.content?.slice(0, 200));
  } catch (error) {
    console.log('❌ 长文本讲解失败:', error.message);
  }
  console.log('');

  console.log('🎯 GLM API诊断测试完成');
}

// 运行测试
testGLMAPI().catch(console.error);