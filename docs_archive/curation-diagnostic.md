# 策展阶段诊断报告

- 基础URL: http://localhost:3000
- Emotion: joy
- UserInput: bright colors, family, celebration
- 生成时间: 2025-09-22T14:46:56.116Z

## 阶段耗时与输出概览

| 阶段 | 耗时(ms) | 状态 | 摘要 |
| --- | ---: | ---: | --- |
| search-plan | 10968 | 200 | {"keywords":["celebration","festival","dance","music","happiness"],"sources":["met","rijks"]} |
| search | 10435 | 200 | {"success":true,"count":48} |
| scoring | 13363 | 200 | {} |
| selection | 186 | 200 | {"selectedCount":0} |
| explanation | 176 | 200 | {"durationMs":1,"successCount":0,"failureCount":0} |
| summary | 10387 | 200 | {"durationMs":10268,"length":37} |
| curate | 97516 | 200 | {"success":true,"scoredCount":21,"summaryTime":10751} |

> 完整原始数据见 curation-diagnostic.json