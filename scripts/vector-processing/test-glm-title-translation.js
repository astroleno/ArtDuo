#!/usr/bin/env node

/**
 * 测试GLM API标题翻译功能
 */

const fs = require('fs');
const path = require('path');

// 加载环境变量
const envPath = path.join(__dirname, '../../frontend/env.local.json');
const env = JSON.parse(fs.readFileSync(envPath, 'utf8'));

// 设置环境变量
process.env.NEXT_PUBLIC_GLM_API_KEY = env.NEXT_PUBLIC_GLM_API_KEY;
process.env.NEXT_PUBLIC_GLM_URL = env.NEXT_PUBLIC_GLM_URL;
process.env.NEXT_PUBLIC_GLM_MODEL = env.NEXT_PUBLIC_GLM_MODEL;

// 导入GLM客户端
const { GLMOptimizedClient } = require('../../frontend/src/lib/glm-optimized-client.ts');

async function testTitleTranslation() {
  console.log('🧪 测试GLM API标题翻译功能...');
  console.log('================================================================================');
  
  const client = new GLMOptimizedClient();
  
  // 测试标题翻译
  const testTitles = [
    'Mona Lisa',
    'The Starry Night',
    'Garden at Sainte-Adresse',
    'The Rehearsal of the Ballet Onstage'
  ];
  
  for (const title of testTitles) {
    console.log(`\n🔄 测试标题翻译: "${title}"`);
    console.log('--------------------------------------------------');
    
    try {
      const titlePrompt = `请将艺术作品标题翻译为中文。要求：1. 先给出中文译名 2. 在括号内保留英文原文 3. 不要添加其他解释文字。

示例：
输入：Mona Lisa
输出：蒙娜丽莎（Mona Lisa）

输入：The Starry Night
输出：星夜（The Starry Night）

现在请翻译：${title}`;
      
      const response = await client.chat([
        { role: 'system', content: '你是专业的艺术作品翻译专家，请严格按照用户要求的格式输出翻译结果。' },
        { role: 'user', content: titlePrompt }
      ], { 
        temperature: 0.1, 
        max_tokens: 500, 
        thinking: 'disabled' 
      });
      
      console.log('📡 GLM API 响应:', JSON.stringify(response, null, 2));
      
      const result = response.choices[0]?.message?.content || title;
      console.log('📝 翻译结果:', result);
      console.log('📝 结果长度:', result.length);
      console.log('📝 是否与原文相同:', result === title);
      
      if (result && result !== title) {
        console.log('✅ 标题翻译成功');
      } else {
        console.log('❌ 标题翻译失败 - 返回空或相同结果');
      }
      
    } catch (error) {
      console.error('❌ 标题翻译失败:', error.message);
    }
  }
  
  console.log('\n🎉 标题翻译测试完成!');
  console.log('================================================================================');
}

// 运行测试
testTitleTranslation().catch(console.error);
