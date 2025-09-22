// 测试GLM API是否正常工作
const { glmOptimizedClient } = require('../frontend/src/lib/glm-optimized-client');

async function testGLMAPI() {
  console.log('🧪 开始测试GLM API...');
  
  try {
    // 检查API密钥
    console.log('🔑 API密钥状态:', glmOptimizedClient.hasValidApiKey());
    
    // 简单测试
    const messages = [
      {
        role: 'user',
        content: '请简单回复"测试成功"'
      }
    ];
    
    console.log('📡 发送测试请求...');
    const response = await glmOptimizedClient.chat(messages, {
      temperature: 0.3,
      max_tokens: 100
    });
    
    console.log('✅ GLM API响应:', response);
    console.log('📝 响应内容:', response.choices[0]?.message?.content);
    
  } catch (error) {
    console.error('❌ GLM API测试失败:', error);
  }
}

testGLMAPI();
