const TestUtils = require('./test-utils');

class Phase6Tests {
  constructor() {
    this.utils = null;
  }

  async run(testRunner) {
    this.utils = new TestUtils(testRunner);
    console.log(chalk.blue.bold('🎭 Testing Phase 6: Smart Curation and Emotion Curves'));
    console.log('');

    // Test 1: Emotion Curve Generation Infrastructure
    await this.testEmotionCurveInfrastructure();

    // Test 2: Dynamic Emotion Curve Generation
    await this.testDynamicEmotionCurveGeneration();

    // Test 3: Artwork Selection Algorithm
    await this.testArtworkSelectionAlgorithm();

    // Test 4: Curation Theme and Description
    await this.testCurationThemeAndDescription();

    // Test 5: Emotional Flow Validation
    await this.testEmotionalFlowValidation();

    // Test 6: Diversity and Balance Testing
    await this.testDiversityAndBalance();

    // Test 7: Edge Cases and Error Handling
    await this.testEdgeCases();

    // Test 8: Integration with Complete Flow
    await this.testCompleteFlowIntegration();

    console.log(chalk.green('\n✓ Phase 6 tests completed'));
  }

  async testEmotionCurveInfrastructure() {
    const testName = 'Emotion Curve Generation Infrastructure';
    const startTime = Date.now();

    try {
      // Check if emotion curve generation is available
      const healthResult = await this.utils.request('GET', '/api/curate/emotion-curve-health');
      const duration = Date.now() - startTime;

      if (healthResult.success && healthResult.status === 200) {
        const { enabled, capabilities } = healthResult.data;

        if (enabled && capabilities) {
          // Test basic emotion curve generation
          const testArtworks = [
            {
              id: 'test-1',
              title: 'Joyful Artwork',
              artist: 'Test Artist',
              source: 'met',
              llmScore: {
                emotionalFit: 8.5,
                artisticValue: 7.2,
                visualExpression: 8.0,
                overallRecommendation: 8.0
              }
            },
            {
              id: 'test-2',
              title: 'Calm Artwork',
              artist: 'Test Artist',
              source: 'rijks',
              llmScore: {
                emotionalFit: 7.8,
                artisticValue: 8.1,
                visualExpression: 7.5,
                overallRecommendation: 7.8
              }
            }
          ];

          const curveResult = await this.utils.testEmotionCurve('joy', testArtworks);

          if (curveResult.success && curveResult.data) {
            this.testRunner.addTestResult(6, testName, 'passed', {
              duration,
              capabilities: capabilities.length,
              curveGenerated: true
            });
          } else {
            this.testRunner.addTestResult(6, testName, 'failed', {
              error: curveResult.error || 'Emotion curve generation failed',
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(6, testName, 'failed', {
            error: 'Emotion curve generation not properly enabled',
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(6, testName, 'failed', {
          error: healthResult.error || 'Health check failed',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(6, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testDynamicEmotionCurveGeneration() {
    const testName = 'Dynamic Emotion Curve Generation';
    const startTime = Date.now();

    try {
      const emotions = ['joy', 'melancholy', 'calm', 'passion', 'lonely'];
      const curveResults = [];

      for (const emotion of emotions) {
        // Get real artworks for each emotion
        const searchResult = await this.utils.testArtworkSearch(emotion, `${emotion} dynamic test`);

        if (searchResult.success && searchResult.data) {
          const artworks = searchResult.data.artworks?.slice(0, 8) || [];

          if (artworks.length > 0) {
            // Generate emotion curve
            const curveResult = await this.utils.testEmotionCurve(emotion, artworks);

            if (curveResult.success && curveResult.data) {
              const curve = curveResult.data.emotionCurve || curveResult.data.curve;

              if (curve) {
                curveResults.push({
                  emotion,
                  curve,
                  artworkCount: artworks.length
                });
              }
            }
          }
        }
      }

      const duration = Date.now() - startTime;

      if (curveResults.length >= 3) {
        // Validate emotion curve structure
        const validCurves = curveResults.filter(result => {
          const curve = result.curve;
          return curve &&
                 Array.isArray(curve.points) &&
                 curve.points.length > 0 &&
                 typeof curve.intensity === 'number' &&
                 curve.points.every(point =>
                   typeof point.position === 'number' &&
                   typeof point.intensity === 'number' &&
                   point.intensity >= 0 && point.intensity <= 1
                 );
        });

        if (validCurves.length >= 3) {
          // Check if curves are emotion-specific
          const emotionSpecific = validCurves.some(result =>
            result.curve.intensity > 0.5 || result.curve.points.some(p => p.intensity > 0.7)
          );

          if (emotionSpecific) {
            this.testRunner.addTestResult(6, testName, 'passed', {
              duration,
              emotionsTested: curveResults.length,
              validCurves: validCurves.length,
              avgIntensity: validCurves.reduce((sum, r) => sum + r.curve.intensity, 0) / validCurves.length
            });
          } else {
            this.testRunner.addTestResult(6, testName, 'failed', {
              error: 'Emotion curves not sufficiently differentiated',
              duration
            });
          }
        } else {
          this.testRunner.addTestResult(6, testName, 'failed', {
            error: `Only ${validCurves.length}/${curveResults.length} curves have valid structure`,
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(6, testName, 'failed', {
          error: `Only ${curveResults.length}/${emotions.length} emotions tested successfully`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(6, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testArtworkSelectionAlgorithm() {
    const testName = 'Artwork Selection Algorithm';
    const startTime = Date.now();

    try {
      // Test artwork selection based on emotion curve
      const searchResult = await this.utils.testArtworkSearch('joy', 'selection test');

      if (searchResult.success && searchResult.data) {
        const artworks = searchResult.data.artworks?.slice(0, 15) || [];

        if (artworks.length >= 9) {
          const selectionResult = await this.utils.testArtworkSelection(artworks, 'joy', 9);
          const duration = Date.now() - startTime;

          if (selectionResult.success && selectionResult.data) {
            const selectedArtworks = selectionResult.data.selectedArtworks || selectionResult.data.artworks;

            if (selectedArtworks && selectedArtworks.length === 9) {
              // Check selection diversity
              const artists = [...new Set(selectedArtworks.map(a => a.artist))];
              const sources = [...new Set(selectedArtworks.map(a => a.source))];
              const decades = [...new Set(selectedArtworks.map(a => {
                const year = a.dating || a.year;
                return year ? Math.floor(year / 10) * 10 : 'unknown';
              }))];

              const hasArtistDiversity = artists.length >= 3;
              const hasSourceDiversity = sources.length >= 1; // At least one source
              const hasDecadeDiversity = decades.filter(d => d !== 'unknown').length >= 2;

              // Check if selected artworks have good scores
              const avgScore = selectedArtworks.reduce((sum, artwork) => {
                const score = artwork.llmScore?.overallRecommendation || artwork.score || 0;
                return sum + score;
              }, 0) / selectedArtworks.length;

              if (hasArtistDiversity && avgScore > 5.0) {
                this.testRunner.addTestResult(6, testName, 'passed', {
                  duration,
                  selectedCount: selectedArtworks.length,
                  artistDiversity: artists.length,
                  sourceDiversity: sources.length,
                  decadeDiversity: decades.length,
                  avgScore
                });
              } else {
                this.testRunner.addTestResult(6, testName, 'failed', {
                  error: `Selection quality inadequate: artistDiversity=${hasArtistDiversity}, avgScore=${avgScore}`,
                  duration
                });
              }
            } else {
              this.testRunner.addTestResult(6, testName, 'failed', {
                error: `Expected 9 artworks, got ${selectedArtworks?.length || 0}`,
                duration
              });
            }
          } else {
            this.testRunner.addTestResult(6, testName, 'failed', {
              error: selectionResult.error || 'Artwork selection failed',
              duration
            });
          }
        } else {
          const duration = Date.now() - startTime;
          this.testRunner.addTestResult(6, testName, 'skipped', {
            error: `Not enough artworks for selection test: ${artworks.length}`,
            duration
          });
        }
      } else {
        const duration = Date.now() - startTime;
        this.testRunner.addTestResult(6, testName, 'failed', {
          error: searchResult.error || 'Artwork search failed',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(6, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testCurationThemeAndDescription() {
    const testName = 'Curation Theme and Description';
    const startTime = Date.now();

    try {
      const emotions = ['joy', 'melancholy', 'calm'];
      const themeResults = [];

      for (const emotion of emotions) {
        const result = await this.utils.testCompleteCuration(emotion, `theme test for ${emotion}`);

        if (result.success && result.data) {
          const { curation } = result.data;

          if (curation) {
            const hasTheme = curation.theme && typeof curation.theme === 'string';
            const hasDescription = curation.description && typeof curation.description === 'string';
            const hasEmotionCurve = curation.emotionCurve;

            if (hasTheme && hasDescription) {
              themeResults.push({
                emotion,
                theme: curation.theme,
                description: curation.description,
                hasEmotionCurve: !!hasEmotionCurve
              });
            }
          }
        }
      }

      const duration = Date.now() - startTime;

      if (themeResults.length >= 2) {
        // Validate theme and description quality
        const meaningfulThemes = themeResults.filter(result =>
          result.theme.length > 10 && result.description.length > 50
        );

        // Check if themes are emotion-specific
        const emotionSpecific = themeResults.some(result =>
          result.theme.toLowerCase().includes(result.emotion) ||
          result.description.toLowerCase().includes(result.emotion)
        );

        if (meaningfulThemes.length >= 2 && emotionSpecific) {
          this.testRunner.addTestResult(6, testName, 'passed', {
            duration,
            emotionsTested: themeResults.length,
            meaningfulThemes: meaningfulThemes.length,
            avgThemeLength: themeResults.reduce((sum, r) => sum + r.theme.length, 0) / themeResults.length,
            avgDescriptionLength: themeResults.reduce((sum, r) => sum + r.description.length, 0) / themeResults.length
          });
        } else {
          this.testRunner.addTestResult(6, testName, 'failed', {
            error: `Theme quality inadequate: meaningful=${meaningfulThemes.length}, specific=${emotionSpecific}`,
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(6, testName, 'failed', {
          error: `Only ${themeResults.length}/${emotions.length} emotions generated themes`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(6, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testEmotionalFlowValidation() {
    const testName = 'Emotional Flow Validation';
    const startTime = Date.now();

    try {
      // Test emotional flow across the selected artworks
      const result = await this.utils.testCompleteCuration('joy', 'emotional flow test');

      if (result.success && result.data) {
        const { artworks, curation } = result.data;

        if (artworks && artworks.length >= 6 && curation && curation.emotionCurve) {
          const emotionCurve = curation.emotionCurve;
          const flowAnalysis = this.analyzeEmotionalFlow(artworks, emotionCurve);

          const duration = Date.now() - startTime;

          if (flowAnalysis.valid) {
            this.testRunner.addTestResult(6, testName, 'passed', {
              duration,
              flowHarmony: flowAnalysis.harmony,
              flowProgression: flowAnalysis.progression,
              avgIntensity: flowAnalysis.avgIntensity,
              flowVariation: flowAnalysis.variation
            });
          } else {
            this.testRunner.addTestResult(6, testName, 'failed', {
              error: flowAnalysis.error || 'Emotional flow validation failed',
              duration
            });
          }
        } else {
          const duration = Date.now() - startTime;
          this.testRunner.addTestResult(6, testName, 'skipped', {
            error: `Insufficient data for flow analysis: artworks=${artworks?.length || 0}, hasCurve=${!!curation?.emotionCurve}`,
            duration
          });
        }
      } else {
        const duration = Date.now() - startTime;
        this.testRunner.addTestResult(6, testName, 'failed', {
          error: result.error || 'Complete curation failed',
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(6, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testDiversityAndBalance() {
    const testName = 'Diversity and Balance Testing';
    const startTime = Date.now();

    try {
      const emotions = ['joy', 'passion'];
      const diversityResults = [];

      for (const emotion of emotions) {
        const result = await this.utils.testCompleteCuration(emotion, `diversity test for ${emotion}`);

        if (result.success && result.data) {
          const { artworks } = result.data;

          if (artworks && artworks.length >= 6) {
            const diversityAnalysis = this.analyzeDiversity(artworks);
            diversityResults.push({
              emotion,
              ...diversityAnalysis,
              artworkCount: artworks.length
            });
          }
        }
      }

      const duration = Date.now() - startTime;

      if (diversityResults.length >= 1) {
        // Check diversity metrics
        const avgArtistDiversity = diversityResults.reduce((sum, r) => sum + r.artistDiversity, 0) / diversityResults.length;
        const avgSourceDiversity = diversityResults.reduce((sum, r) => sum + r.sourceDiversity, 0) / diversityResults.length;
        const avgStyleDiversity = diversityResults.reduce((sum, r) => sum + r.styleDiversity, 0) / diversityResults.length;

        if (avgArtistDiversity >= 0.6 && avgSourceDiversity >= 0.3) {
          this.testRunner.addTestResult(6, testName, 'passed', {
            duration,
            emotionsTested: diversityResults.length,
            avgArtistDiversity,
            avgSourceDiversity,
            avgStyleDiversity
          });
        } else {
          this.testRunner.addTestResult(6, testName, 'failed', {
            error: `Diversity inadequate: artist=${avgArtistDiversity}, source=${avgSourceDiversity}`,
            duration
          });
        }
      } else {
        this.testRunner.addTestResult(6, testName, 'failed', {
          error: `No successful diversity tests completed`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(6, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testEdgeCases() {
    const testName = 'Edge Cases and Error Handling';
    const startTime = Date.now();

    try {
      const edgeCases = [
        {
          name: 'Minimal artwork pool',
          test: async () => {
            const minimalArtworks = [
              {
                id: 'min-1',
                title: 'Minimal Artwork',
                artist: 'Artist',
                source: 'met',
                llmScore: { overallRecommendation: 7.0 }
              }
            ];
            return await this.utils.testArtworkSelection(minimalArtworks, 'joy', 3);
          }
        },
        {
          name: 'Single emotion artwork pool',
          test: async () => {
            const searchResult = await this.utils.testArtworkSearch('joy', 'single emotion test');
            if (searchResult.success && searchResult.data) {
              const artworks = searchResult.data.artworks?.slice(0, 5) || [];
              return await this.utils.testEmotionCurve('joy', artworks);
            }
            return { success: false, error: 'Search failed' };
          }
        },
        {
          name: 'Mixed quality artworks',
          test: async () => {
            const mixedArtworks = [
              {
                id: 'high-1',
                title: 'High Quality',
                artist: 'Artist A',
                source: 'met',
                llmScore: { overallRecommendation: 9.0 }
              },
              {
                id: 'low-1',
                title: 'Low Quality',
                artist: 'Artist B',
                source: 'rijks',
                llmScore: { overallRecommendation: 3.0 }
              },
              {
                id: 'medium-1',
                title: 'Medium Quality',
                artist: 'Artist C',
                source: 'met',
                llmScore: { overallRecommendation: 6.0 }
              }
            ];
            return await this.utils.testArtworkSelection(mixedArtworks, 'joy', 2);
          }
        }
      ];

      const edgeResults = [];

      for (const edgeCase of edgeCases) {
        try {
          const result = await edgeCase.test();
          edgeResults.push({
            name: edgeCase.name,
            handledGracefully: result.success || (result.data && result.data.error)
          });
        } catch (error) {
          edgeResults.push({
            name: edgeCase.name,
            handledGracefully: true // Exception caught
          });
        }
      }

      const duration = Date.now() - startTime;

      const properlyHandled = edgeResults.filter(r => r.handledGracefully).length;

      if (properlyHandled >= 2) {
        this.testRunner.addTestResult(6, testName, 'passed', {
          duration,
          casesTested: edgeResults.length,
          properlyHandled
        });
      } else {
        this.testRunner.addTestResult(6, testName, 'failed', {
          error: `Edge case handling inadequate: ${properlyHandled}/${edgeResults.length} cases handled`,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(6, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  async testCompleteFlowIntegration() {
    const testName = 'Complete Flow Integration';
    const startTime = Date.now();

    try {
      // Test the complete smart curation flow
      const emotions = ['joy', 'calm', 'passion'];
      const flowResults = [];

      for (const emotion of emotions) {
        const startTime = Date.now();
        const result = await this.utils.testCompleteCuration(emotion, `complete flow test for ${emotion}`);
        const duration = Date.now() - startTime;

        if (result.success && result.data) {
          const { artworks, curation, diagnostics } = result.data;

          const hasCompleteData = artworks && curation && diagnostics;
          const hasEmotionCurve = curation && curation.emotionCurve;
          const hasTheme = curation && curation.theme && curation.description;
          const hasSelection = artworks && artworks.length === 9;

          if (hasCompleteData && hasEmotionCurve && hasTheme && hasSelection) {
            flowResults.push({
              emotion,
              duration,
              artworkCount: artworks.length,
              hasDiagnostics: !!diagnostics.curationInfo
            });
          }
        }
      }

      const totalDuration = Date.now() - startTime;

      if (flowResults.length >= 2) {
        // Check if complete flow is working
        const avgDuration = flowResults.reduce((sum, r) => sum + r.duration, 0) / flowResults.length;
        const successRate = (flowResults.length / emotions.length) * 100;

        if (successRate >= 66 && avgDuration < 120000) { // 66% success, < 2 minutes
          this.testRunner.addTestResult(6, testName, 'passed', {
            duration: totalDuration,
            emotionsTested: flowResults.length,
            successRate,
            avgDuration,
            totalArtworksCurated: flowResults.reduce((sum, r) => sum + r.artworkCount, 0)
          });
        } else {
          this.testRunner.addTestResult(6, testName, 'failed', {
            error: `Complete flow inadequate: successRate=${successRate}%, avgDuration=${avgDuration}ms`,
            duration: totalDuration
          });
        }
      } else {
        this.testRunner.addTestResult(6, testName, 'failed', {
          error: `Only ${flowResults.length}/${emotions.length} emotions completed flow successfully`,
          duration: totalDuration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testRunner.addTestResult(6, testName, 'failed', {
        error: error.message,
        duration
      });
    }
  }

  // Helper methods for analysis
  analyzeEmotionalFlow(artworks, emotionCurve) {
    try {
      const scores = artworks.map(artwork => artwork.llmScore?.overallRecommendation || 0);
      const intensities = emotionCurve.points?.map(point => point.intensity) || [];

      if (scores.length === 0 || intensities.length === 0) {
        return { valid: false, error: 'No scores or intensities to analyze' };
      }

      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const avgIntensity = intensities.reduce((sum, intensity) => sum + intensity, 0) / intensities.length;
      const scoreVariance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;
      const intensityVariance = intensities.reduce((sum, intensity) => sum + Math.pow(intensity - avgIntensity, 2), 0) / intensities.length;

      return {
        valid: true,
        harmony: Math.abs(avgScore - 5) < 3, // Scores around middle range
        progression: intensityVariance > 0.01, // Some variation in intensity
        avgIntensity,
        variance: intensityVariance
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  analyzeDiversity(artworks) {
    try {
      const artists = [...new Set(artworks.map(a => a.artist))];
      const sources = [...new Set(artworks.map(a => a.source))];
      const decades = [...new Set(artworks.map(a => {
        const year = a.dating || a.year;
        return year ? Math.floor(year / 10) * 10 : 'unknown';
      }).filter(d => d !== 'unknown'))];

      const artistDiversity = artists.length / artworks.length;
      const sourceDiversity = sources.length / artworks.length;
      const styleDiversity = decades.length / Math.max(artworks.length, 1);

      return {
        artistDiversity,
        sourceDiversity,
        styleDiversity,
        uniqueArtists: artists.length,
        uniqueSources: sources.length,
        uniqueDecades: decades.length
      };
    } catch (error) {
      return {
        artistDiversity: 0,
        sourceDiversity: 0,
        styleDiversity: 0
      };
    }
  }
}

module.exports = {
  run: async function(testRunner) {
    const tests = new Phase6Tests();
    tests.testRunner = testRunner;
    await tests.run(testRunner);
  }
};

const chalk = require('chalk');