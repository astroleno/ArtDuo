// 测试标题翻译功能

async function testTitleTranslation() {
  console.log('🧪 测试标题翻译功能...\n');

  const testCases = [
    'The Starry Night',
    'Mona Lisa',
    'The Persistence of Memory',
    'Guernica',
    'The Birth of Venus',
    '中文标题不需要翻译',
    'Girl with a Pearl Earring',
    'A Bar at the Folies-Bergère',
    'The Garden of Earthly Delights'
  ];

  for (const title of testCases) {
    try {
      console.log(`测试标题: "${title}"`);
      console.log(`需要翻译: ${needsChineseConversion(title)}`);
      console.log('---');
    } catch (error) {
      console.error(`❌ 测试失败:`, error);
    }
  }
}

// 从源码复制的检测函数
function needsChineseConversion(text) {
  if (!text) return false;

  // 检测连续英文单词（降低到2个字母）
  const hasEnglishWords = /[A-Za-z]{2,}/.test(text);

  // 检测常见英文句式结构和介词
  const hasEnglishPatterns = /\b(the|and|or|but|in|on|at|to|for|of|with|by|is|are|was|were|has|have|will|would|could|should)\b/i.test(text);

  // 检测英文标点符号组合
  const hasEnglishPunctuation = /[A-Za-z]+[,.!?][A-Za-z]/.test(text);

  // 检测以英文开头的句子
  const hasEnglishStart = /^[A-Za-z]/.test(text.trim());

  return hasEnglishWords || hasEnglishPatterns || hasEnglishPunctuation || hasEnglishStart;
}

testTitleTranslation();