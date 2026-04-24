---
title: ArtDuo V2 Frontend Backend Workstreams
status: active
created: 2026-04-24
origin: docs/plans/artduo-v2-lightweight-rebuild-plan.md
---

# ArtDuo V2 前后端并行工作流

## 目标

这份计划只解决一件事：

让前端、后端和 pipeline 能按同一套协议并行开工，而不是互相等待。

配套文档：

- `docs/specs/artduo-v2-shared-contracts-and-api.md`
- `docs/specs/artduo-v2-local-corpus-and-media-schema.md`
- `docs/specs/artduo-v2-background-scene-schema.md`
- `docs/specs/artduo-v2-ux-flow-and-state-matrix.md`
- `docs/plans/artduo-v2-artwork-collection-runbook.md`

## Phase 0：Repo Bootstrap

先明确迁移策略，避免团队在 “copy / rename / strangler / workspace” 上卡住。

结论：

- 采用 `parallel workspace bootstrap + strangler` 策略
- 不在第一步 rename 现有 `frontend/`
- 不从 `frontend/` 直接整体 copy 到 `apps/web/`
- 先在同一仓库根目录创建 `apps/` 和 `packages/`
- `frontend/` 保持只读 donor/reference 状态

### Bootstrap 步骤

1. 在仓库根目录新增 `pnpm-workspace.yaml`
2. 新建 `apps/web`, `apps/api`, `apps/pipeline`
3. 新建 `packages/contracts`, `packages/ui`, `packages/corpus`
4. 标记 `frontend/` 为 legacy donor，不继续承担主路径实现
5. 只按需迁移组件、样式和动效，不迁移旧数据流

完成定义：

- 新工作区能独立安装、构建
- `frontend/` 未被 rename / move / bulk copy
- V2 开工不再依赖旧 HTML route layer

## 工作流拆分

### Workstream A: Shared Contracts

职责：

- 维护 `packages/contracts/`
- 维护 JSON fixture
- 维护 API 和事件契约
- 管理 contract freeze v0.1 / v0.2

Owner files:

- `packages/contracts/src/artwork.ts`
- `packages/contracts/src/background-scene.ts`
- `packages/contracts/src/background-match.ts`
- `packages/contracts/src/corpus.ts`
- `packages/contracts/src/exhibition-unit.ts`
- `packages/contracts/src/curation-session.ts`
- `packages/contracts/src/artwork-explanation.ts`
- `packages/contracts/src/curation-events.ts`
- `packages/contracts/src/errors.ts`
- `packages/contracts/fixtures/`

### Workstream B: Frontend

职责：

- 页面壳
- 本地语料加载
- 本地检索
- 背景匹配
- scene unit 渲染
- 模块化转场
- UX 状态矩阵落地

Owner files:

- `apps/web/app/`
- `apps/web/components/`
- `apps/web/lib/`
- `packages/ui/src/`
- `packages/corpus/src/`

### Workstream C: Backend API

职责：

- manifest route
- session route
- explanation route
- 轮询和 SSE 状态
- ownership / authz / idempotency / rate limit / retention

Owner files:

- `apps/api/src/routes/`
- `apps/api/src/services/`
- `apps/api/test/`

### Workstream D: Pipeline / Data

职责：

- 作品数据探针采集
- 批量抓取与清洗
- 背景场景 catalog 构建
- manifest 产物发布
- relevance benchmark 与 gap report

Owner files:

- `apps/pipeline/src/`
- `scripts/collect/met-probe.js`（bootstrap 期间的 probe 过渡入口）
- `scripts/collect/met-batch.js`（bootstrap 期间的 batch 过渡入口）
- `data/`

## 阶段拆分

## Phase 1

### Shared Contracts

交付物：

- `ArtworkRecord`
- `BackgroundSceneRecord`
- `BackgroundMatch`
- `ExhibitionUnit`
- `ReleaseManifest`
- `ApiError`
- v0.1 fixture

完成标准：

- 前后端对最小状态、字段名和 shard 结构没有分歧
- manifest 明确包含 background scene shard

### Frontend

交付物：

- 新首页
- 基础画廊页
- 本地 metadata/search 加载
- 背景匹配模块 v0
- scene unit 展示壳
- 状态矩阵对应的 loading / partial / empty / error UI

依赖：

- 只依赖 v0.1 contract 和 fixture

完成标准：

- 不等后端 session API 也能跑通完整 UI 流程
- gallery -> detail -> immersive 的主导航顺序成立

### Backend API

交付物：

- `GET /v1/corpus/manifest`
- release manifest 输出校验

依赖：

- 只依赖 v0.1 contract

完成标准：

- manifest 和 fixture 一致
- 不额外发明 runtime `background-scenes` endpoint

### Pipeline / Data

交付物：

- metadata shard
- search shard
- background scene shard
- relevance benchmark prompt set
- 第一轮 probe 输出
- 当前仓库可执行入口：
  - `npm run collect:met:probe -- --theme serenity --query serenity`
  - `npm run collect:met:batch -- --theme melancholy --query melancholy`

完成标准：

- 前端可以本地加载真实数据而不是只靠 mock
- Phase 1 relevance benchmark 可重复执行

## Phase 2

### Shared Contracts

新增：

- `CurationSession`
- `ArtworkExplanation`
- `CurationEvent`
- `SourceVersions`
- ownership / authz 约束

### Frontend

新增：

- 本地向量检索
- 详情页
- build-scene-units
- session-aware polling / stream client

### Backend API

新增：

- `POST /v1/curations`
- `GET /v1/curations/:id`
- `GET /v1/curations/:id/stream`
- `GET /v1/artworks/:id/explanation`
- explanation cache
- ownership / authz / idempotency / rate limit

### Pipeline / Data

新增：

- embedding shard
- 数据质量 report
- batch candidate pool
- review queue

## Phase 3

### Shared Contracts

新增：

- dynamic media 字段
- transition hint 扩展字段
- motion profile / grading 字段

### Frontend

新增：

- immersive gallery
- transition registry
- transition modules
- dynamic media stage

### Backend API

新增：

- SSE 增强
- grading service
- motion profile builder
- observability
- retention / redaction policy enforcement

### Pipeline / Data

新增：

- 500-1000 确认作品集
- scene / artwork 覆盖率报告
- 背景与作品适配报告

## 联调接口点

前后端主要联调只需要 5 个接口点：

1. corpus manifest
2. curation create
3. curation get
4. explanation get
5. optional curation stream

这意味着前后端的联调面其实很窄，重点不在接口数量，而在 contract 稳定性。

## 并行开工顺序

1. 先做 repo bootstrap
2. Shared Contracts 冻结 v0.1
3. Frontend 立即基于 fixture 开工
4. Pipeline 输出第一版真实数据给前端替换 fixture
5. Shared Contracts 再冻结 v0.2
6. Backend API 按 v0.2 接上 session / explanation / stream
7. Integration pass 只修 contract 漂移，不临时发明字段

## 推荐看板

### Frontend First Tickets

- `repo-bootstrap-web-v0`
- `web-shell-v0`
- `local-corpus-loader-v0`
- `background-matcher-v0`
- `gallery-scene-v0`
- `ux-state-matrix-v0`
- `transition-registry-v0`

### Backend First Tickets

- `repo-bootstrap-api-v0`
- `contracts-v0.1`
- `corpus-manifest-route-v0`
- `contracts-v0.2`
- `curation-session-route-v0`
- `artwork-explanation-route-v0`

### Data First Tickets

- `probe-met-v0`
- `batch-met-v0`
- `clean-normalize-v0`
- `background-scene-parse-v0`
- `relevance-benchmark-v0`
- `manifest-publish-v0`

## 风险与约束

### 风险 1：团队先卡在迁移策略，而不是功能实现

缓解：

- 明确采用 `parallel workspace bootstrap + strangler`
- Phase 0 不 rename `frontend/`

### 风险 2：前端先做页面时字段漂移

缓解：

- 一切页面状态都来自 contract fixture
- 页面组件不接受“临时对象”

### 风险 3：后端先做接口时超出前端需要

缓解：

- 只做 contract 里明确存在的字段
- Phase 1 不提前实现 session 层

### 风险 4：Pipeline 产物和 API 状态脱节

缓解：

- `SourceVersions` 进入 session request
- 所有 session 响应带 version 信息

## 一句话总结

V2 应该像四条并行工程线一起推进：

- 先 bootstrap repo
- 再冻结 v0.1 display/data contracts
- 前端和 pipeline 先把 thin slice 跑起来
- 然后再冻结 v0.2 session contracts 接入后端会话层
