#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const axios = require('axios');
require('dotenv').config();

class TestRunner {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      phases: {}
    };
    this.startTime = Date.now();
    this.verbose = process.argv.includes('--verbose');
    this.testPhase = this.getTestPhase();
  }

  getTestPhase() {
    const phaseArg = process.argv.find(arg => arg.startsWith('--phase'));
    if (phaseArg) {
      return parseInt(phaseArg.split('=')[1] || phaseArg.split(' ')[1]);
    }
    if (process.argv.includes('--all')) return 'all';
    if (process.argv.includes('--performance')) return 'performance';
    return null;
  }

  async run() {
    console.log(chalk.blue.bold('🎭 ArtDuo Test Suite - Phases 1-8'));
    console.log(chalk.gray(`Test Phase: ${this.testPhase || 'All Phases'}`));
    console.log(chalk.gray(`Started: ${new Date().toISOString()}`));
    console.log('');

    // Load environment variables
    await this.loadEnvironment();

    // Run tests based on phase
    if (this.testPhase === 'all' || this.testPhase === null) {
      await this.runAllPhases();
    } else if (this.testPhase === 'performance') {
      await this.runPerformanceTests();
    } else if (this.testPhase) {
      await this.runPhase(this.testPhase);
    }

    this.generateReport();
  }

  async loadEnvironment() {
    try {
      // Check if .env exists and load required variables
      const envPath = path.join(__dirname, '..', 'frontend', '.env');
      if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
      }

      this.apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      this.testMode = process.env.TEST_MODE || 'mock';

      console.log(chalk.green('✓ Environment loaded'));
      console.log(chalk.gray(`API URL: ${this.apiUrl}`));
      console.log(chalk.gray(`Test Mode: ${this.testMode}`));
      console.log('');
    } catch (error) {
      console.log(chalk.red('✗ Failed to load environment'));
      process.exit(1);
    }
  }

  async runAllPhases() {
    const phases = [1, 2, 3, 4, 5, 6, 7, 8];
    for (const phase of phases) {
      await this.runPhase(phase);
    }
  }

  async runPhase(phase) {
    console.log(chalk.blue.bold(`\n🔍 Testing Phase ${phase}`));

    this.results.phases[phase] = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };

    try {
      const phaseTests = require(`./phase${phase}-test.js`);
      await phaseTests.run(this);
    } catch (error) {
      console.log(chalk.red(`✗ Failed to load Phase ${phase} tests: ${error.message}`));
      this.results.phases[phase].failed = 1;
      this.results.phases[phase].total = 1;
    }

    this.results.total += this.results.phases[phase].total;
    this.results.passed += this.results.phases[phase].passed;
    this.results.failed += this.results.phases[phase].failed;
    this.results.skipped += this.results.phases[phase].skipped;
  }

  async runPerformanceTests() {
    console.log(chalk.blue.bold('\n⚡ Running Performance Tests'));
    // Performance tests will be implemented separately
  }

  addTestResult(phase, testName, status, details = {}) {
    const result = {
      name: testName,
      status,
      ...details,
      timestamp: new Date().toISOString()
    };

    this.results.phases[phase].tests.push(result);
    this.results.phases[phase].total++;

    if (status === 'passed') {
      this.results.phases[phase].passed++;
      console.log(chalk.green(`✓ ${testName}`));
    } else if (status === 'failed') {
      this.results.phases[phase].failed++;
      console.log(chalk.red(`✗ ${testName}`));
      if (details.error) {
        console.log(chalk.red(`  Error: ${details.error}`));
      }
    } else if (status === 'skipped') {
      this.results.phases[phase].skipped++;
      console.log(chalk.yellow(`⚠ ${testName} (skipped)`));
    }

    if (this.verbose && details.duration) {
      console.log(chalk.gray(`  Duration: ${details.duration}ms`));
    }
  }

  generateReport() {
    const duration = Date.now() - this.startTime;

    console.log('\n' + chalk.blue.bold('📊 Test Results Summary'));
    console.log('='.repeat(50));

    for (const [phase, results] of Object.entries(this.results.phases)) {
      const successRate = results.total > 0 ?
        Math.round((results.passed / results.total) * 100) : 0;

      console.log(`\nPhase ${phase}: ${results.passed}/${results.total} passed (${successRate}%)`);

      if (this.verbose) {
        results.tests.forEach(test => {
          const color = test.status === 'passed' ? 'green' :
                       test.status === 'failed' ? 'red' : 'yellow';
          console.log(chalk[color](`  ${test.status} - ${test.name}`));
        });
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`Total: ${this.results.passed}/${this.results.total} passed`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Skipped: ${this.results.skipped}`);
    console.log(`Duration: ${duration}ms`);

    const overallSuccessRate = this.results.total > 0 ?
      Math.round((this.results.passed / this.results.total) * 100) : 0;
    console.log(`Success Rate: ${overallSuccessRate}%`);

    // Save detailed report
    this.saveDetailedReport();
  }

  saveDetailedReport() {
    const reportPath = path.join(__dirname, 'test-results.json');
    const report = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      ...this.results
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(chalk.gray(`\nDetailed report saved to: ${reportPath}`));
  }
}

// Export TestRunner class for use in test files
module.exports = TestRunner;

// Run tests if this file is executed directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.run().catch(console.error);
}