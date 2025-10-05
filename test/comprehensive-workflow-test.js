#!/usr/bin/env node

/**
 * Comprehensive ArtDuo Workflow Test
 *
 * This test script thoroughly validates the entire ArtDuo curation workflow from start to finish.
 * It tests the /api/curate/stream endpoint with various emotions, inputs, and scenarios.
 *
 * Features:
 * - Tests both GET and POST methods
 * - Comprehensive performance measurement for each workflow step
 * - Detailed logging and error handling
 * - Quality validation for generated outputs
 * - Multiple test scenarios with different emotions and inputs
 * - Generates comprehensive reports
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Configuration
const CONFIG = {
  baseUrl: 'http://localhost:3000',
  endpoint: '/api/curate/stream',
  testResultsDir: './test-results',
  logLevel: process.env.LOG_LEVEL || 'info',
  timeout: 300000, // 5 minutes timeout per test
  retryAttempts: 2,
  retryDelay: 1000
};

// Test scenarios
const TEST_SCENARIOS = [
  {
    name: 'Simple Emotion - Joy',
    description: 'Basic workflow with simple positive emotion',
    emotion: 'joy',
    userInput: '',
    method: 'POST',
    expectedEvents: ['start', 'emotion_curve', 'artworks_selected', 'introduction', 'conclusion', 'explanations_batch', 'complete'],
    performanceThresholds: {
      totalDuration: 120000, // 2 minutes
      planDuration: 30000,   // 30 seconds
      searchDuration: 45000, // 45 seconds
      scoringDuration: 60000 // 60 seconds
    }
  },
  {
    name: 'Complex Emotion with User Input',
    description: 'Workflow with detailed user requirements',
    emotion: 'nostalgia',
    userInput: '我想要寻找一些关于童年回忆和温暖家庭时光的艺术作品，希望能感受到那种纯真和怀旧的情感',
    method: 'POST',
    expectedEvents: ['start', 'emotion_curve', 'artworks_selected', 'introduction', 'conclusion', 'explanations_batch', 'complete'],
    performanceThresholds: {
      totalDuration: 150000,
      planDuration: 35000,
      searchDuration: 50000,
      scoringDuration: 70000
    }
  },
  {
    name: 'Negative Emotion Processing',
    description: 'Testing workflow with complex negative emotion',
    emotion: 'melancholy',
    userInput: '寻找一些能够表达内心深处忧伤和思考的作品',
    method: 'POST',
    expectedEvents: ['start', 'emotion_curve', 'artworks_selected', 'introduction', 'conclusion', 'explanations_batch', 'complete'],
    performanceThresholds: {
      totalDuration: 140000,
      planDuration: 32000,
      searchDuration: 48000,
      scoringDuration: 65000
    }
  },
  {
    name: 'GET Method Test',
    description: 'Testing GET method with query parameters',
    emotion: 'peace',
    userInput: '宁静祥和的作品',
    method: 'GET',
    expectedEvents: ['start', 'emotion_curve', 'artworks_selected', 'introduction', 'conclusion', 'explanations_batch', 'complete'],
    performanceThresholds: {
      totalDuration: 120000,
      planDuration: 30000,
      searchDuration: 45000,
      scoringDuration: 60000
    }
  },
  {
    name: 'Minimal Input Test',
    description: 'Testing with minimal emotion input',
    emotion: 'calm',
    userInput: '',
    method: 'POST',
    expectedEvents: ['start', 'emotion_curve', 'artworks_selected', 'introduction', 'conclusion', 'explanations_batch', 'complete'],
    performanceThresholds: {
      totalDuration: 100000,
      planDuration: 25000,
      searchDuration: 40000,
      scoringDuration: 50000
    }
  }
];

// Error scenarios
const ERROR_SCENARIOS = [
  {
    name: 'Missing Emotion',
    description: 'Test error handling when emotion is missing',
    emotion: '',
    userInput: 'Some input',
    method: 'POST',
    expectedError: 'Missing required field: emotion'
  },
  {
    name: 'Empty Request Body',
    description: 'Test error handling with empty request',
    emotion: null,
    userInput: null,
    method: 'POST',
    expectedError: 'Missing required field: emotion'
  },
  {
    name: 'GET without Emotion',
    description: 'Test GET method without emotion parameter',
    emotion: '',
    userInput: '',
    method: 'GET',
    expectedError: 'Missing required field: emotion'
  }
];

// Logger utility
class Logger {
  constructor(level = 'info') {
    this.level = level;
    this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
  }

  log(level, message, data = null) {
    if (this.levels[level] >= this.levels[this.level]) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level: level.toUpperCase(),
        message,
        ...(data && { data })
      };

      if (level === 'error') {
        console.error(`[${timestamp}] ${level.toUpperCase()}: ${message}`, data || '');
      } else if (level === 'warn') {
        console.warn(`[${timestamp}] ${level.toUpperCase()}: ${message}`, data || '');
      } else {
        console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, data || '');
      }

      return logEntry;
    }
  }

  debug(message, data) { return this.log('debug', message, data); }
  info(message, data) { return this.log('info', message, data); }
  warn(message, data) { return this.log('warn', message, data); }
  error(message, data) { return this.log('error', message, data); }
}

// Performance tracker
class PerformanceTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.startTime = null;
    this.events = [];
    this.timings = {};
  }

  start() {
    this.startTime = Date.now();
    this.addEvent('test_start', { timestamp: this.startTime });
  }

  addEvent(eventType, data = {}) {
    const timestamp = Date.now();
    const elapsed = this.startTime ? timestamp - this.startTime : 0;

    const event = {
      type: eventType,
      timestamp,
      elapsed,
      ...data
    };

    this.events.push(event);
    this.debug && console.log(`📍 Event: ${eventType} (${elapsed}ms)`, data);
    return event;
  }

  markTiming(name, duration) {
    this.timings[name] = duration;
    this.addEvent('timing_marked', { name, duration });
  }

  getTotalDuration() {
    return this.startTime ? Date.now() - this.startTime : 0;
  }

  getSummary() {
    return {
      totalDuration: this.getTotalDuration(),
      eventCount: this.events.length,
      timings: this.timings,
      events: this.events
    };
  }
}

// SSE Stream Parser
class SSEStreamParser {
  constructor() {
    this.buffer = '';
    this.events = [];
    this.debug = false;
  }

  parseChunk(chunk) {
    this.buffer += chunk.toString();
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          this.events.push({
            ...data,
            timestamp: Date.now()
          });

          this.debug && console.log('📨 SSE Event:', data.type);
        } catch (error) {
          console.warn('Failed to parse SSE data:', line, error.message);
        }
      }
    }

    return this.events;
  }

  getEvents() {
    return this.events;
  }

  getEventCounts() {
    const counts = {};
    for (const event of this.events) {
      counts[event.type] = (counts[event.type] || 0) + 1;
    }
    return counts;
  }

  reset() {
    this.buffer = '';
    this.events = [];
  }
}

// HTTP Client utility
class HttpClient {
  constructor(baseUrl = CONFIG.baseUrl) {
    this.baseUrl = baseUrl;
  }

  async request(method, endpoint, data = null, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.baseUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const requestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...options.headers
        },
        timeout: options.timeout || CONFIG.timeout
      };

      const req = httpModule.request(requestOptions, (res) => {
        let response = {
          statusCode: res.statusCode,
          headers: res.headers,
          body: '',
          events: []
        };

        const parser = new SSEStreamParser();

        res.on('data', (chunk) => {
          if (res.headers['content-type']?.includes('text/event-stream')) {
            const events = parser.parseChunk(chunk);
            response.events.push(...events);
          } else {
            response.body += chunk.toString();
          }
        });

        res.on('end', () => {
          response.events = parser.getEvents();
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${response.body}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (data && method !== 'GET') {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  async get(endpoint, params = {}, options = {}) {
    const url = new URL(endpoint, this.baseUrl);
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key]);
      }
    });

    return this.request('GET', url.toString(), null, options);
  }

  async post(endpoint, data = {}, options = {}) {
    return this.request('POST', endpoint, data, options);
  }
}

// Test Result Validator
class TestValidator {
  static validateWorkflow(events, scenario) {
    const results = {
      passed: true,
      issues: [],
      scores: {},
      details: {}
    };

    // Check if all expected events were received
    if (scenario.expectedEvents) {
      const eventCounts = {};
      events.forEach(event => {
        eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
      });

      scenario.expectedEvents.forEach(expectedEvent => {
        if (!eventCounts[expectedEvent]) {
          results.passed = false;
          results.issues.push(`Missing expected event: ${expectedEvent}`);
        }
      });

      results.details.eventCounts = eventCounts;
    }

    // Validate event sequence and content
    const startEvent = events.find(e => e.type === 'start');
    if (!startEvent) {
      results.passed = false;
      results.issues.push('Missing start event');
    } else {
      // Validate start event content
      if (!startEvent.payload?.emotion) {
        results.passed = false;
        results.issues.push('Start event missing emotion');
      }
    }

    // Validate emotion curve
    const emotionCurveEvent = events.find(e => e.type === 'emotion_curve');
    if (emotionCurveEvent) {
      const curve = emotionCurveEvent.payload?.curve;
      if (!Array.isArray(curve) || curve.length === 0) {
        results.passed = false;
        results.issues.push('Invalid emotion curve data');
      } else {
        results.scores.emotionCurveQuality = this.validateEmotionCurve(curve);
      }
    }

    // Validate artwork selection
    const artworkEvent = events.find(e => e.type === 'artworks_selected');
    if (artworkEvent) {
      const artworks = artworkEvent.payload?.artworks;
      if (!Array.isArray(artworks) || artworks.length === 0) {
        results.passed = false;
        results.issues.push('No artworks selected');
      } else {
        results.scores.artworkQuality = this.validateArtworks(artworks);
      }
    }

    // Validate explanations
    const explanationEvents = events.filter(e => e.type === 'explanations_batch');
    if (explanationEvents.length > 0) {
      const totalExplanations = explanationEvents.reduce((sum, event) => {
        return sum + (event.payload?.explanations?.length || 0);
      }, 0);

      if (totalExplanations === 0) {
        results.passed = false;
        results.issues.push('No artwork explanations generated');
      } else {
        results.scores.explanationQuality = this.validateExplanations(explanationEvents);
      }
    }

    // Validate completion
    const completeEvent = events.find(e => e.type === 'complete');
    if (!completeEvent) {
      results.passed = false;
      results.issues.push('Workflow did not complete');
    }

    return results;
  }

  static validateEmotionCurve(curve) {
    let score = 100;

    // Check if curve has reasonable values
    if (curve.some(value => value < 0 || value > 1)) {
      score -= 20;
    }

    // Check curve length (should have at least 3 points)
    if (curve.length < 3) {
      score -= 10;
    }

    // Check for variety in values
    const uniqueValues = new Set(curve);
    if (uniqueValues.size < 2) {
      score -= 15;
    }

    return Math.max(0, score);
  }

  static validateArtworks(artworks) {
    let score = 100;
    const requiredFields = ['id', 'title', 'artist', 'year', 'medium'];

    artworks.forEach(artwork => {
      requiredFields.forEach(field => {
        if (!artwork[field]) {
          score -= 5;
        }
      });
    });

    // Check for variety in artists
    const artists = new Set(artworks.map(a => a.artist));
    if (artists.size < Math.min(3, artworks.length)) {
      score -= 10;
    }

    return Math.max(0, score);
  }

  static validateExplanations(explanationEvents) {
    let score = 100;
    let totalExplanations = 0;
    let validExplanations = 0;

    explanationEvents.forEach(event => {
      const explanations = event.payload?.explanations || [];
      totalExplanations += explanations.length;

      explanations.forEach(explanation => {
        if (explanation.introduction && explanation.introduction.length > 20) {
          validExplanations++;
        }
        if (explanation.detail && explanation.detail.length > 50) {
          validExplanations++;
        }
      });
    });

    if (totalExplanations === 0) {
      score = 0;
    } else {
      score = Math.floor((validExplanations / (totalExplanations * 2)) * 100);
    }

    return score;
  }
}

// Main Test Runner
class ComprehensiveWorkflowTest {
  constructor() {
    this.logger = new Logger(CONFIG.logLevel);
    this.httpClient = new HttpClient();
    this.results = {
      startTime: new Date().toISOString(),
      scenarios: [],
      errorScenarios: [],
      summary: {}
    };
  }

  async runAllTests() {
    this.logger.info('🚀 Starting Comprehensive ArtDuo Workflow Tests');

    try {
      // Ensure test results directory exists
      if (!fs.existsSync(CONFIG.testResultsDir)) {
        fs.mkdirSync(CONFIG.testResultsDir, { recursive: true });
      }

      // Run main test scenarios
      this.logger.info(`\n📋 Running ${TEST_SCENARIOS.length} main test scenarios`);
      for (let i = 0; i < TEST_SCENARIOS.length; i++) {
        const scenario = TEST_SCENARIOS[i];
        this.logger.info(`\n${i + 1}/${TEST_SCENARIOS.length}: ${scenario.name}`);
        await this.runTestScenario(scenario);
      }

      // Run error scenarios
      this.logger.info(`\n❌ Running ${ERROR_SCENARIOS.length} error scenarios`);
      for (let i = 0; i < ERROR_SCENARIOS.length; i++) {
        const scenario = ERROR_SCENARIOS[i];
        this.logger.info(`\n${i + 1}/${ERROR_SCENARIOS.length}: ${scenario.name}`);
        await this.runErrorScenario(scenario);
      }

      // Generate comprehensive report
      await this.generateReport();

      this.logger.info('\n✅ All tests completed successfully!');
      return this.results;

    } catch (error) {
      this.logger.error('❌ Test suite failed:', error);
      throw error;
    }
  }

  async runTestScenario(scenario) {
    const tracker = new PerformanceTracker();
    const result = {
      ...scenario,
      startTime: new Date().toISOString(),
      passed: false,
      performance: {},
      validation: {},
      events: [],
      error: null
    };

    try {
      tracker.start();
      this.logger.debug('Starting scenario:', scenario.name);

      // Make request based on method
      let response;
      if (scenario.method === 'GET') {
        const params = { emotion: scenario.emotion };
        if (scenario.userInput) params.userInput = scenario.userInput;
        response = await this.httpClient.get(CONFIG.endpoint, params);
      } else {
        response = await this.httpClient.post(CONFIG.endpoint, {
          emotion: scenario.emotion,
          userInput: scenario.userInput
        });
      }

      tracker.addEvent('response_received', {
        statusCode: response.statusCode,
        eventCount: response.events.length
      });

      result.events = response.events;

      // Analyze events and extract performance data
      const performanceAnalysis = this.analyzePerformance(response.events, tracker);
      result.performance = performanceAnalysis;

      // Validate workflow results
      const validation = TestValidator.validateWorkflow(response.events, scenario);
      result.validation = validation;
      result.passed = validation.passed && this.checkPerformanceThresholds(performanceAnalysis, scenario);

      this.logger.info(`${result.passed ? '✅' : '❌'} ${scenario.name} - ${performanceAnalysis.totalDuration}ms`);

    } catch (error) {
      result.error = {
        message: error.message,
        stack: error.stack
      };
      result.passed = false;
      this.logger.error(`❌ ${scenario.name} failed:`, error.message);
    }

    result.endTime = new Date().toISOString();
    result.totalDuration = tracker.getTotalDuration();

    this.results.scenarios.push(result);
    return result;
  }

  async runErrorScenario(scenario) {
    const result = {
      ...scenario,
      startTime: new Date().toISOString(),
      passed: false,
      error: null,
      receivedError: null
    };

    try {
      let response;
      if (scenario.method === 'GET') {
        response = await this.httpClient.get(CONFIG.endpoint, {
          emotion: scenario.emotion,
          userInput: scenario.userInput
        });
      } else {
        response = await this.httpClient.post(CONFIG.endpoint, {
          emotion: scenario.emotion,
          userInput: scenario.userInput
        });
      }

      // If we got a successful response when expecting an error
      result.receivedError = 'Expected error but got successful response';
      result.passed = false;

    } catch (error) {
      result.receivedError = error.message;
      result.passed = error.message.includes(scenario.expectedError) ||
                      scenario.expectedError.includes(error.message);
    }

    result.endTime = new Date().toISOString();
    this.results.errorScenarios.push(result);

    this.logger.info(`${result.passed ? '✅' : '❌'} ${scenario.name}`);

    return result;
  }

  analyzePerformance(events, tracker) {
    const performance = {
      totalDuration: tracker.getTotalDuration(),
      steps: {},
      eventTiming: {}
    };

    // Extract timing information from events
    events.forEach(event => {
      if (event.payload?.durationMs) {
        switch (event.type) {
          case 'emotion_curve':
            performance.steps.emotionCurve = event.payload.durationMs;
            break;
          case 'artworks_selected':
            performance.steps.artworkSelection = event.payload.durationMs;
            break;
          case 'introduction':
            performance.steps.introduction = event.payload.durationMs;
            break;
          case 'conclusion':
            performance.steps.conclusion = event.payload.durationMs;
            break;
          case 'explanations_batch':
            if (!performance.steps.explanations) {
              performance.steps.explanations = [];
            }
            performance.steps.explanations.push({
              batchIndex: event.payload.batchIndex,
              duration: event.payload.durationMs,
              count: event.payload.batchSize
            });
            break;
        }
      }

      // Track event timing
      if (!performance.eventTiming[event.type]) {
        performance.eventTiming[event.type] = [];
      }
      performance.eventTiming[event.type].push(event.timestamp - events[0].timestamp);
    });

    // Calculate total explanation time
    if (performance.steps.explanations) {
      performance.steps.totalExplanationTime = performance.steps.explanations
        .reduce((sum, exp) => sum + exp.duration, 0);
    }

    return performance;
  }

  checkPerformanceThresholds(performance, scenario) {
    if (!scenario.performanceThresholds) return true;

    const thresholds = scenario.performanceThresholds;
    let passed = true;

    if (thresholds.totalDuration && performance.totalDuration > thresholds.totalDuration) {
      this.logger.warn(`Total duration exceeded threshold: ${performance.totalDuration}ms > ${thresholds.totalDuration}ms`);
      passed = false;
    }

    // Could add more specific threshold checks here
    return passed;
  }

  async generateReport() {
    const summary = this.generateSummary();
    this.results.summary = summary;

    const reportData = {
      ...this.results,
      summary,
      config: CONFIG,
      generatedAt: new Date().toISOString()
    };

    // Save detailed JSON report
    const jsonReportPath = path.join(CONFIG.testResultsDir, `workflow-test-report-${Date.now()}.json`);
    fs.writeFileSync(jsonReportPath, JSON.stringify(reportData, null, 2));

    // Save markdown report
    const markdownReportPath = path.join(CONFIG.testResultsDir, `workflow-test-report-${Date.now()}.md`);
    const markdownReport = this.generateMarkdownReport(reportData);
    fs.writeFileSync(markdownReportPath, markdownReport);

    this.logger.info(`\n📊 Reports generated:`);
    this.logger.info(`  JSON: ${jsonReportPath}`);
    this.logger.info(`  Markdown: ${markdownReportPath}`);

    // Print summary to console
    this.printSummary(summary);
  }

  generateSummary() {
    const totalScenarios = this.results.scenarios.length;
    const passedScenarios = this.results.scenarios.filter(s => s.passed).length;
    const totalErrorScenarios = this.results.errorScenarios.length;
    const passedErrorScenarios = this.results.errorScenarios.filter(s => s.passed).length;

    const performanceStats = this.calculatePerformanceStats();
    const qualityScores = this.calculateQualityScores();

    return {
      totalTests: totalScenarios + totalErrorScenarios,
      passedTests: passedScenarios + passedErrorScenarios,
      failedTests: (totalScenarios - passedScenarios) + (totalErrorScenarios - passedErrorScenarios),
      successRate: Math.round(((passedScenarios + passedErrorScenarios) / (totalScenarios + totalErrorScenarios)) * 100),
      performance: performanceStats,
      quality: qualityScores,
      testDuration: Date.now() - new Date(this.results.startTime).getTime()
    };
  }

  calculatePerformanceStats() {
    const durations = this.results.scenarios
      .filter(s => s.performance && s.performance.totalDuration)
      .map(s => s.performance.totalDuration);

    if (durations.length === 0) return null;

    return {
      averageDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalSamples: durations.length
    };
  }

  calculateQualityScores() {
    const validationResults = this.results.scenarios
      .filter(s => s.validation && s.validation.scores)
      .map(s => s.validation.scores);

    if (validationResults.length === 0) return null;

    const avgScores = {};
    const scoreTypes = ['emotionCurveQuality', 'artworkQuality', 'explanationQuality'];

    scoreTypes.forEach(type => {
      const scores = validationResults
        .map(v => v[type])
        .filter(s => s !== undefined);

      if (scores.length > 0) {
        avgScores[type] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      }
    });

    return avgScores;
  }

  generateMarkdownReport(data) {
    return `# ArtDuo Comprehensive Workflow Test Report

Generated: ${data.generatedAt}

## Executive Summary

- **Total Tests:** ${data.summary.totalTests}
- **Passed:** ${data.summary.passedTests}
- **Failed:** ${data.summary.failedTests}
- **Success Rate:** ${data.summary.successRate}%
- **Test Duration:** ${Math.round(data.summary.testDuration / 1000)}s

## Performance Overview

${data.summary.performance ? `
- **Average Duration:** ${data.summary.performance.averageDuration}ms
- **Min Duration:** ${data.summary.performance.minDuration}ms
- **Max Duration:** ${data.summary.performance.maxDuration}ms
` : 'No performance data available'}

## Quality Scores

${data.summary.quality ? Object.entries(data.summary.quality)
  .map(([key, value]) => `- **${key}:** ${value}%`)
  .join('\n') : 'No quality data available'}

## Test Scenario Results

### Main Scenarios

| Scenario | Status | Duration | Issues |
|----------|--------|----------|---------|
${data.scenarios.map(s =>
  `| ${s.name} | ${s.passed ? '✅' : '❌'} | ${s.performance?.totalDuration || 'N/A'}ms | ${s.validation?.issues?.length || 0} issues |`
).join('\n')}

### Error Scenarios

| Scenario | Status | Expected Error | Received Error |
|----------|--------|----------------|----------------|
${data.errorScenarios.map(s =>
  `| ${s.name} | ${s.passed ? '✅' : '❌'} | ${s.expectedError || 'N/A'} | ${s.receivedError || 'N/A'} |`
).join('\n')}

## Detailed Results

<details>
<summary>Click to expand detailed test results</summary>

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`

</details>

## Recommendations

${this.generateRecommendations(data)}
`;
  }

  generateRecommendations(data) {
    const recommendations = [];

    // Performance recommendations
    if (data.summary.performance) {
      if (data.summary.performance.averageDuration > 120000) {
        recommendations.push('- Consider optimizing workflow to reduce average duration below 2 minutes');
      }
      if (data.summary.performance.maxDuration > 180000) {
        recommendations.push('- Investigate scenarios with unusually high duration');
      }
    }

    // Quality recommendations
    if (data.summary.quality) {
      Object.entries(data.summary.quality).forEach(([metric, score]) => {
        if (score < 80) {
          recommendations.push(`- Improve ${metric} (current: ${score}%)`);
        }
      });
    }

    // Failure recommendations
    const failedScenarios = data.scenarios.filter(s => !s.passed);
    if (failedScenarios.length > 0) {
      recommendations.push(`- Address ${failedScenarios.length} failing test scenarios`);
    }

    return recommendations.length > 0
      ? recommendations.join('\n')
      : '- All tests passed! System is performing as expected.';
  }

  printSummary(summary) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 COMPREHENSIVE TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests:    ${summary.totalTests}`);
    console.log(`Passed:         ${summary.passedTests}`);
    console.log(`Failed:         ${summary.failedTests}`);
    console.log(`Success Rate:   ${summary.successRate}%`);
    console.log(`Test Duration:  ${Math.round(summary.testDuration / 1000)}s`);

    if (summary.performance) {
      console.log('\n📈 Performance:');
      console.log(`  Average: ${summary.performance.averageDuration}ms`);
      console.log(`  Range:   ${summary.performance.minDuration}-${summary.performance.maxDuration}ms`);
    }

    if (summary.quality) {
      console.log('\n🎯 Quality Scores:');
      Object.entries(summary.quality).forEach(([metric, score]) => {
        console.log(`  ${metric}: ${score}%`);
      });
    }

    console.log('='.repeat(60));
  }
}

// Main execution
async function main() {
  const testRunner = new ComprehensiveWorkflowTest();

  try {
    const results = await testRunner.runAllTests();

    // Exit with appropriate code
    const exitCode = results.summary.failedTests > 0 ? 1 : 0;
    process.exit(exitCode);

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  ComprehensiveWorkflowTest,
  TestValidator,
  HttpClient,
  SSEStreamParser,
  PerformanceTracker,
  CONFIG,
  TEST_SCENARIOS,
  ERROR_SCENARIOS
};