const TestUtils = require('./test-utils');

class Phase1Tests {
  constructor() {
    this.utils = null;
    this.testResults = [];
  }

  async run(testRunner) {
    this.utils = new TestUtils(testRunner);
    console.log(chalk.blue.bold('🧠 Testing Phase 1: Intent Parsing (LLM Analysis)'));
    console.log('');

    // Test 1: Health Check
    await this.testHealthCheck();

    // Test 2: Search Plan Building - Basic emotions
    await this.testBasicEmotions();

    // Test 3: Search Plan Building - Complex user input
    await this.testComplexUserInput();

    // Test 4: Search Plan Building - Edge cases
    await this.testEdgeCases();

    // Test 5: Search Plan validation
    await this.testSearchPlanValidation();

    // Test 6: Deterministic seed generation
    await this.testDeterministicSeeds();

    // Test 7: Search Plan output format
    await this.testSearchPlanOutputFormat();

    // Test 8: Performance test
    await this.testPerformance();

    console.log(chalk.green('\n✓ Phase 1 tests completed'));
  }

  async testHealthCheck() {
    const testName = 'Health Check - API availability';
    const startTime = Date.now();

    try {
      const result = await this.utils.healthCheck();
      const duration = Date.now() - startTime;

      if (result) {
        this.testRunner.addTestResult(1, testName, 'passed', { duration });
      } else {
        this.testRunner.addTestResult(1, testName, 'failed', {
          error: 'Health check failed',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(1, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testBasicEmotions() {
    const emotions = ['joy', 'melancholy', 'calm', 'passion', 'lonely'];

    for (const emotion of emotions) {
      const testName = `Search Plan Building - ${emotion} emotion`;
      const startTime = Date.now();

      try {
        const result = await this.utils.testSearchPlan(emotion, `${emotion} artwork`);
        const duration = Date.now() - startTime;

        if (result.success && result.data) {
          const validation = this.utils.validateSearchPlan(result.data);
          if (validation.valid) {
            this.testRunner.addTestResult(1, testName, 'passed', { duration });
          } else {
            this.testRunner.addTestResult(1, testName, 'failed', {
              error: validation.error,
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(1, testName, 'failed', {
            error: result.error || 'No data returned',
            duration
          });
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        this.testRunner.addTestResult(1, testName, 'failed', {
          error: error.message,
          duration
        });
      }
    }
  }

  async testComplexUserInput() {
    const complexInputs = [
      {
        emotion: 'joy',
        userInput: 'I want to feel happy and energetic, preferably with bright colors and dynamic compositions that capture the essence of celebration and movement'
      },
      {
        emotion: 'melancholy',
        userInput: 'Looking for something introspective and quiet, perhaps with muted colors and solitary figures that evoke deep contemplation'
      },
      {
        emotion: 'passion',
        userInput: 'Intense and dramatic pieces with strong emotional content, bold brushstrokes, and powerful symbolism'
      }
    ];

    for (const input of complexInputs) {
      const testName = `Complex Input - ${input.emotion} with detailed context`;
      const startTime = Date.now();

      try {
        const result = await this.utils.testSearchPlan(input.emotion, input.userInput);
        const duration = Date.now() - startTime;

        if (result.success && result.data) {
          const validation = this.utils.validateSearchPlan(result.data);
          if (validation.valid) {
            // Check if keywords are relevant to the complex input
            const hasRelevantKeywords = result.data.keywords.some(keyword =>
              input.userInput.toLowerCase().includes(keyword.toLowerCase()) ||
              keyword.toLowerCase().includes(input.emotion.toLowerCase())
            );

            if (hasRelevantKeywords) {
              this.testRunner.addTestResult(1, testName, 'passed', { duration });
            } else {
              this.testRunner.addTestResult(1, testName, 'failed', {
                error: 'Keywords not relevant to complex input',
                duration
              });
            }
          } else {
            this.testRunner.addTestResult(1, testName, 'failed', {
              error: validation.error,
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(1, testName, 'failed', {
            error: result.error || 'No data returned',
            duration
          });
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        this.testRunner.addTestResult(1, testName, 'failed', {
          error: error.message,
          duration
        });
      }
    }
  }

  async testEdgeCases() {
    const edgeCases = [
      {
        emotion: '',
        userInput: 'Some description',
        expectedError: 'Missing emotion'
      },
      {
        emotion: 'joy',
        userInput: '',
        expectedError: 'Empty user input should still work'
      },
      {
        emotion: 'invalid_emotion',
        userInput: 'Test description',
        expectedError: 'Invalid emotion should be handled'
      },
      {
        emotion: 'joy',
        userInput: 'a'.repeat(1000), // Very long input
        expectedError: 'Very long input should be handled'
      }
    ];

    for (const edgeCase of edgeCases) {
      const testName = `Edge Case - ${edgeCase.expectedError}`;
      const startTime = Date.now();

      try {
        const result = await this.utils.testSearchPlan(edgeCase.emotion, edgeCase.userInput);
        const duration = Date.now() - startTime;

        // For edge cases, we expect graceful handling, not necessarily success
        if (edgeCase.emotion === '' || edgeCase.emotion === 'invalid_emotion') {
          if (result.success === false || (result.data && result.data.error)) {
            this.testRunner.addTestResult(1, testName, 'passed', { duration });
          } else {
            this.testRunner.addTestResult(1, testName, 'failed', {
              error: 'Expected error handling for invalid input',
              duration
            });
          }
        } else {
          // Other edge cases should still work
          if (result.success && result.data) {
            this.testRunner.addTestResult(1, testName, 'passed', { duration });
          } else {
            this.testRunner.addTestResult(1, testName, 'failed', {
              error: result.error || 'Edge case not handled properly',
              duration
            });
          }
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        this.testRunner.addTestResult(1, testName, 'failed', {
          error: error.message,
          duration
        });
      }
    }
  }

  async testSearchPlanValidation() {
    const testName = 'Search Plan Validation - Structure and content';
    const startTime = Date.now();

    try {
      // Test with valid input
      const result = await this.utils.testSearchPlan('joy', 'happy artwork');
      const duration = Date.now() - startTime;

      if (result.success && result.data) {
        const validation = this.utils.validateSearchPlan(result.data);

        if (validation.valid) {
          // Additional validation checks
          const checks = [
            result.data.keywords && result.data.keywords.length > 0,
            result.data.filters && typeof result.data.filters === 'object',
            result.data.sources && Array.isArray(result.data.sources),
            result.data.filters.hasImages === true, // Should always be true for artwork search
          ];

          if (checks.every(check => check)) {
            this.testRunner.addTestResult(1, testName, 'passed', { duration });
          } else {
            this.testRunner.addTestResult(1, testName, 'failed', {
              error: 'Search plan validation checks failed',
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(1, testName, 'failed', {
            error: validation.error,
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(1, testName, 'failed', {
          error: result.error || 'No data returned',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(1, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testDeterministicSeeds() {
    const testName = 'Deterministic Seed Generation';
    const startTime = Date.now();

    try {
      // Test same input multiple times to ensure deterministic output
      const iterations = 3;
      const results = [];

      for (let i = 0; i < iterations; i++) {
        const result = await this.utils.testSearchPlan('joy', 'test input');
        if (result.success && result.data) {
          results.push(result.data);
        }
      }

      const duration = Date.now() - startTime;

      if (results.length === iterations) {
        // Check if results are consistent (keywords should be similar)
        const firstKeywords = results[0].keywords;
        const allConsistent = results.every(result => {
          const similarity = this.calculateSimilarity(firstKeywords, result.keywords);
          return similarity > 0.7; // 70% similarity threshold
        });

        if (allConsistent) {
          this.testRunner.addTestResult(1, testName, 'passed', { duration });
        } else {
          this.testRunner.addTestResult(1, testName, 'failed', {
            error: 'Results not deterministic enough',
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(1, testName, 'failed', {
          error: `Only ${results.length}/${iterations} requests succeeded`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(1, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testSearchPlanOutputFormat() {
    const testName = 'Search Plan Output Format Compliance';
    const startTime = Date.now();

    try {
      const result = await this.utils.testSearchPlan('joy', 'test artwork');
      const duration = Date.now() - startTime;

      if (result.success && result.data) {
        // Check for required fields according to the specification
        const requiredFields = {
          keywords: 'array',
          filters: 'object',
          sources: 'array'
        };

        const filterFields = {
          period: 'object',
          medium: 'array',
          geo: 'array',
          creator: 'array',
          highlight: 'boolean',
          hasImages: 'boolean'
        };

        let formatValid = true;
        let errors = [];

        // Check top-level fields
        for (const [field, expectedType] of Object.entries(requiredFields)) {
          if (!result.data[field]) {
            formatValid = false;
            errors.push(`Missing field: ${field}`);
          } else if (expectedType === 'array' && !Array.isArray(result.data[field])) {
            formatValid = false;
            errors.push(`Field ${field} should be array`);
          } else if (expectedType === 'object' && typeof result.data[field] !== 'object') {
            formatValid = false;
            errors.push(`Field ${field} should be object`);
          }
        }

        // Check filter fields
        const filters = result.data.filters;
        for (const [field, expectedType] of Object.entries(filterFields)) {
          if (filters[field] !== undefined) {
            if (expectedType === 'array' && !Array.isArray(filters[field])) {
              formatValid = false;
              errors.push(`Filter field ${field} should be array`);
            } else if (expectedType === 'object' && typeof filters[field] !== 'object') {
              formatValid = false;
              errors.push(`Filter field ${field} should be object`);
            } else if (expectedType === 'boolean' && typeof filters[field] !== 'boolean') {
              formatValid = false;
              errors.push(`Filter field ${field} should be boolean`);
            }
          }
        }

        if (formatValid) {
          this.testRunner.addTestResult(1, testName, 'passed', { duration });
        } else {
          this.testRunner.addTestResult(1, testName, 'failed', {
            error: `Format errors: ${errors.join(', ')}`,
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(1, testName, 'failed', {
          error: result.error || 'No data returned',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(1, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testPerformance() {
    const testName = 'Performance - Search Plan Generation';
    const startTime = Date.now();

    try {
      const performanceResult = await this.utils.runPerformanceTest(
        'search-plan-generation',
        async () => {
          return await this.utils.testSearchPlan('joy', 'performance test');
        },
        5 // 5 iterations for performance test
      );

      const duration = Date.now() - startTime;

      if (performanceResult.successRate >= 80) {
        this.testRunner.addTestResult(1, testName, 'passed', {
          duration,
          avgDuration: performanceResult.avgDuration,
          successRate: performanceResult.successRate
        });
      } else {
        this.testRunner.addTestResult(1, testName, 'failed', {
          error: `Success rate too low: ${performanceResult.successRate}%`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(1, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  // Helper method to calculate similarity between keyword arrays
  calculateSimilarity(keywords1, keywords2) {
    const set1 = new Set(keywords1.map(k => k.toLowerCase()));
    const set2 = new Set(keywords2.map(k => k.toLowerCase()));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }
}

// Export for use in test runner
module.exports = {
  run: async function(testRunner) {
    const tests = new Phase1Tests();
    tests.testRunner = testRunner;
    await tests.run(testRunner);
  }
};

// Add chalk for colored output
const chalk = require('chalk');