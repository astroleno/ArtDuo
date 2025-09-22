// 测试环境变量加载
console.log('=== 环境变量测试 ===');
console.log('NEXT_PUBLIC_GLM_API_KEY:', process.env.NEXT_PUBLIC_GLM_API_KEY ? '已设置 (长度: ' + process.env.NEXT_PUBLIC_GLM_API_KEY.length + ')' : '未设置');
console.log('NEXT_PUBLIC_GLM_URL:', process.env.NEXT_PUBLIC_GLM_URL || '未设置');
console.log('NEXT_PUBLIC_RIJKS_API_KEY:', process.env.NEXT_PUBLIC_RIJKS_API_KEY ? '已设置' : '未设置');

// 测试GLM客户端
const { glmOptimizedClient } = require('./src/lib/glm-optimized-client');
console.log('\n=== GLM客户端测试 ===');
console.log('GLM客户端API密钥状态:', glmOptimizedClient.hasValidApiKey());

// 简单API测试
async function testGLM() {
  try {
    const messages = [{ role: 'user', content: '请回复"测试成功"' }];
    const response = await glmOptimizedClient.chat(messages, { max_tokens: 50 });
    console.log('GLM API测试成功:', response.choices[0]?.message?.content);
  } catch (error) {
    console.error('GLM API测试失败:', error.message);
  }
}

testGLM();
