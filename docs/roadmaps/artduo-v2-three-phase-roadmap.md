# ArtDuo V2 三阶段路线图

Created: 2026-04-23
Status: active
Source Requirements: `docs/brainstorms/artduo-v2-lightweight-rebuild-requirements.md`
Source Plan: `docs/plans/artduo-v2-lightweight-rebuild-plan.md`

## 一句话方向

保留 ArtDuo 的体验层灵魂，把作品库做成本地优先、渐进加载的 release artifact，并让后端退到离线构建、会话补充和质量保障层。

## 启动前共识

- 当前项目保留在 legacy 分支，V2 在新分支上推进
- repo 迁移采用 `parallel workspace bootstrap + strangler`
- `frontend/` 是主要 UI donor，`reference/artduo/` 是次级 donor
- runtime 只认一份 release manifest
- background scene catalog 属于 release manifest 的一部分
- `embeddings` 在 Phase 1 是可选增强，不是主路径前提
- `session / explanation / stream` 在 Phase 2 再引入
- Phase 1 的验收必须包含 benchmark 和人工评审门槛

## Preflight：Repo Bootstrap

这一步不计入三阶段交付，但必须先完成。

### 交付物

- `apps/` + `packages/` 工作区骨架
- donor/reference 边界定义
- root install / build 脚本
- `v0.1` contract 文件位置约定

### 完成判断

- 团队不再争论“rename / copy / strangler”怎么选
- 新工作区可以独立安装和构建
- `frontend/` 没有被整体迁移进 `apps/web/`

## Phase 1: Foundation Thin Slice

### 目标

尽快做出一条新的最小主链路，让用户可以从一句情绪输入进入一个真实可浏览的展览，同时证明结果不是纯随机拼接。

### 交付物

- `v0.1` display / data contracts freeze
- release manifest + `metadata/search/mediaIndex/backgroundScenes` shards
- 本地加载、缓存和粗召回
- 背景匹配和 score breakdown
- Landing / Gallery / 最小 Detail 路由
- probe、benchmark 与人工评审报告

### 本阶段必须做到

- 不依赖 SSE
- 不让 API 承担首屏检索热路径
- 不引入 runtime `GET /v1/background-scenes` 主路径接口
- 不要求 embedding shard 才能跑通
- 至少一类背景 scene 能稳定和作品形成配对
- benchmark 可重复执行

### 验收问题

- 用户能否快速进入展览？
- 作品是否已经可浏览？
- 本地语料库是否已经替代慢 API 成为首屏主路径？
- 前端是否已经回到单一主栈？
- top 10 结果里是否有足够多人工认可的可用候选？

## Phase 2: Curation Core Experience

### 目标

把最小链路升级成可信的策展体验，重点解决“为什么是这些作品”和“如何稳定保存与补全这场展览”。

### 交付物

- embedding shard 和本地向量检索
- rerank 与 build-exhibition
- `v0.2` session / explanation / event contracts freeze
- `POST /v1/curations`
- `GET /v1/curations/:id`
- `GET /v1/curations/:id/stream`
- `GET /v1/artworks/:id/explanation`
- ownership / authz / idempotency / rate limit / retention
- session-aware detail 页面与状态对齐

### 本阶段必须做到

- 详情页独立可打开
- explanation 不阻塞主链路
- session 可以无损承接前端本地 exhibition snapshot
- 会话层带安全和成本边界
- 状态不再依赖 `localStorage` 轮询同步

### 验收问题

- 同一类输入是否能稳定得到相对可信的结果？
- 用户能否自然从展览进入单件作品深入阅读？
- 前端状态和后端状态是否完全共享同一套 contract？
- session / stream / explanation 是否有明确 ownership 和 rate limit 边界？

## Phase 3: Immersive Productization

### 目标

恢复并增强沉浸式体验，同时补齐模块化转场、动态媒体、缓存回退、观测和发布质量。

### 交付物

- 新版沉浸式画廊
- 模块化 transition registry 与基础 transition modules
- 动态媒体舞台和作品分级
- SSE 增强链路与回退机制
- 语料预取、缓存和回退
- metrics、request log 和 E2E 回归

### 本阶段必须做到

- 沉浸式体验不依赖脆弱同步机制
- SSE 失败时主体验不塌
- 默认转场实现不依赖 WebGL/Three.js
- 动态媒体缺失时可以平滑回退到静态表现

### 验收问题

- 沉浸式路线是否已经完整恢复？
- 流式失败时是否仍然能正常使用？
- 团队是否能根据指标定位性能、质量和成本问题？

## Keep / Modify / Drop

### Keep

- 情绪输入到展览生成的产品方向
- 叙事式进入体验
- 沉浸式观展路线
- 当前 `frontend/` 的主要 UI 资产
- `public/artduo-gallery/` 的背景场景资产
- `reference/artduo/` 的轻壳、灯光和基础动效语言
- `reference/chatgpt/分级.md` 的分级思路
- `reference/chatgpt/动画.md` 的动态媒体思路

### Modify

- repo 结构与迁移策略
- 数据层与 release 发布方式
- 检索主链路
- 会话与 explanation API
- 背景匹配与单元转场策略
- 状态矩阵与页面导航

### Drop

- 浏览器端 Agent 主流程
- 浏览器端直连 LLM/MCP 的做法
- 请求时拼接大 JSON
- `route.ts + page.html` 混合页面模式
- 把 SSE 当成主路径成立前提

## 推荐节奏

### 第 0 周

- 完成 bootstrap 决策
- 新建 workspace 骨架
- 冻结 `v0.1` 合同边界

### 第 1 周到第 2 周

- 跑第一轮 probe
- 产出第一版 release manifest
- 做出 Landing / Gallery 薄切片

### 第 3 周到第 5 周

- 完成本地加载、缓存、粗召回和背景匹配
- 完成 benchmark 和人工评审
- 让 Phase 1 形成可演示薄切片

### 第 6 周到第 8 周

- 冻结 `v0.2`
- 接入向量检索、详情、session 和 explanation
- 形成 Phase 2 核心体验

### 第 9 周以后

- 恢复沉浸式路线
- 接入模块化转场、动态媒体、SSE 增强、监控和 E2E 回归

## 文档维护规则

- 阶段边界变化时先更新本路线图
- contract 变化时先更新共享协议文档
- 页面状态和导航变化时先更新 UX spec
- 数据发布方式变化时先更新 local corpus schema
