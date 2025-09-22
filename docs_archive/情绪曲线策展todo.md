# 情绪曲线策展 TODO

## 目标
让情绪曲线既保持当前算法的可控性，又能借助 LLM 输出更具叙事感的节点和描述，最终在选画、评分、说明之间形成一致的情绪故事线。

---

## 阶段 1：梳理现有数据流
- [ ] 盘点 `EmotionCurveGenerator` 当前输入（作品列表、评分、情绪）与输出（`EmotionPoint[]`、描述）。
- [ ] 整理可供 LLM 使用的结构化数据：
  - 精选作品顺序、`ArtworkScore.emotionFit`
  - `llmAnalysis.curation_strategy`
  - `selectionResult.diversityMetrics`
- [ ] 明确需要暴露给前端或诊断的数据字段。

## 阶段 2：设计 LLM 辅助接口
- [ ] 定义情绪曲线提示词模板（输入：作品数据 + 策展策略；输出：节点数组 + 叙事标签）。
- [ ] 约定 LLM 输出结构，例如：
  ```json
  {
    "nodes": [
      {"position": 0, "intensity": 0.3, "highlight": "作品A开启平静"},
      {"position": 0.6, "intensity": 0.9, "highlight": "作品E引爆高潮"}
    ],
    "pattern": "rise_fall",
    "story": "情绪由平和渐升，最终以希望收束"
  }
  ```
- [ ] 规划错误兜底策略：LLM 无响应或格式错误时自动回退到旧算法。

## 阶段 3：算法融合
- [ ] 在 `EmotionCurveGenerator` 新增“LLM建议”入口：
  - 调用后将节点信息映射至现有曲线函数
  - 根据 `pattern` 选择 `wave/peak/valley/custom` 等模板
- [ ] 调整 `generateCustomCurve`：
  - 去掉随机扰动，改为使用 LLM 节点 + 评分差值进行插值
  - 确保曲线可复现（支持 deterministic seed）
- [ ] 更新平滑与边界检查逻辑，保证所有点在 [0,1]，并维持渐变。

## 阶段 4：情绪描述增强
- [ ] 将 LLM 返回的 `story` 或节点 highlight 融入 `generateCurveDescription` 生成文本。
- [ ] 若 LLM 未提供描述，则保留原有基于统计的描述。
- [ ] 在 diagnostics 中记录 LLM 参与情况（比如 `llmCurvePattern`、`llmHighlights`）。

## 阶段 5：验证与监控
- [ ] 编写调试脚本，比较旧曲线与新曲线（点数、峰值、叙事一致性）。
- [ ] 在 `test/debug-coarse-selection.js` 等调试脚本中打印曲线来源（LLM vs Legacy）。
- [ ] 收集反馈，确定是否需要在前端展示情绪节点说明。

## 阶段 6：部署注意事项
- [ ] 增加环境变量配置选项，例如 `ENABLE_LLM_CURVE=true`，便于在生产环境灰度上线。
- [ ] 记录 LLM 调用的 Token 估算，评估成本。
- [ ] 若部署到无外网环境，确保回退逻辑安全可用。

---

### 附：后续可扩展思路
- 结合前端 Agent 的情绪判定，复用提示词，减少重复请求。
- 允许策展人手动调整 LLM 输出（例如保留关键节点注释）。
- 在最终报告中展示“情绪曲线 + 作品”互动视图，加强用户理解。
