# ArtDuo V2 Image Embedding Sidecar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Every task must keep the checkboxes current. Starting subagents still requires explicit user authorization.

> Review revision: 2026-07-26. This revision incorporates the current repository quality findings and makes baseline, publication, security, replay, and browser acceptance gates executable.

**Goal:** 为 Artwork 与 Background Scene 建立可版本化、可回放、可评估的图片向量 sidecar，在不掩盖现有文本检索回退、不扩大现有 A2A 缺口、不改变默认生产排序的前提下，验证视觉信号是否相对当前 metadata-only 场景选择带来稳定、可解释的增益。

**Architecture:** 保留当前 `caption/description/retrieval text -> text embedding -> in-memory cosine search -> rerank` 主链路；新增离线图片编码管线，将 Artwork 与 Background Scene 编码到同一视觉向量空间，产出可选的 `imageEmbeddings` shard。Shadow 构建只写内部 candidate/report；通过完整 promotion gate 后，发布一个显式选择的 image-embedding manifest variant，不原地覆盖已关账的 base `manifest.json`。只有 feature flag 和 variant manifest 都显式配置时，视觉分数才作为 Background Scene 的晚融合信号。关系图继续只提供证据，不参与向量排序；本轮不引入图数据库或向量数据库。

**Tech Stack:** TypeScript、pnpm workspace、Node test runner、`@xenova/transformers`、现有 JSON release artifacts、现有 `@artduo/contracts` / `@artduo/corpus` / `@artduo/pipeline`。

---

## 0. 当前真实基线与执行前提

截至 2026-07-26 的只读核验结果：

| 项目 | 当前结果 | 本计划如何处理 |
| --- | --- | --- |
| Workspace 非浏览器测试 | `185/185` pass | 作为不得回退的 package 基线 |
| TypeScript typecheck | pass | Task -1 与 Task 7 都必须重跑 |
| Production build | pass | Task -1 与 Task 7 都必须重跑 |
| Phase 1 权威文本 benchmark | Top-1 `23/24` (`95.83%`)，Top-5 `24/24` (`100%`) | 仍是 promotion 权威门槛 |
| 当前工作树文本 benchmark | Top-1 `22/24` (`91.67%`)，Top-5 `23/24` (`95.83%`) | 视为待处理回退，不得静默冻结为新合格基线 |
| 当前回退 case | `desire-metaphor-01` Top-1 miss；`melancholy-metaphor-01` Top-1/Top-5 miss | 必须修复，或由用户显式批准带理由 waiver |
| A2A 100-row harness | `55 pass / 40 fail / 5 blocked` | 本计划不修复既有失败，但失败/阻塞 ID 集合不得扩大 |
| A2A 50-case replay | average total `0.975`，hard resistance violations `0` | 不得回退 |
| Browser E2E | 当前定义 14 条，本轮尚未形成最新全量结果 | Task -1 建立真实 baseline，Task 7 跑完整 preflight |
| Web runtime integration | 当前 `loadWebReleaseCatalog`/Gallery/Immersive 是 server-side 同步路径；`browser-curation` 的 `browser-worker` 标签尚未对应真实 Worker，现有 browser loader 也没有生产 consumer | 首版 late fusion 保持 server-side；本计划不借 image sidecar 暗中重构为真实 browser worker |
| Dependency reproducibility | `pnpm-lock.yaml` 当前被 `.gitignore` 忽略且未跟踪，根依赖使用 `^2.17.2` | 在真实模型构建前改为 exact version 并纳入 pnpm lock；否则不能宣称可重复构建 |
| Git 工作树 | 大量 tracked/untracked 改动，含 tracked `node_modules` 删除 | 不得直接在当前脏边界上执行宽泛提交命令 |

执行规则：

1. **不得把已回退的文本 benchmark 重新命名为“baseline passed”。** Task 1 以前必须修复回退，或在架构文档中记录用户批准的 waiver、原因和风险。
2. **base release manifest 默认不可变。** `data/releases/2026-04-25-curation-b/manifest.json` 只读；shadow candidate 写到内部 report root，发布时新增 `manifest.image-embedding-v1.json` variant。
3. **A2A 使用差异门禁。** 比较 `counts` 还不够，必须比较 pass/fail/blocked 的 case ID 集合；已有失败可以保留，新增失败不允许。
4. **提交必须显式列文件。** 禁止使用 `git add apps/pipeline/src`、`git add packages/corpus/src` 等会混入当前无关改动的目录级暂存命令。
5. **浏览器验证属于本计划关键环节。** Task 6 的 lazy load、flag、损坏 shard fallback 必须用 targeted E2E 验证；Task 7 必须运行完整 preflight。
6. **依赖必须真正锁定。** 模型 revision 固定不能替代 npm runtime lock；Task 2
   必须同时固定 provider direct version、提交 pnpm lock，并把实际 decoder/ONNX
   runtime 版本纳入 fingerprint/report。

## 1. 已确认的架构结论

| 问题 | 本轮结论 |
| --- | --- |
| Corpus 存储 | 继续使用版本化 JSON release artifacts，不迁移数据库 |
| 现有 embedding | 保留文本 embedding；它仍是用户文本检索的主召回信号 |
| Image embedding | 需要，但先作为可选第二视觉信号，不替换 caption/description |
| 图片目标 | 同时覆盖 `artwork` 与 `background-scene` |
| 模型基线 | `Xenova/clip-vit-base-patch32`；固定 revision `d15189d7028b43f1d3e65039190477f6af591c2a`、v2 `quantized` variant（`onnx/vision_model_quantized.onnx`）、artifact SHA-256、provider version 和 preprocessing fingerprint 都写入 report/shard |
| 测试下载模型 | 禁止；单元测试注入 deterministic fake provider |
| Web 启动依赖 | `imageEmbeddings` 缺失时正常启动，不能成为必需 shard |
| 首版 Web consumer | 走现有 server-side release catalog；在文本结果产生后按需读取 variant，Browser loader 保留为可选库能力但本轮不接到生产 UI |
| 首轮生产排序 | 不改变文本检索、rerank、A2A agent 边界和关系图证据链 |
| 首轮可见能力 | 离线构建、按需加载、视觉近邻 debug、作品/背景 shadow 评估 |
| Release 发布 | base `manifest.json` 不覆盖；promotion 后新增显式选择的 manifest variant |
| Promotion 基线 | Phase 1 权威文本 benchmark 不被当前回退结果替代；A2A 使用 case-set diff |
| 数据库 | 当前规模继续内存线性 cosine；只有性能数据证明需要时再评估 ANN/向量库 |

## 2. 范围与非目标

### 本轮范围

- Artwork 图片向量生成、校验、版本化与覆盖率报告。
- Background Scene 图片向量生成、校验、版本化与覆盖率报告。
- 图片来源解析、超时/大小/类型限制、文件指纹和失败原因记录。
- 可忽略提交的本地 source-byte cache，用于远端图片可回放和断网重建。
- Node 与浏览器端的可选加载，以及按实体类型建立内存索引；首版生产融合只接
  Node/server consumer，Browser loader 仍是 shadow/library API。
- 视觉近邻、Artwork/Background Scene 兼容度，以及 metadata baseline vs visual-fusion candidate 的 shadow benchmark。
- 达标后的 Background Scene 晚融合开关；默认关闭。
- manifest variant 构建、回放和质量门禁文档。

### 本轮不做

- 不用 image embedding 替换 caption/description、metadata 或 text embedding。
- 不把用户中文 query 直接送入图片 encoder；跨模态文本查询需要单独验证同模型 text encoder。
- 不改变 `buildUserAffectAgent` 的词典/规则判定，也不把当前 A1 失败归因给 image embedding。
- 不让 relationship graph 改写 vector/rerank 顺序。
- 不在没有真实 image-embedding graph evidence consumer 时扩展 relationship graph allowlist。
- 不引入 Neo4j、Qdrant、Milvus、Pinecone、pgvector 或新的常驻服务。
- 不在 benchmark 门槛通过前改动用户可见推荐结果。
- 不在本计划内建设全仓统一 lint/coverage 平台；新增安全解析器、builder 和 publication gate 必须有定向分支覆盖。

## 3. 目标数据契约

新增 `packages/contracts/src/image-embedding-shard.ts`：

```ts
export const IMAGE_EMBEDDING_ENTITY_TYPES = ["artwork", "background-scene"] as const;
export type ImageEmbeddingEntityType = (typeof IMAGE_EMBEDDING_ENTITY_TYPES)[number];

export interface ImageEmbeddingSourceRef {
  shardId: string;
  recordId: string;
  fieldPath: string;
  fingerprint: string;
}

export interface ImageEmbeddingShardRecord {
  id: string;
  entityType: ImageEmbeddingEntityType;
  entityId: string;
  releaseVersion: string;
  model: string;
  modelRevision: string;
  modelVariant: string;
  modelArtifactChecksum: string;
  provider: "@xenova/transformers";
  providerVersion: string;
  dimensions: number;
  preprocessingVersion: string;
  preprocessingFingerprint: string;
  vectorPrecision: number;
  source: ImageEmbeddingSourceRef;
  vector: number[];
}
```

记录约束：

- `id` 格式为 `${entityType}:${entityId}`，同一 release 内唯一。
- `source.fieldPath` 使用按 entity type 的精确 allowlist：Artwork 只能是 `media.imageUrlPreview`、`media.baseImageUrl`、`media.imageUrlFull`；Background Scene 只能是 `asset.local_public_path`。
- `source.fingerprint` 使用 `sha256:<hex>`；不得写入本机绝对路径、鉴权参数或 API key。
- `source.shardId`、`source.recordId`、`entityId` 必须能在 base release 中交叉验证，dangling 或跨实体引用一律拒绝。
- `dimensions` 必须为正整数、`<= 4096`，并与 `vector.length` 相等。
- 所有向量值必须为有限数；零范数向量拒绝进入 shard。
- provider 输出先做 L2 normalization；序列化后范数必须落在 `1 ± 1e-4`。
- `vectorPrecision` 首版固定为 `8` 位小数；换精度必须升级 `preprocessingVersion` 并重跑 benchmark。
- 同一 shard 的 `model`、`modelRevision`、`modelVariant`、
  `modelArtifactChecksum`、`providerVersion`、`dimensions`、
  `preprocessingVersion` 和 `preprocessingFingerprint` 必须一致。
- 单 shard 最多 `1_000` records；variant manifest pre-parse hard cap 为 `256
  KB`，image shard pre-parse hard cap 为 `4 MB`。Node/Browser loader 在 JSON
  parse 前执行 manifest `sizeBytes` 与本地/响应字节双重上限校验。

Manifest variant 增量：

```ts
export interface ImageEmbeddingManifestBinding {
  schemaVersion: "image-embedding-v1";
  baseManifestChecksum: string;
  promotionReportChecksum: string;
  promotionBindingChecksum: string;
  imageShardChecksum: string;
  model: string;
  modelRevision: string;
  modelVariant: string;
  modelArtifactChecksum: string;
  providerVersion: string;
  preprocessingFingerprint: string;
  visualPolicy: {
    candidateCount: number;
    weight: number;
    lowerCosine: number;
    upperCosine: number;
  };
}

export interface ReleaseManifest {
  // existing fields remain unchanged
  imageEmbeddingSidecar?: ImageEmbeddingManifestBinding;
  shards: {
    // existing shards remain unchanged
    imageEmbeddings?: ShardInfo[];
  };
}
```

Shadow 与发布路径：

```text
data/curation/reports/image-embeddings/<release-version>/candidates/image-embeddings-01.json
data/curation/reports/image-embeddings/<release-version>/image-embedding-report.json
data/curation/reports/image-embeddings/<release-version>/image-embedding-evaluation.json
data/curation/reports/image-embeddings/<release-version>/image-embedding-review-pack.json
data/curation/reports/image-embeddings/<release-version>/image-embedding-reviewer-view.html
data/curation/reports/image-embeddings/<release-version>/image-embedding-review-verdicts.json
data/releases/<release-version>/image-embeddings-01.json
data/releases/<release-version>/manifest.image-embedding-v1.json
```

Base `manifest.json` 保持不变。Variant manifest 复制 base manifest 的 release 与现有
shard 元数据，只新增 `imageEmbeddings` 和与 promotion report 绑定的
`imageEmbeddingSidecar`。二者必须同时出现或同时缺失。Release shard 只保存运行时
需要的数据；抓取错误、源 URL、绝对路径和人工评审信息只进入内部 report。
Variant 中只发布 checksum、固定模型标识和已通过评估的视觉 policy，不发布本机
路径、人工 verdict 或内部错误。

## 4. 质量门槛

只有以下条件全部满足，才允许打开 Background Scene 晚融合：

| 指标 | 门槛 |
| --- | --- |
| Critical Artwork 图片覆盖率 | `100%`；集合包含全部 Grade A；若当前 release 无 Grade A，则使用 Task -1 冻结的 deterministic 30-item promotion anchor set，零分母不得自动通过 |
| 全部 Artwork 图片覆盖率 | `>= 95%` |
| Background Scene 图片覆盖率 | `>= 95%` |
| finite / dimensions / unit-norm / source-ref 校验 | `100%` |
| 视觉正样本优于负样本的 holdout pairwise accuracy | point estimate `>= 80%`、95% bootstrap CI lower bound `>= 70%`、至少 30 个独立 holdout artwork |
| Background Scene weak-label holdout Top-3 hit rate | point estimate `>= 70%`、95% bootstrap CI lower bound `>= 60%`、至少 30 个独立 holdout artwork，并报告每个 strata |
| 人工 baseline-vs-candidate review pack | 至少 30 条全部完成；candidate `acceptable >= 80%`；candidate 相对 baseline 的 regression rate `<= 10%` |
| Phase 1 文本向量 benchmark | Task 1-5 可按规则记录 waiver；Task 6-7 必须无有效 waiver 且 Top-1 `>= 95.83%`、Top-5 `= 100%` |
| A2A spec/harness | 不得新增 fail/blocked case ID；不得减少既有 pass ID |
| A2A replay | average total `>= 0.975`，hard resistance violations `= 0` |
| 当前生产排序 | feature flag 关闭时逐项一致 |
| Browser E2E / preflight | targeted image-sidecar E2E 与完整 `pnpm preflight:check` 通过 |
| 图片 shard 体积 | raw `<= 4 MB`，gzip `<= 1.2 MB` |
| Runtime 性能 | 生产 server-side parse/index 与可选 Browser loader diagnostic 分开记录；总附加内存与 p95 延迟不得超过 Task -1 冻结预算 |

门槛失败时保留 candidate 构建和报告能力，但不得生成 release shard/variant manifest，生产 flag 不得开启。Task 3 只能给出 `coverageReady`；只有 Task 5 可以给出 `promotionReady`。

---

## Task -1: Repository 与 Baseline Readiness Gate

> 这是 Task 0 之前的硬停止点。未满足时只能整理基线和文档，不得开始 contract/provider 实现。

**Files:**

- Inspect: repository status via Step 1 commands
- Inspect: `README.md`
- Inspect: `docs/plans/artduo-v2-phase2-continuation-plan.md`
- Inspect: `data/curation/reports/vector-benchmark-2026-04-25-curation-b.json`
- Create: `data/curation/reports/image-embeddings/2026-04-25-curation-b/promotion-anchor-set.json`
- Modify: `README.md`

- [x] **Step 1: 建立可审查的工作边界**

执行：

```bash
git status --short --branch
git diff --check
git diff --name-only --diff-filter=U
git status --short -- node_modules
```

要求：

- 没有 unresolved conflict。
- sidecar 实现必须位于用户明确授权的干净 branch/worktree。
- tracked `node_modules` 删除、A2A、relationship graph、visual presentation 和 UI 实验改动不得混入本计划提交。
- 如果当前工作树无法满足边界，停止并请求用户授权建立专用 worktree；不得自行 stash、reset 或覆盖现有改动。

- [ ] **Step 2: 运行不会覆盖历史报告的完整基线（A2A 输入此前不完整）**

执行者先创建本次 run directory：

```bash
ARTDUO_IMAGE_BASELINE_DIR="$(mktemp -d -t artduo-image-baseline)"

pnpm preflight:check

pnpm vector:benchmark -- \
  --release-version 2026-04-25-curation-b \
  --output "$ARTDUO_IMAGE_BASELINE_DIR/vector-benchmark.json"

ARTDUO_A2A_REPLAY_DIR="$ARTDUO_IMAGE_BASELINE_DIR/a2a-replay-input"
pnpm exec tsx scripts/evaluate-intent-immersion.ts image-embedding-baseline \
  --output-dir "$ARTDUO_A2A_REPLAY_DIR"
pnpm exec tsx scripts/evaluate-intent-immersion.ts image-embedding-baseline-repeat \
  --output-dir "$ARTDUO_A2A_REPLAY_DIR"
pnpm exec tsx output/a2a-framework-test-20260616-142013/run-a2a-spec-harness.ts \
  --replay "$ARTDUO_A2A_REPLAY_DIR/image-embedding-baseline.json" \
  --replay-repeat "$ARTDUO_A2A_REPLAY_DIR/image-embedding-baseline-repeat.json" \
  --replay-report "$ARTDUO_A2A_REPLAY_DIR/image-embedding-baseline.md" \
  --output-dir "$ARTDUO_IMAGE_BASELINE_DIR/a2a-harness"
cp "$ARTDUO_IMAGE_BASELINE_DIR/a2a-harness/spec-harness-results.json" \
  "$ARTDUO_IMAGE_BASELINE_DIR/a2a-spec-harness.json"
cp "$ARTDUO_A2A_REPLAY_DIR/image-embedding-baseline.json" \
  "$ARTDUO_IMAGE_BASELINE_DIR/a2a-replay.json"
```

`pnpm vector:benchmark` 必须显式使用 `--output`，不得覆盖 tracked 的 Phase 1 closeout report。基线文档记录 run directory、命令、commit SHA、manifest checksum 和结果摘要；不记录用户目录、密钥或含 query credential 的 URL。

- [x] **Step 3: 处理当前文本 benchmark 回退**

从 `$ARTDUO_IMAGE_BASELINE_DIR/vector-benchmark.json` 读取结果：

- 若 Top-1 `< 0.958333` 或 Top-5 `< 1`，停止后续任务。
- 默认处理方式是先修复现有 query alias/rerank 回退并重新运行 Step 2。
- 只有用户明确批准 waiver 时才能继续；waiver 必须记录 failing case IDs、与 image sidecar 无关的证据、风险和失效日期。
- waiver 只允许 Task 1-5 shadow 能力继续，不自动授权 Task 6-7 的用户可见融合与发布。

- [ ] **Step 4: 冻结 A2A case-set baseline 与 critical artwork set（当前 `51/44/5` 回归未清除）**

A2A baseline 必须保存：

- `passIds`
- `failIds`
- `blockedIds`
- replay average scores
- hard resistance violation case IDs

`promotion-anchor-set.json` 规则：

- critical set = 全部 Grade A Artwork 与 deterministic 30-item anchor set 的并集。
- 当前 release 没有 Grade A，因此首轮至少包含 30 个 anchor。
- anchor 按 primary mood/theme 分层，再按 `sha256(releaseVersion + artworkId)` 排序选取，保证可回放。
- anchor 文件只保存 release artwork IDs、分层字段和选择算法版本，不保存远端 URL。

- [x] **Step 5: 冻结浏览器性能与 E2E 基线**

记录当前 14 条 E2E 的 pass/fail/skip 列表。新增 sidecar 的预算：

- flag 关闭时零 variant/shard 文件读取、零 client request、零附加解析与索引成本。
- flag 开启时 shard gzip `<= 1.2 MB`、raw `<= 4 MB`。
- 生产 Node/server JSON parse + index build p95 `<= 150 ms`；server process
  sidecar records/index 的估算附加 heap `<= 16 MB`。
- 可选 Browser loader 的 synthetic mobile-emulation diagnostic p95 `<= 400
  ms`，但它不是本轮生产 consumer，也不能被 E2E 的 runtime label 误报为真实
  Worker。
- 加载或解析超时不得阻塞 Gallery/Immersive；必须回退 metadata-only scene selection。

- [x] **Step 6: 同步项目状态文档**

README 至少更新：

- Phase 2 功能已落地但尚未关账。
- 当前文本 benchmark 回退与处理状态。
- A2A `55/40/5` 是现有专项基线，不是全绿状态。
- 当前 sidecar 工作仍是 shadow-only。

- [x] **Step 7: 显式提交 readiness 文档**

只暂存本步骤实际修改的文件：

```bash
git add \
  README.md \
  data/curation/reports/image-embeddings/2026-04-25-curation-b/promotion-anchor-set.json
git commit -m "docs: freeze image sidecar readiness baseline"
```

---

## Task 0: 冻结基线与边界

**Files:**

- Create: `docs/architecture/image-embedding-sidecar.md`
- Inspect: `data/releases/2026-04-25-curation-b/manifest.json`
- Inspect: `apps/web/lib/release-catalog.ts`
- Inspect: `packages/corpus/src/affective-intent.ts`
- Inspect: `packages/corpus/src/relationship-graph.test.ts`
- Inspect: `output/a2a-framework-test-20260616-142013/run-a2a-spec-harness.ts`
- Inspect: `scripts/evaluate-intent-immersion.ts`

- [x] **Step 1: 记录当前 release 和排序基线**

读取 Task -1 的 frozen artifacts；如 commit 或 base manifest checksum 已变化，重新执行 Task -1。不得通过重新运行当前 benchmark 来静默替换 Phase 1 权威门槛。

架构文档必须同时记录：

- Phase 1 权威文本 benchmark。
- 当前工作树 benchmark 与 failing IDs。
- waiver（如果存在）。
- A2A pass/fail/blocked ID 集合。
- replay 指标。
- E2E case 列表与性能预算。
- base manifest checksum。
- promotion anchor set checksum。

- [x] **Step 2: 写清六条不可破坏的不变量**

`docs/architecture/image-embedding-sidecar.md` 必须明确：

1. 关闭 image feature flag 时，文本检索结果与 frozen pre-sidecar snapshot 逐项相同；不得用当前回退结果替换 Phase 1 权威门槛。
2. `imageEmbeddings` 缺失时，release 与 Web 正常工作。
3. relationship graph 仍是 evidence sidecar，不参与 vector/rerank 排序。
4. affective intent 继续在 retrieval 前独立判定。
5. base `manifest.json` 不被覆盖；image sidecar 通过显式 manifest variant 发布和回退。
6. A2A 以 case-set diff 判定，不以 harness exit code 判定。

- [x] **Step 3: 提交基线文档**

```bash
git add docs/architecture/image-embedding-sidecar.md
git commit -m "docs: define image embedding sidecar boundaries"
```

---

## Task 1: 增加图片向量契约和可选 Manifest Shard

**Files:**

- Create: `packages/contracts/src/image-embedding-shard.ts`
- Create: `packages/contracts/src/image-embedding-shard.test.ts`
- Modify: `packages/contracts/src/corpus.ts`
- Modify: `packages/contracts/src/corpus.test.ts`
- Modify: `packages/contracts/src/index.ts`

- [x] **Step 1: 先写失败的契约测试**

测试必须覆盖：

- 合法 artwork 与 background scene 记录可以解析。
- 空向量、非有限数、维度不一致、零范数被拒绝。
- 非法 `entityType` 被拒绝。
- 空 fingerprint 和绝对本机路径泄漏被拒绝。
- 非 allowlisted `source.fieldPath`、重复 record id、超限 dimensions、非单位范数被拒绝。
- manifest 缺失 `imageEmbeddings` 时解析成功。
- manifest 存在 `imageEmbeddings` 时解析为 `ShardInfo[]`，同时严格解析
  `imageEmbeddingSidecar`。
- `imageEmbeddings` 与 `imageEmbeddingSidecar` 只出现其一、policy 权重超限、
  candidateCount 非正整数/超出 scene recordCount、calibration 上下界反转或
  checksum 格式非法时拒绝。
- base manifest 与 manifest variant 都能解析；base manifest 的序列化内容保持不变。

执行：

```bash
pnpm --filter @artduo/contracts test
```

预期：因为 parser、export 和 manifest 字段尚不存在而失败。

- [x] **Step 2: 实现严格 parser**

核心校验函数：

```ts
function parseImageVector(value: unknown, dimensions: number, path: string): number[] {
  const vector = parseArray(
    value,
    (entry, entryPath) => readNumber({ value: entry }, "value", entryPath),
    path,
  );

  if (!Number.isInteger(dimensions) || dimensions <= 0 || dimensions > 4096) {
    throw new TypeError(`${path}: dimensions must be an integer between 1 and 4096`);
  }

  if (vector.length !== dimensions) {
    throw new TypeError(`${path}: expected ${dimensions} values, received ${vector.length}`);
  }

  if (vector.some((entry) => !Number.isFinite(entry))) {
    throw new TypeError(`${path}: vector values must be finite`);
  }

  const norm = Math.hypot(...vector);
  if (!Number.isFinite(norm) || Math.abs(norm - 1) > 1e-4) {
    throw new TypeError(`${path}: vector must be L2 normalized`);
  }

  return vector;
}
```

Parser 还必须验证 `id === `${entityType}:${entityId}``，并禁止 `source.fieldPath`、`source.recordId`、`source.fingerprint` 包含 `file://`、反斜杠、`..` 或用户目录绝对路径。单 record parser 负责结构安全；跨 shard 的 `source.shardId` / `recordId` referential integrity 由 Task 3 builder 和 Task 4 loader 在拥有完整 release context 时校验。

- [x] **Step 3: 扩展 ReleaseManifest**

在 `parseReleaseManifest` 中像 `embeddings` 一样解析 `imageEmbeddings`，并解析
可选 `imageEmbeddingSidecar` binding。两者必须同时存在；binding 的 shard
checksum、model/revision/variant/artifact checksum/provider version/
preprocessing fingerprint 必须能与实际 shard 元数据/记录交叉验证，
`visualPolicy.weight` 固定在 `[0, 0.3]`，
`visualPolicy.candidateCount` 必须为不超过 Background Scene recordCount 的正
整数，且
`upperCosine > lowerCosine`。Base manifest 不新增这些字段；只有 manifest
variant 携带。本轮不修改 relationship graph contract，因为没有实际 graph
consumer 生成 image-embedding source refs。

- [x] **Step 4: 运行契约测试**

```bash
pnpm --filter @artduo/contracts test
pnpm --filter @artduo/contracts build
```

预期：全部通过。

- [x] **Step 5: 提交契约**

```bash
git add \
  packages/contracts/src/image-embedding-shard.ts \
  packages/contracts/src/image-embedding-shard.test.ts \
  packages/contracts/src/corpus.ts \
  packages/contracts/src/corpus.test.ts \
  packages/contracts/src/index.ts
git commit -m "feat(contracts): add image embedding shard contract"
```

---

## Task 2: 建立 Provider 抽象与安全图片来源解析

**Files:**

- Create: `apps/pipeline/src/image-embedding-provider.ts`
- Create: `apps/pipeline/src/image-embedding-provider.test.ts`
- Create: `apps/pipeline/src/image-embedding-sources.ts`
- Create: `apps/pipeline/src/image-embedding-sources.test.ts`
- Create: `apps/pipeline/src/image-source-cache.ts`
- Create: `apps/pipeline/src/image-source-cache.test.ts`
- Modify: `apps/pipeline/package.json`
- Modify: `package.json`
- Modify: `.gitignore`
- Add: `pnpm-lock.yaml`

- [x] **Step 1: 先写 provider 与 source resolver 的失败测试**

Provider 测试使用 2 个内存图片 buffer，断言批次顺序、模型元数据、dimensions、归一化和数量不匹配错误。Source resolver 测试必须覆盖：

- Artwork 优先级：`imageUrlPreview` -> `baseImageUrl` -> `imageUrlFull`。
- Artwork remote host 首版只允许当前 release 已使用的 `images.metmuseum.org`。
- Background Scene 真实 fixture 的 `/artduo-gallery/...` public URL path 能安全映射到 `<rootDir>/public/artduo-gallery/...`。
- `../`、percent-encoded traversal、反斜杠、本机绝对路径、symlink 越界、非 HTTPS 远端地址被拒绝。
- redirect 每一跳都重新校验 scheme/host/IP；private、loopback、link-local、multicast 和 metadata-service address 被拒绝。
- HTTP 响应超时、redirect 超限、非图片 content-type、magic bytes 不匹配、超过 12 MB 被记录为结构化失败。
- 解码后 width/height/pixel count 超限以及 decoder error 被记录为 `decode-failed`。
- URL query 中的鉴权字段不得进入 report 或 fingerprint input label。
- 同一源内容产生稳定 SHA-256 fingerprint。
- source cache 命中时不访问网络；`--refresh-source-cache` 才允许重新抓取。
- 同一 entity/field 的 release source locator 变化时不得命中旧 cache。
- 使用真实的 1 张 JPEG 与 1 张 PNG fixture 运行 provider smoke，输出 512D unit vector；该 smoke 可显式启用，但不属于普通单元测试。

执行：

```bash
pnpm --filter @artduo/pipeline test
```

预期：模块不存在，测试失败。

- [x] **Step 2: 定义可注入 provider 接口**

```ts
export interface ImageEmbeddingInput {
  entityType: "artwork" | "background-scene";
  entityId: string;
  bytes: Uint8Array;
  mediaType: string;
}

export interface EmbeddedImageVector {
  model: string;
  modelRevision: string;
  modelVariant: string;
  modelArtifactChecksum: string;
  providerVersion: string;
  dimensions: number;
  preprocessingVersion: string;
  preprocessingFingerprint: string;
  vector: number[];
}

export interface ImageEmbeddingProvider {
  readonly mode: "local-transformers";
  readonly model: string;
  readonly modelRevision: string;
  readonly modelVariant: string;
  readonly expectedModelArtifactChecksum: string;
  getModelArtifactProvenance(): Promise<{
    artifact: "onnx/vision_model_quantized.onnx";
    checksum: string;
    providerVersion: string;
  }>;
  embedImages(inputs: ImageEmbeddingInput[]): Promise<EmbeddedImageVector[]>;
}
```

`createTransformersImageEmbeddingProvider` 使用动态 import，避免单元测试加载模型。
首版常量固定为：

```ts
const IMAGE_MODEL_ID = "Xenova/clip-vit-base-patch32";
const IMAGE_MODEL_REVISION = "d15189d7028b43f1d3e65039190477f6af591c2a";
const IMAGE_MODEL_VARIANT = "quantized";
const IMAGE_MODEL_ARTIFACT = "onnx/vision_model_quantized.onnx";
const IMAGE_MODEL_ARTIFACT_SHA256 =
  "sha256:583fd1110a514667812fee7d684952aaf82a99b959760c8d7dca7e0ab9839299";
```

这些值来自模型仓库的 immutable commit 与对应 artifact；禁止默认 floating
`main`。真实 smoke 必须确认 `@xenova/transformers@2.17.2` 实际加载该文件、输出
512D，并验证下载/cache artifact checksum。模型 provenance 固定到
[Hugging Face commit](https://huggingface.co/Xenova/clip-vit-base-patch32/commit/d15189d7028b43f1d3e65039190477f6af591c2a)
与
[vision artifact](https://huggingface.co/Xenova/clip-vit-base-patch32/blob/d15189d7028b43f1d3e65039190477f6af591c2a/onnx/vision_model_quantized.onnx)。
默认 batch size 为 `8`。

Provider 的 bytes 解码路径固定为：

```text
Uint8Array
  -> Blob(mediaType)
  -> RawImage.fromBlob
  -> pipeline("image-feature-extraction", model, {
       revision,
       quantized: true,
       model_file_name: "vision_model"
     })
  -> Float32Array
  -> L2 normalization
  -> round to vectorPrecision=8
  -> norm recheck
```

模型 pipeline 只接收已由 source resolver 验证和限额的 bytes，不允许 provider
自行通过 URL 取图。`modelVariant` 是 provider 对具体加载选项和 artifact path 的
稳定命名，不是任意 CLI 字符串。`getModelArtifactProvenance()` 必须在 pipeline
加载后从实际 cache artifact 读取 bytes 并计算 checksum；target artifact、runtime
version、checksum、输出数量、dimensions 或 preprocessing fingerprint 任一不一致
立即失败。报告和 vector 记录使用已验证的实际 provenance，绝不以常量冒充已验证
artifact。

- [x] **Step 3: 实现安全 source resolver**

固定限制：

```ts
export const IMAGE_FETCH_LIMITS = {
  timeoutMs: 15_000,
  maxBytes: 12 * 1024 * 1024,
  maxRedirects: 3,
  maxWidth: 12_000,
  maxHeight: 12_000,
  maxPixels: 48_000_000,
  allowedMediaTypes: ["image/jpeg", "image/png", "image/webp"],
  allowedRemoteHosts: ["images.metmuseum.org"],
} as const;
```

远端只接受 HTTPS 与 allowlisted host；使用 manual redirect，每一跳重新校验目标。DNS 解析结果必须全部为 public unicast address，连接层也必须绑定到已验证结果或使用具有等价 SSRF 防护的 fetch adapter。

Background Scene 的 `local_public_path` 是 public URL path，不是文件系统绝对路径。实现先拒绝 traversal/backslash，再去掉一个前导 `/`，随后相对 `<rootDir>/public` 解析。`publicRoot` 与最终文件都使用 `realpath` 后再次校验 containment，防止 symlink escape。读取完成后对原始 bytes 计算 SHA-256；content-type 与 magic bytes 必须一致，JPEG/PNG/WebP 都须经 `RawImage.fromBlob` 完整解码后才接受。Artwork 的 preview/base/full URL 按优先级依次尝试；前一个安全来源失败时才能回退到下一个。15 秒总时限覆盖 DNS、redirect、连接和完整 response read，每一跳均重新做 URL 与 DNS 防护。

- [x] **Step 4: 增加可回放 source cache**

默认 cache root：

```text
<rootDir>/.cache/artduo/image-sources/
```

Cache 不提交 Git。每项保存原始 bytes 与一份不含完整 URL/query 的 metadata：

```ts
interface CachedImageSource {
  fingerprint: `sha256:${string}`;
  sourceLocatorFingerprint: `sha256:${string}`;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
  width: number;
  height: number;
  fetchedAt: string;
  sourceHost?: string;
}
```

`sourceLocatorFingerprint` 由规范化后的 source locator 计算：远端 URL 去除
userinfo、fragment 和已知鉴权 query，保留会改变资源选择的非敏感部分；本地 source
使用规范化 public URL path。Cache key 由 entity type、entity id、逻辑 field
path 和 `sourceLocatorFingerprint` 派生。读取时同时校验 locator 与原始 bytes
fingerprint，避免 release 改图后误用旧 cache。默认优先 cache，只有显式
`--refresh-source-cache true` 才访问远端更新。Task 7 的 reproducibility build
必须在断网/禁止 fetch 模式下仅依赖 frozen cache 完成。

- [ ] **Step 5: 将 transformers 声明为 pipeline 直接依赖**

> **Blocked 2026-07-26:** manifests now pin `@xenova/transformers` at `2.17.2`,
> but three bounded `pnpm install --lockfile-only` attempts made no dependency
> resolution progress against either configured or public registry. No
> `pnpm-lock.yaml` was generated. Task 2 remains open until the lockfile and
> frozen-lockfile install are verified.

在根 `package.json` 与 `apps/pipeline/package.json` 都使用 exact version：

```json
"@xenova/transformers": "2.17.2"
```

修正 `.gitignore`：继续忽略 `package-lock.json`、`yarn.lock`，但不再忽略本项目
实际使用的 `pnpm-lock.yaml`。生成并审查 lockfile；若出现与本计划无关的大范围
dependency 更新，停止并在干净 worktree 从当前 package manifests 重建，不能
直接接受噪声 diff。Report 同时记录 lock 中解析出的 provider、ONNX runtime 与
图片 decoder 精确版本，不能只记录 direct semver。

- [ ] **Step 6: 运行测试、类型检查与 opt-in 真实 smoke**

```bash
pnpm install
pnpm install --frozen-lockfile
pnpm --filter @artduo/pipeline test
pnpm --filter @artduo/pipeline typecheck

ARTDUO_RUN_REAL_IMAGE_EMBEDDING_SMOKE=true \
pnpm --filter @artduo/pipeline test -- image-embedding-provider.real.test.ts
```

预期：普通测试全部通过且没有模型下载和外部网络请求。真实 smoke 只在显式环境变量存在时执行，首次可下载 pinned model；结果记录 dimensions、model revision、variant、provider version 与 preprocessing fingerprint，不记录模型缓存绝对路径。

- [ ] **Step 7: 提交 provider、来源解析与 cache**

```bash
git add \
  apps/pipeline/package.json \
  package.json \
  .gitignore \
  pnpm-lock.yaml \
  apps/pipeline/src/image-embedding-provider.ts \
  apps/pipeline/src/image-embedding-provider.test.ts \
  apps/pipeline/src/image-embedding-provider.real.test.ts \
  apps/pipeline/src/image-embedding-sources.ts \
  apps/pipeline/src/image-embedding-sources.test.ts \
  apps/pipeline/src/image-source-cache.ts \
  apps/pipeline/src/image-source-cache.test.ts
git commit -m "feat(pipeline): add image embedding provider and source resolver"
```

---

## Task 3: 构建 Image Embedding Sidecar 与质量报告

**Files:**

- Create: `apps/pipeline/src/image-embedding-shards.ts`
- Create: `apps/pipeline/src/image-embedding-shards.test.ts`
- Create: `apps/pipeline/src/build-image-embedding-shards.ts`
- Modify: `apps/pipeline/src/cli.ts`
- Modify: `apps/pipeline/package.json`
- Modify: `package.json`

- [ ] **Step 1: 写失败的 builder 测试**

使用临时 release fixture 和 fake provider，覆盖：

- 同时生成 artwork 与 background scene 记录。
- 记录顺序固定为 `entityType`、`entityId` 升序。
- 相同输入重复构建得到相同 checksum。
- source 失败时记录 `missing-source`、`offline-cache-miss`、`fetch-failed`、
  `decode-failed` 或 `provider-failed`。
- source ref 指向不存在的 base shard/record、fieldPath 与实体类型不匹配、重复 entity ID 时失败。
- critical artwork、全部 artwork、background scene 覆盖率分别计算；零分母不得自动通过。
- 覆盖不足或向量校验失败时 `coverageReady === false`。
- 无论覆盖率是否通过，Task 3 都不得写 base manifest、variant manifest 或 release shard。
- candidate shard 只写入内部 `candidates/` root。
- 报告写入内部 report root，不进入 release manifest。
- 异常中断不留下半写 JSON。

执行：

```bash
pnpm --filter @artduo/pipeline test
```

预期：builder 和 CLI 尚不存在，测试失败。

- [ ] **Step 2: 实现构建选项与报告**

```ts
export interface ImageEmbeddingBuildOptions {
  rootDir?: string;
  releasesRoot?: string;
  reportRoot?: string;
  candidateRoot?: string;
  sourceCacheRoot?: string;
  promotionAnchorPath?: string;
  releaseVersion?: string;
  manifestPath?: string;
  model?: string;
  modelRevision?: string;
  modelVariant?: string;
  batchSize?: number;
  refreshSourceCache?: boolean;
  offline?: boolean;
  provider?: ImageEmbeddingProvider;
  fetchImpl?: typeof fetch;
}

export interface ImageEmbeddingBuildReport {
  releaseVersion: string;
  baseManifestChecksum: string;
  promotionAnchorSetChecksum: string;
  model: string;
  modelRevision: string;
  modelVariant: string;
  modelArtifactChecksum: string;
  providerVersion: string;
  dimensions: number;
  preprocessingVersion: string;
  preprocessingFingerprint: string;
  vectorPrecision: number;
  generatedAt: string;
  artwork: {
    eligible: number;
    embedded: number;
    gradeAEligible: number;
    gradeAEmbedded: number;
    criticalEligible: number;
    criticalEmbedded: number;
  };
  backgroundScene: { eligible: number; embedded: number };
  failures: Array<{
    entityType: "artwork" | "background-scene";
    entityId: string;
    code:
      | "missing-source"
      | "offline-cache-miss"
      | "fetch-failed"
      | "decode-failed"
      | "provider-failed";
    message: string;
  }>;
  gates: {
    vectorsValid: boolean;
    sourceRefsValid: boolean;
    artworkCoverage: number;
    criticalArtworkCoverage: number;
    backgroundSceneCoverage: number;
    coverageReady: boolean;
  };
  candidateShard: ShardInfo;
}
```

Task 3 不提供任何直接写 release/manifest 的发布选项。Builder 的输出能力被限制为 candidate shard + internal report，避免操作员在 Task 5 前绕过 promotion gate。
`promotionAnchorPath` 必须显式指向 Task -1 冻结文件；报告记录其 checksum，
critical coverage 只能按该文件与 Grade A 并集计算。Failure `message` 必须使用
受控、去路径/URL/响应正文的摘要；原始异常仅输出到受访问控制的即时 debug
日志，不能进入可提交 report。

- [ ] **Step 3: 实现原子写入**

先写 candidate 目录内的临时文件，完成 parser 回读、referential integrity、recordCount、sizeBytes 与 checksum 校验后使用 `renameSync` 替换 candidate 文件。Task 3 不打开 release directory 的写权限。

报告路径固定为：

```ts
const resolvedReportRoot = reportRoot
  ?? path.join(rootDir, "data", "curation", "reports", "image-embeddings");

path.join(
  resolvedReportRoot,
  releaseVersion,
  "image-embedding-report.json",
);
```

Candidate 路径固定为：

```ts
path.join(
  candidateRoot ?? path.join(
    resolvedReportRoot,
    releaseVersion,
    "candidates",
  ),
  "image-embeddings-01.json",
);
```

- [ ] **Step 4: 增加 CLI**

新增参数：

```text
--root-dir
--releases-root
--report-root
--candidate-root
--source-cache-root
--promotion-anchor-set
--release-version
--manifest
--image-embedding-model
--image-embedding-model-revision
--image-embedding-model-variant
--image-embedding-batch-size
--refresh-source-cache true|false
--offline true|false
```

新增 scripts：

```json
// apps/pipeline/package.json
"build:image-embeddings": "pnpm run workspace:prepare && tsx src/build-image-embedding-shards.ts"

// package.json
"image-embeddings:build": "pnpm --filter @artduo/pipeline build:image-embeddings"
```

- [ ] **Step 5: 运行测试**

```bash
pnpm --filter @artduo/pipeline test
pnpm --filter @artduo/pipeline typecheck
```

预期：全部通过；fixture 构建不访问外网。

- [ ] **Step 6: 首次本地 shadow 构建**

```bash
ARTDUO_IMAGE_REPRO_DIR="$(mktemp -d -t artduo-image-repro)"

pnpm image-embeddings:build -- \
  --release-version 2026-04-25-curation-b \
  --image-embedding-model Xenova/clip-vit-base-patch32 \
  --image-embedding-model-revision d15189d7028b43f1d3e65039190477f6af591c2a \
  --image-embedding-model-variant quantized \
  --image-embedding-batch-size 8 \
  --promotion-anchor-set data/curation/reports/image-embeddings/2026-04-25-curation-b/promotion-anchor-set.json
```

预期：生成内部报告和 candidate shard；报告包含完整覆盖率、source cache 状态与失败原因。模型首次运行可以写入标准模型缓存，但模型文件和 source cache 不能提交到仓库。Candidate 即使 `coverageReady=true` 也不能被 runtime manifest 发现。

- [ ] **Step 7: 提交 builder**

```bash
git add \
  apps/pipeline/src/image-embedding-shards.ts \
  apps/pipeline/src/image-embedding-shards.test.ts \
  apps/pipeline/src/build-image-embedding-shards.ts \
  apps/pipeline/src/cli.ts \
  apps/pipeline/package.json \
  package.json \
  data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-report.json
git commit -m "feat(pipeline): build versioned image embedding sidecars"
```

注意：此提交不加入模型缓存、source cache 或 candidate vector payload；Task 3 永远不提交 release shard 或 manifest 变更。

---

## Task 4: 增加可选 Loader、索引与视觉搜索

**Files:**

- Create: `packages/corpus/src/image-embedding.ts`
- Create: `packages/corpus/src/image-embedding.test.ts`
- Modify: `packages/corpus/src/release-loader.ts`
- Modify: `packages/corpus/src/release-loader.test.ts`
- Modify: `packages/corpus/src/browser-release-loader.ts`
- Modify: `packages/corpus/src/browser-release-loader.test.ts`
- Modify: `packages/corpus/src/index.ts`

- [ ] **Step 1: 写失败的 loader 和搜索测试**

覆盖：

- Node loader 缺失 sidecar 时返回空数组，不抛错。
- Node loader 校验 manifest `sizeBytes`、实际 bytes、checksum、recordCount、record parser 和 base release referential integrity。
- Node/Browser 在解析 variant manifest 前执行 256 KB hard cap。
- Async Node loader 使用 `fs.promises.readFile` + `AbortSignal`，abort/timeout
  返回受控错误；不能用 `Promise.race` 包住同步 `readFileSync` 冒充可中断加载。
- Browser loader 只有显式调用时才请求图片 shard。
- Browser loader 不能依赖 `Content-Length` 或无上限 `response.arrayBuffer()`；
  必须以 stream reader 累计 bytes，在超过 4 MB hard cap 时中止，再进入 JSON
  parse，并拒绝超出 manifest `sizeBytes` 的响应。
- Browser cache key 包含 variant manifest checksum、corpus version、model
  revision、preprocessing fingerprint 和 image shard checksum。
- base manifest 没有 `imageEmbeddings` 时返回空数组；只有显式 variant manifest path 才能发现 sidecar。
- variant 的 `imageEmbeddingSidecar` 缺失、与 shard checksum/model 不一致或
  visual policy 非法时拒绝。
- dangling source record、重复 entity ID、非 allowlisted field path、recordCount 不符被拒绝。
- artwork 搜索不会返回 background scene；反之亦然。
- 维度不匹配时抛出明确错误。
- cosine 分数相同时按 `entityId` 稳定排序。

执行：

```bash
pnpm --filter @artduo/corpus test
```

预期：新 API 尚不存在，测试失败。

- [ ] **Step 2: 实现 loader**

```ts
export interface LoadedImageEmbeddingShards extends LoadedReleaseManifest {
  shardPaths: string[];
  records: ImageEmbeddingShardRecord[];
}

export function loadImageEmbeddingShards(
  options: ReleaseLoaderOptions & {
    imageEmbeddingManifestPath?: string;
    maxPreParseBytes?: number;
  } = {},
): LoadedImageEmbeddingShards {
  const loaded = options.imageEmbeddingManifestPath
    ? loadReleaseManifest({ ...options, manifestPath: options.imageEmbeddingManifestPath })
    : loadReleaseManifest(options);
  const shards = loaded.manifest.shards.imageEmbeddings ?? [];
  // size cap, checksum, recordCount, parse, cross-reference to base release;
  // return [] when absent
}

export async function loadImageEmbeddingShardsAsync(
  options: ReleaseLoaderOptions & {
    imageEmbeddingManifestPath: string;
    maxPreParseBytes?: number;
    signal?: AbortSignal;
  },
): Promise<LoadedImageEmbeddingShards>;
```

浏览器端新增独立 `loadBrowserImageEmbeddingShards`，不得并入当前 `loadBrowserEmbeddingShards` 的启动请求。它必须接收显式 `imageEmbeddingManifestUrl`；不能根据目录约定猜测 variant，也不能在 feature flag 关闭时 fetch variant manifest。
Node 与 Browser loader 都返回解析后的 `imageEmbeddingSidecar` binding；Task 6
生产路径只使用 async Node 结果，sync Node API 留给离线/debug，Browser 结果用于
API parity/shadow diagnostic。运行时不得读取内部 evaluation report。Browser
fetch 必须先校验 variant 响应大小，再按同样的 bounded streaming 规则读取
shard。Abort 只能中止 I/O，不能抢占 `JSON.parse`；因此 4 MB pre-parse hard cap
仍是 server 响应时间上界的一部分，不能依赖 timeout 代替 size cap。

- [ ] **Step 3: 实现内存索引与搜索**

```ts
export interface ImageEmbeddingIndex {
  model: string;
  modelRevision: string;
  modelArtifactChecksum: string;
  preprocessingFingerprint: string;
  dimensions: number;
  byId: Map<string, ImageEmbeddingShardRecord>;
  artworkRecords: ImageEmbeddingShardRecord[];
  backgroundSceneRecords: ImageEmbeddingShardRecord[];
}

export function createImageEmbeddingIndex(
  records: ImageEmbeddingShardRecord[],
): ImageEmbeddingIndex;

export function searchVisualNeighbors(
  index: ImageEmbeddingIndex,
  input: {
    entityType: ImageEmbeddingEntityType;
    entityId: string;
    limit?: number;
  },
): Array<{ entityId: string; score: number }>;

export function scoreArtworkBackgroundCompatibility(
  index: ImageEmbeddingIndex,
  artworkId: string,
  backgroundSceneId: string,
): number | undefined;
```

复用现有 cosine/vector search 工具，不复制相似度实现。由于 shard contract 强制 unit vectors，现有 dot-product cosine 路径成立；index 创建时仍需抽样复核范数。当前约 271 个实体继续线性扫描。

- [ ] **Step 4: 增加 browser parse/index 性能测量**

使用确定性 271 × 512 dense vector fixture，分别记录：

- payload bytes
- JSON parse duration
- index build duration
- estimated heap delta
- 50 次 neighbor/compatibility 查询的 p50/p95

普通单元测试验证测量器和 Node/browser 两套预算判定。Task 6 targeted E2E 只
测本轮真实生产的 server-side consumer；Browser loader 保留 synthetic
mobile-emulation diagnostic，除非另立并批准真实 Worker/UI 集成计划，否则不能
宣称已有生产浏览器测量。

- [ ] **Step 5: 运行测试**

```bash
pnpm --filter @artduo/contracts build
pnpm --filter @artduo/corpus test
pnpm --filter @artduo/corpus typecheck
```

预期：全部通过；fixture 满足 Task -1 的 raw size、parse/index 和 heap 预算。

- [ ] **Step 6: 提交 loader 和索引**

```bash
git add \
  packages/corpus/src/image-embedding.ts \
  packages/corpus/src/image-embedding.test.ts \
  packages/corpus/src/release-loader.ts \
  packages/corpus/src/release-loader.test.ts \
  packages/corpus/src/browser-release-loader.ts \
  packages/corpus/src/browser-release-loader.test.ts \
  packages/corpus/src/index.ts
git commit -m "feat(corpus): load and search optional image embeddings"
```

---

## Task 5: 建立 Shadow Debug、自动评估与人工 Review Pack

**Files:**

- Create: `apps/pipeline/src/image-embedding-evaluation.ts`
- Create: `apps/pipeline/src/image-embedding-evaluation.test.ts`
- Create: `apps/pipeline/src/run-image-embedding-evaluation.ts`
- Create: `apps/pipeline/src/debug-image-embedding.ts`
- Create: `apps/pipeline/src/debug-image-embedding.test.ts`
- Modify: `apps/pipeline/src/cli.ts`
- Modify: `apps/pipeline/package.json`
- Modify: `package.json`

- [ ] **Step 1: 写失败的评估测试**

用 synthetic fixture 精确测试：

- 视觉正样本相似度高于负样本时 pairwise accuracy 为 `1`。
- scene Top-3 命中按 artwork 的既有 metadata/curation weak label 计算。
- 缺失向量从分母与 coverage 中分别正确统计，不静默跳过。
- train/holdout split 由 release + entity ID 确定，调权只读 train，promotion 指标只读 holdout。
- review pack 确定性抽样至少 30 条 baseline 与 candidate scene ID 不同的
  comparison，覆盖主要 mood/department strata；不足 30 条时不得 promotion。
- reviewer view 随机化 A/B 方位并隐藏算法、分数和 candidate 身份。
- machine pack checksum 固定后，人工只写独立 verdict sidecar；修改 machine
  pack、randomization 或 candidate 数据会使评估失败。
- 未完成人工 verdict 时 `humanReviewComplete === false`。
- `uncertain`、空 verdict、candidate regression 和 candidate acceptable 的分母分别按规则计算。
- flag 关闭时 production ordering snapshot 完全一致。
- evaluation report 的 build report checksum、candidate checksum、base manifest
  checksum 或 model fingerprint 不匹配时 `promotionReady === false`。

执行：

```bash
pnpm --filter @artduo/pipeline test
```

预期：评估模块不存在，测试失败。

- [ ] **Step 2: 实现确定性 weak-label benchmark**

自动标签只能来自当前结构化字段，不调用 LLM：

- Artwork positive：至少共享两个可用高置信字段；字段只来自
  `metadata.colorTags`、`metadata.compositionTags`、`metadata.subjectTags` 和
  media shard 的 `media.aspectRatioHint`。`unknown-palette`、空数组等占位值不计
  为共享。
- Artwork negative：上述字段无共享，且不是同一作品。
- Scene positive：复用并版本化当前 `selectBackgroundScene` metadata score：
  `metadata.moodTags × curation_profile.emotion_ids` 权重 4、
  `retrieval.emotionLabels × emotion_ids` 权重 4、
  `presentation.sceneAffinity.paletteModes ×
  curation_profile.artwork_palette_modes` 权重 2、
  `sceneAffinity.sceneTypes × visual_profile.scene_type` 权重 2、
  `metadata.colorTags × visual_profile.palette` 权重 1；同分按 scene ID。
- Scene negative：上述 frozen score 为 0，且不是该 artwork 的 positive。当前
  production scorer 未使用 composition/orientation，promotion weak label 也不能
  悄悄加入这些字段；可将它们作为单独 diagnostic，但不能混入门槛。
- 先按 `metadata.moodTags[0]` 与 `metadata.department` 分层，再以
  `sha256(releaseVersion + entityId + evaluationVersion)` 排序；缺失值进入显式
  `unknown` 层。
- 每层固定 `70% train / 30% holdout`；同一 entity 及其正负 pair 不能跨 split。
- fusion weight、visual calibration 参数只能由 train 选择；所有 promotion 数字只来自 holdout。
- bootstrap 以 artwork ID 为 cluster 重采样，不能把同一 artwork 派生的多条 pair
  当成独立样本放大置信度。

报告必须标记 `labelSource: "structured-weak-label-v1"`，避免把弱标签描述为人工
真值，并输出 unique entity sample size、95% bootstrap confidence interval 与
per-strata breakdown。有效 holdout artwork 少于 30 时门槛失败；任何样本数少于
5 的 strata 标记 `insufficient-sample`，不能将其零样本结果汇总成通过。

- [ ] **Step 3: 生成 review pack**

固定生成三份互相校验的评审 artifacts：

- Machine pack：至少 30 条 baseline scene ID 与 candidate scene ID 不同的
  artwork comparison，包含 IDs、分数、fingerprints、randomization seed，但不
  接收人工编辑。另行报告 unchanged case 数量，不能用 unchanged/tie 样本填满
  30 条门槛。
- Reviewer view：由 machine pack 生成只读 HTML，相同 30 条记录的盲化 A/B
  图片与必要 caption；不包含算法名、candidate 方位、视觉分数、metadata 分数或
  machine pack 文件路径。
- Verdict sidecar：只包含 `reviewPackChecksum`、`reviewId`、verdict、
  left/right acceptability 和 reason；不得复制候选 IDs、分数或 fingerprints。
- 可另生成 15 条 artwork -> visual neighbor diagnostics，但它不计入 promotion 人工门槛。

人工 verdict：

```ts
type HumanComparisonVerdict =
  | "left-better"
  | "right-better"
  | "tie"
  | "both-unacceptable"
  | "uncertain";

type HumanAcceptability = "acceptable" | "unacceptable" | "uncertain";
```

每条 verdict 记录同时填写 `comparisonVerdict`、`leftAcceptability`、
`rightAcceptability` 与简短 `reason`。评估命令先校验
`reviewPackChecksum`，再根据 frozen randomization seed 还原 candidate 方位；
拒绝空值、未知/重复 `reviewId`、缺失条目或被改写的 machine pack。人工评审完成
前生成的 report 和完成后的 report 必须使用不同输出 checksum，旧 report 不能
用于发布。

门槛计算：

- 30/30 完成。
- `uncertain <= 10%`。
- candidate acceptable rate `>= 80%`，分母为全部 30 条。
- candidate regression rate（baseline-better 且 candidate 非 acceptable）`<= 10%`。
- 同时报告 candidate-better、tie、baseline-better、both-unacceptable，不把 tie 伪装成增益。

Review pack 是内部评估输入，不进入 release manifest。

- [ ] **Step 4: 实现 debug CLI**

支持：

```bash
pnpm image-embeddings:debug -- \
  --release-version 2026-04-25-curation-b \
  --entity-type artwork \
  --entity-id <release-artwork-id> \
  --limit 10
```

输出每个候选的 `entityId`、cosine score、model、source fingerprint，不输出本机路径。

- [ ] **Step 5: 增加 scripts**

```json
// apps/pipeline/package.json
"debug:image-embeddings": "pnpm run workspace:prepare && tsx src/debug-image-embedding.ts",
"bench:image-embeddings": "pnpm run workspace:prepare && tsx src/run-image-embedding-evaluation.ts"

// package.json
"image-embeddings:debug": "pnpm --filter @artduo/pipeline debug:image-embeddings",
"image-embeddings:benchmark": "pnpm --filter @artduo/pipeline bench:image-embeddings"
```

Benchmark CLI 同时支持显式 `--output`、`--build-report`、`--review-pack`、
`--review-verdicts`、`--emit-review-pack`、`--reviewer-view-output` 和可选
`--fusion-e2e-report`。自动化验证必须显式输出到临时文件；只有 Task 5 完成人工
评审后的 report 才写入计划中的固定 report 路径。Task 5 首次完成时
`promotionReady` 可为 true，但 `fusionVerificationReady` 必须为 false；Task 6
完成 targeted E2E 后用同一命令绑定 E2E report checksum，才能将后者置为 true。

- [ ] **Step 6: 运行自动 benchmark**

```bash
pnpm image-embeddings:benchmark -- \
  --release-version 2026-04-25-curation-b \
  --build-report data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-report.json \
  --candidate-shard data/curation/reports/image-embeddings/2026-04-25-curation-b/candidates/image-embeddings-01.json \
  --emit-review-pack true \
  --reviewer-view-output data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-reviewer-view.html \
  --output data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-evaluation.pre-review.json
```

预期：生成 evaluation report 与 30 条 review pack；未完成人工判定前，报告明确 `promotionReady: false`。

- [ ] **Step 7: 完成人工评审并重跑**

评审者查看只读 reviewer view，只在
`image-embedding-review-verdicts.json` 填写对应 `reviewId` 的 verdict 与简短
`reason`；不修改 machine pack、候选 ID、分数、randomization seed 或
fingerprint。然后执行：

```bash
pnpm image-embeddings:benchmark -- \
  --release-version 2026-04-25-curation-b \
  --build-report data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-report.json \
  --candidate-shard data/curation/reports/image-embeddings/2026-04-25-curation-b/candidates/image-embeddings-01.json \
  --review-pack data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-review-pack.json \
  --review-verdicts data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-review-verdicts.json \
  --output data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-evaluation.json
```

预期：报告计算 weak-label holdout、人工比较、文本/A2A/E2E baseline
references、推荐 visual calibration 与 visual weight，并按第 4 节的
candidate/product 门槛给出 `promotionReady`。此时 Task 6 尚未执行，所以
`fusionVerificationReady: false` 是预期状态，不影响开始 Task 6，但不能进入
Task 7。Report 必须包含：

```ts
interface ImageEmbeddingPromotionBinding {
  releaseVersion: string;
  evaluationVersion: string;
  baseManifestChecksum: string;
  promotionAnchorSetChecksum: string;
  buildReportChecksum: string;
  candidateShardChecksum: string;
  reviewPackChecksum: string;
  reviewVerdictsChecksum: string;
  textBenchmarkBaselineChecksum: string;
  a2aBaselineChecksum: string;
  e2eBaselineChecksum: string;
  fusionE2eReportChecksum?: string;
  promotionBindingChecksum: string;
  modelRevision: string;
  modelVariant: string;
  modelArtifactChecksum: string;
  providerVersion: string;
  preprocessingFingerprint: string;
  visualCandidateCount: number;
  recommendedVisualWeight: number;
  visualCalibration: {
    lowerCosine: number;
    upperCosine: number;
  };
  promotionReady: boolean;
  fusionVerificationReady: boolean;
}
```

`promotionBindingChecksum` 是 canonical JSON 的 SHA-256，输入包含上述 release、
candidate/review/baseline/model/policy 字段以及 holdout/human gate 的原始计数与
结果；排除 `generatedAt`、原始临时路径和后续
`fusionE2eReportChecksum`。因此 Task 6 回写 E2E 证据时该 checksum 必须保持
不变，任何重算候选、重做人工 verdict 或修改 policy 都会改变它并强制重跑 Task
6。

`visualCandidateCount` 首版固定为 `12`：先按原 metadata score/tie-break 取前
12，再在窗口内做视觉晚融合；视觉分数不能把窗口外 scene 拉入结果。
`recommendedVisualWeight` 必须从 frozen candidate set（例如 `0.05, 0.1, 0.15,
0.2, 0.3`）在 train split 选择；不得在 holdout 或人工 verdict 上反复调参。

- [ ] **Step 8: 提交评估工具与完成后的报告**

```bash
git add \
  apps/pipeline/src/image-embedding-evaluation.ts \
  apps/pipeline/src/image-embedding-evaluation.test.ts \
  apps/pipeline/src/run-image-embedding-evaluation.ts \
  apps/pipeline/src/debug-image-embedding.ts \
  apps/pipeline/src/debug-image-embedding.test.ts \
  apps/pipeline/src/cli.ts \
  apps/pipeline/package.json \
  package.json \
  data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-evaluation.json \
  data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-review-pack.json \
  data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-reviewer-view.html \
  data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-review-verdicts.json
git commit -m "test(pipeline): add image embedding shadow evaluation"
```

---

## Task 6: 达标后增加 Background Scene 晚融合开关

> 此任务只有 Task 5 的 `promotionReady: true` 后才执行。未达标时停止在 shadow 能力，不调整权重。
> 首版接入现有 server-side catalog，不把当前仅有标签的 `browser-worker` 路径
> 描述成真实 Worker，也不在 hydration 后二次重排 UI。

**Files:**

- Create: `packages/corpus/src/background-scene-fusion.ts`
- Create: `packages/corpus/src/background-scene-fusion.test.ts`
- Modify: `apps/web/lib/release-catalog.ts`
- Modify: `apps/web/test/lib/release-catalog.test.ts`
- Modify: `apps/web/lib/browser-curation.ts`
- Create: `apps/web/test/lib/browser-curation.test.ts`
- Modify: `apps/web/test/lib/gallery-route.test.ts`
- Create: `apps/web/lib/image-scene-fusion-config.ts`
- Create: `apps/web/test/lib/image-scene-fusion-config.test.ts`
- Modify: `apps/web/app/gallery/page.tsx`
- Modify: `apps/web/app/gallery/[id]/immersive/page.tsx`
- Modify: `apps/web/app/artwork/[id]/page.tsx`
- Create: `apps/web/e2e/image-scene-fusion.spec.ts`

- [ ] **Step 1: 写失败的 feature flag 与排序不变量测试**

覆盖：

- `ARTDUO_IMAGE_SCENE_FUSION` 缺失或为 `false` 时，server 不读取
  `manifest.image-embedding-v1.json` 或 image shard，browser 也没有对应网络
  请求。
- flag 关闭时每个候选 ID、顺序、现有分数与 Task -1 冻结基线完全一致。
- flag 开启但 variant manifest/shard 缺失、超时、checksum 错误或维度错误时，记录可诊断原因并退回当前排序。
- flag 开启且向量存在时，只调整 Background Scene 候选，不改 Artwork 文本召回。
- 现有 scene type、许可、可用性等硬过滤必须在融合前执行；视觉分数不能让被过滤候选重新进入集合。
- 对一次 artwork selection，只有 artwork 和比较窗口内全部 scene candidate 都有合法同模型向量时才能融合；禁止对有向量的单项加分、对缺向量的单项回退。
- 比较窗口必须是原 metadata score/tie-break 的前
  `visualPolicy.candidateCount`（首版 12）；视觉分数不得召回窗口外 scene。
- variant binding 中的 visual weight/calibration 与 shard
  model/checksum/preprocessing 不一致时拒绝启用。
- 同一 checksum 的并发请求只加载/建索引一次；失败后按 cooldown 回退并可恢复，
  不永久缓存 rejected Promise。

执行：

```bash
pnpm --filter @artduo/corpus test
pnpm --filter @artduo/web test
```

预期：flag 和 fusion 尚不存在，测试失败。

- [ ] **Step 2: 将 promotion-bound variant policy 作为唯一融合参数**

```ts
export interface VisualCalibration {
  lowerCosine: number;
  upperCosine: number;
}

export interface BackgroundSceneScoreBreakdown {
  metadataScore: number;
  visualScore?: number;
  finalScore: number;
  visualApplied: boolean;
}

export function calibrateVisualCosine(
  cosine: number,
  calibration: VisualCalibration,
): number {
  if (
    !Number.isFinite(cosine) ||
    !Number.isFinite(calibration.lowerCosine) ||
    !Number.isFinite(calibration.upperCosine) ||
    calibration.upperCosine <= calibration.lowerCosine
  ) {
    throw new Error("Invalid visual calibration");
  }

  return Math.max(
    0,
    Math.min(
      1,
      (cosine - calibration.lowerCosine) /
        (calibration.upperCosine - calibration.lowerCosine),
    ),
  );
}

export function fuseBackgroundSceneScore(input: {
  metadataScore01: number;
  visualCosine?: number;
  enabled: boolean;
  visualWeight: number;
  calibration: VisualCalibration;
}): BackgroundSceneScoreBreakdown {
  const visualScore = input.visualCosine === undefined
    ? undefined
    : calibrateVisualCosine(input.visualCosine, input.calibration);

  if (
    !Number.isFinite(input.visualWeight) ||
    input.visualWeight < 0 ||
    input.visualWeight > 0.3
  ) {
    throw new Error("Invalid visual weight");
  }

  if (!input.enabled || visualScore === undefined) {
    return {
      metadataScore: input.metadataScore01,
      visualScore,
      finalScore: input.metadataScore01,
      visualApplied: false,
    };
  }

  return {
    metadataScore: input.metadataScore01,
    visualScore,
    finalScore:
      input.metadataScore01 * (1 - input.visualWeight) +
      visualScore * input.visualWeight,
    visualApplied: true,
  };
}
```

`visualWeight` 与 calibration 必须逐字段读取 variant manifest 的
`imageEmbeddingSidecar.visualPolicy`；该 policy 由 Task 7 从通过的 Task 5 report
发布，并用 `promotionReportChecksum`、`promotionBindingChecksum` 和
`imageShardChecksum` 绑定。Web runtime
不得访问内部 evaluation report，也不能另设默认权重或重新调参。现有 metadata
分数必须先通过冻结的理论上下界归一化到 `[0, 1]`，不得对当前候选集合做动态
min-max，也不得用未归一化 raw score 直接融合。

- [ ] **Step 3: 实现显式 server 配置、按需加载与 query-level fail-closed**

配置至少包含：

```ts
export interface ImageSceneFusionConfig {
  enabled: boolean;
  imageEmbeddingManifestPath?: string;
  loadTimeoutMs: number;
}
```

- `enabled` 只由 `ARTDUO_IMAGE_SCENE_FUSION === "true"` 打开。
- `loadTimeoutMs` 首版固定 `300`；它只约束 async server I/O，不能替代 4 MB
  size cap。调整该值必须重跑 Task 6 性能与 fallback E2E。
- variant 位置只由 server 环境变量
  `ARTDUO_IMAGE_EMBEDDING_MANIFEST` 显式提供；不能从 base manifest 路径猜测，
  也不能把该文件系统路径序列化给 client。`realpath` 后必须位于所选 release
  directory 内。
- loader 必须同时返回 `imageEmbeddingSidecar` binding；缺失 binding、binding
  checksum 与下载到的 shard 不一致时 fail-closed。
- flag 关闭时不解析 variant 配置，也不产生 variant/shard 文件读取或 client
  网络请求。
- 保留现有同步 `searchReleaseCatalog`/`getArtworkDetail` 作为 metadata baseline；
  新增 async server wrapper。只有文本检索已产生非空 artwork 结果、现有资格与
  去重规则已得到 scene 比较窗口后，wrapper 才异步读取 image shard。
- 若 artwork 或比较窗口中任一 scene 缺向量，或者发生 timeout、checksum、
  model、revision、artifact、preprocessing、dimensions、entity cross-reference
  错误，本次 artwork selection 整体使用 metadata-only 排序。禁止
  partial-vector boost。
- 加载失败不得阻塞 Gallery 或 Immersive 路径；debug trace 记录稳定枚举值
  `imageSceneFusionFallbackReason`，对用户响应不暴露本机路径或内部错误。
- `searchBackgroundScenes` 的 query-text scene search、`gallery-route.ts` 的
  stage scorer 和 affective negotiation 保持原算法；首版视觉信号只改变每个
  artwork 的 `selectBackgroundScene` 排序。Gallery route 只能通过既有
  `selectedSceneBoost` 间接消费该结果，不能在另一个权重系统中重复叠加 visual
  score。
- Gallery、Immersive 和 Artwork detail 的 server components 必须 `await` 同一
  wrapper；不得出现三个入口各自实现不同的 fusion/fallback。
- 首次成功加载后使用 process-local immutable cache，key 至少包含 variant
  manifest checksum 与 image shard checksum；并发首请求共享同一 Promise。Cache
  最多保留当前 release 的一个 index。失败 Promise 不得永久 poison cache，按
  有界 cooldown 重试，并提供仅测试使用的 reset hook。

- [ ] **Step 4: 增加关键 targeted E2E 与性能预算验证**

`apps/web/e2e/image-scene-fusion.spec.ts` 至少覆盖：

1. flag 关闭：server trace 断言 variant/shard 零文件读取，browser 网络日志也
   断言零 sidecar request；scene ID/顺序与冻结 baseline snapshot 一致。
2. flag 开启：首页/无 query 请求不读 sidecar；带 query 的 Gallery/Immersive
   server render 先得到 artwork，再读取显式 variant 和 shard。Browser 仍不直接
   fetch sidecar。
3. variant/shard 404、超时、checksum 错误和缺 entity：Gallery/Immersive
   仍完成，且 scene ID/顺序退回相同 metadata baseline。
4. 完整 sidecar：硬过滤结果不变，只有比较窗口内 scene 排序可变化，并输出
   calibration/weight/promotion binding checksum trace。
5. 记录真实 server process 的 parse + index p95 和 heap delta，满足 Task -1
   Node 预算；另运行 Task 4 的 Browser loader synthetic diagnostic，不将其
   结果冒充生产 Worker 数据。

测试所需 variant 由 fixture builder 在临时目录中从 Task 5 candidate 与
promotion report 生成；它使用真实 checksum 绑定但只用于验证 loader/fusion，
不写 release 目录，也不作为正式发布物提交。

E2E 通过稳定、无敏感信息的 server trace/status 标记观察是否应用或 fallback，
不能靠 browser request 猜测 server 文件读取。这里只使用项目现有 E2E runner，
不把 Playwright 引入单元测试。若未来要把 sidecar 接入真实 Browser Worker，
必须另行确认 client serving、hydration/重排、CSP/cache、移动端内存和 rollback
设计，不能沿用当前 `runtime=browser-worker` 标签就宣称已完成。

- [ ] **Step 5: 运行回归测试并回写 fusion verification binding**

```bash
pnpm --filter @artduo/contracts build
pnpm --filter @artduo/corpus test
pnpm --filter @artduo/web test
ARTDUO_FUSION_CHECK_DIR="$(mktemp -d -t artduo-image-fusion-check)"
baseline_output="$ARTDUO_FUSION_CHECK_DIR/vector-benchmark.json"
fusion_e2e_output="$ARTDUO_FUSION_CHECK_DIR/image-scene-fusion-e2e.json"
pnpm vector:benchmark -- \
  --release-version 2026-04-25-curation-b \
  --output "$baseline_output"
pnpm --filter @artduo/web exec playwright test \
  e2e/image-scene-fusion.spec.ts \
  --reporter=json > "$fusion_e2e_output"
pnpm test

pnpm image-embeddings:benchmark -- \
  --release-version 2026-04-25-curation-b \
  --build-report data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-report.json \
  --candidate-shard data/curation/reports/image-embeddings/2026-04-25-curation-b/candidates/image-embeddings-01.json \
  --review-pack data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-review-pack.json \
  --review-verdicts data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-review-verdicts.json \
  --fusion-e2e-report "$fusion_e2e_output" \
  --output data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-evaluation.json
```

预期：

- flag 关闭时文本 benchmark 与 Task -1 冻结基线逐 query 一致。
- flag 开启时 artwork 文本召回不变，只有满足完整向量与硬过滤条件的 scene
  selection 实验 snapshot 可变化。
- fallback E2E 的 scene 顺序与 metadata baseline 完全一致。
- targeted E2E 性能数据在冻结预算内。
- evaluation report 保持相同 `promotionBindingChecksum`，新增规范化后的
  `fusionE2eReportChecksum`，并给出 `fusionVerificationReady: true`。原始
  Playwright report 可含临时路径，只保存在 temp dir；evaluation report 只写
  case ID、状态、预算数字和 checksum。

- [ ] **Step 6: 提交晚融合**

```bash
git add \
  packages/corpus/src/background-scene-fusion.ts \
  packages/corpus/src/background-scene-fusion.test.ts \
  apps/web/lib/release-catalog.ts \
  apps/web/test/lib/release-catalog.test.ts \
  apps/web/lib/browser-curation.ts \
  apps/web/test/lib/browser-curation.test.ts \
  apps/web/test/lib/gallery-route.test.ts \
  apps/web/lib/image-scene-fusion-config.ts \
  apps/web/test/lib/image-scene-fusion-config.test.ts \
  apps/web/app/gallery/page.tsx \
  'apps/web/app/gallery/[id]/immersive/page.tsx' \
  'apps/web/app/artwork/[id]/page.tsx' \
  apps/web/e2e/image-scene-fusion.spec.ts \
  data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-evaluation.json
git commit -m "feat(web): gate image-aware background scene scoring"
```

---

## Task 7: 发布 Sidecar、回放与最终验证

**Files:**

- Create: `apps/pipeline/src/publish-image-embedding-sidecar.ts`
- Create: `apps/pipeline/src/publish-image-embedding-sidecar.test.ts`
- Modify: `apps/pipeline/src/cli.ts`
- Modify: `apps/pipeline/package.json`
- Modify: `package.json`
- Add: `data/releases/2026-04-25-curation-b/image-embeddings-01.json`
- Add: `data/releases/2026-04-25-curation-b/manifest.image-embedding-v1.json`
- Inspect only: `data/releases/2026-04-25-curation-b/manifest.json`
- Modify: `README.md`
- Modify: `docs/architecture/image-embedding-sidecar.md`
- Inspect: `output/a2a-framework-test-20260616-142013/run-a2a-spec-harness.ts`
- Inspect: `scripts/evaluate-intent-immersion.ts`

- [ ] **Step 1: 写失败的发布绑定与原子性测试**

覆盖：

- 只有 `promotionReady: true` 且 `fusionVerificationReady: true` 的最终
  evaluation report 才能发布。
- report 中 `releaseVersion`、base manifest checksum、candidate shard checksum、
  promotion anchor checksum、review pack/verdict checksum、model
  revision/variant/artifact checksum、provider version、preprocessing
  fingerprint、人工 review 完成状态、文本 benchmark、A2A ID 集合、fusion E2E
  checksum 任一不匹配时拒绝。
- candidate 不得来自 release 目录；发布器只接收 shadow candidate 和已完成
  evaluation report。
- 发布过程先在同目录临时文件完成 schema/checksum/recordCount/cross-reference
  校验，再原子 rename；失败时 release 目录无半写文件。
- base `manifest.json` 的 bytes/checksum 在成功和失败路径都保持不变。
- variant 是 base manifest 的完整兼容副本：现有 shard metadata 逐字段不变，
  仅新增 `imageEmbeddings` 和严格的 `imageEmbeddingSidecar` binding。
- 重跑相同输入得到相同 shard bytes 和 variant manifest bytes；时间戳等非确定
  字段只能进入 report，不能进入发布文件。

执行：

```bash
pnpm --filter @artduo/pipeline test
```

预期：发布器尚不存在，测试失败。

- [ ] **Step 2: 实现 promotion-bound 发布器**

命令：

```bash
pnpm image-embeddings:publish -- \
  --release-version 2026-04-25-curation-b \
  --candidate-shard data/curation/reports/image-embeddings/2026-04-25-curation-b/candidates/image-embeddings-01.json \
  --build-report data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-report.json \
  --evaluation-report data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-evaluation.json \
  --base-manifest data/releases/2026-04-25-curation-b/manifest.json \
  --variant-manifest data/releases/2026-04-25-curation-b/manifest.image-embedding-v1.json
```

发布器必须：

1. 先验证 Task 5 的所有 promotion 绑定，并确认显式 build report checksum
   一致且 Task 3 `coverageReady` 为 true。
2. 将已验证 candidate 内容复制为 release
   `image-embeddings-01.json`，不得在发布阶段重新推理或改写浮点值。
3. 由当前 base manifest 构造完整
   `manifest.image-embedding-v1.json`；复制既有 shard metadata，不修改 base
   manifest。
4. 写入 `imageEmbeddingSidecar` 的 schema version、base/promotion
   report/promotion binding/image shard checksum、
   model/revision/variant/artifact checksum、provider/preprocessing fingerprint，
   以及通过 report 的 visual policy；再写入 image shard
   sizeBytes/recordCount。
5. 对 shard 和 variant 做临时写入、read-back 校验、`fsync`/atomic rename；
   任一步失败均清理明确的临时文件并保留已存在正式文件。

Web runtime 只有在 flag 打开且
`ARTDUO_IMAGE_EMBEDDING_MANIFEST` 显式指向 variant 时才使用它。默认 release
路径继续加载 base manifest。

- [ ] **Step 3: 离线重建并验证可重复性**

仅在 `promotionReady: true` 且 `fusionVerificationReady: true` 后执行：

```bash
pnpm image-embeddings:build -- \
  --release-version 2026-04-25-curation-b \
  --image-embedding-model Xenova/clip-vit-base-patch32 \
  --image-embedding-model-revision d15189d7028b43f1d3e65039190477f6af591c2a \
  --image-embedding-model-variant quantized \
  --image-embedding-batch-size 8 \
  --source-cache .cache/artduo/image-sources \
  --promotion-anchor-set data/curation/reports/image-embeddings/2026-04-25-curation-b/promotion-anchor-set.json \
  --report-root "$ARTDUO_IMAGE_REPRO_DIR/reports" \
  --candidate-root "$ARTDUO_IMAGE_REPRO_DIR/candidates" \
  --offline true
```

将 reproducibility candidate 与通过 promotion 的 candidate 比较：

- `image-embeddings-01.json` checksum 相同。
- recordCount 相同。
- entity 顺序相同。
- source fingerprint 集合相同。
- model、revision、variant、model artifact checksum、provider version、dimensions、
  preprocessing fingerprint 与 vector precision 相同。

若 source cache 不完整或任一 checksum 不同，发布停止；不得回退网络下载。通过后
再执行 Step 2 的 publish 命令。报告中的 `generatedAt` 可以变化，但不参与
candidate/release shard 或 variant manifest checksum。此步骤不得覆盖 Task 3
build report 或 Task 5 evaluation report。

- [ ] **Step 4: 运行完整验证矩阵**

```bash
pnpm install --frozen-lockfile
pnpm preflight:check

ARTDUO_IMAGE_FINAL_DIR="$(mktemp -d -t artduo-image-final)"
vector_output="$ARTDUO_IMAGE_FINAL_DIR/vector-benchmark.json"
image_output="$ARTDUO_IMAGE_FINAL_DIR/image-benchmark.json"
pnpm vector:benchmark -- \
  --release-version 2026-04-25-curation-b \
  --output "$vector_output"
pnpm image-embeddings:benchmark -- \
  --release-version 2026-04-25-curation-b \
  --build-report data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-report.json \
  --candidate-shard data/releases/2026-04-25-curation-b/image-embeddings-01.json \
  --review-pack data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-review-pack.json \
  --review-verdicts data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-review-verdicts.json \
  --output "$image_output"
ARTDUO_A2A_FINAL_REPLAY_DIR="$ARTDUO_IMAGE_FINAL_DIR/a2a-replay-input"
pnpm exec tsx scripts/evaluate-intent-immersion.ts image-embedding-final \
  --output-dir "$ARTDUO_A2A_FINAL_REPLAY_DIR"
pnpm exec tsx scripts/evaluate-intent-immersion.ts image-embedding-final-repeat \
  --output-dir "$ARTDUO_A2A_FINAL_REPLAY_DIR"
pnpm exec tsx output/a2a-framework-test-20260616-142013/run-a2a-spec-harness.ts \
  --replay "$ARTDUO_A2A_FINAL_REPLAY_DIR/image-embedding-final.json" \
  --replay-repeat "$ARTDUO_A2A_FINAL_REPLAY_DIR/image-embedding-final-repeat.json" \
  --replay-report "$ARTDUO_A2A_FINAL_REPLAY_DIR/image-embedding-final.md" \
  --output-dir "$ARTDUO_IMAGE_FINAL_DIR/a2a-harness"
pnpm --filter @artduo/web exec playwright test e2e/image-scene-fusion.spec.ts
```

验证必须比较内容而非只看退出码或总数：

- 文本 benchmark 逐 query 对比 Task -1 冻结基线，并满足第 4 节
  `Top1 >= 95.83%`、`Top5 = 100%`；若 Task -1 使用 waiver 进入 shadow，
  则此处仍必须恢复门槛，waiver 不允许发布。
- A2A 比较 pass/fail/blocked case ID 集合；不得新增 fail/blocked ID，也不得让
  已 pass ID 退化。Harness 当前可能在 case fail 时仍返回零，因此不能只看退出码
  或 `counts`。
- replay 平均 total `>= 0.975`，hard resistance violation 为 `0`。
- 临时 image benchmark 因未重新传入原始 fusion E2E report，可保持
  `fusionVerificationReady: false`；但其 candidate metrics、human gates 与
  `promotionBindingChecksum` 必须和已发布 evaluation report 一致。
- targeted E2E 与现有全量 preflight 均通过，且 flag 关闭时 server 零
  variant/shard 文件读取、browser 零 sidecar request。
- base manifest checksum 与 Task -1 冻结值相同；variant 的既有 shard 描述与
  base 逐字段相同。

- [ ] **Step 5: 检查 sidecar 泄漏和占用**

```bash
rg -n '/Users/|file://|api[_-]?key|authorization|token=|private|localhost|127\\.0\\.0\\.1' \
  data/releases/2026-04-25-curation-b/image-embeddings-01.json \
  data/releases/2026-04-25-curation-b/manifest.image-embedding-v1.json \
  data/curation/reports/image-embeddings/2026-04-25-curation-b
wc -c data/releases/2026-04-25-curation-b/image-embeddings-01.json
gzip -c data/releases/2026-04-25-curation-b/image-embeddings-01.json | wc -c
```

预期：敏感信息扫描无结果；raw/gzip 体积、recordCount、单 shard 上限和 runtime
预算满足第 4 节门槛。若正常业务字段可能命中宽泛词 `private`，必须逐条人工判定
并在发布报告记录，不得直接忽略整个规则。

- [ ] **Step 6: 更新文档**

README 与架构文档必须说明：

- 文本 embedding 仍负责用户 query 召回。
- image embedding 是可选视觉 sidecar。
- relationship graph 仍是证据 sidecar。
- 当前无向量数据库和图数据库。
- base `manifest.json` 不含 image shard；variant manifest 的显式配置、构建、
  benchmark、debug、发布、feature flag 与回退命令。
- flag 默认关闭；关闭时 server 零 variant/shard 文件读取、browser 零 sidecar
  request。回滚只需关 flag/移除显式 variant 配置，不删除 base release。
- candidate、evaluation report、release shard、variant manifest 之间的 checksum
  和 model/preprocessing 绑定。
- baseline model 不是最终模型承诺，换模型必须生成新 benchmark。

- [ ] **Step 7: 最终提交**

```bash
git add \
  apps/pipeline/src/publish-image-embedding-sidecar.ts \
  apps/pipeline/src/publish-image-embedding-sidecar.test.ts \
  apps/pipeline/src/cli.ts \
  apps/pipeline/package.json \
  package.json \
  data/releases/2026-04-25-curation-b/image-embeddings-01.json \
  data/releases/2026-04-25-curation-b/manifest.image-embedding-v1.json \
  data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-evaluation.json \
  data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-review-pack.json \
  data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-reviewer-view.html \
  data/curation/reports/image-embeddings/2026-04-25-curation-b/image-embedding-review-verdicts.json \
  README.md \
  docs/architecture/image-embedding-sidecar.md
git commit -m "data: publish evaluated image embedding sidecar"
```

提交前执行 `git diff --cached --name-only`，确认不包含 base
`data/releases/2026-04-25-curation-b/manifest.json`、cache、repro candidate 或
无关 dirty worktree 文件。

---

## 5. 执行顺序与停止点

```text
Task -1 repository + baseline readiness
  -> Task 0 baseline freeze
  -> Task 1 contract
  -> Task 2 provider/source safety
  -> Task 3 shadow candidate sidecar (coverageReady only)
  -> Task 4 optional loader/search
  -> Task 5 shadow benchmark + human review
       -> promotionReady=false: stop, keep shadow capability
       -> promotionReady=true: Task 6 gated scene fusion
              -> fusionVerificationReady=false: stop, fix/fallback stays metadata-only
              -> fusionVerificationReady=true: Task 7 promotion-bound variant publish/replay
```

Task -1 发现 dirty worktree 未隔离、基线回归未获 waiver、输入 checksum 漂移或
测量方法缺失时必须停止。Task 1-4 可以形成完整但不影响生产排序的基础设施；
Task 3 不能发布。Task 5 是产品决策门，只有它能给出 `promotionReady`；Task 6
只追加 production-integration 的 `fusionVerificationReady` 证据，不能修改
promotion metrics/policy。Task 6-7 不是默认自动执行项；Task -1 的文本回归
waiver 只允许继续 shadow
Task 1-5，不能放行 Task 6-7。任何阶段都不得覆盖 base manifest。

## 6. 并行实施建议

先完成 Task -1，并获得用户对 worktree 范围和合并顺序的明确授权后，最多使用
3 个独立 worktree：

| Worktree | 范围 | 可开始条件 |
| --- | --- | --- |
| A | Task 1 contracts；其后 Task 4 corpus loader/index | Task 0 已冻结；Task 4 必须等 Task 1 契约完成 |
| B | Task 2 provider/source；其后 Task 3 shadow builder | Task 1 接口稳定；Task 3 必须等 Task 2 安全与 cache 测试完成 |
| C | Task 5 evaluation/debug fixture 与 reviewer UI | 可先做不依赖实现的 fixture；集成必须等 Task 3 candidate schema 和 Task 4 API 稳定 |

Task 6 必须在 A/B/C 合并、真实 benchmark、人工 review 和 `promotionReady: true`
后串行执行；Task 7 最后串行发布。各 worktree 不同时修改
`package.json`、`apps/pipeline/package.json`、release 文件或相同 CLI registry；
依赖、lock、scripts 与 CLI registry 由 B 统一维护；C 在并行阶段只提交 evaluation
模块文件，等合并时再由 B/主线接线。每个 worktree 只按步骤列出的具体文件执行
`git add`，合并前运行各自测试并记录 commit/checksum，禁止用目录级 staging
吸入主 worktree 的既有改动。

## 7. 实施完成判定

本计划只有同时满足以下条件才算完成：

- `imageEmbeddings` 契约严格、可选、版本化，并验证 entity cross-reference、
  维度、unit norm、size/checksum 上限。
- 两类实体可从固定 source cache、固定 model revision/variant 离线重建；普通测试
  不下载模型，真实 smoke 明确 opt-in；provider/ONNX/decoder 版本由已跟踪
  `pnpm-lock.yaml` 固定并进入 report fingerprint。
- 所有 Critical Artwork 100% 覆盖；当前无 Grade A 时，冻结的 30-item
  promotion anchor set 100% 覆盖，零分母不算通过。
- candidate 构建失败不污染 release；发布失败不改 base manifest、不留下半写
  release shard/variant。
- Node/Browser loader 只按显式 variant 按需加载；生产 Node consumer 在 flag
  关闭时零文件读取，Browser 无网络请求；缺失或 partial-vector 时按 query 整体
  安全回退。
- shadow holdout benchmark 带独立 entity sample size、cluster-bootstrap 95% CI 和
  per-strata breakdown；
  30/30 盲评完成且满足人工门槛。
- 未达标时生产排序零变化；达标后 scene fusion 仍由默认关闭的 flag 控制。
- 文本 Top1 `>= 95.83%`、Top5 `= 100%`；A2A 不新增 fail/blocked case ID，
  已 pass ID 不退化；replay average total `>= 0.975` 且 hard resistance
  violation 为 `0`。
- 现有 metadata eligibility、score/tie-break 与固定 top-12 candidate window 在
  视觉融合前执行，融合 candidateCount/calibration/weight 与通过的 promotion
  report/binding checksum 绑定。
- Task 5 report 为唯一 promotion authority；Task 7 拒绝任何 release、
  checksum、model、preprocessing、人审、文本、A2A 或 E2E 绑定不匹配，并要求
  `promotionReady` 与 `fusionVerificationReady` 同时为 true。
- base manifest bytes/checksum 不变；发布物仅为 image shard 与完整
  `manifest.image-embedding-v1.json` variant。
- release shard 无绝对路径、凭证、内部错误详情泄漏。
- release raw/gzip、生产 Node parse/index p95 与 heap 预算通过；Browser loader
  synthetic diagnostic 单独标记，不冒充生产 Worker。
- `pnpm preflight:check`、targeted E2E、文本/image benchmark、A2A
  case-set diff 与 replay 全部满足本节门槛。

## 8. 计划自检

执行前检查：

```bash
rg -n -e 'PLACE''HOLDER' -e 'FIX''ME' -e 'implement ''later' -e 'similar ''to' \
  docs/plans/artduo-v2-image-embedding-sidecar-plan.md

rg -n -e 'publish''ToManifest' -e 'publish''-to-manifest' \
  -e 'Modify: `data/releases/2026-04-25-curation-b/manifest''\\.json`' \
  docs/plans/artduo-v2-image-embedding-sidecar-plan.md

rg -n 'git add (apps|packages|data)/[^[:space:]\\\\]+$' \
  docs/plans/artduo-v2-image-embedding-sidecar-plan.md
```

预期：三组检查均无结果。另需确认：

- base manifest 的初始 checksum 与最终 checksum 相同。
- 所有 `git add` 都是明确文件路径，没有目录级 staging。
- fenced code blocks 成对，命令中的输出路径不会覆盖当前已跟踪 benchmark/report。
- 所有计划文件路径与当前分支一致。

若实现期间现有接口、release 输入或基线已变化，应先更新本计划中的路径、契约、
checksum 绑定和验证命令，再继续改代码。
