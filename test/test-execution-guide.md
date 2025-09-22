# 🚀 ArtDuo Test Execution Guide

## Quick Start

### Prerequisites
- Node.js 16+ installed
- Development server running (if testing live APIs)
- Environment variables configured

### Basic Test Execution

```bash
# Navigate to test directory
cd test

# Install dependencies (if not already done)
npm install

# Run all phases
npm test

# Run specific phase
npm run test:phase1
npm run test:phase2
npm run test:phase3
npm run test:phase4
npm run test:phase5
npm run test:phase6
npm run test:phase7
npm run test:phase8

# Run performance tests
npm run test:performance

# Run with verbose output
node test-runner.js --verbose
```

## Detailed Test Commands

### Individual Phase Testing

```bash
# Phase 1: Intent Parsing
node test-runner.js --phase 1
node test-runner.js --phase 1 --verbose

# Phase 2: Met API Integration
node test-runner.js --phase 2
node test-runner.js --phase 2 --verbose

# Phase 3: Rijks API Integration
node test-runner.js --phase 3
node test-runner.js --phase 3 --verbose

# Phase 4: Concurrent API Calls
node test-runner.js --phase 4
node test-runner.js --phase 4 --verbose

# Phase 5: LLM Confidence Scoring
node test-runner.js --phase 5
node test-runner.js --phase 5 --verbose

# Phase 6: Smart Curation
node test-runner.js --phase 6
node test-runner.js --phase 6 --verbose

# Phase 7: Caching & Fallback
node test-runner.js --phase 7
node test-runner.js --phase 7 --verbose

# Phase 8: Monitoring & Performance
node test-runner.js --phase 8
node test-runner.js --phase 8 --verbose
```

### Advanced Options

```bash
# Run all phases
node test-runner.js --all

# Run performance tests only
node test-runner.js --performance

# Run with custom API URL
NEXT_PUBLIC_API_URL=http://localhost:3001 node test-runner.js --phase 1

# Run in mock mode (no real API calls)
TEST_MODE=mock node test-runner.js --all
```

## Test Environment Setup

### Environment Variables

Create a `.env` file in the test directory:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
TEST_MODE=mock  # or 'live'

# API Keys (if needed for live testing)
MET_API_BASE=https://collectionapi.metmuseum.org/public/collection/v1
RIJKS_API_KEY=your_api_key_here
```

### Development Server Setup

For live API testing, start the development server:

```bash
# Navigate to frontend directory
cd ../frontend

# Start development server
npm run dev

# Server should be running on http://localhost:3000
```

## Understanding Test Results

### Console Output

```
🎭 ArtDuo Test Suite - Phases 1-8
Test Phase: 1
Started: 2025-09-22T02:29:05.819Z

✓ Environment loaded
API URL: http://localhost:3000
Test Mode: mock

🧠 Testing Phase 1: Intent Parsing (LLM Analysis)

✓ Health Check - API availability
✓ Search Plan Building - joy emotion
✓ Search Plan Building - melancholy emotion
✓ Complex Input - joy with detailed context
✗ Edge Case - Missing emotion
✓ Search Plan Validation - Structure and content
✓ Deterministic Seed Generation
✓ Search Plan Output Format Compliance
✓ Performance - Search Plan Generation

✓ Phase 1 tests completed

📊 Test Results Summary
==================================================

Phase 1: 8/9 passed (89%)
  passed - Health Check - API availability
  passed - Search Plan Building - joy emotion
  passed - Search Plan Building - melancholy emotion
  passed - Complex Input - joy with detailed context
  failed - Edge Case - Missing emotion
  passed - Search Plan Validation - Structure and content
  passed - Deterministic Seed Generation
  passed - Search Plan Output Format Compliance
  passed - Performance - Search Plan Generation

==================================================
Total: 8/9 passed
Failed: 1
Skipped: 0
Duration: 2345ms
Success Rate: 89%

Detailed report saved to: test-results.json
```

### JSON Report Structure

The detailed JSON report (`test-results.json`) contains:

```json
{
  "timestamp": "2025-09-22T02:29:05.819Z",
  "duration": 2345,
  "total": 9,
  "passed": 8,
  "failed": 1,
  "skipped": 0,
  "phases": {
    "1": {
      "total": 9,
      "passed": 8,
      "failed": 1,
      "skipped": 0,
      "tests": [
        {
          "name": "Health Check - API availability",
          "status": "passed",
          "duration": 45,
          "timestamp": "2025-09-22T02:29:06.123Z"
        },
        {
          "name": "Edge Case - Missing emotion",
          "status": "failed",
          "error": "Expected error handling for invalid input",
          "duration": 23,
          "timestamp": "2025-09-22T02:29:06.456Z"
        }
      ]
    }
  }
}
```

## Troubleshooting

### Common Issues

#### 1. API Server Not Running
```
✗ Health Check - API availability
Error: connect ECONNREFUSED 127.0.0.1:3000
```

**Solution**: Start the development server
```bash
cd ../frontend
npm run dev
```

#### 2. Environment Variables Missing
```
✗ Environment loaded
Error: Missing required environment variables
```

**Solution**: Create a `.env` file with required variables

#### 3. Test Dependencies Missing
```
Error: Cannot find module 'chalk'
```

**Solution**: Install dependencies
```bash
cd test
npm install
```

#### 4. Timeout Errors
```
✗ Basic Search - joy emotion
Error: Request timeout after 5000ms
```

**Solution**:
- Check API server performance
- Increase timeout in test configuration
- Run in mock mode for faster testing

### Performance Issues

#### Slow Test Execution
- Use `TEST_MODE=mock` for faster testing
- Reduce concurrent request count
- Increase timeout values

#### Memory Usage
- Run phases individually instead of all at once
- Monitor system resources during testing

## Test Development Guide

### Adding New Tests

1. **Create Test Function**:
```javascript
async testNewFeature() {
  const testName = 'New Feature Test';
  const startTime = Date.now();

  try {
    const result = await this.utils.someTestMethod();
    const duration = Date.now() - startTime;

    if (result.success) {
      this.testRunner.addTestResult(1, testName, 'passed', { duration });
    } else {
      this.testRunner.addTestResult(1, testName, 'failed', {
        error: result.error,
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
```

2. **Add to Test Runner**:
```javascript
async run(testRunner) {
  this.utils = new TestUtils(testRunner);
  console.log(chalk.blue.bold('🧠 Testing Phase 1: Intent Parsing'));

  await this.testNewFeature();
  // ... other tests
}
```

### Best Practices

1. **Test Independence**: Each test should be self-contained
2. **Error Handling**: Always wrap tests in try-catch blocks
3. **Timing**: Measure and report test duration
4. **Validation**: Use comprehensive validation criteria
5. **Cleanup**: Clean up resources after tests
6. **Documentation**: Add clear comments explaining test logic

### Test Data Management

- **Mock Data**: Use realistic mock data for consistent testing
- **Environment Configuration**: Use environment variables for configuration
- **Test Cleanup**: Clean up test data and resources
- **State Management**: Ensure tests don't interfere with each other

## Continuous Integration

### GitHub Actions Example

```yaml
name: ArtDuo Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v2

    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16'

    - name: Install dependencies
      run: |
        cd test
        npm install

    - name: Run tests
      run: |
        cd test
        npm test

    - name: Upload test results
      uses: actions/upload-artifact@v2
      with:
        name: test-results
        path: test/test-results.json
```

## Performance Monitoring

### Key Metrics to Watch

1. **Response Times**: Keep API responses under thresholds
2. **Success Rates**: Maintain high success rates (>80%)
3. **Error Rates**: Monitor and minimize error rates
4. **Resource Usage**: Track memory and CPU usage
5. **Concurrent Performance**: Ensure system handles load well

### Alerting Setup

Set up alerts for:
- Success rate drops below 80%
- Response times exceed thresholds
- Error rates increase significantly
- System resource usage exceeds limits

---

This guide provides comprehensive instructions for running, understanding, and extending the ArtDuo test suite. For additional questions or issues, refer to the test code comments or the main documentation.