---
title: ArtDuo V2 Lightweight Rebuild Plan
status: phase1-closed-phase2-ready
created: 2026-04-23
updated: 2026-04-29
origin: docs/brainstorms/artduo-v2-lightweight-rebuild-requirements.md
---

# ArtDuo V2 轻量重建技术计划

## 当前状态

Phase 1 已关账，可以推进 Phase 2，但当前代码仍需要以清晰 PR 边界固化。

已验证事实：

- `apps/web` 已从 scaffold 落地为 Next App Router 产品 thin slice。
- `Landing -> Gallery -> Detail` 主路径已接入 release manifest、embedding records、rerank 和背景场景选择。
- 当前 runtime 真相源是 `data/releases/2026-04-25-curation-b/manifest.json` 及同目录 shards。
- 当前 web 实现是 Phase 1 server-side release bridge：Next.js 服务端读取本地 release files 并执行检索。
- 这份关账不宣称严格浏览器本地 IndexedDB/Worker 架构已经完成；该工作进入后续计划。
- `pnpm preflight:check` 已覆盖 workspace tests、typecheck、build 和 Playwright E2E。
- `data/curation/reports/phase1-closeout-report.md` 记录了关账结果、benchmark 和人工 top10 gate。

下一份执行计划：

- `docs/plans/artduo-v2-phase2-continuation-plan.md`

## 问题框架

当前项目最重的问题，不是单点性能不足，而是职责边界已经失衡：

- 前端承担了过多业务编排
- 数据层没有形成稳定的 release artifact
- API 和 SSE 被误用成首屏主链路补丁
- 页面架构、状态流和契约命名都已经漂移

这份计划的目标不是继续优化旧链路，而是建立一条新的、能让前后端并行推进的主链路。

## 需求追踪

- R1 快速生成可浏览展览：通过“本地先召回、后补讲解”的双阶段响应实现
- R2 非流式条件下也能成立：默认采用本地检索 + 状态 API，SSE 仅做增强
- R3 数据来自稳定数据层：建立 release manifest，而不是请求时拼大文件
- R4 讲解解耦主链路：拆成作品级 explanation 和展览级补充
- R5 前端保留体验层职责：运行本地只读检索，消费统一 contract
- R6 服务端拥有安全边界：密钥、外部调用和版本发布全部留在服务端
- R7 可观测性：建立加载、检索、补充生成和降级指标
- R8 保留沉浸式路线：先恢复主路径，再恢复沉浸式产品化
- R9 动态媒体增强预留字段：在 media / presentation 合同中预留
- R10 背景场景与画作单元建模：scene unit、背景匹配和转场合同一起设计
- R11 前后端共享协议协作：通过 `packages/contracts/` 和 fixture 并行开发
- R12 作品收集三段流程：probe、batch、review loop
- R13 session / privacy / cost 边界：在 v0.2 会话层显式建模
- R14 IA 和状态矩阵：通过独立 UX spec 落地
- R15 release artifact 可重放：manifest + media version / fingerprint
- R16 Phase 1 可信度门槛：benchmark + 人工评审不能缺席

## 关键输入文档

- `docs/specs/artduo-v2-shared-contracts-and-api.md`
- `docs/specs/artduo-v2-ux-flow-and-state-matrix.md`
- `docs/specs/artduo-v2-local-corpus-and-media-schema.md`
- `docs/specs/artduo-v2-background-scene-schema.md`
- `docs/plans/artduo-v2-frontend-backend-workstreams.md`
- `docs/plans/artduo-v2-artwork-collection-runbook.md`
- `data/curation/reports/phase1-closeout-report.md`
- `docs/plans/artduo-v2-phase2-continuation-plan.md`

## 非协商技术决策

### 决策 1：当前项目保留在 legacy 分支，新项目在新分支启动

建议分支策略：

- 当前项目保留在独立 legacy 分支
- V2 在新的分支上推进
- 新分支中可以保留旧目录作为 donor/reference，但不再继续在旧主链路上叠加功能

### 决策 2：repo 迁移采用 `parallel workspace bootstrap + strangler`

第一步不做 rename，不做 bulk copy。

明确规则：

- 不 rename 现有 `frontend/`
- 不把整个 `frontend/` 直接 copy 到 `apps/web/`
- 在仓库根目录新建 `apps/` 与 `packages/`
- 旧 `frontend/` 作为 donor/reference 保留
- 只迁 UI 组件、样式和动效，不迁旧数据流、旧状态流和旧 API 编排

这是为了解决“Phase 1 开工前团队先卡死在迁移策略”的问题。

### 决策 3：前端采用 hybrid donor，不继承任意一套旧前端

- 当前 `frontend/` 是主要 UI donor
- `reference/artduo/` 是轻壳、灯光、粒子和基础动效 donor
- V2 自己建立新的页面壳、状态层和 contract 层

### 决策 4：runtime 只认一份 release manifest

Phase 1 的 runtime 真相源只有一份：`GET /v1/corpus/manifest` 返回的 release manifest。

它必须同时包含：

- `metadata` shard
- `search` shard
- `mediaIndex` shard
- `backgroundScenes` shard
- `embeddings` shard 可选

结论：

- background scene catalog 是 release manifest 的一部分
- runtime 不依赖额外的 `GET /v1/background-scenes` 主路径接口
- 如果未来有单独 catalog endpoint，也只能是 debug / admin convenience endpoint

### 决策 5：共享协议分两段冻结

- `v0.1` 只冻结 display / data contracts
- `v0.2` 再冻结 session / explanation / event contracts

Phase 1 不允许提前把 session 层变成强依赖。

### 决策 6：本地优先检索采用两级策略

- Phase 1：metadata + search shard + 粗召回 + 背景匹配
- Phase 2：embedding shard + 本地向量检索 + rerank

这能避免 thin slice 一上来就被 embedding 模型冷启动和全量向量预热拖垮。

### 决策 7：会话类 API 后移到 v0.2，并带 ownership / cost 约束

`POST /v1/curations`、`GET /v1/curations/:id`、`GET /v1/curations/:id/stream`、`GET /v1/artworks/:id/explanation` 都是 Phase 2 再引入。

一旦引入，就必须同时带上：

- ownership / authz
- idempotency
- rate limit
- budget guard
- retention / redaction

### 决策 8：信息架构和状态矩阵单独成文

主导航、返回规则、页面状态矩阵不再散落在页面口头约定里，统一以 `docs/specs/artduo-v2-ux-flow-and-state-matrix.md` 为准。

### 决策 9：Phase 1 接受 server-side release bridge，严格浏览器本地检索后移

Phase 1 的产品 thin slice 已经证明 release-backed 主路径成立。当前实现允许 Next.js 服务端读取 release manifest/shards 并执行检索，因为它满足以下约束：

- runtime 仍只消费 release manifest 和 shards
- 不依赖旧 `frontend/` 数据流
- 不依赖 SSE 或 runtime LLM
- 不引入 `GET /v1/background-scenes` 主路径
- 可通过 `pnpm preflight:check` 和 benchmark 重放

这不是放弃本地优先路线。IndexedDB cache、Worker search 和浏览器侧 shard loading 进入后续 follow-up，在实现前不得把当前形态描述为完整 local-first runtime。

## 目标结构

```text
apps/
  web/
    app/
    components/
    lib/
  api/
    src/
    test/
  pipeline/
    src/
packages/
  contracts/
    src/
    fixtures/
  ui/
    src/
  corpus/
    src/
frontend/
  ...legacy donor only...
reference/
  artduo/
  chatgpt/
docs/
  brainstorms/
  plans/
  roadmaps/
  specs/
```

## Preflight：Repo Bootstrap

这一步不算三阶段产品交付，但必须先完成。

### Bootstrap 步骤

1. 在仓库根目录新增 `pnpm-workspace.yaml`
2. 新建 `apps/web`、`apps/api`、`apps/pipeline`
3. 新建 `packages/contracts`、`packages/ui`、`packages/corpus`
4. 在文档和看板中把 `frontend/` 标记为 donor/reference
5. 建立最小 root scripts，保证新工作区能独立安装和构建

### Bootstrap 完成定义

- 新工作区可以独立安装和构建
- `frontend/` 没有被 rename / move / bulk copy
- V2 开工不再依赖旧 HTML route layer

## Contract Freeze 策略

### v0.1 必冻合同

- `packages/contracts/src/artwork.ts`
- `packages/contracts/src/background-scene.ts`
- `packages/contracts/src/background-match.ts`
- `packages/contracts/src/corpus.ts`
- `packages/contracts/src/exhibition-unit.ts`
- `packages/contracts/src/errors.ts`

### v0.2 新增合同

- `packages/contracts/src/curation-session.ts`
- `packages/contracts/src/artwork-explanation.ts`
- `packages/contracts/src/curation-events.ts`

### 命名约束

- 统一使用 `ExhibitionUnit`
- 不再使用 `ExhibitionSceneUnit`
- 统一使用 `CurationSession`
- 不再使用泛化的 `curation.ts`
- 统一使用 `ArtworkExplanation`
- 统一使用 `ApiError`

## 三阶段实施

## Phase 1: Foundation Thin Slice

### 目标

用一条最小可用主链路证明：

- 新工作区成立
- `v0.1` contract 真正冻结
- release manifest 和 shard 可以被前端消费
- 本地粗召回、背景匹配和基础画廊成立
- relevance benchmark 和人工评审门槛成立

### 实施单元 1：工作区骨架与 v0.1 contracts

Files:

- `package.json`
- `pnpm-workspace.yaml`
- `apps/web/package.json`
- `apps/api/package.json`
- `apps/pipeline/package.json`
- `packages/contracts/src/artwork.ts`
- `packages/contracts/src/background-scene.ts`
- `packages/contracts/src/background-match.ts`
- `packages/contracts/src/corpus.ts`
- `packages/contracts/src/exhibition-unit.ts`
- `packages/contracts/src/errors.ts`
- `packages/contracts/fixtures/corpus-manifest.json`
- `packages/contracts/fixtures/background-scenes.json`
- `packages/contracts/fixtures/exhibition-units.json`

Tests:

- `packages/contracts/src/artwork.test.ts`
- `packages/contracts/src/background-scene.test.ts`
- `packages/contracts/src/background-match.test.ts`
- `packages/contracts/src/corpus.test.ts`
- `packages/contracts/src/exhibition-unit.test.ts`
- `packages/contracts/src/errors.test.ts`

Test scenarios:

- `v0.1` 只覆盖 thin slice 需要的 display/data contract
- fixture 可以描述最小展览结果
- 前后端在构建时不会分叉出第二套字段命名
- `ExhibitionUnit`、`BackgroundSceneRecord`、`ReleaseManifest` 命名保持一致

### 实施单元 2：release manifest、作品 shard 与背景 scene shard 构建

Files:

- `apps/pipeline/src/build-artwork-metadata-shards.ts`
- `apps/pipeline/src/build-search-shards.ts`
- `apps/pipeline/src/build-media-index.ts`
- `apps/pipeline/src/build-background-scenes.ts`
- `apps/pipeline/src/build-release-manifest.ts`
- `apps/api/src/routes/corpus.ts`
- `packages/contracts/src/corpus.ts`
- `packages/contracts/src/background-scene.ts`

Tests:

- `apps/pipeline/src/build-artwork-metadata-shards.test.ts`
- `apps/pipeline/src/build-search-shards.test.ts`
- `apps/pipeline/src/build-media-index.test.ts`
- `apps/pipeline/src/build-background-scenes.test.ts`
- `apps/pipeline/src/build-release-manifest.test.ts`
- `apps/api/test/routes/corpus.test.ts`

Test scenarios:

- 现有处理后的作品数据能稳定产出为 release artifact
- manifest 明确包含 `metadata/search/mediaIndex/backgroundScenes`
- `embeddings` 在 Phase 1 可以缺席，不影响 thin slice
- background scene catalog 不需要额外 runtime endpoint
- 缺图、缺年份、缺描述等不完整数据能被容忍
- release artifact 中记录的是远端媒体引用，而不是媒体二进制本体
- 如果上游只提供可变 URL，pipeline 会补齐 `mediaVersion` 或等价 fingerprint

### 实施单元 3：probe、benchmark 与人工评审门槛

Files:

- `apps/pipeline/src/probe-met.ts`
- `scripts/collect/met-probe.js`
- `scripts/collect/met-batch.js`
- `apps/pipeline/src/build-relevance-benchmark.ts`
- `data/curation/benchmarks/phase1-prompts.json`
- `data/curation/reports/phase1-probe-report.md`
- `data/curation/reports/phase1-benchmark-report.md`
- `docs/plans/artduo-v2-artwork-collection-runbook.md`

Tests:

- `apps/pipeline/src/probe-met.test.ts`
- `apps/pipeline/src/build-relevance-benchmark.test.ts`

Test scenarios:

- benchmark prompt set 可重复执行
- probe 输出可追溯到 query、source、采样范围和命中结果
- probe verdict 能区分 `pass / mixed / fail`，review 决策能区分 `promote / hold / reject`
- Phase 1 不会在没有可信度报告的情况下宣称通过
- 在 `apps/pipeline/` 正式接管前，当前仓库已有 `npm run collect:met:probe` 和 `npm run collect:met:batch` 可直接生成采集 artifacts

### 实施单元 4：本地加载、缓存、粗召回与背景匹配

Files:

- `packages/corpus/src/loader.ts`
- `packages/corpus/src/indexeddb-cache.ts`
- `packages/corpus/src/search-worker.ts`
- `packages/corpus/src/coarse-search.ts`
- `packages/corpus/src/background-scene-loader.ts`
- `apps/web/lib/local-curation.ts`
- `apps/web/lib/background-matcher.ts`
- `apps/web/lib/background-score.ts`
- `packages/contracts/src/background-match.ts`

Tests:

- `packages/corpus/src/loader.test.ts`
- `packages/corpus/src/coarse-search.test.ts`
- `apps/web/lib/local-curation.test.ts`
- `apps/web/lib/background-matcher.test.ts`
- `apps/web/lib/background-score.test.ts`

Test scenarios:

- 用户输入一句情绪文本后，客户端能在本地得到首批候选作品
- 首屏只加载必要 shard，不要求全量预热
- 第二次访问时可以命中 IndexedDB 缓存
- 搜索在 Worker 中执行时不会阻塞主线程
- 背景匹配结果能输出 score breakdown
- 没有强匹配时可以回退到 neutral-safe scene

### 实施单元 5：Landing、Gallery 与最小 Detail 路由

Files:

- `apps/web/app/page.tsx`
- `apps/web/app/gallery/[id]/page.tsx`
- `apps/web/app/artworks/[id]/page.tsx`
- `apps/web/lib/exhibition-snapshot.ts`
- `packages/ui/src/artwork-card.tsx`
- `packages/ui/src/dynamic-background.tsx`
- `packages/ui/src/gallery-scene.tsx`
- `packages/ui/src/artwork-detail-shell.tsx`

Tests:

- `apps/web/app/page.test.tsx`
- `apps/web/app/gallery/[id]/page.test.tsx`
- `apps/web/app/artworks/[id]/page.test.tsx`
- `packages/ui/src/gallery-scene.test.tsx`
- `packages/ui/src/artwork-detail-shell.test.tsx`

Test scenarios:

- 用户可以输入情绪并进入展览页
- 展览页在只拿到本地首批作品时也能成立
- detail 页即使 explanation 不存在，也能用本地 metadata 成立
- 页面按状态矩阵展示 `loading / partial / empty / error / offline`
- 不再依赖旧 `page.html` 或 `localStorage` 轮询同步

### Phase 1 退出标准

- repo bootstrap 完成，`frontend/` 仍保持 donor/reference 身份
- `v0.1` contract 和 fixture 冻结
- `GET /v1/corpus/manifest` 返回 release manifest，且与前端消费一致
- runtime 不依赖 `GET /v1/background-scenes`
- landing -> gallery -> detail 主路径成立，不依赖 SSE
- 至少一类背景 scene 可以和作品形成稳定配对
- Phase 1 benchmark 通过门槛：
  - 固定 benchmark prompts 至少 20 条
  - 至少 80% 的 prompts 在 top 10 中有 5 件以上被人工判定为“可用候选”
  - probe 第一轮报告明确列出 `pass / mixed / fail` 结论，并生成 canonical batch handoff artifact

### Phase 1 关账结果

Status: closed on 2026-04-29.

Release:

- `data/releases/2026-04-25-curation-b/manifest.json`
- metadata/search/media/background-scenes/embeddings shards are present for 221 release-ready artworks and 50 background scenes.

Product path:

- `apps/web/app/page.tsx`
- `apps/web/app/gallery/page.tsx`
- `apps/web/app/artwork/[id]/page.tsx`
- `apps/web/components/artwork-image.tsx`
- `apps/web/lib/release-catalog.ts`

Acceptance:

- `pnpm preflight:check` passes.
- Workspace tests include 4 web unit tests for release loading, search, empty query handling, and missing shard diagnostics.
- Playwright E2E has 4 passing browser tests for Landing -> Gallery -> Detail and Phase 1 state coverage.
- `pnpm vector:benchmark -- --release-version 2026-04-25-curation-b` reports rerank Top-1 `95.83%` and Top-5 `100%`.
- Manual top10 gate is 20/24 pass, 83.33%, above the 80% Phase 1 threshold.

Known deferral:

- Browser-local IndexedDB/Worker runtime remains open and must be planned explicitly before claiming strict local-first execution.

## Phase 2: Curation Core Experience

Status: next.

### 目标

把“能跑的薄切片”升级成“可信的策展体验”，补齐排序、详情、session 和按需讲解。

### 实施单元 6：embedding shard、本地向量检索与 rerank

Files:

- `apps/pipeline/src/build-embedding-shards.ts`
- `packages/corpus/src/query-embedding.ts`
- `packages/corpus/src/vector-search.ts`
- `packages/corpus/src/rerank.ts`
- `apps/web/lib/build-exhibition.ts`

Tests:

- `apps/pipeline/src/build-embedding-shards.test.ts`
- `packages/corpus/src/query-embedding.test.ts`
- `packages/corpus/src/vector-search.test.ts`
- `packages/corpus/src/rerank.test.ts`

Test scenarios:

- 用户情绪文本可以转成稳定查询意图
- embedding shard 通过可选预热接入，不阻塞 Phase 1 主路径
- rerank 结果对相似输入保持基本一致
- 模型未预热时可以安全回退到粗召回

### 实施单元 7：v0.2 contracts、session API 与 explanation API

Files:

- `packages/contracts/src/curation-session.ts`
- `packages/contracts/src/artwork-explanation.ts`
- `packages/contracts/src/curation-events.ts`
- `packages/contracts/fixtures/curation-session-pending.json`
- `packages/contracts/fixtures/curation-session-ready.json`
- `packages/contracts/fixtures/artwork-explanation-pending.json`
- `packages/contracts/fixtures/artwork-explanation-ready.json`
- `apps/api/src/routes/curations.ts`
- `apps/api/src/routes/curation-stream.ts`
- `apps/api/src/routes/artworks.ts`
- `apps/api/src/services/explanations/get-artwork-explanation.ts`
- `apps/api/src/services/explanations/explanation-cache.ts`

Tests:

- `packages/contracts/src/curation-session.test.ts`
- `packages/contracts/src/artwork-explanation.test.ts`
- `packages/contracts/src/curation-events.test.ts`
- `apps/api/test/routes/curations.test.ts`
- `apps/api/test/routes/curation-stream.test.ts`
- `apps/api/test/routes/artworks.test.ts`

Test scenarios:

- `CreateCurationRequest` 能无损承接前端本地生成的 exhibition snapshot
- session 状态和事件语义一致使用 `pending / partial / ready / failed`
- explanation 可单独按需生成和缓存
- stream 是增强，不是主路径前提

### 实施单元 8：ownership、authz、idempotency、budget 与 retention

Files:

- `apps/api/src/services/auth/session-token.ts`
- `apps/api/src/services/http/idempotency-store.ts`
- `apps/api/src/services/http/rate-limit.ts`
- `apps/api/src/services/privacy/request-redaction.ts`
- `apps/api/src/services/privacy/retention-policy.ts`
- `apps/api/src/services/curation/budget-guard.ts`

Tests:

- `apps/api/test/services/session-token.test.ts`
- `apps/api/test/services/idempotency-store.test.ts`
- `apps/api/test/services/rate-limit.test.ts`
- `apps/api/test/services/request-redaction.test.ts`
- `apps/api/test/services/retention-policy.test.ts`
- `apps/api/test/services/budget-guard.test.ts`

Test scenarios:

- 创建 session 后会返回可用于读取自身状态的 ownership token
- `POST /v1/curations` 支持 `Idempotency-Key`
- `userText` 不会被原样写入常规 request log
- raw `userText` retention 可配置且默认短期
- explanation 和 stream 受 budget / rate limit 保护

### 实施单元 9：状态对齐、Detail 增强与 session-aware 客户端

Files:

- `apps/web/lib/curation-client.ts`
- `apps/web/lib/build-scene-units.ts`
- `apps/web/app/artworks/[id]/page.tsx`
- `apps/web/lib/explanation-client.ts`
- `apps/web/lib/session-state.ts`

Tests:

- `apps/web/lib/curation-client.test.ts`
- `apps/web/lib/build-scene-units.test.ts`
- `apps/web/lib/session-state.test.ts`
- `apps/web/app/artworks/[id]/page.test.tsx`

Test scenarios:

- 详情页可以独立打开，不依赖上一个页面写本地状态
- 本地 exhibition snapshot 和服务端 session 能按 `SourceVersions` 对齐
- 同一状态在 polling 和 stream 模式下语义一致
- 页面在 `partial` 状态下依然可用，不会等 explanation 全齐才显示

### Phase 2 退出标准

- `v0.2` contract 和 fixture 冻结
- 本地向量检索和 rerank 可以稳定工作
- `POST /v1/curations`、`GET /v1/curations/:id`、`GET /v1/artworks/:id/explanation` 主路径成立
- session / explanation 带 ownership、authz、idempotency、rate limit 和 retention 约束
- benchmark 复测结果优于 Phase 1，且排序质量足以支撑可信策展

## Phase 3: Immersive Productization

### 目标

恢复并增强沉浸式路线，同时补齐模块化转场、动态媒体、观测和发布质量。

### 实施单元 10：沉浸式画廊与模块化转场 registry

Files:

- `apps/web/app/gallery/[id]/immersive/page.tsx`
- `packages/ui/src/immersive/immersive-gallery.tsx`
- `packages/ui/src/immersive/image-lightbox.tsx`
- `packages/ui/src/immersive/progress-indicator.tsx`
- `packages/ui/src/immersive/scene-orchestrator.ts`
- `packages/ui/src/transitions/registry.ts`
- `packages/ui/src/transitions/fade-transition.ts`
- `packages/ui/src/transitions/dissolve-transition.ts`
- `packages/ui/src/transitions/light-swell-transition.ts`
- `packages/ui/src/transitions/depth-push-transition.ts`

Tests:

- `apps/web/app/gallery/[id]/immersive/page.test.tsx`
- `packages/ui/src/immersive/image-lightbox.test.tsx`
- `packages/ui/src/immersive/scene-orchestrator.test.ts`
- `packages/ui/src/transitions/registry.test.ts`

Test scenarios:

- 沉浸式页面在最小展览数据下也能成立
- 不同 unit 可以走不同 transition family
- 某个 transition module 不可用时能回退到 `fade`
- 默认实现不依赖 WebGL/Three.js，但可平滑接入增强实现

### 实施单元 11：动态媒体与分级展示

Files:

- `apps/api/src/services/curation/grade-artworks.ts`
- `apps/api/src/services/curation/build-motion-profile.ts`
- `packages/contracts/src/curation-grade.ts`
- `packages/ui/src/immersive/video-stage.tsx`
- `packages/ui/src/immersive/director-focus.tsx`

Tests:

- `apps/api/test/services/grade-artworks.test.ts`
- `apps/api/test/services/build-motion-profile.test.ts`
- `packages/ui/src/immersive/video-stage.test.tsx`
- `packages/ui/src/immersive/director-focus.test.tsx`

Test scenarios:

- 作品可以稳定分配到 A/B/C 级
- 没有动态媒体时可以回退到静态图 + 轻动效
- A 级作品可使用更强的导演式展示策略
- 背景、作品和动态媒体的组合不会破坏主导航路径

### 实施单元 12：观测、缓存回退与发布质量

Files:

- `apps/api/src/observability/metrics.ts`
- `apps/api/src/observability/request-log.ts`
- `apps/web/lib/analytics.ts`
- `packages/corpus/src/prefetch.ts`
- `apps/api/test/e2e/curation-flow.e2e.test.ts`

Tests:

- `apps/api/test/e2e/curation-flow.e2e.test.ts`
- `apps/api/test/observability/metrics.test.ts`
- `packages/corpus/src/prefetch.test.ts`

Test scenarios:

- 可以记录展览创建、检索、讲解生成和降级触发耗时
- SSE 失败时客户端可以平滑回退到 polling 或本地状态
- 下一批语料 shard 可以在后台预取
- 发布流程可以校验 release manifest 和媒体版本信息

### Phase 3 退出标准

- 沉浸式路线完整恢复
- 模块化转场、动态媒体和分级能力成立
- 可观测性、缓存回退和发布质量工具链可用
- 团队可以根据指标定位性能、质量和成本问题

## 依赖关系与顺序

1. 先完成 repo bootstrap
2. 再冻结 `v0.1` contracts
3. 然后让 pipeline 产出 release manifest 和第一批真实数据
4. 前端基于 fixture 和真实 shard 跑通 thin slice
5. benchmark 通过后，再冻结 `v0.2`
6. 最后接入 session / explanation / stream 和沉浸式增强

## 一句话总结

V2 的落地顺序应该是：

- 先把 repo 和 contract 站稳
- 再把本地薄切片跑通并建立质量门槛
- 然后补会话层、解释层和沉浸式产品化
