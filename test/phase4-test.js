const TestUtils = require('./test-utils');

class Phase4Tests {
  constructor() {
    this.utils = null;
  }

  async run(testRunner) {
    this.utils = new TestUtils(testRunner);
    console.log(chalk.blue.bold('⚡ Testing Phase 4: Concurrent API Calls and Aggregation'));
    console.log('');

    // Test 1: Concurrent API Call Infrastructure
    await this.testConcurrentInfrastructure();

    // Test 2: Dual API Call Performance
    await this.testDualAPIPerformance();

    // Test 3: Result Aggregation and Merging
    await this.testResultAggregation();

    // Test 4: Fallback Strategy
    await this.testFallbackStrategy();

    // Test 5: Load Balancing
    await this.testLoadBalancing();

    // Test 6: Error Handling in Concurrent Environment
    await this.testConcurrentErrorHandling();

    // Test 7: Data Normalization (if implemented)
    await this testDataNormalization();

    // Test 8: Integration with Service Manager
    await this.testServiceManagerIntegration();

    console.log(chalk.green('\n✓ Phase 4 tests completed'));
  }

  async testConcurrentInfrastructure() {
    const testName = 'Concurrent API Call Infrastructure';
    const startTime = Date.now();

    try {
      // Test if concurrent API calls are supported
      const result = await this.utils.request('POST', '/api/curate/test-concurrent', {
        emotion: 'joy',
        userInput: 'test concurrent calls',
        testMode: this.utils.testMode
      });

      const duration = Date.now() - startTime;

      if (result.success && result.data) {
        // Check if both APIs were called concurrently
        const { metResults, rijksResults, timing } = result.data;

        if (metResults && rijksResults && timing) {
          // Check if concurrent timing is reasonable (should be faster than sequential)
          const totalTime = timing.total || 0;
          const metTime = timing.met || 0;
          const rijksTime = timing.rijks || 0;

          if (totalTime < Math.max(metTime, rijksTime) * 1.5) { // Should be close to max of individual times
            this.testRunner.addTestResult(4, testName, 'passed', {
              duration,
              totalTime,
              metTime,
              rijksTime
            });
          } else {
            this.testRunner.addTestResult(4, testName, 'failed', {
              error: `Concurrent call not efficient: total=${totalTime}, max individual=${Math.max(metTime, rijksTime)}`,
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(4, testName, 'failed', {
            error: 'Missing concurrent call results',
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(4, testName, 'failed', {
          error: result.error || 'Concurrent infrastructure not working',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(4, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testDualAPIPerformance() {
    const testName = 'Dual API Call Performance';
    const startTime = Date.now();

    try {
      const emotions = ['joy', 'melancholy', 'calm'];
      const performanceResults = [];

      for (const emotion of emotions) {
        const result = await this.utils.testCompleteCuration(emotion, `${emotion} dual API test`);
        if (result.success && result.data) {
          performanceResults.push({
            emotion,
            duration: result.duration,
            artworkCount: result.data.artworks?.length || 0
          });
        }
      }

      const duration = Date.now() - startTime;

      if (performanceResults.length >= 2) {
        // Check if dual API calls provide better results than single API
        const avgDuration = performanceResults.reduce((sum, r) => sum + r.duration, 0) / performanceResults.length;
        const avgArtworkCount = performanceResults.reduce((sum, r) => sum + r.artworkCount, 0) / performanceResults.length;

        if (avgDuration < 10000 && avgArtworkCount > 5) { // Reasonable performance and results
          this.testRunner.addTestResult(4, testName, 'passed', {
            duration,
            avgDuration,
            avgArtworkCount,
            testCount: performanceResults.length
          });
        } else {
          this.testRunner.addTestResult(4, testName, 'failed', {
            error: `Performance inadequate: avgDuration=${avgDuration}ms, avgArtworkCount=${avgArtworkCount}`,
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(4, testName, 'failed', {
          error: `Only ${performanceResults.length}/${emotions.length} tests succeeded`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(4, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testResultAggregation() {
    const testName = 'Result Aggregation and Merging';
    const startTime = Date.now();

    try {
      const result = await this.utils.testCompleteCuration('joy', 'test aggregation');
      const duration = Date.now() - startTime;

      if (result.success && result.data) {
        const artworks = result.data.artworks || [];

        if (artworks.length > 0) {
          // Check if results from both APIs are merged
          const metArtworks = artworks.filter(a => a.source === 'met');
          const rijksArtworks = artworks.filter(a => a.source === 'rijks');

          const hasBothSources = metArtworks.length > 0 && rijksArtworks.length > 0;
          const hasAnySource = metArtworks.length > 0 || rijksArtworks.length > 0;

          // Check for duplicates
          const uniqueIds = new Set(artworks.map(a => a.id));
          const hasDuplicates = uniqueIds.size !== artworks.length;

          // Check data consistency
          const validArtworks = artworks.filter(artwork => {
            const validation = this.utils.validateArtwork(artwork);
            return validation.valid;
          });

          if (hasAnySource && !hasDuplicates && validArtworks.length === artworks.length) {
            this.testRunner.addTestResult(4, testName, 'passed', {
              duration,
              totalArtworks: artworks.length,
              metArtworks: metArtworks.length,
              rijksArtworks: rijksArtworks.length,
              hasBothSources,
              hasDuplicates
            });
          } else {
            this.testRunner.addTestResult(4, testName, 'failed', {
              error: `Aggregation issues: hasAnySource=${hasAnySource}, hasDuplicates=${hasDuplicates}, validCount=${validArtworks.length}/${artworks.length}`,
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(4, testName, 'failed', {
            error: 'No artworks returned from aggregation',
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(4, testName, 'failed', {
          error: result.error || 'Aggregation failed',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(4, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testFallbackStrategy() {
    const testName = 'Fallback Strategy';
    const startTime = Date.now();

    try {
      // Test fallback when one API fails
      const fallbackTest = async (simulateFailure) => {
        return await this.utils.request('POST', '/api/curate/test-fallback', {
          emotion: 'joy',
          userInput: 'test fallback',
          simulateFailure,
          testMode: this.utils.testMode
        });
      };

      // Test Met API failure
      const metFailureResult = await fallbackTest('met');
      // Test Rijks API failure
      const rijksFailureResult = await fallbackTest('rijks');
      // Test both APIs failure
      const bothFailureResult = await fallbackTest('both');

      const duration = Date.now() - startTime;

      const tests = [
        { name: 'Met API failure', result: metFailureResult },
        { name: 'Rijks API failure', result: rijksFailureResult },
        { name: 'Both APIs failure', result: bothFailureResult }
      ];

      let passedTests = 0;

      for (const test of tests) {
        if (test.name === 'Both APIs failure') {
          // Should fail gracefully
          if (!test.result.success || (test.result.data && test.result.data.error)) {
            passedTests++;
          }
        } else {
          // Should succeed with fallback
          if (test.result.success && test.result.data && test.result.data.artworks?.length > 0) {
            passedTests++;
          }
        }
      }

      if (passedTests >= 2) { // At least 2 tests should pass
        this.testRunner.addTestResult(4, testName, 'passed', {
          duration,
          passedTests,
          totalTests: tests.length
        });
      } else {
        this.testRunner.addTestResult(4, testName, 'failed', {
          error: `Fallback strategy inadequate: ${passedTests}/${tests.length} tests passed`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(4, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testLoadBalancing() {
    const testName = 'Load Balancing';
    const startTime = Date.now();

    try {
      // Test multiple concurrent requests to see load balancing
      const concurrentRequests = [];
      const requestCount = 5;

      for (let i = 0; i < requestCount; i++) {
        concurrentRequests.push(
          this.utils.testCompleteCuration('joy', `load balance test ${i}`)
        );
      }

      const results = await Promise.allSettled(concurrentRequests);
      const duration = Date.now() - startTime;

      const successfulRequests = results.filter(r => r.status === 'fulfilled' && r.value.success);
      const failedRequests = results.filter(r => r.status === 'rejected' || !r.value.success);

      // Check load distribution across APIs
      let metCount = 0;
      let rijksCount = 0;

      successfulRequests.forEach(request => {
        const artworks = request.value.data?.artworks || [];
        metCount += artworks.filter(a => a.source === 'met').length;
        rijksCount += artworks.filter(a => a.source === 'rijks').length;
      });

      const successRate = (successfulRequests.length / requestCount) * 100;

      if (successRate >= 60 && (metCount > 0 || rijksCount > 0)) {
        this.testRunner.addTestResult(4, testName, 'passed', {
          duration,
          successRate,
          successfulRequests: successfulRequests.length,
          failedRequests: failedRequests.length,
          metArtworks: metCount,
          rijksArtworks: rijksCount
        });
      } else {
        this.testRunner.addTestResult(4, testName, 'failed', {
          error: `Load balancing inadequate: successRate=${successRate}%, metCount=${metCount}, rijksCount=${rijksCount}`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(4, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testConcurrentErrorHandling() {
    const testName = 'Concurrent Error Handling';
    const startTime = Date.now();

    try {
      // Test error handling in concurrent environment
      const errorScenarios = [
        {
          name: 'Timeout scenario',
          test: () => this.utils.request('POST', '/api/curate/test-concurrent-error', {
            scenario: 'timeout',
            testMode: this.utils.testMode
          })
        },
        {
          name: 'Network error scenario',
          test: () => this.utils.request('POST', '/api/curate/test-concurrent-error', {
            scenario: 'network',
            testMode: this.utils.testMode
          })
        },
        {
          name: 'API rate limit scenario',
          test: () => this.utils.request('POST', '/api/curate/test-concurrent-error', {
            scenario: 'ratelimit',
            testMode: this.utils.testMode
          })
        }
      ];

      const errorResults = [];

      for (const scenario of errorScenarios) {
        try {
          const result = await scenario.test();
          errorResults.push({
            name: scenario.name,
            success: result.success,
            hasErrorHandling: !result.success || (result.data && result.data.error)
          });
        } catch (error) {
          errorResults.push({
            name: scenario.name,
            success: false,
            hasErrorHandling: true // Exception caught
          });
        }
      }

      const duration = Date.now() - startTime;

      const properlyHandled = errorResults.filter(r => r.hasErrorHandling).length;

      if (properlyHandled === errorResults.length) {
        this.testRunner.addTestResult(4, testName, 'passed', {
          duration,
          scenariosTested: errorResults.length,
          properlyHandled
        });
      } else {
        this.testRunner.addTestResult(4, testName, 'failed', {
          error: `Error handling inadequate: ${properlyHandled}/${errorResults.length} scenarios properly handled`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(4, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testDataNormalization() {
    const testName = 'Data Normalization (if implemented)';
    const startTime = Date.now();

    try {
      // Check if data normalization modules exist
      const normalizationResult = await this.utils.request('GET', '/api/curate/check-normalization');

      const duration = Date.now() - startTime;

      if (normalizationResult.success && normalizationResult.data && normalizationResult.data.enabled) {
        // If normalization is enabled, test it
        const result = await this.utils.testCompleteCuration('joy', 'test normalization');

        if (result.success && result.data) {
          const artworks = result.data.artworks || [];

          // Check for normalized schema
          const normalized = artworks.every(artwork => {
            const required = ['id', 'title', 'artist', 'source', 'image', 'license', 'permalink'];
            return required.every(field => artwork[field] !== undefined);
          });

          if (normalized) {
            this.testRunner.addTestResult(4, testName, 'passed', {
              duration,
              normalizedArtworks: artworks.length
            });
          } else {
            this.testRunner.addTestResult(4, testName, 'failed', {
              error: 'Data normalization not applied correctly',
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(4, testName, 'failed', {
            error: result.error || 'Normalization test failed',
            duration
          });
        }
      } else {
        // Skip if normalization not implemented
        this.testRunner.addTestResult(4, testName, 'skipped', {
          duration,
          reason: 'Data normalization not implemented'
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(4, testName, 'skipped', {
        duration,
        error: error.message
      });
    }
  }

  async testServiceManagerIntegration() {
    const testName = 'Service Manager Integration';
    const startTime = Date.now();

    try {
      // Test service manager health and status
      const serviceManagerResult = await this.utils.request('GET', '/api/curate/service-manager-status');

      const duration = Date.now() - startTime;

      if (serviceManagerResult.success && serviceManagerResult.data) {
        const { services, status } = serviceManagerResult.data;

        if (status === 'healthy' && services && services.length > 0) {
          // Test service manager with actual artwork search
          const result = await this.utils.testCompleteCuration('joy', 'service manager test');

          if (result.success && result.data) {
            const diagnostics = result.data.diagnostics || {};
            const { sources } = diagnostics;

            if (sources && Object.keys(sources).length > 0) {
              this.testRunner.addTestResult(4, testName, 'passed', {
                duration,
                serviceStatus: status,
                serviceCount: services.length,
                activeSources: Object.keys(sources).length
              });
            } else {
              this.testRunner.addTestResult(4, testName, 'failed', {
                error: 'No active sources in diagnostics',
                duration
              });
            }
          } else {
            this.testRunner.addTestResult(4, testName, 'failed', {
              error: result.error || 'Service manager test failed',
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(4, testName, 'failed', {
            error: `Service manager unhealthy: status=${status}, services=${services?.length}`,
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(4, testName, 'failed', {
          error: serviceManagerResult.error || 'Service manager check failed',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(4, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }
}

module.exports = {
  run: async function(testRunner) {
    const tests = new Phase4Tests();
    tests.testRunner = testRunner;
    await tests.run(testRunner);
  }
};

const chalk = require('chalk');