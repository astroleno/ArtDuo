#!/usr/bin/env tsx

/**
 * 作品讲解系统完整测试脚本
 * 测试英文标题翻译、中文输出、缓存机制、性能等关键功能
 */

import { generateArtworkExplanations, ArtworkExplanation } from './frontend/src/lib/curation/artwork-explanation';
import { Artwork } from './frontend/src/lib/curation/types';

// 测试配置
const TEST_CONFIG = {
  emotion: 'joy',
  userInput: '我想要一些能够让我感到开心和充满活力的艺术作品',
  curationStrategy: '选择色彩明亮、构图生动的作品来传达欢快的情绪'
};

// 测试用的艺术作品数据（包含英文标题）
const TEST_ARTWORKS: Artwork[] = [
  {
    id: 'test-001',
    title: 'Starry Night Over the Rhône',
    artist: 'Vincent van Gogh',
    year: '1888',
    medium: 'Oil on canvas',
    dimensions: '72.5 cm × 92 cm',
    imageUrl: 'https://example.com/starry-night.jpg',
    description: 'A beautiful night scene with stars reflected in the Rhône River, showcasing Van Gogh\'s distinctive post-impressionist style.',
    museum: 'Musée d\'Orsay, Paris',
    license: 'Public Domain',
    source: 'test'
  },
  {
    id: 'test-002',
    title: 'The Dance of Life',
    artist: 'Edvard Munch',
    year: '1899',
    medium: 'Oil on canvas',
    dimensions: '125 cm × 190 cm',
    imageUrl: 'https://example.com/dance-life.jpg',
    description: 'A symbolic representation of human life stages through dancing figures in a coastal landscape.',
    museum: 'National Gallery, Oslo',
    license: 'Public Domain',
    source: 'test'
  },
  {
    id: 'test-003',
    title: 'Sunflowers',
    artist: 'Vincent van Gogh',
    year: '1888',
    medium: 'Oil on canvas',
    dimensions: '92.1 cm × 73 cm',
    imageUrl: 'https://example.com/sunflowers.jpg',
    description: 'A vibrant still life showing a bouquet of sunflowers in a vase, demonstrating Van Gogh\'s mastery of color.',
    museum: 'National Gallery, London',
    license: 'Public Domain',
    source: 'test'
  }
];

/**
 * 英文检测函数 - 用于验证输出是否包含英文
 */
function containsEnglish(text: string): boolean {
  if (!text) return false;
  // 检测连续英文单词（2个字母及以上）
  return /[A-Za-z]{2,}/.test(text);
}

/**
 * 检测中文字符比例
 */
function getChineseRatio(text: string): number {
  if (!text) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  return totalChars > 0 ? chineseChars / totalChars : 0;
}

/**
 * 性能测试结果
 */
interface PerformanceResult {
  functionName: string;
  duration: number;
  memoryUsage?: NodeJS.MemoryUsage;
  cacheHitRate?: number;
}

/**
 * 执行测试并记录性能
 */
async function measurePerformance<T>(
  functionName: string,
  fn: () => Promise<T>
): Promise<{ result: T; performance: PerformanceResult }> {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();

  const result = await fn();

  const endTime = Date.now();
  const endMemory = process.memoryUsage();

  return {
    result,
    performance: {
      functionName,
      duration: endTime - startTime,
      memoryUsage: {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external,
        arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers
      }
    }
  };
}

/**
 * 验证单个作品的讲解结果
 */
function validateExplanation(artwork: Artwork, explanation: ArtworkExplanation): {
  isValid: boolean;
  issues: string[];
  chineseRatio: number;
  hasEnglish: boolean;
} {
  const issues: string[] = [];

  // 检查基本字段
  if (!explanation.artworkId) issues.push('缺少作品ID');
  if (!explanation.emotionalConnection) issues.push('缺少情感连接描述');
  if (!explanation.artisticAnalysis) issues.push('缺少艺术分析');

  // 检查是否为中文输出
  const fullText = [
    explanation.emotionalConnection,
    explanation.artisticAnalysis,
    explanation.explanation?.emotionalConnection,
    explanation.explanation?.artisticAnalysis,
    explanation.explanation?.introduction,
    explanation.explanation?.detail
  ].filter(Boolean).join(' ');

  const hasEnglish = containsEnglish(fullText);
  const chineseRatio = getChineseRatio(fullText);

  if (hasEnglish) {
    issues.push('输出包含英文内容');
  }

  if (chineseRatio < 0.7) {
    issues.push(`中文字符比例过低: ${(chineseRatio * 100).toFixed(1)}%`);
  }

  // 检查标题翻译
  if (artwork.title && containsEnglish(artwork.title)) {
    const titleInExplanation = fullText.includes(artwork.title);
    const hasChineseTranslation = /[\u4e00-\u9fff]/.test(fullText);

    if (!hasChineseTranslation && titleInExplanation) {
      issues.push('英文标题未正确翻译');
    }
  }

  // 检查格式是否符合要求
  if (explanation.explanation?.introduction) {
    const intro = explanation.explanation.introduction;
    if (!intro.startsWith('简介：') && intro.length > 40) {
      issues.push('简介长度超过40字或格式不正确');
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    chineseRatio,
    hasEnglish
  };
}

/**
 * 执行缓存测试
 */
async function testCacheMechanism(): Promise<{
  firstRun: PerformanceResult;
  secondRun: PerformanceResult;
  cacheWorking: boolean;
}> {
  console.log('\n🔄 测试缓存机制...');

  // 启用缓存
  process.env.EXPLAIN_CACHE_ENABLED = 'true';

  // 第一次运行（应该不命中缓存）
  const { result: firstResult, performance: firstRun } = await measurePerformance(
    '首次生成',
    () => generateArtworkExplanations([TEST_ARTWORKS[0]], TEST_CONFIG.emotion, TEST_CONFIG.userInput)
  );

  // 第二次运行（应该命中缓存）
  const { result: secondResult, performance: secondRun } = await measurePerformance(
    '缓存命中',
    () => generateArtworkExplanations([TEST_ARTWORKS[0]], TEST_CONFIG.emotion, TEST_CONFIG.userInput)
  );

  const cacheWorking = secondRun.duration < firstRun.duration * 0.5 &&
                      firstResult.fromCacheCount === 0 &&
                      secondResult.fromCacheCount > 0;

  // 禁用缓存
  process.env.EXPLAIN_CACHE_ENABLED = 'false';

  return {
    firstRun,
    secondRun,
    cacheWorking
  };
}

/**
 * 执行完整测试
 */
async function runCompleteTest(): Promise<void> {
  console.log('🎨 开始作品讲解系统完整测试');
  console.log('=' .repeat(60));

  const testResults = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    performance: [] as PerformanceResult[],
    validationResults: [] as any[]
  };

  try {
    // 测试1: 基本功能测试
    console.log('\n📝 测试1: 基本功能测试');
    console.log('-'.repeat(40));

    const { result: basicResult, performance: basicPerf } = await measurePerformance(
      '基本功能测试',
      () => generateArtworkExplanations(TEST_ARTWORKS, TEST_CONFIG.emotion, TEST_CONFIG.userInput, TEST_CONFIG.curationStrategy)
    );

    testResults.performance.push(basicPerf);
    testResults.totalTests++;

    console.log(`✅ 处理了 ${basicResult.totalProcessed} 件作品`);
    console.log(`✅ 成功生成 ${basicResult.successCount} 个讲解`);
    console.log(`✅ 失败 ${basicResult.failureCount} 个`);
    console.log(`✅ 总耗时: ${basicResult.processingTime}ms`);

    if (basicResult.successCount > 0) {
      testResults.passedTests++;
      console.log('✅ 基本功能测试通过');
    } else {
      testResults.failedTests++;
      console.log('❌ 基本功能测试失败');
    }

    // 测试2: 输出质量验证
    console.log('\n🔍 测试2: 输出质量验证');
    console.log('-'.repeat(40));

    let qualityPassed = 0;
    const validationResults = [];

    for (let i = 0; i < basicResult.explanations.length; i++) {
      const explanation = basicResult.explanations[i];
      const artwork = TEST_ARTWORKS.find(a => a.id === explanation.artworkId);

      if (!artwork) continue;

      const validation = validateExplanation(artwork, explanation);
      validationResults.push({
        artworkId: artwork.id,
        artworkTitle: artwork.title,
        validation
      });

      console.log(`\n作品 ${i + 1}: ${artwork.title}`);
      console.log(`  - 有效性: ${validation.isValid ? '✅' : '❌'}`);
      console.log(`  - 中文比例: ${(validation.chineseRatio * 100).toFixed(1)}%`);
      console.log(`  - 包含英文: ${validation.hasEnglish ? '是' : '否'}`);
      console.log(`  - 置信度: ${explanation.confidence}`);
      console.log(`  - 处理时间: ${explanation.processingTime}ms`);

      if (validation.issues.length > 0) {
        console.log(`  - 问题: ${validation.issues.join(', ')}`);
      }

      // 显示部分内容
      if (explanation.explanation?.introduction) {
        console.log(`  - 简介: ${explanation.explanation.introduction.substring(0, 50)}...`);
      }

      if (validation.isValid) {
        qualityPassed++;
      }
    }

    testResults.validationResults = validationResults;
    testResults.totalTests++;
    testResults.passedTests += qualityPassed;
    testResults.failedTests += (basicResult.explanations.length - qualityPassed);

    console.log(`\n✅ 质量验证完成: ${qualityPassed}/${basicResult.explanations.length} 个作品通过验证`);

    // 测试3: 缓存机制测试
    console.log('\n💾 测试3: 缓存机制测试');
    console.log('-'.repeat(40));

    const cacheResult = await testCacheMechanism();
    testResults.performance.push(cacheResult.firstRun, cacheResult.secondRun);
    testResults.totalTests++;

    console.log(`首次运行耗时: ${cacheResult.firstRun.duration}ms`);
    console.log(`缓存运行耗时: ${cacheResult.secondRun.duration}ms`);
    console.log(`速度提升: ${((1 - cacheResult.secondRun.duration / cacheResult.firstRun.duration) * 100).toFixed(1)}%`);
    console.log(`缓存机制: ${cacheResult.cacheWorking ? '✅ 正常' : '❌ 异常'}`);

    if (cacheResult.cacheWorking) {
      testResults.passedTests++;
    } else {
      testResults.failedTests++;
    }

    // 测试4: 异常处理测试
    console.log('\n⚠️ 测试4: 异常处理测试');
    console.log('-'.repeat(40));

    const invalidArtwork: Artwork = {
      ...TEST_ARTWORKS[0],
      id: 'invalid-test',
      title: '', // 空标题
      artist: '', // 空艺术家
      year: 'invalid', // 无效年份
      medium: '', // 空材质
      dimensions: '',
      imageUrl: '',
      description: '',
      museum: '',
      license: ''
    };

    const { result: errorResult, performance: errorPerf } = await measurePerformance(
      '异常处理测试',
      () => generateArtworkExplanations([invalidArtwork], TEST_CONFIG.emotion, TEST_CONFIG.userInput)
    );

    testResults.performance.push(errorPerf);
    testResults.totalTests++;

    console.log(`异常处理结果: ${errorResult.successCount > 0 ? '✅ 成功处理' : '❌ 处理失败'}`);
    console.log(`生成了 ${errorResult.explanations.length} 个讲解`);

    if (errorResult.successCount > 0) {
      testResults.passedTests++;
    } else {
      testResults.failedTests++;
    }

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    testResults.failedTests++;
  }

  // 输出测试总结
  console.log('\n📊 测试总结');
  console.log('='.repeat(60));
  console.log(`总测试数: ${testResults.totalTests}`);
  console.log(`通过测试: ${testResults.passedTests}`);
  console.log(`失败测试: ${testResults.failedTests}`);
  console.log(`通过率: ${((testResults.passedTests / testResults.totalTests) * 100).toFixed(1)}%`);

  console.log('\n⏱️ 性能统计:');
  testResults.performance.forEach((perf, index) => {
    console.log(`${index + 1}. ${perf.functionName}: ${perf.duration}ms`);
    if (perf.memoryUsage) {
      console.log(`   内存增长: ${(perf.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }
  });

  // 输出详细验证结果
  if (testResults.validationResults.length > 0) {
    console.log('\n📋 详细验证结果:');
    testResults.validationResults.forEach(result => {
      console.log(`- ${result.artworkTitle} (${result.artworkId}): ${result.validation.isValid ? '✅' : '❌'}`);
      if (result.validation.issues.length > 0) {
        console.log(`  问题: ${result.validation.issues.join(', ')}`);
      }
    });
  }

  // 输出日志样本
  console.log('\n📝 日志输出已记录在控制台中，请检查上述输出以确认:');
  console.log('- 英文标题是否正确翻译');
  console.log('- 输出内容是否全为中文');
  console.log('- 缓存命中和英文检测逻辑');
  console.log('- 异常处理是否正常');
  console.log('- 日志输出是否有助于调试');
}

// 执行测试
if (require.main === module) {
  runCompleteTest()
    .then(() => {
      console.log('\n🎉 测试完成!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 测试失败:', error);
      process.exit(1);
    });
}

export { runCompleteTest, TEST_ARTWORKS, TEST_CONFIG };