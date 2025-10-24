# ArtDuo 策展流程测试报告

## 测试信息

- **测试时间**: 2025-10-06T15:34:08.270Z
- **测试输入**: "今天感觉不错,逛了一天街"
- **服务地址**: http://localhost:3004
- **测试状态**: ✅ 通过
- **总耗时**: 174171ms

## 输入输出记录

### 输入数据
```json
{
  "emotion": "今天感觉不错,逛了一天街",
  "userInput": ""
}
```

### 输出摘要
无输出数据

## 性能分析

### 各步骤耗时
- **emotionCurve**: 25ms
- **artworkSelection**: 6ms
- **introduction**: 7302ms
- **conclusion**: 7778ms
- **explanations**: 112519ms (5批次)
- **totalExplanationTime**: 112519ms

### 性能指标
- **总耗时**: 174170ms
- **平均事件间隔**: 17278ms
- **最长步骤**: N/A

## 验证结果


- **验证状态**: ✅ 通过
- **发现问题**: 0 个




## 详细事件日志


- **start** (undefinedms)
  
  - 耗时: N/Ams
  
  
  

- **emotion_curve** (undefinedms)
  
  - 耗时: 25ms
  
  
  

- **artworks_selected** (undefinedms)
  
  - 耗时: 6ms
  - 作品数: 9
  
  

- **introduction** (undefinedms)
  
  - 耗时: 7302ms
  
  
  

- **conclusion** (undefinedms)
  
  - 耗时: 7778ms
  
  
  

- **explanations_batch** (undefinedms)
  
  - 耗时: 24803ms
  
  - 讲解数: 2
  

- **explanations_batch** (undefinedms)
  
  - 耗时: 19919ms
  
  - 讲解数: 2
  

- **explanations_batch** (undefinedms)
  
  - 耗时: 19959ms
  
  - 讲解数: 2
  

- **explanations_batch** (undefinedms)
  
  - 耗时: 23907ms
  
  - 讲解数: 1
  

- **explanations_batch** (undefinedms)
  
  - 耗时: 23931ms
  
  - 讲解数: 2
  

- **complete** (undefinedms)
  
  - 耗时: N/Ams
  
  
  


## 环境信息

- **Node.js 版本**: v22.20.0
- **平台**: darwin
- **架构**: arm64

---
报告生成时间: 2025-10-06T15:37:02.444Z
