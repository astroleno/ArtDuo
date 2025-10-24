#!/usr/bin/env node

/**
 * 测试不同情绪输入的策展流程
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// 使用现有的测试类结构
const { CurateWorkflowTest } = require('./curate-workflow-test.js');

async function testDifferentEmotions() {
  const testEmotions = [
    { emotion: '有点疲惫，想找点安静的作品', userInput: '工作了一整天很累' },
    { emotion: '心情平静', userInput: '' },
    { emotion: '有些忧郁', userInput: '雨天的时候' }
  ];

  for (let i = 0; i < testEmotions.length; i++) {
    const testCase = testEmotions[i];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎨 测试案例 ${i + 1}: "${testCase.emotion}"`);
    console.log(`${'='.repeat(60)}`);

    const test = new CurateWorkflowTest();

    // 修改测试输入
    test.results.input = testCase;
    test.results.config = {
      baseUrl: 'http://localhost:3001',
      endpoint: '/api/curate/stream',
      timeout: 180000, // 3分钟超时
      testInput: testCase
    };

    try {
      // 修改测试方法的输入
      const originalPost = test.httpClient.post;
      test.httpClient.post = async function(endpoint, data, options) {
        return originalPost.call(this, endpoint, testCase, options);
      };

      await test.runTest();

      console.log(`✅ 测试案例 ${i + 1} 完成`);
      console.log(`📊 结果状态: ${test.results.success ? '通过' : '失败'}`);
      console.log(`⏱️  耗时: ${test.results.totalDuration}ms`);

      if (test.results.validation?.summary?.artworks) {
        console.log(`🎨 选择作品数: ${test.results.validation.summary.artworks.count}`);
      }

      await test.generateReport();

      // 等待一下再进行下一个测试
      if (i < testEmotions.length - 1) {
        console.log('⏳ 等待5秒后进行下一个测试...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

    } catch (error) {
      console.error(`❌ 测试案例 ${i + 1} 失败:`, error.message);
    }
  }

  console.log('\n🎉 所有测试案例完成！');
}

// 运行测试
if (require.main === module) {
  testDifferentEmotions().catch(console.error);
}

module.exports = { testDifferentEmotions };