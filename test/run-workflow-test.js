#!/usr/bin/env node

/**
 * ArtDuo Workflow Test Runner
 *
 * Command-line interface for running comprehensive workflow tests.
 *
 * Usage:
 *   node run-workflow-test.js                           # Run all tests
 *   node run-workflow-test.js --scenario "Simple Emotion"  # Run specific scenario
 *   node run-workflow-test.js --quick                   # Run quick tests only
 *   node run-workflow-test.js --errors                  # Run error scenarios only
 *   node run-workflow-test.js --report                 # Generate report only
 *   node run-workflow-test.js --help                    # Show help
 */

const { program } = require('commander');
const { ComprehensiveWorkflowTest, TEST_SCENARIOS, ERROR_SCENARIOS } = require('./comprehensive-workflow-test');

// Configure CLI options
program
  .name('run-workflow-test')
  .description('ArtDuo Comprehensive Workflow Test Runner')
  .version('1.0.0');

program
  .option('-s, --scenario <name>', 'Run specific test scenario by name')
  .option('-e, --emotion <emotion>', 'Run tests with specific emotion')
  .option('-m, --method <method>', 'Filter tests by HTTP method (GET/POST)')
  .option('-q, --quick', 'Run only quick tests (basic scenarios)')
  .option('--errors', 'Run only error scenarios')
  .option('--no-report', 'Skip report generation')
  .option('--log-level <level>', 'Set log level (debug, info, warn, error)', 'info')
  .option('--timeout <ms>', 'Set request timeout in milliseconds', '300000')
  .option('--base-url <url>', 'Set base URL for API', 'http://localhost:3000')
  .option('--dry-run', 'Show what tests would run without executing them')
  .option('--list-scenarios', 'List all available test scenarios')
  .option('--list-errors', 'List all error scenarios')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-h, --help', 'Show help');

program.parse();

const options = program.opts();

// Show help if requested
if (options.help) {
  program.help();
}

// List scenarios if requested
if (options.listScenarios) {
  console.log('\n📋 Available Test Scenarios:\n');
  TEST_SCENARIOS.forEach((scenario, index) => {
    console.log(`${index + 1}. ${scenario.name}`);
    console.log(`   Method: ${scenario.method}`);
    console.log(`   Emotion: ${scenario.emotion}`);
    console.log(`   Description: ${scenario.description}\n`);
  });
  process.exit(0);
}

// List error scenarios if requested
if (options.listErrors) {
  console.log('\n❌ Available Error Scenarios:\n');
  ERROR_SCENARIOS.forEach((scenario, index) => {
    console.log(`${index + 1}. ${scenario.name}`);
    console.log(`   Method: ${scenario.method}`);
    console.log(`   Expected Error: ${scenario.expectedError}`);
    console.log(`   Description: ${scenario.description}\n`);
  });
  process.exit(0);
}

class TestRunnerCLI {
  constructor(options) {
    this.options = options;
    this.testRunner = new ComprehensiveWorkflowTest();

    // Update configuration based on CLI options
    if (options.baseUrl) {
      this.testRunner.httpClient.baseUrl = options.baseUrl;
    }

    if (options.logLevel) {
      this.testRunner.logger.level = options.logLevel;
    }
  }

  async run() {
    try {
      console.log('🚀 ArtDuo Workflow Test Runner');
      console.log('================================\n');

      if (this.options.dryRun) {
        return this.showDryRun();
      }

      if (this.options.scenario) {
        return this.runSpecificScenario();
      }

      if (this.options.emotion) {
        return this.runEmotionTests();
      }

      if (this.options.method) {
        return this.runMethodTests();
      }

      if (this.options.quick) {
        return this.runQuickTests();
      }

      if (this.options.errors) {
        return this.runErrorTests();
      }

      // Run all tests by default
      return this.runAllTests();

    } catch (error) {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    }
  }

  showDryRun() {
    console.log('🔍 Dry Run Mode - Tests that would be executed:\n');

    let scenarios = this.getFilteredScenarios();
    let errorScenarios = this.getFilteredErrorScenarios();

    console.log('📋 Main Scenarios:');
    if (scenarios.length === 0) {
      console.log('  No scenarios match the specified filters');
    } else {
      scenarios.forEach((scenario, index) => {
        console.log(`  ${index + 1}. ${scenario.name} (${scenario.method})`);
      });
    }

    console.log('\n❌ Error Scenarios:');
    if (errorScenarios.length === 0) {
      console.log('  No error scenarios match the specified filters');
    } else {
      errorScenarios.forEach((scenario, index) => {
        console.log(`  ${index + 1}. ${scenario.name} (${scenario.method})`);
      });
    }

    console.log(`\nTotal: ${scenarios.length + errorScenarios.length} tests would run`);
  }

  getFilteredScenarios() {
    let scenarios = [...TEST_SCENARIOS];

    if (this.options.scenario) {
      scenarios = scenarios.filter(s =>
        s.name.toLowerCase().includes(this.options.scenario.toLowerCase())
      );
    }

    if (this.options.emotion) {
      scenarios = scenarios.filter(s =>
        s.emotion.toLowerCase() === this.options.emotion.toLowerCase()
      );
    }

    if (this.options.method) {
      scenarios = scenarios.filter(s =>
        s.method.toLowerCase() === this.options.method.toLowerCase()
      );
    }

    return scenarios;
  }

  getFilteredErrorScenarios() {
    if (!this.options.errors && !this.options.scenario && !this.options.method) {
      return [];
    }

    let scenarios = [...ERROR_SCENARIOS];

    if (this.options.scenario) {
      scenarios = scenarios.filter(s =>
        s.name.toLowerCase().includes(this.options.scenario.toLowerCase())
      );
    }

    if (this.options.method) {
      scenarios = scenarios.filter(s =>
        s.method.toLowerCase() === this.options.method.toLowerCase()
      );
    }

    return scenarios;
  }

  async runSpecificScenario() {
    const scenarios = this.getFilteredScenarios();

    if (scenarios.length === 0) {
      console.error(`❌ No scenario found matching: ${this.options.scenario}`);
      process.exit(1);
    }

    if (scenarios.length > 1) {
      console.log(`📋 Found ${scenarios.length} matching scenarios:\n`);
      scenarios.forEach((scenario, index) => {
        console.log(`${index + 1}. ${scenario.name}`);
      });
      console.log('\n⚠️  Running first match. Use more specific criteria if needed.');
    }

    const scenario = scenarios[0];
    console.log(`🎯 Running scenario: ${scenario.name}`);

    const result = await this.testRunner.runTestScenario(scenario);
    await this.generateCustomReport([result], []);

    return result;
  }

  async runEmotionTests() {
    console.log(`🎭 Running tests for emotion: ${this.options.emotion}`);

    const scenarios = TEST_SCENARIOS.filter(s =>
      s.emotion.toLowerCase() === this.options.emotion.toLowerCase()
    );

    if (scenarios.length === 0) {
      console.error(`❌ No tests found for emotion: ${this.options.emotion}`);
      process.exit(1);
    }

    const results = [];
    for (const scenario of scenarios) {
      console.log(`\n📋 Running: ${scenario.name}`);
      const result = await this.testRunner.runTestScenario(scenario);
      results.push(result);
    }

    await this.generateCustomReport(results, []);
    return results;
  }

  async runMethodTests() {
    console.log(`🔗 Running ${this.options.method.toUpperCase()} method tests`);

    const scenarios = TEST_SCENARIOS.filter(s =>
      s.method.toLowerCase() === this.options.method.toLowerCase()
    );

    if (scenarios.length === 0) {
      console.error(`❌ No tests found for method: ${this.options.method}`);
      process.exit(1);
    }

    const results = [];
    for (const scenario of scenarios) {
      console.log(`\n📋 Running: ${scenario.name}`);
      const result = await this.testRunner.runTestScenario(scenario);
      results.push(result);
    }

    await this.generateCustomReport(results, []);
    return results;
  }

  async runQuickTests() {
    console.log('⚡ Running quick tests only...');

    const quickScenarios = TEST_SCENARIOS.slice(0, 2); // First 2 scenarios
    const results = [];

    for (let i = 0; i < quickScenarios.length; i++) {
      const scenario = quickScenarios[i];
      console.log(`\n${i + 1}/${quickScenarios.length}: ${scenario.name}`);
      const result = await this.testRunner.runTestScenario(scenario);
      results.push(result);
    }

    await this.generateCustomReport(results, []);
    return results;
  }

  async runErrorTests() {
    console.log('❌ Running error scenarios only...');

    const results = [];
    for (let i = 0; i < ERROR_SCENARIOS.length; i++) {
      const scenario = ERROR_SCENARIOS[i];
      console.log(`\n${i + 1}/${ERROR_SCENARIOS.length}: ${scenario.name}`);
      const result = await this.testRunner.runErrorScenario(scenario);
      results.push(result);
    }

    await this.generateCustomReport([], results);
    return results;
  }

  async runAllTests() {
    console.log('🎯 Running all tests...');
    return await this.testRunner.runAllTests();
  }

  async generateCustomReport(scenarios, errorScenarios) {
    if (this.options.noReport) {
      this.printCustomSummary(scenarios, errorScenarios);
      return;
    }

    // Override results in the test runner
    this.testRunner.results.scenarios = scenarios;
    this.testRunner.results.errorScenarios = errorScenarios;

    await this.testRunner.generateReport();
  }

  printCustomSummary(scenarios, errorScenarios) {
    const passedScenarios = scenarios.filter(s => s.passed).length;
    const passedErrors = errorScenarios.filter(s => s.passed).length;
    const total = scenarios.length + errorScenarios.length;
    const passed = passedScenarios + passedErrors;
    const rate = Math.round((passed / total) * 100);

    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);
    console.log(`Success Rate: ${rate}%`);

    if (scenarios.length > 0) {
      console.log('\n📋 Main Scenarios:');
      scenarios.forEach(s => {
        console.log(`  ${s.passed ? '✅' : '❌'} ${s.name} (${s.performance?.totalDuration || 'N/A'}ms)`);
      });
    }

    if (errorScenarios.length > 0) {
      console.log('\n❌ Error Scenarios:');
      errorScenarios.forEach(s => {
        console.log(`  ${s.passed ? '✅' : '❌'} ${s.name}`);
      });
    }

    console.log('='.repeat(50));
  }
}

// Run the CLI
async function main() {
  const cli = new TestRunnerCLI(options);
  const results = await cli.run();

  // Exit with appropriate code (dry-run doesn't have test results)
  if (options.dryRun) {
    process.exit(0);
  }

  const failedCount = Array.isArray(results)
    ? results.filter(r => !r.passed).length
    : results?.summary?.failedTests || 0;

  process.exit(failedCount > 0 ? 1 : 0);
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { TestRunnerCLI };