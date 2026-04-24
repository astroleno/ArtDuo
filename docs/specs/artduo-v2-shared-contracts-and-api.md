---
title: ArtDuo V2 Shared Contracts and API
status: active
created: 2026-04-24
origin: docs/brainstorms/artduo-v2-lightweight-rebuild-requirements.md
---

# ArtDuo V2 共享协议与 API 规格

## 目标

这份文档的目标不是继续讨论产品方向，而是给前后端一套可以真正并行开工的合作边界。

一句话原则：

- 前端和后端分开推进
- `packages/contracts/` 是双方唯一共享的真相源
- 先冻结一版最小 contract，再分别推进页面和接口
- Phase 1 只冻结 thin slice 必需合同，Phase 2 再引入 session / explanation / stream

## Canonical Freeze

这部分用于解决“contract freeze v0.1 实际并没有冻结”的问题。

### v0.1 必冻合同

Phase 1 只能以这 6 份 contract 作为共享真相源：

- `packages/contracts/src/artwork.ts`
- `packages/contracts/src/background-scene.ts`
- `packages/contracts/src/background-match.ts`
- `packages/contracts/src/corpus.ts`
- `packages/contracts/src/exhibition-unit.ts`
- `packages/contracts/src/errors.ts`

配套 fixture：

- `packages/contracts/fixtures/corpus-manifest.json`
- `packages/contracts/fixtures/background-scenes.json`
- `packages/contracts/fixtures/exhibition-units.json`

### v0.2 新增合同

Phase 2 才引入以下会话类合同：

- `packages/contracts/src/curation-session.ts`
- `packages/contracts/src/artwork-explanation.ts`
- `packages/contracts/src/curation-events.ts`

配套 fixture：

- `packages/contracts/fixtures/curation-session-pending.json`
- `packages/contracts/fixtures/curation-session-ready.json`
- `packages/contracts/fixtures/artwork-explanation-pending.json`
- `packages/contracts/fixtures/artwork-explanation-ready.json`

### 命名统一规则

以下命名在 V2 中必须统一：

- 统一使用 `ExhibitionUnit`，不再使用 `ExhibitionSceneUnit`
- 统一使用 `CurationSession`，不再使用泛化的 `curation.ts` 命名
- 统一使用 `ArtworkExplanation`，不再使用过泛的 `explanation.ts` 语义
- 统一使用 `CurationEvent`，文件名为 `curation-events.ts`
- 统一使用 `ApiError`

## 协作模型

建议把 V2 明确拆成 4 条工作线：

1. Shared Contracts
2. Frontend
3. Backend API
4. Pipeline / Corpus Build

其中：

- `Shared Contracts` 是前后端对齐层
- `Frontend` 负责页面、交互、本地检索、背景匹配、转场消费
- `Backend API` 负责 session、explanation、可选 SSE 增强
- `Pipeline / Corpus Build` 负责作品库、背景 metadata、版本发布

## 目录边界

### Shared Contracts

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

### Frontend

- `apps/web/app/`
- `apps/web/components/`
- `apps/web/lib/`
- `packages/ui/src/`
- `packages/corpus/src/`

### Backend API

- `apps/api/src/routes/`
- `apps/api/src/services/`
- `apps/api/test/`

### Pipeline

- `apps/pipeline/src/`
- `data/`

## 协议优先原则

前后端协作必须遵守：

1. 先定 contract，再写页面和接口
2. contract 变更必须先更新 `packages/contracts/`
3. 前端不得自行发明接口字段
4. 后端不得绕过 contract 直接返回临时结构
5. SSE 事件名、状态字段、错误结构都归 contract 管
6. Phase 1 不得提前消费 v0.2 session 合同作为强依赖

## 核心实体

### ArtworkRecord

来源：`docs/specs/artduo-v2-local-corpus-and-media-schema.md`

用途：

- 作品基础 metadata
- 本地检索字段
- 远端媒体引用
- scene 匹配提示

### BackgroundSceneRecord

来源：`docs/specs/artduo-v2-background-scene-schema.md`

用途：

- 背景 metadata
- 背景匹配字段
- 挂载区域
- 转场语义

### ExhibitionUnit

用途：

- 把单件作品和单个背景场景组装成一个可展示 unit
- 给前端画廊、详情、沉浸式页直接消费
- `TransitionHint` 也由这个 contract 持有和冻结，不依赖别的 spec 才能成立

建议字段：

```ts
type ExhibitionUnit = {
  unitId: string
  artworkId: string
  backgroundSceneId: string

  order: number
  role: "opening" | "bridge" | "focus" | "closing"
  displayMode: "static-frame" | "motion-frame" | "director-focus"

  transitionIn?: TransitionHint
  transitionOut?: TransitionHint
}

type TransitionHint = {
  family:
    | "fade"
    | "dissolve"
    | "match-cut"
    | "depth-push"
    | "lateral-pan"
    | "light-swell"
    | "scale-focus"
  durationMs?: number
  intensity?: "soft" | "moderate" | "dramatic"
  implementationHint?: "auto" | "css" | "motion" | "video" | "webgl" | "three"
}
```

说明：

- `TransitionHint` 属于 `packages/contracts/src/exhibition-unit.ts` 的一部分
- v0.1 freeze 已经覆盖 `TransitionHint`
- `docs/specs/artduo-v2-background-scene-schema.md` 负责解释背景如何产出这些 hint，而不是拥有它

### SourceVersions

用途：

- 把本地生成结果和服务端 session 对齐到同一版本语义

```ts
type SourceVersions = {
  corpusVersion: string
  backgroundCatalogVersion: string
  contractsVersion: string
}
```

### CurationSession

Phase 2 才引入。

用途：

- 表达一次展览会话的服务端状态
- 给前端轮询和可选 SSE 共同消费
- 能无损承接前端本地生成的 exhibition snapshot

建议字段：

```ts
type CurationSession = {
  id: string
  status: "pending" | "partial" | "ready" | "failed"

  input: {
    emotion: string
    userText?: string
  }

  sourceVersions: SourceVersions

  clientSelection: {
    selectedArtworkIds: string[]
    selectionHash: string
    units: ClientExhibitionUnitInput[]
  }

  summary?: {
    title?: string
    preface?: string
    closing?: string
  }

  ownership: {
    mode: "anonymous-token"
    subjectId?: string
  }

  units: ExhibitionUnit[]
  createdAt: string
  updatedAt: string
  error?: ApiError
}

type ClientExhibitionUnitInput = {
  artworkId: string
  backgroundSceneId: string
  order: number
  role: "opening" | "bridge" | "focus" | "closing"
  displayMode: "static-frame" | "motion-frame" | "director-focus"
  transitionIn?: TransitionHint
  transitionOut?: TransitionHint
}
```

说明：

- `clientSelection.units` 用来无损传递前端本地生成的顺序、背景和转场提示
- `sourceVersions` 用来解决“前端本地结果”和“后端会话状态”对不上版本的问题

### ArtworkExplanation

Phase 2 才引入。

用途：

- 单件作品详情页按需讲解
- 不阻塞首屏展览生成

建议字段：

```ts
type ArtworkExplanation = {
  artworkId: string
  scope: "public" | "session"
  sessionId?: string
  status: "pending" | "ready" | "failed"
  shortText?: string
  fullText?: string
  generatedAt?: string
  error?: ApiError
}
```

## Release Artifact 边界

这里明确解决“背景 scene 到底是不是 manifest 的一部分”的冲突。

结论：

- 运行时只认一份 `release manifest`
- 背景 scene catalog 是 manifest 的一部分
- `GET /v1/background-scenes` 不属于 runtime freeze v0.1，也不是主路径接口
- 如果未来需要单独拉 catalog，只能作为 debug / admin convenience endpoint，不作为主协议

## HTTP API 契约

### 1. `GET /v1/corpus/manifest`

Phase: v0.1
Owner: Backend / Pipeline
Consumer: Frontend

用途：

- 返回当前 release 版本
- 返回可下载 shard 列表
- 返回背景 scene catalog shard

响应草案：

```ts
type GetCorpusManifestResponse = ReleaseManifest

type ReleaseManifest = {
  release: {
    corpusVersion: string
    backgroundCatalogVersion: string
    contractsVersion: string
    createdAt: string
  }
  shards: {
    metadata: ShardInfo[]
    search: ShardInfo[]
    mediaIndex: ShardInfo[]
    backgroundScenes: ShardInfo[]
    embeddings?: ShardInfo[]
  }
}
```

说明：

- `embeddings` 在 Phase 1 是可选字段，不得作为 thin slice 前提
- Phase 1 前端只依赖 `metadata/search/backgroundScenes`

### 2. `POST /v1/curations`

Phase: v0.2
Owner: Backend API
Consumer: Frontend

用途：

- 记录一次展览会话
- 返回服务端会话 id
- 保存前端本地 exhibition snapshot 的必要信息

请求草案：

```ts
type CreateCurationRequest = {
  emotion: string
  userText?: string
  sourceVersions: SourceVersions
  clientSelection: {
    selectedArtworkIds: string[]
    selectionHash: string
    units: ClientExhibitionUnitInput[]
  }
}
```

响应草案：

```ts
type CreateCurationResponse = {
  session: CurationSession
}
```

说明：

- 前端本地完成作品召回和背景匹配后，把 `clientSelection` 提交给后端
- 后端不负责首屏候选生成，但负责会话记录和补充内容状态

### 3. `GET /v1/curations/:id`

Phase: v0.2
Owner: Backend API
Consumer: Frontend

用途：

- 读取会话状态
- 轮询获取补充文案、结语和失败信息

响应草案：

```ts
type GetCurationResponse = {
  session: CurationSession
}
```

### 4. `GET /v1/curations/:id/stream`

Phase: v0.2
Owner: Backend API
Consumer: Frontend

用途：

- 可选 SSE 增强
- 不得成为主路径前提

事件草案：

```ts
type CurationEvent =
  | { type: "session.partial"; session: CurationSession }
  | { type: "preface.ready"; sessionId: string; preface: string }
  | { type: "closing.ready"; sessionId: string; closing: string }
  | { type: "session.ready"; session: CurationSession }
  | { type: "session.failed"; sessionId: string; error: ApiError }
```

### 5. `GET /v1/artworks/:id/explanation`

Phase: v0.2
Owner: Backend API
Consumer: Frontend

用途：

- 详情页按需讲解
- 默认返回 public 级 explanation
- 如果未来要做 session 派生 explanation，再要求 session 权限

请求草案：

```ts
type GetArtworkExplanationRequest = {
  artworkId: string
  scope?: "public" | "session"
  sessionId?: string
}
```

响应草案：

```ts
type GetArtworkExplanationResponse = {
  explanation: ArtworkExplanation
}
```

## Ownership / Authz 模型

这里用于解决“session / stream / explanation 没有 ownership 模型”的问题。

### Phase 1

- Phase 1 不落 session API，因此不存在跨会话读写问题
- 前端只消费 fixture 和本地 manifest

### Phase 2

默认采用 `anonymous-token` 模型：

- `account` 模式不属于 v0.2 freeze，也不是 Phase 2 的实现要求
- `POST /v1/curations` 创建 session 时，服务端签发一个 opaque session access token
- token 只保存服务端 hash，明文只在响应时返回给客户端一次
- 生产环境优先使用 cookie `artduo_session`，属性固定为 `HttpOnly + Secure + SameSite=Lax + Path=/v1`
- token TTL 默认 `7 days`
- 本地开发和非浏览器客户端允许 header fallback：`X-ArtDuo-Session-Token`
- `GET /v1/curations/:id` 和 `GET /v1/curations/:id/stream` 必须校验该 token
- 没有 token、token 不匹配、token 过期时统一返回 `403`
- `POST /v1/curations` 必须校验 `Origin` 或 `Referer` 与 allowlist 同源；不满足时返回 `403`
- v0.2 只有 `POST /v1/curations` 是 state-changing endpoint，因此 CSRF/origin 校验只要求覆盖它

### Explanation 范围

- `scope=public` 的 explanation 可公共缓存，不依赖 session 权限
- `scope=session` 的 explanation 必须同时带 `sessionId` 且通过同一 session token 校验
- Phase 2 默认只要求 `scope=public` 真正落地

### Canonical Backend Enforcement

Phase 2 后端实现顺序固定为：

1. `Origin/Referer` 校验
2. rate limit
3. ownership token 解析
4. idempotency 校验
5. budget guard
6. handler 逻辑
7. request redaction + log 写入

这条顺序属于实现冻结的一部分，不建议各服务自己重排。

## 错误契约

前后端必须共用统一错误结构。

```ts
type ApiError = {
  code: string
  message: string
  retryable?: boolean
  details?: Record<string, unknown>
}
```

约定：

- 前端所有错误 UI 只认 `ApiError`
- 后端所有失败响应必须可映射成 `ApiError`
- 不再允许一部分接口返回 `{ error: string }`，另一部分返回自定义字段

## Idempotency / Rate Limit / Budget

这里用于解决成本和滥用控制缺失的问题。

### Idempotency

- `POST /v1/curations` 必须支持 `Idempotency-Key`
- 相同 key + 相同 payload 应返回同一 session，而不是重复创建
- idempotency record 默认保留 `24 hours`

### Rate Limit

建议默认阈值：

- `POST /v1/curations`: `10 requests / 5 min / IP`
- `GET /v1/curations/:id/stream`: `2 concurrent streams / session`
- `GET /v1/artworks/:id/explanation`: `30 requests / min / IP`

### Budget Guard

建议：

- explanation 生成必须记录 token / cost 预算
- 单 session 的补充生成应有上限
- 到达 budget cap 时返回 `429` 或 `budget_exceeded`
- 最少要持久化：
  - `generatedExplanationCount`
  - `generatedTokenEstimate`
  - `streamOpenCount`

## Retention / Redaction

这里用于解决 `userText` 和 request log 的隐私边界问题。

约定：

- `userText` 可以进入 session store，但不得原样进入常规 request log
- request log 只保留 hash、长度和 redacted preview
- 原始 `userText` 默认保留 `<= 7 days`
- analytics 和 metrics 只使用聚合字段，不保留原文

## Fixture 契约

为了让前后端可以分开开工，建议在 `packages/contracts/fixtures/` 下维护：

### v0.1 fixture

- `corpus-manifest.json`
- `background-scenes.json`
- `exhibition-units.json`
- `errors.json`

### v0.2 fixture

- `curation-session-pending.json`
- `curation-session-ready.json`
- `artwork-explanation-pending.json`
- `artwork-explanation-ready.json`
- `curation-events.ndjson`

用途：

- 前端直接对 fixture 开发
- 后端实现完成后跑 contract test
- design / motion / transition 也可以基于 fixture 提前推进

## 前端开工条件

### Phase 1

前端只需要这些东西就能先开工：

1. `ArtworkRecord`
2. `BackgroundSceneRecord`
3. `BackgroundMatch`
4. `ExhibitionUnit`
5. `ReleaseManifest`
6. 一组 v0.1 fixture

基于这 6 个输入，前端可以先完成：

- 首页
- 基础画廊页
- 背景匹配模块
- scene unit 渲染
- 模块化转场 registry
- 沉浸式壳子

### Phase 2

新增依赖：

- `CurationSession`
- `ArtworkExplanation`
- `CurationEvent`

## 后端开工条件

### Phase 1

后端只需要这些东西就能先开工：

1. `ReleaseManifest`
2. `ApiError`
3. background scene shard contract

基于这 3 个输入，后端可以先完成：

- manifest endpoint
- release artifact 输出校验
- scene catalog shard 输出

### Phase 2

新增依赖：

1. `CreateCurationRequest/Response`
2. `CurationSession`
3. `ArtworkExplanation`
4. `CurationEvent`

基于这些输入，后端可以完成：

- curation session route
- explanation route
- SSE route
- ownership / authz / rate limit

## 集成节奏建议

### 阶段 A：Contract Freeze v0.1

冻结：

- artwork
- background-scene
- background-match
- corpus
- exhibition-unit
- errors

产出：

- TS 类型
- JSON fixture

### 阶段 B：Frontend and Pipeline Thin Slice

前端先完成：

- 页面结构
- 本地加载
- 匹配模块
- 转场模块

后端 / pipeline 完成：

- manifest
- metadata/search/background scene shards

### 阶段 C：Contract Freeze v0.2

冻结：

- curation-session
- artwork-explanation
- curation-events

### 阶段 D：Backend Session Layer

后端完成：

- session route
- explanation route
- stream route
- authz / idempotency / budget / retention

### 阶段 E：Integration Pass

联调检查：

- 字段名不漂移
- `pending/partial/ready/failed` 一致
- 事件类型一致
- fixture 和真实响应一致
- session access 不能越权

## 一句话总结

V2 的前后端协作要建立在两段式 contract freeze 上：

- Phase 1 先冻展示和数据层合同
- Phase 2 再冻 session 和 explanation 合同
- 双方只通过 `packages/contracts/` 和 fixture 对齐
