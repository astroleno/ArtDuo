// 测试GLM API的简单脚本
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// 读取配置
const envPath = path.join(__dirname, 'env.local.json');
const config = JSON.parse(fs.readFileSync(envPath, 'utf8'));

const apiKey = config.NEXT_PUBLIC_GLM_API_KEY;
const baseUrl = 'https://open.bigmodel.cn/api/paas/v4';
const model = config.NEXT_PUBLIC_GLM_MODEL || 'glm-4.5';

console.log('🔧 GLM API测试配置:');
console.log('- API Key长度:', apiKey ? apiKey.length : 0);
console.log('- 基础URL:', baseUrl);
console.log('- 模型:', model);

async function testGLMAPI() {
  try {
    console.log('\n🚀 开始测试GLM API...');
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'user', content: '请回复：测试成功' }
        ],
        temperature: 0.7,
        max_tokens: 100,
        response_format: { type: 'json_object' }
      })
    });

    console.log('📡 响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API错误响应:', errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ API测试成功!');
    console.log('📝 响应内容:', result.choices[0]?.message?.content);
    console.log('📊 使用情况:', result.usage);
    
  } catch (error) {
    console.error('❌ API测试失败:', error.message);
  }
}

testGLMAPI();
