# ArtDuo Comprehensive Workflow Test Report

Generated: 2025-10-12T14:18:47.878Z

## Executive Summary

- **Total Tests:** 3
- **Passed:** 0
- **Failed:** 3
- **Success Rate:** 0%
- **Test Duration:** 0s

## Performance Overview

No performance data available

## Quality Scores

No quality data available

## Test Scenario Results

### Main Scenarios

| Scenario | Status | Duration | Issues |
|----------|--------|----------|---------|


### Error Scenarios

| Scenario | Status | Expected Error | Received Error |
|----------|--------|----------------|----------------|
| Missing Emotion | ❌ | Missing required field: emotion | Expected error but got successful response |
| Empty Request Body | ❌ | Missing required field: emotion | Expected error but got successful response |
| GET without Emotion | ❌ | Missing required field: emotion | Expected error but got successful response |

## Detailed Results

<details>
<summary>Click to expand detailed test results</summary>

```json
{
  "startTime": "2025-10-12T14:18:47.864Z",
  "scenarios": [],
  "errorScenarios": [
    {
      "name": "Missing Emotion",
      "description": "Test error handling when emotion is missing",
      "emotion": "",
      "userInput": "Some input",
      "method": "POST",
      "expectedError": "Missing required field: emotion",
      "startTime": "2025-10-12T14:18:47.865Z",
      "passed": false,
      "error": null,
      "receivedError": "Expected error but got successful response",
      "endTime": "2025-10-12T14:18:47.874Z"
    },
    {
      "name": "Empty Request Body",
      "description": "Test error handling with empty request",
      "emotion": null,
      "userInput": null,
      "method": "POST",
      "expectedError": "Missing required field: emotion",
      "startTime": "2025-10-12T14:18:47.874Z",
      "passed": false,
      "error": null,
      "receivedError": "Expected error but got successful response",
      "endTime": "2025-10-12T14:18:47.876Z"
    },
    {
      "name": "GET without Emotion",
      "description": "Test GET method without emotion parameter",
      "emotion": "",
      "userInput": "",
      "method": "GET",
      "expectedError": "Missing required field: emotion",
      "startTime": "2025-10-12T14:18:47.876Z",
      "passed": false,
      "error": null,
      "receivedError": "Expected error but got successful response",
      "endTime": "2025-10-12T14:18:47.877Z"
    }
  ],
  "summary": {
    "totalTests": 3,
    "passedTests": 0,
    "failedTests": 3,
    "successRate": 0,
    "performance": null,
    "quality": null,
    "testDuration": 14
  },
  "config": {
    "baseUrl": "http://localhost:3000",
    "endpoint": "/api/curate/stream",
    "testResultsDir": "./test-results",
    "logLevel": "info",
    "timeout": 300000,
    "retryAttempts": 2,
    "retryDelay": 1000
  },
  "generatedAt": "2025-10-12T14:18:47.878Z"
}
```

</details>

## Recommendations

- All tests passed! System is performing as expected.
