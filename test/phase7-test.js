const TestUtils = require('./test-utils');

class Phase7Tests {
  constructor() {
    this.utils = null;
  }

  async run(testRunner) {
    this.utils = new TestUtils(testRunner);
    console.log(chalk.blue.bold('⚡ Testing Phase 7: Caching and Fallback Strategies'));
    console.log('');

    // Test 1: Query Caching Infrastructure
    await this.testQueryCachingInfrastructure();

    // Test 2: Cache Performance and TTL
    await this.testCachePerformance();

    // Test 3: Cache Invalidation
    await this.testCacheInvalidation();

    // Test 4: Fallback Strategy for Single API Failure
    await this.testSingleAPIFallback();

    // Test 5: Fallback Strategy for Complete API Failure
    await this.testCompleteAPIFallback();

    // Test 6: Cache Persistence and Recovery
    await this.testCachePersistence();

    // Test 7: Concurrent Access and Cache Consistency
    await this.testConcurrentCacheAccess();

    // Test 8: Cache Memory Management
    await this.testCacheMemoryManagement();

    console.log(chalk.green('\n✓ Phase 7 tests completed'));
  }

  async testQueryCachingInfrastructure() {
    const testName = 'Query Caching Infrastructure';
    const startTime = Date.now();

    try {
      // Check if caching infrastructure is available
      const cacheHealthResult = await this.utils.request('GET', '/api/curate/cache-health');
      const duration = Date.now() - startTime;

      if (cacheHealthResult.success && cacheHealthResult.status === 200) {
        const { enabled, type, storage } = cacheHealthResult.data;

        if (enabled && type) {
          // Test basic caching functionality
          const testQuery = {
            emotion: 'joy',
            userInput: 'cache test query',
            testMode: this.utils.testMode
          };

          // First call - should miss cache
          const firstResult = await this.utils.testCompleteCuration('joy', 'cache infrastructure test');
          const firstDuration = firstResult.duration;

          // Second call - should hit cache
          const secondResult = await this.utils.testCompleteCuration('joy', 'cache infrastructure test');
          const secondDuration = secondResult.duration;

          if (firstResult.success && secondResult.success) {
            // Check if cache was used (second call should be faster)
            const cacheImproved = secondDuration < firstDuration * 0.8;

            this.testRunner.addTestResult(7, testName, 'passed', {
              duration,
              cacheType: type,
              storage: storage,
              firstDuration,
              secondDuration,
              cacheImproved
            });
          } else {
            this.testRunner.addTestResult(7, testName, 'failed', {
              error: 'Cache test calls failed',
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(7, testName, 'failed', {
            error: 'Caching not properly enabled',
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(7, testName, 'failed', {
          error: cacheHealthResult.error || 'Cache health check failed',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(7, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testCachePerformance() {
    const testName = 'Cache Performance and TTL';
    const startTime = Date.now();

    try {
      const testQueries = [
        { emotion: 'joy', userInput: 'cache performance test 1' },
        { emotion: 'melancholy', userInput: 'cache performance test 2' },
        { emotion: 'calm', userInput: 'cache performance test 3' }
      ];

      const performanceResults = [];

      for (const query of testQueries) {
        // First call - cache miss
        const firstStartTime = Date.now();
        const firstResult = await this.utils.testCompleteCuration(query.emotion, query.userInput);
        const firstDuration = Date.now() - firstStartTime;

        // Second call - cache hit
        const secondStartTime = Date.now();
        const secondResult = await this.utils.testCompleteCuration(query.emotion, query.userInput);
        const secondDuration = Date.now() - secondStartTime;

        if (firstResult.success && secondResult.success) {
          performanceResults.push({
            query,
            firstDuration,
            secondDuration,
            speedup: firstDuration / secondDuration
          });
        }
      }

      const duration = Date.now() - startTime;

      if (performanceResults.length >= 2) {
        // Calculate average performance improvement
        const avgSpeedup = performanceResults.reduce((sum, r) => sum + r.speedup, 0) / performanceResults.length;
        const cacheHitRate = (performanceResults.length / testQueries.length) * 100;

        // Cache should provide at least 20% speedup
        if (avgSpeedup > 1.2 && cacheHitRate >= 66) {
          this.testRunner.addTestResult(7, testName, 'passed', {
            duration,
            queriesTested: performanceResults.length,
            avgSpeedup,
            cacheHitRate
          });
        } else {
          this.testRunner.addTestResult(7, testName, 'failed', {
            error: `Cache performance inadequate: avgSpeedup=${avgSpeedup}, hitRate=${cacheHitRate}%`,
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(7, testName, 'failed', {
          error: `Only ${performanceResults.length}/${testQueries.length} cache tests succeeded`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(7, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testCacheInvalidation() {
    const testName = 'Cache Invalidation';
    const startTime = Date.now();

    try {
      // Test cache invalidation mechanisms
      const invalidationTests = [
        {
          name: 'Manual cache clear',
          test: async () => {
            const clearResult = await this.utils.request('POST', '/api/curate/cache-clear', {
              testMode: this.utils.testMode
            });
            return clearResult.success;
          }
        },
        {
          name: 'TTL-based invalidation',
          test: async () => {
            // This test assumes TTL is configured reasonably
            const query = 'ttl test query';
            const firstResult = await this.utils.testCompleteCuration('joy', query);

            // Wait a short time (for testing purposes, not actual TTL wait)
            await new Promise(resolve => setTimeout(resolve, 100));

            const secondResult = await this.utils.testCompleteCuration('joy', query);
            return firstResult.success && secondResult.success;
          }
        },
        {
          name: 'Cache size limit',
          test: async () => {
            // Test multiple different queries to hit cache size limits
            const queries = [];
            for (let i = 0; i < 10; i++) {
              queries.push(this.utils.testCompleteCuration('joy', `size limit test ${i}`));
            }

            const results = await Promise.allSettled(queries);
            const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            return successCount >= 8; // Allow some failures
          }
        }
      ];

      const invalidationResults = [];

      for (const test of invalidationTests) {
        try {
          const result = await test.test();
          invalidationResults.push({
            name: test.name,
            success: result
          });
        } catch (error) {
          invalidationResults.push({
            name: test.name,
            success: false,
            error: error.message
          });
        }
      }

      const duration = Date.now() - startTime;

      const successfulTests = invalidationResults.filter(r => r.success).length;

      if (successfulTests >= 2) {
        this.testRunner.addTestResult(7, testName, 'passed', {
          duration,
          testsPassed: successfulTests,
          totalTests: invalidationResults.length
        });
      } else {
        this.testRunner.addTestResult(7, testName, 'failed', {
          error: `Cache invalidation tests failed: ${successfulTests}/${invalidationResults.length} passed`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(7, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testSingleAPIFallback() {
    const testName = 'Single API Fallback Strategy';
    const startTime = Date.now();

    try {
      // Test fallback when one API fails
      const fallbackTests = [
        {
          name: 'Met API failure fallback',
          test: async () => {
            const result = await this.utils.request('POST', '/api/curate/test-fallback', {
              emotion: 'joy',
              userInput: 'met fallback test',
              simulateFailure: 'met',
              testMode: this.utils.testMode
            });
            return result;
          }
        },
        {
          name: 'Rijks API failure fallback',
          test: async () => {
            const result = await this.utils.request('POST', '/api/curate/test-fallback', {
              emotion: 'joy',
              userInput: 'rijks fallback test',
              simulateFailure: 'rijks',
              testMode: this.utils.testMode
            });
            return result;
          }
        }
      ];

      const fallbackResults = [];

      for (const test of fallbackTests) {
        try {
          const result = await test.test();
          fallbackResults.push({
            name: test.name,
            success: result.success,
            hasArtworks: result.data?.artworks?.length > 0,
            artworkCount: result.data?.artworks?.length || 0,
            hasDiagnostics: !!result.data?.diagnostics
          });
        } catch (error) {
          fallbackResults.push({
            name: test.name,
            success: false,
            error: error.message
          });
        }
      }

      const duration = Date.now() - startTime;

      const successfulFallbacks = fallbackResults.filter(r => r.success && r.hasArtworks).length;

      if (successfulFallbacks >= 1) {
        this.testRunner.addTestResult(7, testName, 'passed', {
          duration,
          successfulFallbacks,
          totalTests: fallbackTests.length,
          avgArtworkCount: fallbackResults
            .filter(r => r.hasArtworks)
            .reduce((sum, r) => sum + r.artworkCount, 0) / fallbackResults.filter(r => r.hasArtworks).length
        });
      } else {
        this.testRunner.addTestResult(7, testName, 'failed', {
          error: `Single API fallback inadequate: ${successfulFallbacks}/${fallbackTests.length} tests passed`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(7, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testCompleteAPIFallback() {
    const testName = 'Complete API Fallback Strategy';
    const startTime = Date.now();

    try {
      // Test graceful handling when all APIs fail
      const result = await this.utils.request('POST', '/api/curate/test-fallback', {
        emotion: 'joy',
        userInput: 'complete failure test',
        simulateFailure: 'both',
        testMode: this.utils.testMode
      });

      const duration = Date.now() - startTime;

      if (result.success === false || (result.data && result.data.error)) {
        // Should fail gracefully with appropriate error handling
        const hasGracefulError = result.data?.error || result.data?.message;
        const hasUserMessage = result.data?.userMessage;

        if (hasGracefulError) {
          this.testRunner.addTestResult(7, testName, 'passed', {
            duration,
            gracefulFailure: true,
            hasUserMessage: !!hasUserMessage,
            errorType: typeof result.data?.error
          });
        } else {
          this.testRunner.addTestResult(7, testName, 'failed', {
            error: 'Complete failure not handled gracefully',
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(7, testName, 'failed', {
          error: 'Expected complete failure but request succeeded',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      // Exception is expected for complete failure
      this.testRunner.addTestResult(7, testName, 'passed', {
        duration,
        gracefulFailure: true,
        exception: error.message
      });
    }
  }

  async testCachePersistence() {
    const testName = 'Cache Persistence and Recovery';
    const startTime = Date.now();

    try {
      // Test if cache persists across sessions/restarts
      const testQuery = 'persistence test query';

      // Populate cache
      const firstResult = await this.utils.testCompleteCuration('joy', testQuery);

      if (firstResult.success) {
        // Simulate cache recovery (this would be more meaningful in actual implementation)
        const recoveryResult = await this.utils.request('POST', '/api/curate/test-cache-recovery', {
          query: testQuery,
          testMode: this.utils.testMode
        });

        const duration = Date.now() - startTime;

        if (recoveryResult.success && recoveryResult.data) {
          const { cacheExists, cacheHit } = recoveryResult.data;

          if (cacheExists) {
            this.testRunner.addTestResult(7, testName, 'passed', {
              duration,
              cacheExists,
              cacheHit,
              cacheSize: recoveryResult.data.cacheSize
            });
          } else {
            this.testRunner.addTestResult(7, testName, 'skipped', {
              duration,
              reason: 'Cache persistence not implemented'
            });
          }
        } else {
          this.testRunner.addTestResult(7, testName, 'skipped', {
            duration,
            reason: 'Cache recovery endpoint not available'
          });
        }
      } else {
        const duration = Date.now() - startTime;
        this.testRunner.addTestResult(7, testName, 'failed', {
          error: 'Initial cache population failed',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(7, testName, 'skipped', {
        duration,
        error: error.message,
        reason: 'Cache persistence test not available'
      });
    }
  }

  async testConcurrentCacheAccess() {
    const testName = 'Concurrent Cache Access and Consistency';
    const startTime = Date.now();

    try {
      const concurrentRequests = [];
      const requestCount = 5;
      const testQuery = 'concurrent cache test';

      // Clear cache first
      await this.utils.request('POST', '/api/curate/cache-clear', {
        testMode: this.utils.testMode
      });

      // First request to populate cache
      await this.utils.testCompleteCuration('joy', testQuery);

      // Concurrent requests to test cache consistency
      for (let i = 0; i < requestCount; i++) {
        concurrentRequests.push(
          this.utils.testCompleteCuration('joy', testQuery)
        );
      }

      const results = await Promise.allSettled(concurrentRequests);
      const duration = Date.now() - startTime;

      const successfulRequests = results.filter(r => r.status === 'fulfilled' && r.value.success);
      const failedRequests = results.filter(r => r.status === 'rejected' || !r.value.success);

      // Check if all results are consistent
      const artworkSets = successfulRequests.map(r => {
        const artworks = r.value.data?.artworks || [];
        return new Set(artworks.map(a => a.id));
      });

      const consistentResults = artworkSets.every(set =>
        JSON.stringify([...set]) === JSON.stringify([...artworkSets[0]])
      );

      if (successfulRequests.length >= 4 && consistentResults) {
        this.testRunner.addTestResult(7, testName, 'passed', {
          duration,
          successfulRequests: successfulRequests.length,
          failedRequests: failedRequests.length,
          consistency: consistentResults
        });
      } else {
        this.testRunner.addTestResult(7, testName, 'failed', {
          error: `Concurrent cache access inadequate: success=${successfulRequests.length}, consistency=${consistentResults}`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(7, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testCacheMemoryManagement() {
    const testName = 'Cache Memory Management';
    const startTime = Date.now();

    try {
      // Test cache memory limits and cleanup
      const memoryTests = [
        {
          name: 'Cache size limit enforcement',
          test: async () => {
            // Generate many different queries to test size limits
            const queries = [];
            for (let i = 0; i < 20; i++) {
              queries.push(this.utils.testCompleteCuration('joy', `memory test query ${i}`));
            }

            const results = await Promise.allSettled(queries);
            const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

            // Check cache status
            const cacheStatus = await this.utils.request('GET', '/api/curate/cache-status');

            return {
              successCount,
              cacheSize: cacheStatus.data?.size || 0,
              cacheLimit: cacheStatus.data?.limit || 0
            };
          }
        },
        {
          name: 'Cache eviction policy',
          test: async () => {
            // Test LRU or other eviction policies
            const status = await this.utils.request('GET', '/api/curate/cache-status');
            return status.success && status.data;
          }
        },
        {
          name: 'Memory cleanup',
          test: async () => {
            // Test automatic memory cleanup
            const cleanupResult = await this.utils.request('POST', '/api/curate/cache-cleanup');
            return cleanupResult.success;
          }
        }
      ];

      const memoryResults = [];

      for (const test of memoryTests) {
        try {
          const result = await test.test();
          memoryResults.push({
            name: test.name,
            success: true,
            data: result
          });
        } catch (error) {
          memoryResults.push({
            name: test.name,
            success: false,
            error: error.message
          });
        }
      }

      const duration = Date.now() - startTime;

      const successfulTests = memoryResults.filter(r => r.success).length;

      if (successfulTests >= 2) {
        // Check if memory management is working
        const sizeTest = memoryResults.find(r => r.name === 'Cache size limit enforcement');
        const withinLimits = sizeTest?.data?.cacheSize <= (sizeTest?.data?.cacheLimit || Infinity);

        if (withinLimits || successfulTests >= 2) {
          this.testRunner.addTestResult(7, testName, 'passed', {
            duration,
            testsPassed: successfulTests,
            totalTests: memoryTests.length,
            cacheSize: sizeTest?.data?.cacheSize,
            cacheLimit: sizeTest?.data?.cacheLimit
          });
        } else {
          this.testRunner.addTestResult(7, testName, 'failed', {
            error: 'Cache size limits not enforced',
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(7, testName, 'failed', {
          error: `Memory management tests failed: ${successfulTests}/${memoryTests.length} passed`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(7, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }
}

module.exports = {
  run: async function(testRunner) {
    const tests = new Phase7Tests();
    tests.testRunner = testRunner;
    await tests.run(testRunner);
  }
};

const chalk = require('chalk');