# ArtDuo Comprehensive Workflow Test Suite

This comprehensive test suite thoroughly validates the entire ArtDuo curation workflow from start to finish. It tests the `/api/curate/stream` endpoint with various emotions, inputs, and scenarios to ensure the system performs reliably and produces high-quality results.

## 🎯 Overview

The test suite is designed to:

- ✅ Test the complete ArtDuo workflow from emotion input to artwork curation
- 📊 Measure performance metrics for each step of the workflow
- 🔍 Validate the quality of generated outputs (emotions, artwork selections, explanations)
- 🚫 Test error handling and edge cases
- 📝 Generate detailed reports for analysis and debugging
- ⚡ Support both GET and POST HTTP methods

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- ArtDuo development server running on `http://localhost:3000`
- Access to the GLM API for artwork scoring

### Installation

```bash
cd test/
npm install
```

### Running Tests

#### Run All Tests
```bash
# Using npm script
npm run workflow

# Or directly
node run-workflow-test.js
```

#### Quick Test (Basic Scenarios Only)
```bash
npm run workflow:quick
```

#### Test Specific Scenarios
```bash
# Test with joy emotion
npm run workflow:joy

# Test GET method only
npm run workflow:get

# Test POST method only
npm run workflow:post

# Test error scenarios only
npm run workflow:errors
```

#### List Available Scenarios
```bash
npm run workflow:list
```

## 📋 Test Scenarios

### Main Test Scenarios

| Scenario | Method | Emotion | Description | Focus Areas |
|----------|--------|---------|-------------|-------------|
| Simple Emotion - Joy | POST | joy | Basic workflow with simple positive emotion | Core functionality, basic performance |
| Complex Emotion with User Input | POST | nostalgia | Workflow with detailed user requirements | Complex input handling, quality validation |
| Negative Emotion Processing | POST | melancholy | Testing workflow with complex negative emotion | Emotional diversity, content quality |
| GET Method Test | GET | peace | Testing GET method with query parameters | API compatibility, method handling |
| Minimal Input Test | POST | calm | Testing with minimal emotion input | Edge case handling, efficiency |

### Error Scenarios

| Scenario | Method | Expected Error | Purpose |
|----------|--------|----------------|---------|
| Missing Emotion | POST | Missing required field: emotion | Validate input validation |
| Empty Request Body | POST | Missing required field: emotion | Test request parsing |
| GET without Emotion | GET | Missing required field: emotion | Validate query parameter handling |

## 📊 Performance Metrics

The test suite measures the following performance metrics:

### Workflow Timing
- **Total Duration**: End-to-end workflow execution time
- **Plan Duration**: Time to generate search plan and LLM analysis
- **Search Duration**: Time to search and retrieve artworks
- **Scoring Duration**: Time to score and rank artworks
- **Explanation Duration**: Time to generate artwork explanations

### Performance Thresholds
- **Simple workflows**: < 2 minutes total
- **Complex workflows**: < 2.5 minutes total
- **Individual steps**: Various thresholds per step type

### Quality Metrics
- **Emotion Curve Quality**: Validates emotional progression (0-100%)
- **Artwork Quality**: Checks artwork metadata completeness and diversity
- **Explanation Quality**: Validates depth and completeness of explanations

## 🔧 Advanced Usage

### Command Line Options

The test runner supports numerous command-line options:

```bash
node run-workflow-test.js [options]

Options:
  -s, --scenario <name>      Run specific test scenario by name
  -e, --emotion <emotion>    Run tests with specific emotion
  -m, --method <method>      Filter tests by HTTP method (GET/POST)
  -q, --quick                Run only quick tests (basic scenarios)
  --errors                   Run only error scenarios
  --no-report               Skip report generation
  --log-level <level>       Set log level (debug, info, warn, error)
  --timeout <ms>            Set request timeout in milliseconds
  --base-url <url>          Set base URL for API
  --dry-run                 Show what tests would run without executing
  --list-scenarios          List all available test scenarios
  --list-errors             List all error scenarios
  -v, --verbose             Enable verbose output
  -h, --help                Show help
```

### Examples

#### Run Tests for Specific Emotion
```bash
node run-workflow-test.js --emotion joy
```

#### Run Specific Scenario
```bash
node run-workflow-test.js --scenario "Simple Emotion"
```

#### Dry Run (See What Would Run)
```bash
node run-workflow-test.js --dry-run --emotion joy
```

#### Verbose Logging
```bash
node run-workflow-test.js --verbose --log-level debug
```

#### Custom Base URL
```bash
node run-workflow-test.js --base-url https://api.artduo.com
```

## 📈 Reports and Output

### Report Generation

The test suite generates two types of reports:

1. **JSON Report**: Detailed machine-readable results
2. **Markdown Report**: Human-readable summary with insights

Reports are saved in the `./test-results/` directory with timestamps:
- `workflow-test-report-1696543210000.json`
- `workflow-test-report-1696543210000.md`

### Report Contents

#### Summary Statistics
- Total tests run and pass/fail counts
- Success rate percentage
- Average, min, and max performance metrics
- Quality scores for different aspects

#### Detailed Results
- Individual test scenario results
- Performance timing for each workflow step
- Quality validation scores
- Error details and debugging information

#### Recommendations
- Performance optimization suggestions
- Quality improvement recommendations
- Identified issues and solutions

### Console Output

During execution, the test runner provides:
- Real-time progress updates
- Individual test results
- Performance timing information
- Error notifications
- Final summary statistics

## 🧪 Test Architecture

### Core Components

#### ComprehensiveWorkflowTest
Main test orchestrator that:
- Manages test execution flow
- Coordinates different test types
- Generates reports and summaries

#### TestValidator
Validates workflow results by:
- Checking required events are present
- Validating data structure and content
- Calculating quality scores
- Identifying potential issues

#### PerformanceTracker
Measures and tracks:
- Workflow step timing
- Event sequence validation
- Performance threshold checking
- Metric aggregation

#### SSEStreamParser
Handles Server-Sent Events:
- Parses streaming response data
- Extracts individual events
- Maintains event order and timing

#### HttpClient
HTTP communication layer:
- Handles GET and POST requests
- Manages timeouts and retries
- Supports both regular and SSE responses

### Test Flow

1. **Setup**: Initialize logging, HTTP client, and performance tracking
2. **Execution**: Run test scenarios with comprehensive monitoring
3. **Validation**: Verify results against expected outcomes
4. **Analysis**: Calculate performance metrics and quality scores
5. **Reporting**: Generate detailed reports and summaries

## 🔍 Debugging and Troubleshooting

### Common Issues

#### Server Not Running
```
❌ Test execution failed: connect ECONNREFUSED 127.0.0.1:3000
```
**Solution**: Ensure the ArtDuo development server is running on port 3000

#### Timeout Issues
```
❌ Request timeout
```
**Solution**:
- Check network connectivity
- Increase timeout with `--timeout <ms>`
- Verify API endpoints are responding

#### API Key Issues
```
❌ GLM API authentication failed
```
**Solution**: Verify environment variables and API key configuration

### Debug Mode

Enable detailed logging for troubleshooting:
```bash
node run-workflow-test.js --log-level debug --verbose
```

This provides:
- Detailed event timing information
- HTTP request/response details
- SSE event parsing information
- Validation step details

### Custom Test Scenarios

You can modify the test scenarios in `comprehensive-workflow-test.js`:

```javascript
const TEST_SCENARIOS = [
  {
    name: 'Custom Test',
    description: 'Your custom test description',
    emotion: 'your-emotion',
    userInput: 'Your custom input',
    method: 'POST',
    expectedEvents: ['start', 'emotion_curve', ...],
    performanceThresholds: {
      totalDuration: 120000,
      // ... other thresholds
    }
  },
  // ... other scenarios
];
```

## 📝 Integration with CI/CD

### GitHub Actions Example

```yaml
name: ArtDuo Workflow Tests

on: [push, pull_request]

jobs:
  workflow-tests:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install dependencies
      run: |
        cd test/
        npm install

    - name: Start development server
      run: npm run dev &
      wait-on http://localhost:3000

    - name: Run workflow tests
      run: |
        cd test/
        npm run workflow:quick

    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: test-results
        path: test/test-results/
```

## 🤝 Contributing

### Adding New Test Scenarios

1. Add scenarios to `TEST_SCENARIOS` array in `comprehensive-workflow-test.js`
2. Define appropriate expected events and performance thresholds
3. Test the new scenario with `--dry-run` first
4. Update documentation if needed

### Improving Validation

The `TestValidator` class can be extended with new validation rules:
- Add new quality metrics
- Implement custom validation logic
- Enhance error detection

### Performance Optimization

- Adjust performance thresholds based on system capabilities
- Add new timing metrics as needed
- Implement custom performance analysis

## 📄 License

This test suite is part of the ArtDuo project and follows the same license terms.

## 🆘 Support

For issues or questions about the test suite:

1. Check this documentation for common solutions
2. Review generated test reports for detailed error information
3. Enable debug mode for detailed troubleshooting information
4. Check the main ArtDuo project documentation for API and server issues

---

**Happy Testing! 🎉**