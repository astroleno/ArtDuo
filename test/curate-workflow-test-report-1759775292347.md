# ArtDuo 策展流程测试报告

## 测试信息

- **测试时间**: 2025-10-06T18:25:41.407Z
- **测试输入**: "今天感觉不错,逛了一天街"
- **服务地址**: http://localhost:3001
- **测试状态**: ✅ 通过
- **总耗时**: 150937ms

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
- **emotionCurve**: 2ms
- **artworkSelection**: 1ms
- **introduction**: 7155ms
- **conclusion**: 4753ms
- **explanations**: 152492ms (5批次)
- **totalExplanationTime**: 152492ms

### 性能指标
- **总耗时**: 150937ms
- **平均事件间隔**: 15089ms
- **最长步骤**: N/A

## 验证结果


- **验证状态**: ✅ 通过
- **发现问题**: 0 个




## 详细事件日志


- **start** (undefinedms)
  
  - 耗时: N/Ams
  
  
  

- **emotion_curve** (undefinedms)
  
  - 耗时: 2ms
  
  
  

- **artworks_selected** (undefinedms)
  
  - 耗时: 1ms
  - 作品数: 9
  
  

- **introduction** (undefinedms)
  
  - 耗时: 7155ms
  
  
  

- **conclusion** (undefinedms)
  
  - 耗时: 4753ms
  
  
  

- **explanations_batch** (undefinedms)
  
  - 耗时: 51846ms
  
  - 讲解数: 2
  

- **explanations_batch** (undefinedms)
  
  - 耗时: 22913ms
  
  - 讲解数: 2
  

- **explanations_batch** (undefinedms)
  
  - 耗时: 24128ms
  
  - 讲解数: 1
  

- **explanations_batch** (undefinedms)
  
  - 耗时: 26160ms
  
  - 讲解数: 2
  

- **explanations_batch** (undefinedms)
  
  - 耗时: 27445ms
  
  - 讲解数: 2
  

- **complete** (undefinedms)
  
  - 耗时: N/Ams
  
  
  


## 环境信息

- **Node.js 版本**: v22.20.0
- **平台**: darwin
- **架构**: arm64

---
报告生成时间: 2025-10-06T18:28:12.346Z
