下面是一份面向你当前架构的「前端 × MCP × LLM」审查报告。依据你提供的模块说明与运行日志编写，结论与建议均可直接落地到现有代码结构。

# 一、结论摘要（Executive Summary）

* 你的链路已形成「LLM 分析 → MCP 搜索 → LLM 判定 → 产出策展」的闭环，但当前 **MCP 实际为模拟实现**，导致数据质量与可验证性不足，易产生“看似可用、实则假数据”的风险。
* 关键薄弱点在于：**分析阶段产出为空仍继续检索**、**前端解析缺少严格校验**、**数据溯源与去重缺失**、**child\_process 调用的安全与资源控制不足**。
* 建议以“三步走”整改：
  1）去 Mock 与强校验；2）可观测性与容错分层；3）安全与性能硬化。
  这样既能保障“高端画廊”体验的一致性，也能确保后续扩源与商用合规。

---

# 二、架构理解（Based on your modules）

* frontend-llm-client.ts：直连 GLM，含流式/非流与降级。
* frontend-mcp-client.ts：经 Next API 代理调用 MCP，做搜索与详情、含置信度与匹配。
* mcp-route.ts：Next API 路由层，目前是模拟实现（智能搜索算法只是占位）。
* frontend-agent.ts：四阶段状态机，整合 LLM、MCP、缓存与降级。
* metmuseum-mcp.ts：通过 child\_process 调用真正 MCP 服务，走 JSON-RPC，并发控制与错误处理在本地实现。

---

# 三、关键发现与风险评级

下列发现按照影响面与复现概率给出严重度。

1. 模拟 MCP 结果进入生产链路（严重）

* 证据：日志中 9 条结果字段高度模板化、primaryImage 相同、text→JSON→map 的多级“转换”更像本地构造。
* 风险：错误期望与策略误判；后续扩源时可能叠加噪声。
* 立即措施：在 mcp-route.ts 默认拒绝返回 mock；若无真实响应则显式标记错误状态，中止 Phase 2→3。

2. 分析阶段为空仍继续检索（严重）

* 证据：Phase 1 日志显示 LLM 原始文本与清理后均为 {}，但仍进入 MCP 搜索。
* 风险：关键词质量差、召回随机；评分排序没有真实语义依据。
* 立即措施：在 frontend-agent.ts 里对 analysis 设硬断言；失败则引导重试或回退到本地情绪→关键词映射表。

3. 解析与入库缺少强模式校验（严重）

* 证据：存在“字符串化 JSON → 解析 → 转换 → 结果”的宽松流程。
* 风险：一旦上游字段漂移或脏数据混入，前端仍“正常显示”，放大问题。
* 立即措施：前端引入 zod/yup Schema，解析失败直接 fail-fast，不做任何本地填充。

4. 数据去重、溯源字段缺失（高）

* 证据：多条 primaryImage 相同；结果不带 museum/source/rawUrl。
* 风险：画廊页重复与假成功；用户无法核验来源。
* 立即措施：结果结构增加 {source, museum, objectUrl, imageUrl, rights}，并在渲染前做去重与可见标记。

5. child\_process 调用的安全与资源控制不足（高）

* 风险：命令注入、僵尸进程、超时阻塞、并发竞争。
* 立即措施：

  * 固定可执行文件路径与参数白名单；
  * 全链路 timeout、killSignal、stderr 监控；
  * 限制并发与队列长度；
  * 进程退出码与 JSON-RPC 校验。

6. 缓存策略不完整（中）

* 证据：IndexedDB 成功，但未见 TTL、版本标识与逐出。
* 风险：旧模型或旧映射导致“错误但可复现”的假确定性。
* 立即措施：缓存键包括 {queryHash, model, toolVersion, source}；设置 TTL 与容量上限；命中后仍做快速健康探测。

7. 可观测性不足（中）

* 风险：难以定位“哪一环坏了”。
* 立即措施：注入 correlationId，phase 维度打点（开始/成功/失败/耗时），对 MCP/LLM 各自统计 QPS、错误率、P95。

8. 合规与授权提示（中）

* 风险：博物馆 API/图片版权政策；需在 UI 展示来源与授权声明。
* 立即措施：列表与详情页统一展示来源、版权、开放许可链接；保留点击原站入口。

---

# 四、建议的最小变更集（可直接落地）

以下为“无侵入或低侵入”的增量措施，按优先级排序。

A. 终止 Mock 回落

* mcp-route.ts：移除或关闭默认 mock 返回；当上游不可用时返回 502/503，并在 body 中写入 {code:"MCP\_UPSTREAM\_UNAVAILABLE"}。
* frontend-mcp-client.ts：收到该 code 直接 fail，不生成占位数据。

B. 分析空值硬断言与兜底映射

* frontend-agent.ts：

  ```ts
  if (!analysis || Object.keys(analysis).length === 0) {
    return setState({ status: 'error', code: 'ANALYSIS_EMPTY', message: '请更具体地描述你的情绪或场景' });
  }
  ```
* 新增本地映射：emotion → keywords\[]（例如 Plutchik 八维 + 同义词），仅在用户明确同意后用于兜底。

C. 结构化校验

* frontend-mcp-client.ts：

  * 使用 zod 定义 ArtworkSchema；解析后通过 `ArtworkSchema.safeParse` 校验；
  * 失败则抛出 MCP\_SCHEMA\_INVALID，不进入 Phase 3。

D. 溯源字段与去重

* 统一 Artwork 类型：

  ```ts
  type Artwork = {
    id: string; title: string; artist: string;
    year?: string; medium?: string; description?: string;
    imageUrl?: string; objectUrl?: string;
    museum?: 'Met' | 'GAC' | 'Tate' | string;
    source?: 'mcp' | 'api';
    rights?: string; // CC0/开放获取等
    score?: number;  // 判定得分
  }
  ```
* 渲染前：以 `title+artist` 与 `imageUrl` 双键去重；若重复，记录 telemetry 并只保留得分高的一条。

E. child\_process 安全与资源

* metmuseum-mcp.ts：

  * 显式 `execFile` 或 `spawn`，不拼接 shell 字符串；
  * 为每次调用设置 `timeout`、`maxBuffer`、`killSignal`；
  * 并发以 p-queue 控制；异常路径 `finally` 确保清理。

F. 可观测性

* 全链路 correlationId：在 frontend-agent.ts 生成，透传给 LLM 与 MCP；日志统一打印。
* 关键指标：phase\_duration\_ms、mcp\_qps、mcp\_error\_rate、llm\_empty\_ratio、dedupe\_ratio、cache\_hit\_rate。

---

# 五、测试计划（含验收标准）

1. 单元与契约测试

* zod Schema：错误字段、缺字段、脏 JSON 都应 fail。
* MCP 代理：当上游断开时返回 503，不生成本地数据。

2. 集成测试

* 正常路径：输入“孤独”，Analysis 非空，MCP 返回 10 条真实数据，去重后 ≥8 条；每条含 museum 与 objectUrl。
* 失败路径：Analysis 空 → 显示友好提示，不进入 Phase 2。
* 上游断线：MCP 503 → UI 呈现“来源服务暂时不可用”，不展示占位图。

3. 性能基线

* gallery 首屏加载 < 3s（Wi-Fi），交互帧率 > 60fps；MCP 请求超时 6-8s。

4. 合规

* 详情页展示来源、版权状态与跳转链接；图片请求遵守对方缓存与引用规范。

---

# 六、风险矩阵与缓解

* 高概率×高影响：Mock 数据进入生产 → 通过 Schema 校验、阻断回退、显式错误页缓解。
* 中概率×高影响：child\_process 堵塞 → timeout 与并发队列控制。
* 低概率×高影响：版权投诉 → UI 溯源与授权说明，保留原站链接与日志证据。

---

# 七、后续演进建议

* 把 mcp-route.ts 的“模拟智能搜索”迁出，独立成 dev-only provider；生产环境仅允许真实 MCP 工具链。
* 抽象 SourceAdapter：Met、Google Arts & Culture、Rijksmuseum 等接入统一协议；前端只依赖统一 ArtworkSchema。
* 在 frontend-llm-client.ts 增加“可解释输出”模式：记录关键词抽取、主题权重，用于 Phase 3 的评分因子与 UI 可视化。

---

# 八、验收清单（开发勾选）

* [ ] mcp-route.ts 去 Mock，错误时返回 5xx 与明确 code
* [ ] frontend-agent.ts 阶段断言与兜底映射
* [ ] frontend-mcp-client.ts 引入 zod Schema 并严格校验
* [ ] Artwork 类型加入 museum/source/objectUrl/rights
* [ ] 渲染前去重与溯源显示
* [ ] metmuseum-mcp.ts child\_process 安全与并发控制
* [ ] 注入 correlationId 与关键指标上报
* [ ] 文案与错误页统一风格，避免“工具味”

如需，我可以基于你当前文件名，给出上述 A–F 六项的最小改动代码片段与断言示例，直接贴进仓库即可跑通。
