const axios = require('axios');
const path = require('path');
const fs = require('fs');

class TestUtils {
  constructor(testRunner) {
    this.testRunner = testRunner;
    this.apiUrl = testRunner.apiUrl;
    this.testMode = testRunner.testMode;
  }

  // Helper for HTTP requests
  async request(method, endpoint, data = null, headers = {}) {
    const url = `${this.apiUrl}${endpoint}`;

    try {
      const config = {
        method,
        url,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (data) {
        config.data = data;
      }

      const startTime = Date.now();
      const response = await axios(config);
      const duration = Date.now() - startTime;

      return {
        success: true,
        data: response.data,
        status: response.status,
        duration
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      };
    }
  }

  // Test specific emotion inputs
  getTestEmotions() {
    return [
      {
        emotion: 'joy',
        userInput: 'I want to feel happy and energetic',
        expectedKeywords: ['happiness', 'celebration', 'vibrant', 'lively']
      },
      {
        emotion: 'melancholy',
        userInput: 'I need something introspective and quiet',
        expectedKeywords: ['introspection', 'solitude', 'contemplation', 'quiet']
      },
      {
        emotion: 'calm',
        userInput: 'Peaceful and serene artwork',
        expectedKeywords: ['peace', 'serenity', 'tranquility', 'harmony']
      },
      {
        emotion: 'passion',
        userInput: 'Intense and dramatic pieces',
        expectedKeywords: ['intensity', 'drama', 'emotion', 'power']
      },
      {
        emotion: 'lonely',
        userInput: 'Solitary and contemplative works',
        expectedKeywords: ['solitude', 'isolation', 'contemplation', 'alone']
      }
    ];
  }

  // Test API health check
  async healthCheck() {
    const result = await this.request('GET', '/api/curate/health');
    return result.success && result.status === 200;
  }

  // Test search plan building
  async testSearchPlan(emotion, userInput) {
    const payload = {
      emotion,
      userInput,
      testMode: this.testMode
    };

    const result = await this.request('POST', '/api/curate/test-search-plan', payload);
    return result;
  }

  // Test artwork search
  async testArtworkSearch(emotion, userInput) {
    const payload = {
      emotion,
      userInput,
      testMode: this.testMode
    };

    const result = await this.request('POST', '/api/curate/test-search', payload);
    return result;
  }

  // Test LLM scoring
  async testLLMScoring(artworks, emotion) {
    const payload = {
      artworks,
      emotion,
      testMode: this.testMode
    };

    const result = await this.request('POST', '/api/curate/test-scoring', payload);
    return result;
  }

  // Test emotion curve generation
  async testEmotionCurve(emotion, artworks) {
    const payload = {
      emotion,
      artworks,
      testMode: this.testMode
    };

    const result = await this.request('POST', '/api/curate/test-emotion-curve', payload);
    return result;
  }

  // Test artwork selection
  async testArtworkSelection(artworks, emotion, count = 9) {
    const payload = {
      artworks,
      emotion,
      count,
      testMode: this.testMode
    };

    const result = await this.request('POST', '/api/curate/test-selection', payload);
    return result;
  }

  // Test complete curation flow
  async testCompleteCuration(emotion, userInput) {
    const payload = {
      emotion,
      userInput,
      testMode: this.testMode
    };

    const startTime = Date.now();
    const result = await this.request('POST', '/api/curate', payload);
    const duration = Date.now() - startTime;

    return {
      ...result,
      duration
    };
  }

  // Performance testing
  async runPerformanceTest(testName, testFunction, iterations = 10) {
    const results = [];
    let totalTime = 0;

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      try {
        const result = await testFunction();
        const duration = Date.now() - startTime;
        results.push({ success: true, duration, result });
        totalTime += duration;
      } catch (error) {
        const duration = Date.now() - startTime;
        results.push({ success: false, duration, error: error.message });
        totalTime += duration;
      }
    }

    const successRate = (results.filter(r => r.success).length / results.length) * 100;
    const avgDuration = totalTime / results.length;

    return {
      testName,
      iterations,
      successRate,
      avgDuration,
      totalTime,
      results
    };
  }

  // Validate search plan structure
  validateSearchPlan(plan) {
    const required = ['keywords', 'filters', 'sources'];
    const missing = required.filter(field => !plan[field]);

    if (missing.length > 0) {
      return {
        valid: false,
        error: `Missing required fields: ${missing.join(', ')}`
      };
    }

    if (!Array.isArray(plan.keywords) || plan.keywords.length === 0) {
      return {
        valid: false,
        error: 'Keywords must be a non-empty array'
      };
    }

    if (!plan.filters || typeof plan.filters !== 'object') {
      return {
        valid: false,
        error: 'Filters must be an object'
      };
    }

    return {
      valid: true
    };
  }

  // Validate artwork structure
  validateArtwork(artwork) {
    const required = ['id', 'title', 'artist', 'source'];
    const missing = required.filter(field => !artwork[field]);

    if (missing.length > 0) {
      return {
        valid: false,
        error: `Missing required fields: ${missing.join(', ')}`
      };
    }

    return {
      valid: true
    };
  }

  // Generate test report
  generateTestReport(phase, results) {
    const report = {
      phase,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'skipped').length
      }
    };

    const reportPath = path.join(__dirname, `phase${phase}-report.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return reportPath;
  }
}

module.exports = TestUtils;