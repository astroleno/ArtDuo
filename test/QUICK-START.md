# ArtDuo Workflow Test - Quick Start

Get up and running with the comprehensive ArtDuo workflow test suite in minutes.

## 🚀 5-Minute Quick Start

### 1. Prerequisites

```bash
# Make sure Node.js 18+ is installed
node --version

# Make sure your ArtDuo server is running
cd ../
npm run dev
# Server should be running on http://localhost:3000
```

### 2. Install Test Dependencies

```bash
cd test/
npm install
```

### 3. Run Your First Test

```bash
# Quick test with basic scenarios
npm run workflow:quick

# Or dry-run to see what would be tested
node run-workflow-test.js --dry-run --quick
```

### 4. Check Results

After running tests:
- **Console**: See immediate results and performance metrics
- **Reports**: Find detailed reports in `./test-results/` directory
- **Summary**: View overall test performance and quality scores

## 📋 Common Commands

### Basic Testing
```bash
# Run all tests
npm run workflow

# Quick test (2 scenarios only)
npm run workflow:quick

# Test specific emotion
npm run workflow:joy

# Test error scenarios only
npm run workflow:errors
```

### Advanced Usage
```bash
# List all available test scenarios
npm run workflow:list

# Run with debug logging
node run-workflow-test.js --log-level debug

# Test specific scenario by name
node run-workflow-test.js --scenario "Simple Emotion"

# Test with custom base URL
node run-workflow-test.js --base-url https://api.artduo.com
```

## 🎯 Understanding the Output

### Console Output Example
```
🚀 ArtDuo Workflow Test Runner
================================

1/5: Simple Emotion - Joy
✅ Simple Emotion - Joy - 45320ms

2/5: Complex Emotion with User Input
✅ Complex Emotion with User Input - 62150ms

============================================================
📊 COMPREHENSIVE TEST SUMMARY
============================================================
Total Tests:    5
Passed:         5
Failed:         0
Success Rate:   100%
Test Duration:  245s

📈 Performance:
  Average: 52340ms
  Range:   45320-62150ms

🎯 Quality Scores:
  emotionCurveQuality: 95%
  artworkQuality: 88%
  explanationQuality: 92%
============================================================
```

### Report Files
- **JSON**: `workflow-test-report-1696543210000.json` (machine-readable)
- **Markdown**: `workflow-test-report-1696543210000.md` (human-readable)

## 🔧 Troubleshooting

### Common Issues

**Server not running**
```bash
❌ Test execution failed: connect ECONNREFUSED 127.0.0.1:3000
```
✅ **Solution**: Start your ArtDuo server: `cd ../ && npm run dev`

**Timeout errors**
```bash
❌ Request timeout
```
✅ **Solution**: Increase timeout: `node run-workflow-test.js --timeout 600000`

**API issues**
```bash
❌ GLM API authentication failed
```
✅ **Solution**: Check your environment variables and API key configuration

### Debug Mode
```bash
# Enable detailed logging
node run-workflow-test.js --log-level debug --verbose

# See what tests would run without executing
node run-workflow-test.js --dry-run
```

## 📊 Test Results Explained

### Performance Metrics
- **Total Duration**: End-to-end workflow time
- **Plan Duration**: Search plan generation time
- **Search Duration**: Artwork search time
- **Scoring Duration**: Artwork scoring time

### Quality Scores
- **Emotion Curve Quality** (0-100%): Validates emotional progression
- **Artwork Quality** (0-100%): Checks metadata completeness and diversity
- **Explanation Quality** (0-100%): Validates explanation depth and completeness

### Success Criteria
A test passes if:
- ✅ All expected events are received
- ✅ Performance thresholds are met
- ✅ Quality scores are above minimum thresholds
- ✅ No critical errors occur

## 🎨 Test Scenarios Overview

| Scenario | Emotion | Method | Focus |
|----------|---------|--------|-------|
| Simple Emotion | joy | POST | Basic workflow |
| Complex Input | nostalgia | POST | User requirements |
| Negative Emotion | melancholy | POST | Emotional diversity |
| GET Method | peace | GET | API compatibility |
| Minimal Input | calm | POST | Edge case handling |

## 🚀 Next Steps

### For Developers
1. **Run full test suite**: `npm run workflow`
2. **Check performance metrics**: Look for trends in timing data
3. **Validate quality scores**: Ensure all metrics are >80%
4. **Review reports**: Check `test-results/` for detailed analysis

### For QA Testing
1. **Run quick tests first**: `npm run workflow:quick`
2. **Test error scenarios**: `npm run workflow:errors`
3. **Validate specific emotions**: `npm run workflow:joy`, `npm run workflow:nostalgia`
4. **Generate reports**: Ensure all tests pass before deployments

### For CI/CD Integration
```bash
# Quick test for PR validation
npm run workflow:quick

# Full test for main branch
npm run workflow

# Error handling validation
npm run workflow:errors
```

## 📞 Need Help?

1. **Check the full documentation**: `WORKFLOW-TEST-README.md`
2. **Review example usage**: `node example-usage.js`
3. **Enable debug mode**: `--log-level debug --verbose`
4. **Check server logs**: Ensure ArtDuo server is running properly

---

**Happy Testing! 🎉**