#!/usr/bin/env node

/**
 * ArtDuo Workflow Test - Example Usage
 *
 * This file demonstrates various ways to use the comprehensive workflow test suite.
 * You can run these examples to understand how the tests work and how to integrate them.
 */

const { ComprehensiveWorkflowTest } = require('./comprehensive-workflow-test.js');

async function example1_BasicUsage() {
  console.log('\n🎯 Example 1: Basic Usage - Run All Tests');
  console.log('='.repeat(50));

  const testRunner = new ComprehensiveWorkflowTest();

  try {
    const results = await testRunner.runAllTests();
    console.log('\n✅ All tests completed!');
    console.log(`Success Rate: ${results.summary.successRate}%`);
    console.log(`Total Duration: ${Math.round(results.summary.testDuration / 1000)}s`);
  } catch (error) {
    console.error('❌ Tests failed:', error.message);
  }
}

async function example2_CustomScenario() {
  console.log('\n🎯 Example 2: Run Specific Scenario');
  console.log('='.repeat(50));

  const testRunner = new ComprehensiveWorkflowTest();

  // Define a custom scenario
  const customScenario = {
    name: 'Custom Test - Happiness',
    description: 'Testing with happiness emotion',
    emotion: 'happiness',
    userInput: 'I want to feel pure joy and celebration',
    method: 'POST',
    expectedEvents: ['start', 'emotion_curve', 'artworks_selected', 'introduction', 'conclusion', 'explanations_batch', 'complete'],
    performanceThresholds: {
      totalDuration: 120000,
      planDuration: 30000,
      searchDuration: 45000,
      scoringDuration: 60000
    }
  };

  try {
    const result = await testRunner.runTestScenario(customScenario);

    console.log('\n📊 Test Results:');
    console.log(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Duration: ${result.totalDuration}ms`);

    if (result.performance) {
      console.log('\n⏱️ Performance Breakdown:');
      Object.entries(result.performance.steps).forEach(([step, duration]) => {
        if (typeof duration === 'number') {
          console.log(`  ${step}: ${duration}ms`);
        }
      });
    }

    if (result.validation?.scores) {
      console.log('\n🎯 Quality Scores:');
      Object.entries(result.validation.scores).forEach(([metric, score]) => {
        console.log(`  ${metric}: ${score}%`);
      });
    }

    if (!result.passed && result.validation?.issues) {
      console.log('\n❌ Issues Found:');
      result.validation.issues.forEach(issue => {
        console.log(`  - ${issue}`);
      });
    }

  } catch (error) {
    console.error('❌ Custom scenario failed:', error.message);
  }
}

async function example3_ErrorScenarios() {
  console.log('\n🎯 Example 3: Test Error Scenarios');
  console.log('='.repeat(50));

  const testRunner = new ComprehensiveWorkflowTest();

  // Test error scenario
  const errorScenario = {
    name: 'Missing Emotion Test',
    description: 'Test error handling when emotion is missing',
    emotion: '',
    userInput: 'Some input',
    method: 'POST',
    expectedError: 'Missing required field: emotion'
  };

  try {
    const result = await testRunner.runErrorScenario(errorScenario);

    console.log('\n📊 Error Test Results:');
    console.log(`Status: ${result.passed ? '✅ PASSED (Error handled correctly)' : '❌ FAILED'}`);
    console.log(`Expected Error: ${result.expectedError}`);
    console.log(`Received Error: ${result.receivedError}`);

  } catch (error) {
    console.error('❌ Error scenario test failed:', error.message);
  }
}

async function example4_MultipleEmotions() {
  console.log('\n🎯 Example 4: Test Multiple Emotions');
  console.log('='.repeat(50));

  const testRunner = new ComprehensiveWorkflowTest();
  const emotions = ['joy', 'peace', 'excitement', 'calm'];

  for (const emotion of emotions) {
    console.log(`\n🎭 Testing emotion: ${emotion}`);

    const scenario = {
      name: `Test ${emotion}`,
      description: `Testing workflow with ${emotion} emotion`,
      emotion: emotion,
      userInput: '',
      method: 'POST',
      expectedEvents: ['start', 'emotion_curve', 'artworks_selected', 'introduction', 'conclusion', 'explanations_batch', 'complete']
    };

    try {
      const result = await testRunner.runTestScenario(scenario);
      console.log(`  Status: ${result.passed ? '✅' : '❌'} (${result.totalDuration}ms)`);

      if (result.performance?.totalDuration) {
        console.log(`  Performance: ${result.performance.totalDuration}ms`);
      }
    } catch (error) {
      console.log(`  Status: ❌ (${error.message})`);
    }
  }
}

async function example5_PerformanceAnalysis() {
  console.log('\n🎯 Example 5: Performance Analysis');
  console.log('='.repeat(50));

  const testRunner = new ComprehensiveWorkflowTest();
  const results = [];

  // Run multiple scenarios to gather performance data
  const scenarios = [
    { emotion: 'joy', userInput: '' },
    { emotion: 'nostalgia', userInput: 'Childhood memories' },
    { emotion: 'peace', userInput: 'Calm and serene' }
  ];

  for (let i = 0; i < scenarios.length; i++) {
    const { emotion, userInput } = scenarios[i];

    const scenario = {
      name: `Performance Test ${i + 1}`,
      description: `Performance test for ${emotion}`,
      emotion,
      userInput,
      method: 'POST'
    };

    try {
      const result = await testRunner.runTestScenario(scenario);
      results.push(result);
      console.log(`✅ ${emotion}: ${result.performance?.totalDuration || 'N/A'}ms`);
    } catch (error) {
      console.log(`❌ ${emotion}: ${error.message}`);
    }
  }

  // Analyze performance
  if (results.length > 0) {
    const durations = results
      .filter(r => r.performance?.totalDuration)
      .map(r => r.performance.totalDuration);

    if (durations.length > 0) {
      const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      const min = Math.min(...durations);
      const max = Math.max(...durations);

      console.log('\n📈 Performance Summary:');
      console.log(`  Average: ${avg}ms`);
      console.log(`  Min: ${min}ms`);
      console.log(`  Max: ${max}ms`);
      console.log(`  Range: ${max - min}ms`);
    }
  }
}

// Main function to run examples
async function runExamples() {
  console.log('🚀 ArtDuo Workflow Test - Usage Examples');
  console.log('===========================================');
  console.log('Note: Make sure your ArtDuo server is running on localhost:3000');

  // Run examples (you can comment out the ones you don't want to run)

  await example1_BasicUsage();
  // await example2_CustomScenario();
  // await example3_ErrorScenarios();
  // await example4_MultipleEmotions();
  // await example5_PerformanceAnalysis();

  console.log('\n🎉 Examples completed!');
  console.log('\n💡 Tips:');
  console.log('  - Use --dry-run to see what tests would run without executing them');
  console.log('  - Use --log-level debug for detailed logging');
  console.log('  - Check test-results/ directory for detailed reports');
  console.log('  - Adjust performance thresholds based on your system capabilities');
}

// Run if called directly
if (require.main === module) {
  runExamples().catch(console.error);
}

module.exports = {
  example1_BasicUsage,
  example2_CustomScenario,
  example3_ErrorScenarios,
  example4_MultipleEmotions,
  example5_PerformanceAnalysis
};