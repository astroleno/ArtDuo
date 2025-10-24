# ArtDuo 策展流程测试报告

## 测试信息

- **测试时间**: 2025-10-07T03:31:01.423Z
- **测试输入**: "今天感觉不错,逛了一天街"
- **服务地址**: http://localhost:3001
- **测试状态**: ✅ 通过
- **总耗时**: 193176ms

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
- **emotionCurve**: 1ms
- **artworkSelection**: 3ms
- **introduction**: 4334ms
- **conclusion**: 3503ms
- **explanations**: 258934ms (5批次)
- **totalExplanationTime**: 258934ms

### 性能指标
- **总耗时**: 193175ms
- **平均事件间隔**: 19300ms
- **最长步骤**: N/A

## 验证结果


- **验证状态**: ✅ 通过
- **发现问题**: 0 个




## 详细事件日志


- **start** (undefinedms)
  
  - 耗时: N/Ams
  
  
  

- **emotion_curve** (undefinedms)
  
  - 耗时: 1ms
  
  
  

- **artworks_selected** (undefinedms)
  
  - 耗时: 3ms
  - 作品数: 9
  
  

- **introduction** (undefinedms)
  
  - 耗时: 4334ms
  
  
  

- **conclusion** (undefinedms)
  
  - 耗时: 3503ms
  
  
  

- **explanations_batch** (undefinedms)
  
  - 耗时: 20585ms
  
  - 讲解数: 2
  

- **explanations_batch** (undefinedms)
  
  - 耗时: 17865ms
  
  - 讲解数: 1
  

- **explanations_batch** (undefinedms)
  
  - 耗时: 50487ms
  
  - 讲解数: 2
  

- **explanations_batch** (undefinedms)
  
  - 耗时: 51085ms
  
  - 讲解数: 2
  

- **explanations_batch** (undefinedms)
  
  - 耗时: 118912ms
  
  - 讲解数: 2
  

- **complete** (undefinedms)
  
  - 耗时: N/Ams
  
  
  


## 环境信息

- **Node.js 版本**: v22.20.0
- **平台**: darwin
- **架构**: arm64

---
报告生成时间: 2025-10-07T03:34:14.601Z
