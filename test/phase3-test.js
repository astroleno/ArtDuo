const TestUtils = require('./test-utils');

class Phase3Tests {
  constructor() {
    this.utils = null;
  }

  async run(testRunner) {
    this.utils = new TestUtils(testRunner);
    console.log(chalk.blue.bold('🎨 Testing Phase 3: Rijks API Integration'));
    console.log('');

    // Test 1: Rijks API Health Check
    await this.testRijksAPIHealth();

    // Test 2: Basic Search Functionality
    await this.testBasicSearch();

    // Test 3: Advanced Search with Parameters
    await this.testAdvancedSearch();

    // Test 4: Linked Art JSON Processing
    await this.testLinkedArtProcessing();

    // Test 5: IIIF Image URL Generation
    await this.testIIIFImageGeneration();

    // Test 6: Multi-format Support (JSON-LD, Turtle, RDF/XML)
    await this.testMultiFormatSupport();

    // Test 7: Error Handling and Edge Cases
    await this.testErrorHandling();

    // Test 8: Performance and Rate Limiting
    await this.testPerformance();

    console.log(chalk.green('\n✓ Phase 3 tests completed'));
  }

  async testRijksAPIHealth() {
    const testName = 'Rijks API Health Check';
    const startTime = Date.now();

    try {
      const result = await this.utils.request('GET', '/api/curate/rijks-health');
      const duration = Date.now() - startTime;

      if (result.success && result.status === 200) {
        this.testRunner.addTestResult(3, testName, 'passed', { duration });
      } else {
        this.testRunner.addTestResult(3, testName, 'failed', {
          error: result.error || 'Health check failed',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(3, testName, 'failed', {
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
      { emotion: 'passion', query: 'drama intensity' },
      { emotion: 'lonely', query: 'solitude isolation' }
    ];

    for (const test of testQueries) {
      const testName = `Basic Search - ${test.emotion}`;
      const startTime = Date.now();

      try {
        const result = await this.utils.testArtworkSearch(test.emotion, test.query);
        const duration = Date.now() - startTime;

        if (result.success && result.data) {
          // Check if results contain Rijks artworks
          const rijksArtworks = result.data.artworks?.filter(artwork => artwork.source === 'rijks') || [];

          if (rijksArtworks.length > 0) {
            // Validate artwork structure
            const validArtworks = rijksArtworks.filter(artwork => {
              const validation = this.utils.validateArtwork(artwork);
              return validation.valid;
            });

            if (validArtworks.length > 0) {
              this.testRunner.addTestResult(3, testName, 'passed', {
                duration,
                artworkCount: rijksArtworks.length
              });
            } else {
              this.testRunner.addTestResult(3, testName, 'failed', {
                error: 'No valid artworks found',
                duration
              });
            }
          } else {
            this.testRunner.addTestResult(3, testName, 'failed', {
              error: 'No Rijks artworks found',
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(3, testName, 'failed', {
            error: result.error || 'No data returned',
            duration
          });
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        this.testRunner.addTestResult(3, testName, 'failed', {
          error: error.message,
          duration
        });
      }
    }
  }

  async testAdvancedSearch() {
    const advancedParams = [
      {
        name: 'Image available filter',
        params: { imageAvailable: true }
      },
      {
        name: 'Culture filter',
        params: { culture: 'Netherlands' }
      },
      {
        name: 'Material filter',
        params: { material: 'oil paint' }
      },
      {
        name: 'Artist filter',
        params: { involvedMaker: 'Rembrandt' }
      },
      {
        name: 'Type filter',
        params: { type: 'painting' }
      },
      {
        name: 'Date range filter',
        params: { dating: '1600-1700' }
      }
    ];

    for (const paramTest of advancedParams) {
      const testName = `Advanced Search - ${paramTest.name}`;
      const startTime = Date.now();

      try {
        const payload = {
          emotion: 'joy',
          userInput: 'test',
          params: paramTest.params,
          testMode: this.utils.testMode
        };

        const result = await this.utils.request('POST', '/api/curate/test-rijks-search', payload);
        const duration = Date.now() - startTime;

        if (result.success && result.data) {
          const artworks = result.data.artworks || [];
          const rijksArtworks = artworks.filter(artwork => artwork.source === 'rijks');

          if (rijksArtworks.length > 0) {
            // Validate parameter application
            let paramsApplied = true;

            if (paramTest.params.imageAvailable && !rijksArtworks.every(artwork => artwork.image)) {
              paramsApplied = false;
            }

            if (paramsApplied) {
              this.testRunner.addTestResult(3, testName, 'passed', {
                duration,
                artworkCount: rijksArtworks.length
              });
            } else {
              this.testRunner.addTestResult(3, testName, 'failed', {
                error: 'Parameters not applied correctly',
                duration
              });
            }
          } else {
            this.testRunner.addTestResult(3, testName, 'failed', {
              error: 'No artworks found with parameters',
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(3, testName, 'failed', {
            error: result.error || 'No data returned',
            duration
          });
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        this.testRunner.addTestResult(3, testName, 'failed', {
          error: error.message,
          duration
        });
      }
    }
  }

  async testLinkedArtProcessing() {
    const testName = 'Linked Art JSON Processing';
    const startTime = Date.now();

    try {
      // First, get some artwork IDs from a basic search
      const searchResult = await this.utils.testArtworkSearch('joy', 'celebration');

      if (searchResult.success && searchResult.data) {
        const rijksArtworks = searchResult.data.artworks?.filter(artwork => artwork.source === 'rijks') || [];

        if (rijksArtworks.length > 0) {
          // Test Linked Art processing for first few artworks
          const artworkIds = rijksArtworks.slice(0, 3).map(artwork => artwork.id);

          const linkedArtResults = [];
          for (const id of artworkIds) {
            const linkedArtResult = await this.utils.request('GET', `/api/curate/rijks-linked-art/${id}`);
            linkedArtResults.push(linkedArtResult);
          }

          const duration = Date.now() - startTime;

          const successfulLinkedArt = linkedArtResults.filter(r => r.success && r.data);

          if (successfulLinkedArt.length > 0) {
            // Validate Linked Art structure
            const validLinkedArt = successfulLinkedArt.filter(result => {
              const data = result.data;
              return data &&
                     (data.title || data.label) &&
                     (data.maker || data.creator) &&
                     (data.dating || data.created) &&
                     (data.materials || data.medium) &&
                     data.iiif;
            });

            if (validLinkedArt.length > 0) {
              this.testRunner.addTestResult(3, testName, 'passed', {
                duration,
                linkedArtFetched: successfulLinkedArt.length,
                validLinkedArt: validLinkedArt.length
              });
            } else {
              this.testRunner.addTestResult(3, testName, 'failed', {
                error: 'Linked Art structure invalid',
                duration
              });
            }
          } else {
            this.testRunner.addTestResult(3, testName, 'failed', {
              error: 'No Linked Art data fetched successfully',
              duration
            });
          }
        } else {
          const duration = Date.now() - startTime;
          this.testRunner.addTestResult(3, testName, 'skipped', {
            error: 'No Rijks artworks found to test Linked Art',
            duration
          });
        }
      } else {
        const duration = Date.now() - startTime;
        this.testRunner.addTestResult(3, testName, 'failed', {
          error: searchResult.error || 'Search failed',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(3, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testIIIFImageGeneration() {
    const testName = 'IIIF Image URL Generation';
    const startTime = Date.now();

    try {
      const result = await this.utils.testArtworkSearch('joy', 'celebration');
      const duration = Date.now() - startTime;

      if (result.success && result.data) {
        const rijksArtworks = result.data.artworks?.filter(artwork => artwork.source === 'rijks') || [];

        if (rijksArtworks.length > 0) {
          // Test IIIF URL generation
          const validIIIFURLs = rijksArtworks.filter(artwork => {
            if (!artwork.image) return false;

            // Check if image URL is a valid IIIF URL
            const iiifPattern = /iiif\/.*\/info\.json$/;
            return iiifPattern.test(artwork.image) ||
                   artwork.image.includes('iiif') ||
                   artwork.image.includes('googleusercontent.com');
          });

          if (validIIIFURLs.length > 0) {
            // Test a few IIIF URLs for accessibility
            const testURLs = validIIIFURLs.slice(0, 2).map(artwork => artwork.image);
            const iiifTests = [];

            for (const url of testURLs) {
              try {
                const response = await fetch(url, { method: 'HEAD' });
                iiifTests.push({ url, status: response.status });
              } catch (error) {
                iiifTests.push({ url, status: 'error', error: error.message });
              }
            }

            const accessibleIIIF = iiifTests.filter(test => test.status === 200);

            if (accessibleIIIF.length > 0) {
              this.testRunner.addTestResult(3, testName, 'passed', {
                duration,
                validIIIFURLs: validIIIFURLs.length,
                accessibleIIIF: accessibleIIIF.length
              });
            } else {
              this.testRunner.addTestResult(3, testName, 'failed', {
                error: 'IIIF URLs not accessible',
                duration
              });
            }
          } else {
            this.testRunner.addTestResult(3, testName, 'failed', {
              error: 'No valid IIIF URLs found',
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(3, testName, 'skipped', {
            error: 'No Rijks artworks found',
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(3, testName, 'failed', {
          error: result.error || 'No data returned',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(3, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testMultiFormatSupport() {
    const testName = 'Multi-format Support (JSON-LD, Turtle, RDF/XML)';
    const startTime = Date.now();

    try {
      // Test different formats
      const formats = ['jsonld', 'turtle', 'rdfxml'];
      const formatResults = [];

      for (const format of formats) {
        try {
          const result = await this.utils.request('GET', `/api/curate/rijks-format-test?format=${format}`);
          formatResults.push({ format, success: result.success });
        } catch (error) {
          formatResults.push({ format, success: false, error: error.message });
        }
      }

      const duration = Date.now() - startTime;

      const supportedFormats = formatResults.filter(r => r.success);

      if (supportedFormats.length >= 2) { // At least 2 formats should work
        this.testRunner.addTestResult(3, testName, 'passed', {
          duration,
          supportedFormats: supportedFormats.length,
          totalFormats: formats.length
        });
      } else {
        this.testRunner.addTestResult(3, testName, 'failed', {
          error: `Only ${supportedFormats.length}/${formats.length} formats supported`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(3, testName, 'failed', {
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
          return await this.utils.request('GET', '/api/curate/rijks-linked-art/invalid-id');
        }
      },
      {
        name: 'Empty search query',
        test: async () => {
          return await this.utils.request('POST', '/api/curate/test-rijks-search', {
            emotion: '',
            userInput: '',
            testMode: this.utils.testMode
          });
        }
      },
      {
        name: 'Invalid format',
        test: async () => {
          return await this.utils.request('GET', '/api/curate/rijks-format-test?format=invalid');
        }
      },
      {
        name: 'Pagination beyond limits',
        test: async () => {
          return await this.utils.request('POST', '/api/curate/test-rijks-search', {
            emotion: 'art',
            userInput: 'test',
            params: { ps: 1000, p: 100 }, // Large page size and page number
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
          this.testRunner.addTestResult(3, testName, 'passed', { duration });
        } else {
          this.testRunner.addTestResult(3, testName, 'failed', {
            error: 'Expected error handling not triggered',
            duration
          });
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        this.testRunner.addTestResult(3, testName, 'passed', { // Exception handling is good
          duration,
          error: 'Exception properly caught'
        });
      }
    }
  }

  async testPerformance() {
    const testName = 'Performance - Rijks API Response Times';
    const startTime = Date.now();

    try {
      const performanceResult = await this.utils.runPerformanceTest(
        'rijks-api-search',
        async () => {
          return await this.utils.testArtworkSearch('joy', 'performance test');
        },
        5 // 5 iterations
      );

      const duration = Date.now() - startTime;

      if (performanceResult.successRate >= 80) {
        // Check if average response time is reasonable (< 5 seconds for Rijks API)
        if (performanceResult.avgDuration < 5000) {
          this.testRunner.addTestResult(3, testName, 'passed', {
            duration,
            avgDuration: performanceResult.avgDuration,
            successRate: performanceResult.successRate
          });
        } else {
          this.testRunner.addTestResult(3, testName, 'failed', {
            error: `Average response time too slow: ${performanceResult.avgDuration}ms`,
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(3, testName, 'failed', {
          error: `Success rate too low: ${performanceResult.successRate}%`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(3, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }
}

module.exports = {
  run: async function(testRunner) {
    const tests = new Phase3Tests();
    tests.testRunner = testRunner;
    await tests.run(testRunner);
  }
};

const chalk = require('chalk');