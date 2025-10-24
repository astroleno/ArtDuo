#!/usr/bin/env node

/**
 * 直接测试GLM API调用
 */

const fs = require('fs');
const path = require('path');

// 读取配置
const envConfigPath = path.join(__dirname, '..', 'frontend', 'env.local.json');
const envConfig = JSON.parse(fs.readFileSync(envConfigPath, 'utf8'));

const API_KEY = envConfig.NEXT_PUBLIC_GLM_API_KEY;
const API_URL = envConfig.NEXT_PUBLIC_GLM_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const MODEL = envConfig.NEXT_PUBLIC_GLM_MODEL || 'glm-4.5-air';

console.log('🔑 API密钥长度:', API_KEY.length);
console.log('🌐 API地址:', API_URL);
console.log('🤖 模型:', MODEL);
console.log('');

async function callGLMAPI(messages, options = {}) {
  const requestBody = {
    model: MODEL,
    messages,
    temperature: options.temperature || 0.3,
    max_tokens: options.max_tokens || 1024,
    ...options
  };

  console.log('📤 请求体:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📥 响应状态:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ 错误响应:', errorText);
      return null;
    }

    const result = await response.json();
    console.log('✅ 响应成功');
    console.log('📝 内容长度:', result.choices?.[0]?.message?.content?.length || 0);
    console.log('📄 前200字符:', result.choices?.[0]?.message?.content?.slice(0, 200) || '(无内容)');

    return result;
  } catch (error) {
    console.log('❌ 请求失败:', error.message);
    return null;
  }
}

async function runTests() {
  console.log('🔍 开始GLM API直接测试...\n');

  // 测试1: 简单对话
  console.log('📝 测试1: 简单对话');
  await callGLMAPI([
    { role: 'system', content: '你是一个测试助手。' },
    { role: 'user', content: '请说"测试成功"' }
  ]);
  console.log('');

  // 测试2: 关键词生成
  console.log('📝 测试2: 关键词生成');
  await callGLMAPI([
    { role: 'system', content: '你是一个专业的艺术策展人，擅长生成多样化的艺术搜索关键词。请生成5个不同的关键词，用逗号分隔。' },
    { role: 'user', content: '为情绪"今天感觉不错,逛了一天街"生成5个多样化的艺术搜索关键词，包括不同风格、时期、技法等。' }
  ], { temperature: 0.3614034115224123, max_tokens: 150 });
  console.log('');

  // 测试3: JSON评分格式
  console.log('📝 测试3: JSON评分格式');
  await callGLMAPI([
    { role: 'system', content: '你是专业的艺术作品评分专家。请严格按照指定的JSON格式返回评分结果。' },
    { role: 'user', content: `请为以下艺术作品评分，用户当前情绪是"今天感觉不错,逛了一天街"。

评分标准：
1. **情绪契合度** (0-10分)：作品与"今天感觉不错,逛了一天街"情绪的匹配程度
2. **艺术价值** (0-10分)：作品的艺术技法、创新性、历史地位
3. **视觉表现力** (0-10分)：作品的视觉冲击力和表现力
4. **整体推荐度** (0-10分)：综合以上因素的整体推荐程度

作品列表：
1. 作品ID: test123
   标题: 测试作品
   艺术家: 测试艺术家
   年代: 2020
   材质: Oil on canvas
   描述: 测试描述
   图片: 有

请以JSON格式返回评分结果，格式如下：
{
  "scores": [
    {
      "artworkId": "test123",
      "emotionFit": 情绪契合度分数,
      "artisticValue": 艺术价值分数,
      "visualImpact": 视觉表现力分数,
      "overallRecommendation": 整体推荐度分数,
      "confidence": 置信度(0-1),
      "reasoning": "评分理由（简短说明）"
    }
  ]
}

请确保：
1. 每件作品都要评分
2. 分数为0-10的整数或小数
3. 评分理由要结合作品特点和用户情绪
4. JSON格式必须正确` }
  ], { temperature: 0.3, max_tokens: 1000 });
  console.log('');

  // 测试4: 长文本讲解
  console.log('📝 测试4: 长文本讲解');
  await callGLMAPI([
    { role: 'system', content: '你是一位资深的艺术史学家的策展人，擅长深度解读艺术作品的时代背景、情感密码和生命共鸣。你的讲解既有学术深度又充满人情味，能帮助用户在特定心情下与作品建立深刻的连接。' },
    { role: 'user', content: `请以艺术史学家的专业视角，为"今天感觉不错,逛了一天街"情绪的用户深度解读这件作品。

**用户情境**：
用户现在的情绪是"今天感觉不错,逛了一天街"。请站在用户的角度思考：为什么在这个心情下，这件作品特别值得一看？

**作品背景**：
标题：《蒙娜丽莎》
创作者：列奥纳多·达·芬奇
创作年代：1503-1506（这个年代发生了什么？）
材质技法：Oil on poplar panel（这种技法有什么特点？）
历史背景：文艺复兴时期的杰作
收藏机构：卢浮宫

**请从以下角度深度分析**：

1. **时代语境**：
   - 1503-1506年是什么时代？这个时代的艺术特点和社会背景
   - 艺术家列奥纳多·达·芬奇的创作风格和历史地位
   - 这件作品在艺术史上的意义

2. **情感密码**：
   - 作品如何表达"今天感觉不错,逛了一天街"相关的情感？
   - 色彩、构图、题材如何与用户心情对话？
   - 为什么在"今天感觉不错,逛了一天街"的心情下看这件作品会有特殊感受？

3. **观看之道**：
   - 建议用户从哪些角度欣赏这件作品？
   - 哪些细节特别值得注意？
   - 如何在欣赏中获得情感慰藉或启发？

4. **生命共鸣**：
   - 这件作品与"今天感觉不错,逛了一天街"这种生活情感有什么关联？
   - 能给用户带来什么样的思考或感动？

**写作要求**：
- 用温暖、专业的语调，像一位懂艺术的朋友在娓娓道来
- 避免空洞的形容词，要用具体的作品细节和背景故事
- 总长度400-600字，让用户有深度阅读的收获
- 让讲解既有学术深度又充满人情味

请直接输出讲解文本，不需要JSON格式或小标题。` }
  ], { temperature: 0.8, max_tokens: 1200 });
  console.log('');

  console.log('🎯 GLM API直接测试完成');
}

runTests().catch(console.error);