# ArtDuo Docs

本目录用于承接 ArtDuo V2 的正式文档，按一套轻量但可直接开工的 superpowers 流程组织：

1. `docs/brainstorms/` 说明为什么做、保留什么、舍弃什么
2. `docs/plans/` 说明怎么做、怎么分工、怎么收集数据
3. `docs/roadmaps/` 说明按什么阶段推进
4. `docs/specs/` 说明共享协议、数据模型、状态矩阵和 schema

## 当前文档

- `docs/brainstorms/artduo-v2-lightweight-rebuild-requirements.md`
- `docs/plans/artduo-v2-lightweight-rebuild-plan.md`
- `docs/plans/artduo-v2-frontend-backend-workstreams.md`
- `docs/plans/artduo-v2-artwork-collection-runbook.md`
- `docs/roadmaps/artduo-v2-three-phase-roadmap.md`
- `docs/specs/artduo-v2-shared-contracts-and-api.md`
- `docs/specs/artduo-v2-ux-flow-and-state-matrix.md`
- `docs/specs/artduo-v2-local-corpus-and-media-schema.md`
- `docs/specs/artduo-v2-background-scene-schema.md`

## 推荐阅读顺序

1. 先看 `docs/brainstorms/artduo-v2-lightweight-rebuild-requirements.md`
2. 再看 `docs/plans/artduo-v2-lightweight-rebuild-plan.md`
3. 然后看 `docs/plans/artduo-v2-frontend-backend-workstreams.md`
4. 联调前看 `docs/specs/artduo-v2-shared-contracts-and-api.md`
5. 页面和导航实现前看 `docs/specs/artduo-v2-ux-flow-and-state-matrix.md`
6. 数据构建前看 `docs/specs/artduo-v2-local-corpus-and-media-schema.md`
7. 背景匹配和转场实现前看 `docs/specs/artduo-v2-background-scene-schema.md`
8. 开始收集名画时看 `docs/plans/artduo-v2-artwork-collection-runbook.md`
9. 最后用 `docs/roadmaps/artduo-v2-three-phase-roadmap.md` 对齐节奏和阶段边界

## 当前共识

- 当前项目保留在 legacy 分支，V2 在新分支上推进
- 迁移策略采用 `parallel workspace bootstrap + strangler`
- 旧 `frontend/` 保持 donor/reference 身份，不直接 rename，也不整体 copy 到 `apps/web/`
- 前端 donor 以当前 `frontend/` 为主，以 `reference/artduo/` 为辅
- 前后端通过 `packages/contracts/` 和 fixture 协作，不再靠口头约定字段
- 共享协议采用两段式冻结：`v0.1` 只冻结 display/data 合同，`v0.2` 再引入 session / explanation / stream
- 首屏主链路采用本地优先、渐进加载，不再把 API 和 SSE 当生命线
- runtime 只认一份 release manifest，里面同时包含 `metadata`、`search`、`mediaIndex` 和 `backgroundScenes` shard
- `embeddings` 在 Phase 1 是可选增强，不得成为薄切片前提
- 背景场景与画作会在运行时组装成 `ExhibitionUnit`，转场默认按动画/PPT/视频转场语义建模
- 作品收集按 `probe -> batch -> review loop` 三段推进，最终收敛到 500-1000 张 confirmed works
- Phase 1 的验收不只看“能跑”，还必须有一套可重复的 relevance benchmark 和人工评审门槛
