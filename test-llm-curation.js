/**
 * 测试LLM策展意图生成
 */

const { realLLMCurationIntentGenerator } = require('./frontend/src/lib/curation/real-llm-curation-intent');

async function testLLMCuration() {
  console.log('🧪 测试LLM策展意图生成...');
  
  try {
    const userInput = "今天去了朋友家，聊的很投机、很开心";
    console.log('📝 用户输入:', userInput);
    
    const result = await realLLMCurationIntentGenerator.generateCurationIntent(userInput);
    
    console.log('✅ LLM策展意图生成成功:');
    console.log('📊 策展主题:', result.curatorialTheme);
    console.log('📊 情绪弧线:', result.emotionalArc);
    console.log('📊 情绪阶段数量:', result.emotionalStages.length);
    
    result.emotionalStages.forEach((stage, index) => {
      console.log(`\n🎭 阶段 ${stage.stage}:`);
      console.log(`   情绪: ${stage.emotion}`);
      console.log(`   强度: ${stage.intensity}`);
      console.log(`   描述: ${stage.description}`);
      console.log(`   视觉特征: ${stage.visualCharacteristics.join(', ')}`);
      console.log(`   作品数量: ${stage.artworkCount}`);
      console.log(`   关键词: ${stage.keywords.join(', ')}`);
    });
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testLLMCuration();
