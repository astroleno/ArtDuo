const TestUtils = require('./test-utils');

class Phase2Tests {
  constructor() {
    this.utils = null;
  }

  async run(testRunner) {
    this.utils = new TestUtils(testRunner);
    console.log(chalk.blue.bold('🏛️ Testing Phase 2: Met API Integration'));
    console.log('');

    // Test 1: Met API Health Check
    await this.testMetAPIHealth();

    // Test 2: Basic Search Functionality
    await this.testBasicSearch();

    // Test 3: Advanced Search with Filters
    await this.testAdvancedSearch();

    // Test 4: Artwork Details Fetching
    await this.testArtworkDetails();

    // Test 5: Error Handling
    await this.testErrorHandling();

    // Test 6: Rate Limiting and Timeouts
    await this.testRateLimiting();

    // Test 7: Data Validation and Transformation
    await this.testDataTransformation();

    // Test 8: Performance Tests
    await this.testPerformance();

    console.log(chalk.green('\n✓ Phase 2 tests completed'));
  }

  async testMetAPIHealth() {
    const testName = 'Met API Health Check';
    const startTime = Date.now();

    try {
      const result = await this.utils.request('GET', '/api/curate/met-health');
      const duration = Date.now() - startTime;

      if (result.success && result.status === 200) {
        this.testRunner.addTestResult(2, testName, 'passed', { duration });
      } else {
        this.testRunner.addTestResult(2, testName, 'failed', {
          error: result.error || 'Health check failed',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(2, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testBasicSearch() {
    const testQueries = [
      { emotion: 'joy', query: 'happiness celebration' },
      { emotion: 'melancholy', query: 'sadness contemplation' },
      { emotion: 'calm', query: 'peace serenity' },
      { emotion: 'passion', query: 'drama intensity' }
    ];

    for (const test of testQueries) {
      const testName = `Basic Search - ${test.emotion}`;
      const startTime = Date.now();

      try {
        const result = await this.utils.testArtworkSearch(test.emotion, test.query);
        const duration = Date.now() - startTime;

        if (result.success && result.data) {
          // Check if results contain Met artworks
          const metArtworks = result.data.artworks?.filter(artwork => artwork.source === 'met') || [];

          if (metArtworks.length > 0) {
            // Validate artwork structure
            const validArtworks = metArtworks.filter(artwork => {
              const validation = this.utils.validateArtwork(artwork);
              return validation.valid;
            });

            if (validArtworks.length > 0) {
              this.testRunner.addTestResult(2, testName, 'passed', {
                duration,
                artworkCount: metArtworks.length
              });
            } else {
              this.testRunner.addTestResult(2, testName, 'failed', {
                error: 'No valid artworks found',
                duration
              });
            }
          } else {
            this.testRunner.addTestResult(2, testName, 'failed', {
              error: 'No Met artworks found',
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(2, testName, 'failed', {
            error: result.error || 'No data returned',
            duration
          });
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        this.testRunner.addTestResult(2, testName, 'failed', {
          error: error.message,
          duration
        });
      }
    }
  }

  async testAdvancedSearch() {
    const advancedFilters = [
      {
        name: 'hasImages filter',
        filters: { hasImages: true }
      },
      {
        name: 'medium filter',
        filters: { medium: ['Paintings', 'Drawings'] }
      },
      {
        name: 'geoLocation filter',
        filters: { geoLocation: 'Europe' }
      },
      {
        name: 'period filter',
        filters: { period: { start: 1800, end: 1900 } }
      },
      {
        name: 'highlight filter',
        filters: { highlight: true }
      }
    ];

    for (const filterTest of advancedFilters) {
      const testName = `Advanced Search - ${filterTest.name}`;
      const startTime = Date.now();

      try {
        const payload = {
          emotion: 'joy',
          userInput: 'test',
          filters: filterTest.filters,
          testMode: this.utils.testMode
        };

        const result = await this.utils.request('POST', '/api/curate/test-met-search', payload);
        const duration = Date.now() - startTime;

        if (result.success && result.data) {
          // Check if filters were applied correctly
          const artworks = result.data.artworks || [];
          const metArtworks = artworks.filter(artwork => artwork.source === 'met');

          if (metArtworks.length > 0) {
            // Validate filter application
            let filtersApplied = true;

            if (filterTest.filters.hasImages && !metArtworks.every(artwork => artwork.image)) {
              filtersApplied = false;
            }

            if (filtersApplied) {
              this.testRunner.addTestResult(2, testName, 'passed', {
                duration,
                artworkCount: metArtworks.length
              });
            } else {
              this.testRunner.addTestResult(2, testName, 'failed', {
                error: 'Filters not applied correctly',
                duration
              });
            }
          } else {
            this.testRunner.addTestResult(2, testName, 'failed', {
              error: 'No artworks found with filters',
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(2, testName, 'failed', {
            error: result.error || 'No data returned',
            duration
          });
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        this.testRunner.addTestResult(2, testName, 'failed', {
          error: error.message,
          duration
        });
      }
    }
  }

  async testArtworkDetails() {
    const testName = 'Artwork Details Fetching';
    const startTime = Date.now();

    try {
      // First, get some artwork IDs from a basic search
      const searchResult = await this.utils.testArtworkSearch('joy', 'celebration');

      if (searchResult.success && searchResult.data) {
        const metArtworks = searchResult.data.artworks?.filter(artwork => artwork.source === 'met') || [];

        if (metArtworks.length > 0) {
          // Test details fetching for first few artworks
          const artworkIds = metArtworks.slice(0, 3).map(artwork => artwork.id);

          const detailsResults = [];
          for (const id of artworkIds) {
            const detailResult = await this.utils.request('GET', `/api/curate/met-details/${id}`);
            detailsResults.push(detailResult);
          }

          const duration = Date.now() - startTime;

          const successfulDetails = detailsResults.filter(r => r.success && r.data);

          if (successfulDetails.length > 0) {
            // Validate detail structure
            const validDetails = successfulDetails.filter(detail => {
              const artwork = detail.data;
              return artwork &&
                     artwork.title &&
                     artwork.artist &&
                     artwork.dating &&
                     artwork.medium &&
                     artwork.image;
            });

            if (validDetails.length > 0) {
              this.testRunner.addTestResult(2, testName, 'passed', {
                duration,
                detailsFetched: successfulDetails.length,
                validDetails: validDetails.length
              });
            } else {
              this.testRunner.addTestResult(2, testName, 'failed', {
                error: 'Details structure invalid',
                duration
              });
            }
          } else {
            this.testRunner.addTestResult(2, testName, 'failed', {
              error: 'No details fetched successfully',
              duration
            });
          }
        } else {
          const duration = Date.now() - startTime;
          this.testRunner.addTestResult(2, testName, 'skipped', {
            error: 'No Met artworks found to test details',
            duration
          });
        }
      } else {
        const duration = Date.now() - startTime;
        this.testRunner.addTestResult(2, testName, 'failed', {
          error: searchResult.error || 'Search failed',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(2, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testErrorHandling() {
    const errorCases = [
      {
        name: 'Invalid artwork ID',
        test: async () => {
          return await this.utils.request('GET', '/api/curate/met-details/invalid-id');
        }
      },
      {
        name: 'Empty search query',
        test: async () => {
          return await this.utils.request('POST', '/api/curate/test-met-search', {
            emotion: '',
            userInput: '',
            testMode: this.utils.testMode
          });
        }
      },
      {
        name: 'Malformed filters',
        test: async () => {
          return await this.utils.request('POST', '/api/curate/test-met-search', {
            emotion: 'joy',
            userInput: 'test',
            filters: { invalid: 'filter' },
            testMode: this.utils.testMode
          });
        }
      },
      {
        name: 'Large result set',
        test: async () => {
          return await this.utils.request('POST', '/api/curate/test-met-search', {
            emotion: 'art',
            userInput: 'art',
            filters: { hasImages: true },
            testMode: this.utils.testMode
          });
        }
      }
    ];

    for (const errorCase of errorCases) {
      const testName = `Error Handling - ${errorCase.name}`;
      const startTime = Date.now();

      try {
        const result = await errorCase.test();
        const duration = Date.now() - startTime;

        // For error cases, we expect graceful handling
        if (result.success === false || (result.data && result.data.error)) {
          this.testRunner.addTestResult(2, testName, 'passed', { duration });
        } else if (errorCase.name === 'Large result set') {
          // Large result set should succeed but be limited
          if (result.success && result.data) {
            const artworkCount = result.data.artworks?.length || 0;
            if (artworkCount <= 100) { // Assuming reasonable limit
              this.testRunner.addTestResult(2, testName, 'passed', {
                duration,
                artworkCount
              });
            } else {
              this.testRunner.addTestResult(2, testName, 'failed', {
                error: `Result set too large: ${artworkCount}`,
                duration
              });
            }
          } else {
            this.testRunner.addTestResult(2, testName, 'failed', {
              error: 'Large result set failed',
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(2, testName, 'failed', {
            error: 'Expected error handling not triggered',
            duration
          });
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        this.testRunner.addTestResult(2, testName, 'failed', {
          error: error.message,
          duration
        });
      }
    }
  }

  async testRateLimiting() {
    const testName = 'Rate Limiting and Timeouts';
    const startTime = Date.now();

    try {
      // Test concurrent requests
      const concurrentRequests = [];
      const requestCount = 5;

      for (let i = 0; i < requestCount; i++) {
        concurrentRequests.push(
          this.utils.testArtworkSearch('joy', `concurrent test ${i}`)
        );
      }

      const results = await Promise.allSettled(concurrentRequests);
      const duration = Date.now() - startTime;

      const successfulRequests = results.filter(r => r.status === 'fulfilled' && r.value.success);
      const failedRequests = results.filter(r => r.status === 'rejected' || !r.value.success);

      // Allow some failures due to rate limiting
      if (successfulRequests.length >= Math.floor(requestCount * 0.6)) { // 60% success rate acceptable
        this.testRunner.addTestResult(2, testName, 'passed', {
          duration,
          successful: successfulRequests.length,
          failed: failedRequests.length,
          successRate: (successfulRequests.length / requestCount) * 100
        });
      } else {
        this.testRunner.addTestResult(2, testName, 'failed', {
          error: `Too many failures: ${failedRequests.length}/${requestCount}`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(2, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testDataTransformation() {
    const testName = 'Data Transformation and Schema Compliance';
    const startTime = Date.now();

    try {
      const result = await this.utils.testArtworkSearch('joy', 'celebration');
      const duration = Date.now() - startTime;

      if (result.success && result.data) {
        const metArtworks = result.data.artworks?.filter(artwork => artwork.source === 'met') || [];

        if (metArtworks.length > 0) {
          // Validate schema compliance
          const validArtworks = metArtworks.filter(artwork => {
            const required = ['id', 'title', 'artist', 'source', 'image', 'license', 'permalink'];
            const hasRequired = required.every(field => artwork[field] !== undefined);

            const typeChecks = [
              typeof artwork.id === 'string' || typeof artwork.id === 'number',
              typeof artwork.title === 'string',
              typeof artwork.artist === 'string',
              artwork.source === 'met',
              typeof artwork.image === 'string',
              typeof artwork.license === 'string',
              typeof artwork.permalink === 'string'
            ];

            return hasRequired && typeChecks.every(check => check);
          });

          if (validArtworks.length === metArtworks.length) {
            this.testRunner.addTestResult(2, testName, 'passed', {
              duration,
              validatedArtworks: validArtworks.length
            });
          } else {
            this.testRunner.addTestResult(2, testName, 'failed', {
              error: `${metArtworks.length - validArtworks.length} artworks failed validation`,
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(2, testName, 'skipped', {
            error: 'No Met artworks found',
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(2, testName, 'failed', {
          error: result.error || 'No data returned',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(2, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testPerformance() {
    const testName = 'Performance - Met API Response Times';
    const startTime = Date.now();

    try {
      const performanceResult = await this.utils.runPerformanceTest(
        'met-api-search',
        async () => {
          return await this.utils.testArtworkSearch('joy', 'performance test');
        },
        5 // 5 iterations
      );

      const duration = Date.now() - startTime;

      if (performanceResult.successRate >= 80) {
        // Check if average response time is reasonable (< 3 seconds)
        if (performanceResult.avgDuration < 3000) {
          this.testRunner.addTestResult(2, testName, 'passed', {
            duration,
            avgDuration: performanceResult.avgDuration,
            successRate: performanceResult.successRate
          });
        } else {
          this.testRunner.addTestResult(2, testName, 'failed', {
            error: `Average response time too slow: ${performanceResult.avgDuration}ms`,
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(2, testName, 'failed', {
          error: `Success rate too low: ${performanceResult.successRate}%`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(2, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }
}

module.exports = {
  run: async function(testRunner) {
    const tests = new Phase2Tests();
    tests.testRunner = testRunner;
    await tests.run(testRunner);
  }
};

const chalk = require('chalk');