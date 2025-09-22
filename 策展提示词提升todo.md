## 策展提示词提升 TODO（合并《情绪曲线策展todo》与《提示词提升》）

### 1) 讲解（explanations）提示词与生成方式
- 统一输出为严格 JSON（仅 JSON，无额外文本/Markdown）。
- 写作约束：
  - 第三人称、实体化称谓（标题/材质/年代/地点），禁用模糊代词与套话。
  - 每段 80–120 字；字段固定：emotionalConnection、artisticAnalysis、historicalContext、curationReason、userRelevance、confidence。
- 输入增强：在提示中加入“策展总结摘要（≤120字）+ 编排要点 + 作品评分关键词（3–5词）”。
- 并发与限流：每批 3 条、批内并发 ≤3、抖动 30–80ms、批间 120ms；对 429/timeout 仅该条 1s/2s/4s 退避重试。
- 片段化（可选下一步）：五字段改为五个“小段请求”，SSE 流式逐条返回；失败片段单独回退模板并标记 degraded。
- 缓存：key = artworkId+emotion+hash(userInput)+field，TTL 24h；命中立即返回 fromCache。

### 2) 评分（scoring）提示词与解析
- 批量评分返回统一 schema：
  - { scores: [{artwork_id, emotion_fit, artistic_value, visual_impact, overall_recommendation, confidence, reasoning}], errors: [] }
  - 范围校验与两位精度；reasoning 50–90 字。
- 解析：zod 校验 → 失败回退模板分数并标记 degraded。
- 并发控制：批次化 + 指数退避；仅在必要时缩短 max_tokens/temperature 以稳态快速完成。

### 3) 搜索计划（plan）与关键词（keywords）
- 简化 schema：{ keywords: string[≤5], fallback: boolean }；仅英文、不需要 thinking。
- 若 LLM 不可用或不稳，直接用 PRECISE_EMOTION_KEYWORDS 规则集回退。

### 4) 策展总结与编排（summary/arrangement）
- 首轮短版总结（不启用 thinking，180–220 字）。
- 仅当质量/长度不达标或用户指定时，对“总结/编排说明/情绪曲线描述”进行一次 thinking 重试（后台异步替换）。
- 输出纯文本（无 Markdown），避免前端再解析成本。

### 5) 情绪曲线（emotion curve）与 LLM 建议
- 默认使用现有算法曲线。
- 增设 LLM 建议入口（默认关闭）：仅返回 2–3 个关键节点与 pattern（rise/plateau/fall），混合当前曲线进行轻度弯曲与插值。
- diagnostics 增加：llmCurvePattern、llmHighlights、curveSource(LLM|Legacy|Hybrid)。

### 6) 流式输出（SSE）与增量渲染
- 新增 /api/curate/stream：按步骤 emit 事件：plan → coarse → score(batch) → select → summary → explanation(field/片段)。
- 前端订阅：先渲染总结与卡片骨架；分数/精选/讲解片段逐条填充；显示每幅作品片段进度与 degraded 标记。

### 7) 失败兜底与熔断
- 统一错误策略：429/5xx/timeout 触发指数退避（1s/2s/4s），仍失败则模板回退并 logged。
- 令牌桶限流（2–3 TPS）；短时 429 激增触发轻量熔断，转为模板+后台补齐，稳定后自动恢复。

### 8) 配置与观测
- 环境变量：仅用 Next 默认 .env.local；浏览器可见用 NEXT_PUBLIC_*；改动后重启 dev。
- diagnostics 扩充：coarseCount、preFilterCount、scoredCount、selectedCount、glmKey、explainFromCache、explainDegraded、curveSource。

### 9) 实施优先级（里程碑）
- M1（当天）：讲解提示词升级（第三人称/实体化/JSON）+ 评分 schema + 诊断计数 + 429 退避；报告对比结果。
- M2（+1 天）：SSE 流式 + 讲解片段化并发 + 片段缓存。
- M3（+2 天）：情绪曲线 LLM 建议入口（灰度）+ Hybrid 曲线混合与观测。
- M4（+3 天）：总结后台 thinking 重试 + 端到端性能/质量报告。


