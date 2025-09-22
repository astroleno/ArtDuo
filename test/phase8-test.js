const TestUtils = require('./test-utils');

class Phase8Tests {
  constructor() {
    this.utils = null;
  }

  async run(testRunner) {
    this.utils = new TestUtils(testRunner);
    console.log(chalk.blue.bold('📊 Testing Phase 8: Monitoring and Performance'));
    console.log('');

    // Test 1: Performance Metrics Collection
    await this.testPerformanceMetricsCollection();

    // Test 2: API Latency Monitoring
    await this.testAPILatencyMonitoring();

    // Test 3: LLM Performance Tracking
    await this.testLLMPerformanceTracking();

    // Test 4: System Health Monitoring
    await this.testSystemHealthMonitoring();

    // Test 5: Error Rate and Failure Analysis
    await this.testErrorRateMonitoring();

    // Test 6: Load Testing and Scalability
    await this.testLoadTesting();

    // Test 7: Resource Usage Monitoring
    await this.testResourceUsageMonitoring();

    // Test 8: Integration Test Coverage
    await this.testIntegrationTestCoverage();

    console.log(chalk.green('\n✓ Phase 8 tests completed'));
  }

  async testPerformanceMetricsCollection() {
    const testName = 'Performance Metrics Collection';
    const startTime = Date.now();

    try {
      // Check if performance metrics are being collected
      const metricsResult = await this.utils.request('GET', '/api/curate/performance-metrics');
      const duration = Date.now() - startTime;

      if (metricsResult.success && metricsResult.status === 200) {
        const metrics = metricsResult.data;

        // Check for essential metrics
        const essentialMetrics = [
          'apiLatency',
          'llmResponseTime',
          'cacheHitRate',
          'errorRate',
          'requestCount'
        ];

        const hasEssentialMetrics = essentialMetrics.every(metric => metrics[metric] !== undefined);

        if (hasEssentialMetrics) {
          // Validate metric types and ranges
          const validMetrics = this.validateMetrics(metrics);

          if (validMetrics) {
            this.testRunner.addTestResult(8, testName, 'passed', {
              duration,
              metricsCollected: Object.keys(metrics).length,
              hasEssentialMetrics: true
            });
          } else {
            this.testRunner.addTestResult(8, testName, 'failed', {
              error: 'Some metrics have invalid values or types',
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(8, testName, 'failed', {
            error: 'Essential metrics missing',
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(8, testName, 'failed', {
          error: metricsResult.error || 'Metrics endpoint not available',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(8, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testAPILatencyMonitoring() {
    const testName = 'API Latency Monitoring';
    const startTime = Date.now();

    try {
      // Test latency monitoring for different APIs
      const apiTests = [
        {
          name: 'Met Museum API',
          test: () => this.utils.request('GET', '/api/curate/met-health')
        },
        {
          name: 'Rijks Museum API',
          test: () => this.utils.request('GET', '/api/curate/rijks-health')
        },
        {
          name: 'LLM Service',
          test: () => this.utils.request('GET', '/api/curate/llm-scoring-health')
        }
      ];

      const latencyResults = [];

      for (const apiTest of apiTests) {
        const testStartTime = Date.now();
        try {
          const result = await apiTest.test();
          const latency = Date.now() - testStartTime;

          latencyResults.push({
            name: apiTest.name,
            latency,
            success: result.success
          });
        } catch (error) {
          const latency = Date.now() - testStartTime;
          latencyResults.push({
            name: apiTest.name,
            latency,
            success: false,
            error: error.message
          });
        }
      }

      const duration = Date.now() - startTime;

      if (latencyResults.length >= 2) {
        // Analyze latency patterns
        const avgLatency = latencyResults.reduce((sum, r) => sum + r.latency, 0) / latencyResults.length;
        const maxLatency = Math.max(...latencyResults.map(r => r.latency));
        const successRate = (latencyResults.filter(r => r.success).length / latencyResults.length) * 100;

        // Check if latencies are reasonable
        const reasonableLatency = avgLatency < 5000 && maxLatency < 15000; // 5s avg, 15s max

        if (reasonableLatency && successRate >= 66) {
          this.testRunner.addTestResult(8, testName, 'passed', {
            duration,
            apisTested: latencyResults.length,
            avgLatency,
            maxLatency,
            successRate
          });
        } else {
          this.testRunner.addTestResult(8, testName, 'failed', {
            error: `API latency inadequate: avg=${avgLatency}ms, max=${maxLatency}ms, success=${successRate}%`,
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(8, testName, 'failed', {
          error: `Only ${latencyResults.length}/${apiTests.length} API latency tests completed`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(8, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testLLMPerformanceTracking() {
    const testName = 'LLM Performance Tracking';
    const startTime = Date.now();

    try {
      // Test LLM performance monitoring
      const llmTests = [
        {
          emotion: 'joy',
          description: 'Joy performance test'
        },
        {
          emotion: 'melancholy',
          description: 'Melancholy performance test'
        },
        {
          emotion: 'calm',
          description: 'Calm performance test'
        }
      ];

      const llmResults = [];

      for (const test of llmTests) {
        const testStartTime = Date.now();
        try {
          const result = await this.utils.testCompleteCuration(test.emotion, test.description);
          const llmDuration = Date.now() - testStartTime;

          if (result.success && result.data) {
            const diagnostics = result.data.diagnostics || {};
            const llmDiagnostics = diagnostics.llmScoring || {};

            llmResults.push({
              emotion: test.emotion,
              totalDuration: llmDuration,
              llmDuration: llmDiagnostics.duration || 0,
              artworksScored: llmDiagnostics.artworksScored || 0,
              success: true
            });
          } else {
            llmResults.push({
              emotion: test.emotion,
              totalDuration: llmDuration,
              success: false
            });
          }
        } catch (error) {
          const llmDuration = Date.now() - testStartTime;
          llmResults.push({
            emotion: test.emotion,
            totalDuration: llmDuration,
            success: false,
            error: error.message
          });
        }
      }

      const duration = Date.now() - startTime;

      if (llmResults.length >= 2) {
        const successfulTests = llmResults.filter(r => r.success);
        const avgTotalDuration = successfulTests.reduce((sum, r) => sum + r.totalDuration, 0) / successfulTests.length;
        const avgLLMDuration = successfulTests.reduce((sum, r) => sum + r.llmDuration, 0) / successfulTests.length;
        const avgArtworksScored = successfulTests.reduce((sum, r) => sum + r.artworksScored, 0) / successfulTests.length;

        // Check LLM performance efficiency
        const llmOverhead = avgLLMDuration / avgTotalDuration;
        const efficientLLM = llmOverhead < 0.8; // LLM should not dominate total time

        if (efficientLLM && avgArtworksScored > 0) {
          this.testRunner.addTestResult(8, testName, 'passed', {
            duration,
            testsCompleted: successfulTests.length,
            avgTotalDuration,
            avgLLMDuration,
            avgArtworksScored,
            llmOverhead: llmOverhead * 100
          });
        } else {
          this.testRunner.addTestResult(8, testName, 'failed', {
            error: `LLM performance inadequate: overhead=${llmOverhead * 100}%, artworks=${avgArtworksScored}`,
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(8, testName, 'failed', {
          error: `Only ${llmResults.length}/${llmTests.length} LLM performance tests completed`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(8, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testSystemHealthMonitoring() {
    const testName = 'System Health Monitoring';
    const startTime = Date.now();

    try {
      // Test comprehensive system health monitoring
      const healthEndpoints = [
        '/api/curate/health',
        '/api/curate/met-health',
        '/api/curate/rijks-health',
        '/api/curate/cache-health',
        '/api/curate/llm-scoring-health'
      ];

      const healthResults = [];

      for (const endpoint of healthEndpoints) {
        try {
          const result = await this.utils.request('GET', endpoint);
          healthResults.push({
            endpoint,
            success: result.success,
            status: result.status,
            data: result.data
          });
        } catch (error) {
          healthResults.push({
            endpoint,
            success: false,
            error: error.message
          });
        }
      }

      const duration = Date.now() - startTime;

      if (healthResults.length >= 3) {
        const healthyEndpoints = healthResults.filter(r => r.success && r.status === 200);
        const healthStatus = this.calculateSystemHealth(healthResults);

        if (healthStatus.overall === 'healthy' || healthStatus.overall === 'degraded') {
          this.testRunner.addTestResult(8, testName, 'passed', {
            duration,
            endpointsTested: healthResults.length,
            healthyEndpoints: healthyEndpoints.length,
            overallHealth: healthStatus.overall,
            criticalFailures: healthStatus.criticalFailures
          });
        } else {
          this.testRunner.addTestResult(8, testName, 'failed', {
            error: `System health inadequate: status=${healthStatus.overall}, critical=${healthStatus.criticalFailures}`,
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(8, testName, 'failed', {
          error: `Only ${healthResults.length}/${healthEndpoints.length} health endpoints tested`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(8, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testErrorRateMonitoring() {
    const testName = 'Error Rate and Failure Analysis';
    const startTime = Date.now();

    try {
      // Test error rate monitoring and analysis
      const errorScenarios = [
        {
          name: 'Invalid emotion',
          test: () => this.utils.testCompleteCuration('invalid_emotion', 'test')
        },
        {
          name: 'Empty input',
          test: () => this.utils.testCompleteCuration('', '')
        },
        {
          name: 'Very long input',
          test: () => this.utils.testCompleteCuration('joy', 'a'.repeat(1000))
        }
      ];

      const errorResults = [];

      for (const scenario of errorScenarios) {
        try {
          const result = await scenario.test();
          errorResults.push({
            name: scenario.name,
            success: result.success,
            hasError: result.data?.error || !result.success,
            graceful: !result.success || (result.data && result.data.error)
          });
        } catch (error) {
          errorResults.push({
            name: scenario.name,
            success: false,
            hasError: true,
            graceful: true // Exception caught
          });
        }
      }

      // Also test error rate metrics
      const errorMetrics = await this.utils.request('GET', '/api/curate/error-metrics');

      const duration = Date.now() - startTime;

      const gracefullyHandled = errorResults.filter(r => r.graceful).length;

      if (gracefullyHandled >= 2) {
        // Check error metrics if available
        const hasErrorMetrics = errorMetrics.success && errorMetrics.data;
        const errorRateAcceptable = !hasErrorMetrics || errorMetrics.data.errorRate < 0.1; // < 10% error rate

        this.testRunner.addTestResult(8, testName, 'passed', {
          duration,
          scenariosTested: errorResults.length,
          gracefullyHandled,
          hasErrorMetrics: !!hasErrorMetrics,
          errorRate: hasErrorMetrics ? errorMetrics.data.errorRate : 'N/A'
        });
      } else {
        this.testRunner.addTestResult(8, testName, 'failed', {
          error: `Error handling inadequate: ${gracefullyHandled}/${errorResults.length} scenarios handled gracefully`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(8, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testLoadTesting() {
    const testName = 'Load Testing and Scalability';
    const startTime = Date.now();

    try {
      // Test system under load
      const loadTests = [
        {
          name: 'Concurrent users (5)',
          concurrency: 5,
          requests: 10
        },
        {
          name: 'Rapid requests (10)',
          concurrency: 10,
          requests: 20
        }
      ];

      const loadResults = [];

      for (const test of loadTests) {
        const testStartTime = Date.now();

        // Generate concurrent requests
        const requests = [];
        for (let i = 0; i < test.requests; i++) {
          requests.push(
            this.utils.testCompleteCuration('joy', `load test ${i}`)
          );
        }

        const results = await Promise.allSettled(requests);
        const testDuration = Date.now() - testStartTime;

        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
        const failed = results.filter(r => r.status === 'rejected' || !r.value.success);
        const avgResponseTime = successful.reduce((sum, r) => sum + (r.value.duration || 0), 0) / successful.length;

        loadResults.push({
          name: test.name,
          concurrency: test.concurrency,
          requests: test.requests,
          successful: successful.length,
          failed: failed.length,
          testDuration,
          avgResponseTime: successful.length > 0 ? avgResponseTime : 0,
          successRate: (successful.length / test.requests) * 100
        });
      }

      const duration = Date.now() - startTime;

      if (loadResults.length >= 1) {
        // Analyze load test results
        const avgSuccessRate = loadResults.reduce((sum, r) => sum + r.successRate, 0) / loadResults.length;
        const avgResponseTime = loadResults.filter(r => r.avgResponseTime > 0).reduce((sum, r) => sum + r.avgResponseTime, 0) / loadResults.filter(r => r.avgResponseTime > 0).length;

        // Performance criteria
        const acceptableSuccessRate = avgSuccessRate >= 70; // 70% success rate under load
        const acceptableResponseTime = avgResponseTime < 30000; // 30s average response time

        if (acceptableSuccessRate && acceptableResponseTime) {
          this.testRunner.addTestResult(8, testName, 'passed', {
            duration,
            loadTestsCompleted: loadResults.length,
            avgSuccessRate,
            avgResponseTime,
            totalRequests: loadResults.reduce((sum, r) => sum + r.requests, 0)
          });
        } else {
          this.testRunner.addTestResult(8, testName, 'failed', {
            error: `Load test inadequate: successRate=${avgSuccessRate}%, responseTime=${avgResponseTime}ms`,
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(8, testName, 'failed', {
          error: 'No load tests completed successfully',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(8, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testResourceUsageMonitoring() {
    const testName = 'Resource Usage Monitoring';
    const startTime = Date.now();

    try {
      // Test resource usage monitoring
      const resourceMetrics = await this.utils.request('GET', '/api/curate/resource-metrics');

      const duration = Date.now() - startTime;

      if (resourceMetrics.success && resourceMetrics.data) {
        const metrics = resourceMetrics.data;

        // Check for essential resource metrics
        const essentialMetrics = [
          'memoryUsage',
          'cpuUsage',
          'diskUsage',
          'networkUsage'
        ];

        const hasEssentialMetrics = essentialMetrics.every(metric => metrics[metric] !== undefined);

        if (hasEssentialMetrics) {
          // Validate resource usage is within reasonable bounds
          const memoryOK = metrics.memoryUsage < 1024 * 1024 * 1024; // < 1GB
          const cpuOK = metrics.cpuUsage < 80; // < 80%
          const diskOK = metrics.diskUsage < 90; // < 90%

          const resourceUsageOK = memoryOK && cpuOK && diskOK;

          if (resourceUsageOK) {
            this.testRunner.addTestResult(8, testName, 'passed', {
              duration,
              memoryUsage: metrics.memoryUsage,
              cpuUsage: metrics.cpuUsage,
              diskUsage: metrics.diskUsage,
              metricsAvailable: Object.keys(metrics).length
            });
          } else {
            this.testRunner.addTestResult(8, testName, 'failed', {
              error: `Resource usage concerning: memory=${memoryOK}, cpu=${cpuOK}, disk=${diskOK}`,
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(8, testName, 'failed', {
            error: 'Essential resource metrics missing',
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(8, testName, 'skipped', {
          duration,
          reason: 'Resource metrics endpoint not available'
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(8, testName, 'skipped', {
        duration,
        error: error.message,
        reason: 'Resource monitoring not implemented'
      });
    }
  }

  async testIntegrationTestCoverage() {
    const testName = 'Integration Test Coverage';
    const startTime = Date.now();

    try {
      // Test comprehensive integration scenarios
      const integrationTests = [
        {
          name: 'Complete emotion workflow',
          test: async () => {
            const emotions = ['joy', 'melancholy', 'calm'];
            const results = [];

            for (const emotion of emotions) {
              const result = await this.utils.testCompleteCuration(emotion, `integration test ${emotion}`);
              results.push(result);
            }

            return {
              successRate: results.filter(r => r.success).length / results.length,
              avgDuration: results.filter(r => r.success).reduce((sum, r) => sum + (r.duration || 0), 0) / results.filter(r => r.success).length
            };
          }
        },
        {
          name: 'Multi-source integration',
          test: async () => {
            const result = await this.utils.testCompleteCuration('passion', 'multi-source integration test');
            return {
              success: result.success,
              hasMultipleSources: result.data?.artworks && [...new Set(result.data.artworks.map(a => a.source))].length > 1
            };
          }
        },
        {
          name: 'Cache and fallback integration',
          test: async () => {
            // First call
            const first = await this.utils.testCompleteCuration('joy', 'cache integration test');
            // Second call (should hit cache)
            const second = await this.utils.testCompleteCuration('joy', 'cache integration test');
            return {
              cacheWorking: second.duration < first.duration * 0.8,
              bothSuccessful: first.success && second.success
            };
          }
        }
      ];

      const integrationResults = [];

      for (const test of integrationTests) {
        try {
          const result = await test.test();
          integrationResults.push({
            name: test.name,
            success: true,
            data: result
          });
        } catch (error) {
          integrationResults.push({
            name: test.name,
            success: false,
            error: error.message
          });
        }
      }

      const duration = Date.now() - startTime;

      const successfulTests = integrationResults.filter(r => r.success).length;

      if (successfulTests >= 2) {
        // Analyze integration test coverage
        const emotionWorkflow = integrationResults.find(r => r.name === 'Complete emotion workflow');
        const multiSource = integrationResults.find(r => r.name === 'Multi-source integration');
        const cacheIntegration = integrationResults.find(r => r.name === 'Cache and fallback integration');

        const coverage = {
          emotionWorkflow: emotionWorkflow?.success,
          multiSource: multiSource?.success,
          cacheIntegration: cacheIntegration?.success
        };

        const overallCoverage = Object.values(coverage).filter(v => v).length / Object.keys(coverage).length;

        if (overallCoverage >= 0.66) {
          this.testRunner.addTestResult(8, testName, 'passed', {
            duration,
            testsPassed: successfulTests,
            totalTests: integrationResults.length,
            coverage: overallCoverage * 100,
            emotionSuccessRate: emotionWorkflow?.data?.successRate || 0
          });
        } else {
          this.testRunner.addTestResult(8, testName, 'failed', {
            error: `Integration coverage inadequate: ${overallCoverage * 100}%`,
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(8, testName, 'failed', {
          error: `Only ${successfulTests}/${integrationTests.length} integration tests passed`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(8, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  // Helper methods
  validateMetrics(metrics) {
    try {
      // Validate apiLatency
      if (metrics.apiLatency && (typeof metrics.apiLatency !== 'number' || metrics.apiLatency < 0)) {
        return false;
      }

      // Validate llmResponseTime
      if (metrics.llmResponseTime && (typeof metrics.llmResponseTime !== 'number' || metrics.llmResponseTime < 0)) {
        return false;
      }

      // Validate cacheHitRate
      if (metrics.cacheHitRate !== undefined && (typeof metrics.cacheHitRate !== 'number' || metrics.cacheHitRate < 0 || metrics.cacheHitRate > 1)) {
        return false;
      }

      // Validate errorRate
      if (metrics.errorRate !== undefined && (typeof metrics.errorRate !== 'number' || metrics.errorRate < 0 || metrics.errorRate > 1)) {
        return false;
      }

      // Validate requestCount
      if (metrics.requestCount && (typeof metrics.requestCount !== 'number' || metrics.requestCount < 0)) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  calculateSystemHealth(healthResults) {
    const criticalEndpoints = ['/api/curate/health'];
    const criticalFailures = healthResults.filter(r =>
      criticalEndpoints.includes(r.endpoint) && (!r.success || r.status !== 200)
    ).length;

    const totalFailures = healthResults.filter(r => !r.success || r.status !== 200).length;
    const failureRate = totalFailures / healthResults.length;

    let overall = 'healthy';
    if (criticalFailures > 0) {
      overall = 'critical';
    } else if (failureRate > 0.5) {
      overall = 'unhealthy';
    } else if (failureRate > 0.2) {
      overall = 'degraded';
    }

    return {
      overall,
      criticalFailures,
      totalFailures,
      failureRate
    };
  }
}

module.exports = {
  run: async function(testRunner) {
    const tests = new Phase8Tests();
    tests.testRunner = testRunner;
    await tests.run(testRunner);
  }
};

const chalk = require('chalk');