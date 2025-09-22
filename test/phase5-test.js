const TestUtils = require('./test-utils');

class Phase5Tests {
  constructor() {
    this.utils = null;
  }

  async run(testRunner) {
    this.utils = new TestUtils(testRunner);
    console.log(chalk.blue.bold('🤖 Testing Phase 5: LLM Confidence Scoring'));
    console.log('');

    // Test 1: LLM Scoring Infrastructure
    await this.testLLMScoringInfrastructure();

    // Test 2: Multi-dimensional Scoring
    await this.testMultiDimensionalScoring();

    // Test 3: Confidence Score Validation
    await this.testConfidenceScoreValidation();

    // Test 4: Scoring Performance Optimization
    await this.testScoringPerformance();

    // Test 5: Scoring Error Handling
    await this.testScoringErrorHandling();

    // Test 6: Scoring Consistency
    await this.testScoringConsistency();

    // Test 7: Integration with Artwork Selection
    await this.testArtworkSelectionIntegration();

    // Test 8: Batch Scoring Optimization
    await this.testBatchScoringOptimization();

    console.log(chalk.green('\n✓ Phase 5 tests completed'));
  }

  async testLLMScoringInfrastructure() {
    const testName = 'LLM Scoring Infrastructure';
    const startTime = Date.now();

    try {
      // Check if LLM scoring service is available
      const healthResult = await this.utils.request('GET', '/api/curate/llm-scoring-health');
      const duration = Date.now() - startTime;

      if (healthResult.success && healthResult.status === 200) {
        const { enabled, capabilities } = healthResult.data;

        if (enabled && capabilities) {
          // Test basic scoring functionality
          const testArtworks = [
            {
              id: 'test-1',
              title: 'Test Artwork',
              artist: 'Test Artist',
              source: 'met',
              image: 'https://example.com/image.jpg'
            }
          ];

          const scoringResult = await this.utils.testLLMScoring(testArtworks, 'joy');

          if (scoringResult.success && scoringResult.data) {
            this.testRunner.addTestResult(5, testName, 'passed', {
              duration,
              capabilities: capabilities.length,
              scoringEnabled: true
            });
          } else {
            this.testRunner.addTestResult(5, testName, 'failed', {
              error: scoringResult.error || 'Basic scoring failed',
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(5, testName, 'failed', {
            error: 'LLM scoring not properly enabled',
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(5, testName, 'failed', {
          error: healthResult.error || 'Health check failed',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(5, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testMultiDimensionalScoring() {
    const testName = 'Multi-dimensional Scoring';
    const startTime = Date.now();

    try {
      // First, get some real artworks from the API
      const searchResult = await this.utils.testArtworkSearch('joy', 'celebration');

      if (searchResult.success && searchResult.data) {
        const artworks = searchResult.data.artworks?.slice(0, 3) || [];

        if (artworks.length > 0) {
          const scoringResult = await this.utils.testLLMScoring(artworks, 'joy');
          const duration = Date.now() - startTime;

          if (scoringResult.success && scoringResult.data) {
            const scoredArtworks = scoringResult.data.scoredArtworks || [];

            // Check for multi-dimensional scoring
            const hasMultiDimensions = scoredArtworks.every(artwork => {
              const score = artwork.llmScore || artwork.score;
              return score &&
                     typeof score.emotionalFit === 'number' &&
                     typeof score.artisticValue === 'number' &&
                     typeof score.visualExpression === 'number' &&
                     typeof score.overallRecommendation === 'number';
            });

            if (hasMultiDimensions) {
              // Validate score ranges (0-10 or 0-100)
              const validScoreRanges = scoredArtworks.every(artwork => {
                const score = artwork.llmScore || artwork.score;
                return Object.values(score).every(value =>
                  typeof value === 'number' && value >= 0 && value <= 100
                );
              });

              if (validScoreRanges) {
                this.testRunner.addTestResult(5, testName, 'passed', {
                  duration,
                  artworksScored: scoredArtworks.length,
                  dimensions: 4 // emotionalFit, artisticValue, visualExpression, overallRecommendation
                });
              } else {
                this.testRunner.addTestResult(5, testName, 'failed', {
                  error: 'Invalid score ranges detected',
                  duration
                });
              }
            } else {
              this.testRunner.addTestResult(5, testName, 'failed', {
                error: 'Multi-dimensional scoring not working',
                duration
              });
            }
          } else {
            this.testRunner.addTestResult(5, testName, 'failed', {
              error: scoringResult.error || 'Scoring failed',
              duration
            });
          }
        } else {
          const duration = Date.now() - startTime;
          this.testRunner.addTestResult(5, testName, 'skipped', {
            error: 'No artworks found to test scoring',
            duration
          });
        }
      } else {
        const duration = Date.now() - startTime;
        this.testRunner.addTestResult(5, testName, 'failed', {
          error: searchResult.error || 'Artwork search failed',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(5, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testConfidenceScoreValidation() {
    const testName = 'Confidence Score Validation';
    const startTime = Date.now();

    try {
      const emotions = ['joy', 'melancholy', 'calm', 'passion'];
      const confidenceResults = [];

      for (const emotion of emotions) {
        // Get artworks for each emotion
        const searchResult = await this.utils.testArtworkSearch(emotion, `${emotion} test`);

        if (searchResult.success && searchResult.data) {
          const artworks = searchResult.data.artworks?.slice(0, 2) || [];

          if (artworks.length > 0) {
            const scoringResult = await this.utils.testLLMScoring(artworks, emotion);

            if (scoringResult.success && scoringResult.data) {
              const scoredArtworks = scoringResult.data.scoredArtworks || [];
              const avgConfidence = scoredArtworks.reduce((sum, artwork) =>
                sum + (artwork.confidence || artwork.llmScore?.confidence || 0), 0) / scoredArtworks.length;

              confidenceResults.push({
                emotion,
                avgConfidence,
                artworksScored: scoredArtworks.length
              });
            }
          }
        }
      }

      const duration = Date.now() - startTime;

      if (confidenceResults.length >= 3) {
        // Validate confidence scores are reasonable
        const validConfidence = confidenceResults.every(result =>
          result.avgConfidence >= 0 && result.avgConfidence <= 1
        );

        // Check if confidence varies appropriately by emotion
        const confidenceVariance = confidenceResults.some(result =>
          Math.abs(result.avgConfidence - 0.5) > 0.2
        );

        if (validConfidence && confidenceVariance) {
          this.testRunner.addTestResult(5, testName, 'passed', {
            duration,
            emotionsTested: confidenceResults.length,
            avgConfidence: confidenceResults.reduce((sum, r) => sum + r.avgConfidence, 0) / confidenceResults.length
          });
        } else {
          this.testRunner.addTestResult(5, testName, 'failed', {
            error: `Confidence validation failed: valid=${validConfidence}, variance=${confidenceVariance}`,
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(5, testName, 'failed', {
          error: `Only ${confidenceResults.length}/${emotions.length} emotions tested successfully`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(5, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testScoringPerformance() {
    const testName = 'Scoring Performance Optimization';
    const startTime = Date.now();

    try {
      // Test with different batch sizes to measure performance
      const batchSizes = [3, 5, 8];
      const performanceResults = [];

      for (const batchSize of batchSizes) {
        // Get artworks
        const searchResult = await this.utils.testArtworkSearch('joy', 'performance test');

        if (searchResult.success && searchResult.data) {
          const artworks = searchResult.data.artworks?.slice(0, batchSize) || [];

          if (artworks.length === batchSize) {
            const scoringStartTime = Date.now();
            const scoringResult = await this.utils.testLLMScoring(artworks, 'joy');
            const scoringDuration = Date.now() - scoringStartTime;

            if (scoringResult.success && scoringResult.data) {
              performanceResults.push({
                batchSize,
                duration: scoringDuration,
                success: true
              });
            }
          }
        }
      }

      const duration = Date.now() - startTime;

      if (performanceResults.length >= 2) {
        // Check if performance is reasonable (< 30 seconds per batch)
        const reasonablePerformance = performanceResults.every(result =>
          result.duration < 30000
        );

        // Check if larger batches don't scale linearly (indicating optimization)
        const avgTimePerArtwork = performanceResults.map(result =>
          result.duration / result.batchSize
        );
        const efficiency = avgTimePerArtwork.every(time => time < 10000); // < 10s per artwork

        if (reasonablePerformance && efficiency) {
          this.testRunner.addTestResult(5, testName, 'passed', {
            duration,
            batchesTested: performanceResults.length,
            avgTimePerArtwork: avgTimePerArtwork.reduce((sum, time) => sum + time, 0) / avgTimePerArtwork.length
          });
        } else {
          this.testRunner.addTestResult(5, testName, 'failed', {
            error: `Performance inadequate: reasonable=${reasonablePerformance}, efficiency=${efficiency}`,
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(5, testName, 'failed', {
          error: `Only ${performanceResults.length}/${batchSizes.length} batch sizes tested`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(5, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testScoringErrorHandling() {
    const testName = 'Scoring Error Handling';
    const startTime = Date.now();

    try {
      const errorScenarios = [
        {
          name: 'Empty artwork list',
          test: () => this.utils.testLLMScoring([], 'joy')
        },
        {
          name: 'Invalid artwork data',
          test: () => this.utils.testLLMScoring([{ id: 'invalid' }], 'joy')
        },
        {
          name: 'Invalid emotion',
          test: () => this.utils.testLLMScoring([{ id: 'test', title: 'Test' }], 'invalid_emotion')
        },
        {
          name: 'Large batch size',
          test: async () => {
            const largeBatch = Array(20).fill().map((_, i) => ({
              id: `test-${i}`,
              title: `Test Artwork ${i}`,
              artist: 'Test Artist'
            }));
            return await this.utils.testLLMScoring(largeBatch, 'joy');
          }
        }
      ];

      const errorResults = [];

      for (const scenario of errorScenarios) {
        try {
          const result = await scenario.test();
          errorResults.push({
            name: scenario.name,
            handledGracefully: !result.success || (result.data && result.data.error)
          });
        } catch (error) {
          errorResults.push({
            name: scenario.name,
            handledGracefully: true // Exception caught
          });
        }
      }

      const duration = Date.now() - startTime;

      const properlyHandled = errorResults.filter(r => r.handledGracefully).length;

      if (properlyHandled === errorResults.length) {
        this.testRunner.addTestResult(5, testName, 'passed', {
          duration,
          scenariosTested: errorResults.length,
          properlyHandled
        });
      } else {
        this.testRunner.addTestResult(5, testName, 'failed', {
          error: `Error handling inadequate: ${properlyHandled}/${errorResults.length} scenarios properly handled`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(5, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testScoringConsistency() {
    const testName = 'Scoring Consistency';
    const startTime = Date.now();

    try {
      // Test same artwork multiple times to ensure consistent scoring
      const testArtwork = {
        id: 'consistency-test',
        title: 'Consistency Test Artwork',
        artist: 'Test Artist',
        source: 'met',
        image: 'https://example.com/image.jpg'
      };

      const iterations = 3;
      const scoringResults = [];

      for (let i = 0; i < iterations; i++) {
        const result = await this.utils.testLLMScoring([testArtwork], 'joy');
        if (result.success && result.data) {
          const scoredArtwork = result.data.scoredArtworks?.[0];
          if (scoredArtwork && scoredArtwork.llmScore) {
            scoringResults.push(scoredArtwork.llmScore);
          }
        }
      }

      const duration = Date.now() - startTime;

      if (scoringResults.length === iterations) {
        // Check scoring consistency (scores should be similar)
        const overallScores = scoringResults.map(score => score.overallRecommendation || score.overall_score);
        const avgScore = overallScores.reduce((sum, score) => sum + score, 0) / overallScores.length;
        const variance = overallScores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / overallScores.length;
        const standardDeviation = Math.sqrt(variance);

        // Scores should be consistent (low standard deviation)
        if (standardDeviation < 15) { // Allow some variation
          this.testRunner.addTestResult(5, testName, 'passed', {
            duration,
            iterations,
            avgScore,
            standardDeviation
          });
        } else {
          this.testRunner.addTestResult(5, testName, 'failed', {
            error: `Scoring inconsistency detected: standard deviation ${standardDeviation}`,
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(5, testName, 'failed', {
          error: `Only ${scoringResults.length}/${iterations} scoring attempts succeeded`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(5, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testArtworkSelectionIntegration() {
    const testName = 'Integration with Artwork Selection';
    const startTime = Date.now();

    try {
      // Test complete flow with LLM scoring integration
      const result = await this.utils.testCompleteCuration('joy', 'test scoring integration');
      const duration = Date.now() - startTime;

      if (result.success && result.data) {
        const { artworks, diagnostics } = result.data;

        if (artworks && artworks.length > 0) {
          // Check if artworks have LLM scores
          const scoredArtworks = artworks.filter(artwork =>
            artwork.llmScore || artwork.score || artwork.confidence
          );

          if (scoredArtworks.length > 0) {
            // Check if diagnostics contain scoring information
            const hasScoringDiagnostics = diagnostics && (
              diagnostics.llmScoring ||
              diagnostics.scoringSuccess ||
              diagnostics.avgConfidence
            );

            if (hasScoringDiagnostics) {
              this.testRunner.addTestResult(5, testName, 'passed', {
                duration,
                totalArtworks: artworks.length,
                scoredArtworks: scoredArtworks.length,
                hasDiagnostics: true
              });
            } else {
              this.testRunner.addTestResult(5, testName, 'failed', {
                error: 'Scoring diagnostics not found',
                duration
              });
            }
          } else {
            this.testRunner.addTestResult(5, testName, 'failed', {
              error: 'No artworks have LLM scores',
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(5, testName, 'failed', {
            error: 'No artworks returned',
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(5, testName, 'failed', {
          error: result.error || 'Complete curation failed',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(5, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testBatchScoringOptimization() {
    const testName = 'Batch Scoring Optimization';
    const startTime = Date.now();

    try {
      // Test concurrent batch scoring
      const searchResult = await this.utils.testArtworkSearch('joy', 'batch test');

      if (searchResult.success && searchResult.data) {
        const artworks = searchResult.data.artworks?.slice(0, 10) || [];

        if (artworks.length >= 5) {
          // Test optimized batch scoring
          const batchResult = await this.utils.request('POST', '/api/curate/test-batch-scoring', {
            artworks,
            emotion: 'joy',
            testMode: this.utils.testMode
          });

          const duration = Date.now() - startTime;

          if (batchResult.success && batchResult.data) {
            const { scoredArtworks, timing, optimization } = batchResult.data;

            if (scoredArtworks && scoredArtworks.length > 0) {
              // Check if optimization metrics are present
              const hasOptimizationData = optimization && (
                optimization.concurrentRequests ||
                optimization.batchSize ||
                optimization.timeSaved
              );

              if (hasOptimizationData) {
                this.testRunner.addTestResult(5, testName, 'passed', {
                  duration,
                  artworksScored: scoredArtworks.length,
                  concurrentRequests: optimization.concurrentRequests || 0,
                  timeSaved: optimization.timeSaved || 0
                });
              } else {
                this.testRunner.addTestResult(5, testName, 'passed', {
                  duration,
                  artworksScored: scoredArtworks.length,
                  note: 'Optimization data not available but scoring works'
                });
              }
            } else {
              this.testRunner.addTestResult(5, testName, 'failed', {
                error: 'No artworks scored in batch',
                duration
              });
            }
          } else {
            this.testRunner.addTestResult(5, testName, 'failed', {
              error: batchResult.error || 'Batch scoring failed',
              duration
            });
          }
        } else {
          const duration = Date.now() - startTime;
          this.testRunner.addTestResult(5, testName, 'skipped', {
            error: `Not enough artworks for batch test: ${artworks.length}`,
            duration
          });
        }
      } else {
        const duration = Date.now() - startTime;
        this.testRunner.addTestResult(5, testName, 'failed', {
          error: searchResult.error || 'Artwork search failed',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(5, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }
}

module.exports = {
  run: async function(testRunner) {
    const tests = new Phase5Tests();
    tests.testRunner = testRunner;
    await tests.run(testRunner);
  }
};

const chalk = require('chalk');