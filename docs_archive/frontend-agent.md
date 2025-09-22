# ArtDuo 前端 Agent 技术说明

## 背景与定位

ArtDuo 的前端 Agent 负责把「情绪输入 → 策展输出」的多阶段流程组合在一起。在当前实现中它运行在浏览器侧，通过 IndexedDB 做缓存，并直接调用前端封装的 LLM/MCP 客户端。本文档梳理 Agent 的状态机、依赖、数据流与待办事项，便于后续替换 mock、对接真实 MCP 服务以及扩展无状态策展能力。

## 核心职责

- 管理四阶段状态机：`planning → searching → judging → complete`，保证界面状态与底层调用同步
- 调用 LLM 生成策展分析（Phase 1），并把分析结果标准化后透出给后续阶段
- 基于 LLM 输出拼接 MCP 检索语句，拉取候选作品并完成基础去重排序（Phase 2）
- 再次调用 LLM 对候选作品打分、补充策展叙事（Phase 3/Phase 4）
- 缓存 LLM 响应与最终展览结果，减少重复调用
- 把执行过程中的关键事件广播给 UI（`frontend/src/components/EmotionInput.tsx` 等）

## 状态机概览

```
idle
  └─ execute()
       ↓
planning (Phase 1: generateAnalysis)
       ↓
searching (Phase 2: searchArtworks)
       ↓
judging (Phase 3: judgeArtworks)
       ↓
complete (Phase 4: generateCuration)
       ↘ error (任意阶段失败)
```

每次状态切换都会调用 `updateState(newState, data)`，随后触发所有监听器。UI 订阅该回调用于展示 Loading、错误提示等。

## 主要模块

| 模块 | 作用 | 关键文件 |
| ---- | ---- | -------- |
| `FrontendAgent` | 状态机、流程调度、缓存管理 | `frontend/src/lib/frontend-agent.ts` |
| `FrontendLLMClient` | 调用 OpenAI 兼容 API，支持超时与 fallback | `frontend/src/lib/frontend-llm-client.ts` |
| `FrontendMCPClient` | 构建检索 query、调用 MCP 代理、解析作品详情 | `frontend/src/lib/frontend-mcp-client.ts` |
| `LocalCache` | IndexedDB 缓存 LLM/MCP/展览结果 | `frontend/src/lib/local-cache.ts` |
| MCP API Route | 目前为 mock，将来需代理真实 MCP 服务 | `frontend/src/app/api/mcp/route.ts` |

## Phase 1 – LLM 分析 (`generateAnalysis`)

- Prompt 中包含情绪词、可选的用户补充文本以及输出格式要求
- 调用 `frontendLLMClient.chat()`，默认 30s 超时；网络错误会回落到内置 mock 响应
- 尝试把字符串解析为 JSON；若失败则返回空对象，后续阶段依然继续执行（需在 TODO 中修复）
- 输出结构体 `LLMAnalysis`：`emotion_analysis`、`art_styles`、`search_keywords`、`recommended_artists`、`curation_strategy`
- TODO：为空或字段缺失时应 fail fast，并提示用户补充输入（见 `mcp建议todo.md` Phase 1.B）

## Phase 2 – MCP 检索 (`searchArtworks`)

- 若命中缓存则直接返回完整结果，状态跳到 `complete`
- 否则调用 `frontendMCPClient.searchArtworks(emotion, userInput, analysis)`
  - `buildSearchQuery` 会合并情绪词、LLM keywords、推荐艺术家与用户输入
  - 通过 `callMCPServer('search-museum-objects', { query, llm_analysis, limit })` 请求 `/api/mcp`
  - 代理层默认转发至 `MCP_UPSTREAM_URL`，遇到网络/超时会返回 `MCP_UPSTREAM_*` 错误码，前端会直接 fail-fast
- `parseObjectIDs` 从返回体中提取 objectID 列表，`getArtworksWithLimit` 限制批量并发抓取详情（最多 9 件）
- `convertMCPArtworkFromText/JSON` 将返回值转换为 UI 使用的 `Artwork` 结构，缺失字段会填入默认值
- TODO：
  - 删掉 mock，遇到上游不可用时直接抛出 `MCP_UPSTREAM_UNAVAILABLE`
  - 用 `ArtworkSchema.safeParse` 对数据做强校验，失败时不要进入 Phase 3
  - 新增溯源字段、去重统计与错误透传

## Phase 3 – LLM 智能判定 (`judgeArtworks`)

- 当前实现再次调用 LLM，对每件作品生成 `llmScore` 和 `llmReason`（详情见源码第 340 行附近）
- 支持缓存，避免对相同作品重复判定
- TODO：
  - 需要保证输入输出都是结构化 JSON，失败时应回退或提示
  - 评分下限、拒绝理由、补检计划等需要更细的协议（参考 `docs/mcp整合todo.md` Phase 3）

## Phase 4 – 策展汇总 (`generateCuration`)

- 结合 LLM 分析与评分，构造最终的 `CurationResult`（主题、描述、情绪曲线、作品总数）
- 最终结果组装成 `AgentResult`，包含耗时、来源标记（目前写死为 `mcp`）、作品数组和分析详情
- 写入缓存，并广播 `complete` 状态
- TODO：
  - 根据评分阈值筛选作品，输出多样性统计
  - 让 `source` 字段真实反映 MCP/API/fallback

## 缓存策略

- `LocalCache` 用 IndexedDB 存储三类数据：`artworks`、`llm_responses`、`mcp_results`
- `CACHE_EXPIRY` 默认为 24 小时，过期后自动删除
- 缓存键包含情绪词与用户输入；后续可以加入种子 seed 以支持无记忆可复现的请求
- TODO：在真实 MCP 接入后，需要增加版本号或 schema 校验，避免旧缓存污染

## 配置与环境变量

| 变量 | 作用 |
| ---- | ---- |
| `NEXT_PUBLIC_OPENAI_API_KEY` | 浏览器侧 OpenAI API Key（可被用户输入覆盖） |
| `NEXT_PUBLIC_OPENAI_BASE_URL` | OpenAI API 基础地址（默认 `https://api.openai.com/v1`） |
| `NEXT_PUBLIC_OPENAI_MODEL` | 默认模型名（默认 `gpt-4o-mini`） |
| `NEXT_PUBLIC_MCP_SERVER_URL` | MCP 代理地址，默认 `/api/mcp` |
| `NEXT_PUBLIC_ENABLE_MCP` | 控制前端 Agent 是否直接调用 MCP（默认关闭） |
| `NEXT_PUBLIC_MCP_MOCK_ENABLED` *(计划新增)* | 控制是否使用本地 mock |
| `MCP_UPSTREAM_URL` | 服务器访问的真实 MCP 入口地址（HTTP/JSON-RPC） |
| `MCP_UPSTREAM_API_KEY` | （可选）MCP 上游鉴权 Token，自动加到 `Authorization` 头 |
| `MCP_REQUEST_TIMEOUT` | MCP 代理超时配置，默认 20000ms |
| `ENABLE_MCP_SERVICE` | Server 端 ArtworkServiceManager 是否注册 MCP 服务 |

### `.env.local` 示例

在 Next.js 项目根目录创建 `.env.local`，写入以下变量（根据需要调整模型或自定义接口）：

```
NEXT_PUBLIC_OPENAI_API_KEY=sk-your-openai-key
NEXT_PUBLIC_OPENAI_BASE_URL=https://api.openai.com/v1
NEXT_PUBLIC_OPENAI_MODEL=gpt-4o-mini

# 仅在服务端调用时需要
OPENAI_API_KEY=sk-your-openai-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# MCP 代理（后端环境变量）
MCP_UPSTREAM_URL=https://your-mcp-endpoint
MCP_UPSTREAM_API_KEY=your-mcp-token
MCP_REQUEST_TIMEOUT=20000
```

> 小贴士：前端会优先读取 `NEXT_PUBLIC_OPENAI_API_KEY`，也支持在设置面板中由用户手动输入并存储在浏览器 `localStorage` 的 `user_openai_api_key`，方便调试不同账号。

## 错误处理与监控现状

- `FrontendAgent.execute` 统一捕获异常并切换到 `error` 状态，但未区分错误类型
- LLM 客户端对超时/网络错误会回落到硬编码的 fallback 响应，可能导致空分析继续执行
- MCP 客户端在任何异常时都会返回空结果，前端无法区分「无数据」和「上游失败」
- TODO：
  - 定义标准错误码（`ANALYSIS_EMPTY`、`MCP_UPSTREAM_UNAVAILABLE` 等）并在 UI 中展示
  - 记录 requestId、LLM/MCP latency，以便排查
  - 在 Agent 内部增加阶段日志与指标上报（可复用浏览器 Performance API）

## 与 MCP + LLM 串接 Checklist 的对应关系

- 文件开头新增的 Checklist 提供了从配置→调用→UI→监控的 MVP 步骤
- 本文档补充了每个阶段的实现细节，配合 Checklist 可以直接进入重构：
  1. 替换 `/api/mcp` mock，使用真实 MCP；按 Checklist 要求返回 502/503
  2. 在 `generateAnalysis` 中加空值断言，失败时返回 `ANALYSIS_EMPTY`
  3. 对 `FrontendMCPClient` 的转换结果应用 `ArtworkSchema.safeParse`
  4. 串联状态、错误码与 UI 提示，完成联调验收

## 后续工作建议

1. **接口梳理**：补充真实 MCP 上游的接口文档、鉴权方案与节流策略
2. **Schema 统一**：先落地 `ArtworkSchema`、`AgentResult` 的 Zod 校验，减少前端脏数据
3. **观察性增强**：把 requestId/seed 注入日志，搭建最小化的浏览器侧 metrics（可先 console + window.performance）
4. **无状态可复现**：在 Agent 中引入种子 seed，并在缓存键、LLM Prompt、MCP 请求中统一使用
5. **测试策略**：按照 `mcp建议todo.md` 中的单测/集成测试计划，编写 Playwright 或 Vitest 测试用例

---

最后更新：2025-01-21  
撰写：Codex 助手
