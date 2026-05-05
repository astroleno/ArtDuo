---
title: ArtDuo V2 Artwork Collection Runbook
status: active
created: 2026-04-24
origin: docs/plans/artduo-v2-lightweight-rebuild-plan.md
---

# ArtDuo V2 名画采集与收敛 Runbook

## 目标

这份 runbook 不是策略备忘录，而是一份可以交给 data / pipeline 团队直接执行的手册。

执行节奏固定为三段：

1. `probe`
2. `batch`
3. `review loop`

一句话：

- probe 用来验证 query 和馆源
- batch 用来扩出 candidate pool
- review loop 用来把 candidate pool 收敛成 `release-ready corpus`

## 当前仓库里的真实入口

### 旧入口

当前仓库已经有一个 legacy 采集脚本：

- `scripts/collect/met-collect.js`

它仍然可用，但它面向的是旧项目的 emotion 采集，输出到：

- `data/met/artworks/`
- `data/met/reports/`

它不再是 V2 runbook 的主入口。

### 新入口

本轮已经补上了 V2 采集入口：

- `scripts/collect/met-probe.js`
- `scripts/collect/met-batch.js`
- `scripts/collect/build-curation-summaries.js`
- `apps/pipeline/src/build-confirmed-metadata-backfill.ts`
- `apps/pipeline/src/build-metadata-backfill-preview.ts`
- `apps/pipeline/src/build-candidate-preview.ts`
- `apps/pipeline/src/build-quantity-preview.ts`
- `package.json` script: `npm run collect:met:probe`
- `package.json` script: `npm run collect:met:batch`
- `package.json` script: `npm run collect:metadata-backfill`
- `package.json` script: `npm run collect:metadata-preview`
- `package.json` script: `npm run collect:candidate-preview`
- `package.json` script: `npm run collect:quantity-preview`

这个入口会把 probe artifacts 写到：

- `data/sources/met/probe/<theme>/<run-id>/`

汇总和 handoff artifact 固定写到：

- `data/curation/reports/probe-summary.json`
- `data/curation/reports/probe-summary.md`
- `data/curation/reports/probe-approved-query-matrix.json`
- `data/curation/reports/probe-approved-query-matrix.md`

在 `apps/pipeline/` 正式接管前，V2 的第一周工作以这个入口为准。

## Canonical 目录树

```text
data/
  met/
    ...legacy-only...
  sources/
    met/
      probe/
        <theme>/<run-id>/
      batch/
        <theme>/<run-id>/
  curation/
    candidate-pool/
    review-queue/
    confirmed/
    metadata-backfill/
    preview/
    release-ready/
    reports/
    benchmarks/
```

说明：

- `data/met/*` 继续保留为 legacy 参考数据
- V2 runbook 只往 `data/sources/*` 和 `data/curation/*` 写入
- `metadata-backfill/` 是 `confirmed` 的并行 enrichment artifact，只补 Phase 1 metadata/retrieval 字段
- `preview/` 是 metadata-backfill 的下游试运行产物，可供检索 / 文案 / UI 验证使用
- `release-ready/` 是最终可进入 release manifest 的集合

## 状态定义

### candidate

只是通过自动清洗的候选，不保证值得保留。

### confirmed

通过人工或策展 review，值得进入最终作品库候选层。

### metadata-backfill

基于 `confirmed` 补齐 Phase 1 metadata / retrieval 字段后的并行工作层。

说明：

- 这一步可以和 curation backfill 并行推进
- 它不等于主题 gate 已通过
- 它也不等于 portfolio gate 已通过

### preview

基于 `metadata-backfill` 生成的 preview-only shard / manifest 层。

说明：

- 只用于检索、文案、下游消费联调
- 不等于 runtime 正式 release
- 不得替代 `release-ready/` 成为 canonical 发布源

当数量目标优先于 curation gate 时，可以额外生成 `candidate-preview`：

- 输入来自 `candidate-pool/`
- 只用于大盘浏览、粗召回验证和 UI 压测
- 不得和 `metadata-backfill preview` 混淆

如果仍然不足以满足数量目标，可以额外生成 `quantity-preview`：

- 先吃 `candidate-pool` 全并集
- 再用 legacy Met 处理语料做补位
- 补位必须在 report 里明确披露，不得伪装成当前 curation 成果
- preview 目录内必须同时写逐条 provenance sidecar，能区分 `candidate-pool`、`legacy-boost`、`legacy-fallback`

### release-ready

在 `confirmed` 基础上，已经满足 Phase 1 发布合同，能够进入 `ReleaseManifest` 产物。

结论：

- `confirmed` 不等于可发布
- `metadata-backfill` 不等于 gate-cleared
- `preview` 不等于 release-ready
- `candidate-preview` 只代表数量可用，不代表策展质量可用
- `quantity-preview` 允许 legacy boost，但只能用于数量导向验证
- Phase 1 runtime 实际消费的是 `release-ready corpus`

## release-ready 最低条件

单件作品进入 `release-ready` 前，至少要满足：

- 有稳定的 `sourceArtworkId`
- 有 `title`
- 有 `artistDisplayName` 或稳定替代字段
- 有 `descriptionRaw` 或可清洗文本来源
- 有 `storySnippet`
- 有 `retrieval.searchText`
- 有至少一组 `moodTags`
- 有至少一组 `colorTags`
- 有 `baseImageUrl` 或 `imageUrlPreview`
- 有 `mediaVersion` 或 `sourceAssetFingerprint`
- 不与现有 `release-ready` 作品高度重复
- 已完成一次人工 review

这组条件和 Phase 1 的本地 corpus contract 对齐，避免“confirmed 了但还不能发布”。

## Owner 定义

### Pipeline Owner

负责：

- probe / batch 脚本执行
- 原始结果落盘
- 详情拉取
- 规范化
- 去重
- 自动报告生成

### Curatorial Owner

负责：

- `promote / hold / reject` 判定
- query 是否偏题
- 作品是否值得进入 confirmed

### Design / Frontend Owner

负责：

- 图像质量
- 展示适配性
- 背景场景适配性
- unit / transition 角度的缺口判断

## Probe 命名与目录规则

每一次 probe 都必须有唯一 `run-id`。

推荐格式：

- `<iso-timestamp>--<theme>--<query-slug>`

例如：

- `2026-04-24T12-00-00-000Z--serenity--serenity`
- `smoke-test-serenity`

每个 probe run 固定产出：

```text
data/sources/met/probe/<theme>/<run-id>/
  query.json
  search-results.json
  detail-sample.json
  probe-report.md
```

这样不会互相覆盖，也方便审计和回放。

## Probe 文件 schema

### `query.json`

必须包含：

- `runId`
- `createdAt`
- `source`
- `theme`
- `query`
- `synonyms[]`
- `excludes[]`
- `titleOnly`
- `limit`
- `sample`

### `search-results.json`

必须包含：

- `runId`
- `source`
- `theme`
- `uniqueHitCount`
- `candidateObjectIDs[]`
- `searches[]`
- `searchDigest`

其中 `searches[]` 每项至少包含：

- `term`
- `titleOnly`
- `total`
- `objectIDs[]`

### `detail-sample.json`

必须包含：

- `runId`
- `sampleObjectIDs[]`
- `objects[]`
- `reviewSignals`

其中 `objects[]` 每项至少包含：

- `sourceArtworkId`
- `title`
- `artistDisplayName`
- `yearLabel`
- `imageUrlPreview`
- `imageUrlFull`
- `descriptionRaw`
- `hasImage`
- `hasDescription`
- `hasArtist`

### `probe-report.md`

必须回答：

- 命中数量够不够
- 画面质量够不够
- metadata 完整度怎么样
- 查询词是否偏题
- 哪些词值得保留，哪些词要禁用
- 推荐 verdict 是什么

## Probe 可执行命令

### 最小 smoke test

```bash
npm run collect:met:probe -- \
  --theme serenity \
  --query serenity \
  --synonym calm \
  --limit 3 \
  --sample 2 \
  --run-id smoke-test-serenity
```

### 标准 probe

```bash
npm run collect:met:probe -- \
  --theme melancholy \
  --query melancholy \
  --synonym sadness \
  --synonym solitude \
  --synonym twilight \
  --exclude depressed \
  --exclude mood \
  --limit 20 \
  --sample 10
```

## 阶段 0：准备

### Step 0.1：锁定第一轮范围

第一轮固定为：

- source: `met`
- themes: 10 个
- 每个 probe：`limit=20`、`sample=10`

推荐 10 个主题：

- serenity
- melancholy
- longing
- wonder
- contemplation
- hope
- loneliness
- joy
- mystery
- desire

### Step 0.2：建立目录

必须先建立：

- `data/sources/met/probe/`
- `data/sources/met/batch/`
- `data/curation/candidate-pool/`
- `data/curation/review-queue/`
- `data/curation/confirmed/`
- `data/curation/metadata-backfill/`
- `data/curation/preview/`
- `data/curation/release-ready/`
- `data/curation/reports/`
- `data/curation/benchmarks/`

### Step 0.3：建立 benchmark prompts

先落一份：

- `data/curation/benchmarks/phase1-prompts.json`

最低要求：

- 20 条 prompt
- 每条 prompt 关联一个主主题
- 每条 prompt 有人工期望方向说明

## 阶段 1：Probe

目标：

- 验证哪些 query 真能拿到值得进入 batch 的作品

### Step 1：写 query matrix

每个主题至少准备：

- 1 个主 query
- 2 到 4 个 synonyms
- 1 到 2 个 exclude / failed terms

### Step 2：执行 probe

每个主题跑一次标准 probe 命令。

执行 owner：`Pipeline`

### Step 3：人工抽样 review

看 `detail-sample.json` 和 `probe-report.md`。

执行 owner：`Curatorial + Design`

### Step 4：写 verdict

每个 probe 只允许 3 种 verdict：

- `pass`
- `mixed`
- `fail`

建议把 verdict 追加进：

- `data/curation/reports/probe-summary.json`
- `data/curation/reports/probe-summary.md`

注意：

- probe verdict 只用 `pass / mixed / fail`
- `promote / hold / reject` 只属于 review loop，不能回写成 probe verdict
- summary 必须保留 `configuredInput`、`configuredExcludes`、`recommendedBans`、metrics 和 override log，不能只留一句人工结论

### Probe Gate

只有满足以下阈值才允许进入 batch：

- `uniqueHitCount >= 10`
- `sample size >= 10`
- `usable hits >= 5`
- `image coverage >= 0.7`
- `artist coverage >= 0.7` 或 `description coverage >= 0.3`
- 人工 verdict 为 `pass`

其中：

- `usable hit` = `hasImage && (hasDescription || hasArtist)`

### Probe 到 Batch 的 canonical handoff

只有在 probe summary 里被标成 `gateDecision = approved-for-batch` 的主题，才允许进入 batch。

canonical handoff artifact 固定为：

- `data/curation/reports/probe-approved-query-matrix.json`
- `data/curation/reports/probe-approved-query-matrix.md`

要求：

- batch 的 `query / synonym / exclude` 必须从这份 matrix 读取
- 手写 `--query/--synonym/--exclude` 只允许用于临时调试，不可作为 canonical batch artifact
- batch run 的 `query.json` 必须记录它消费的是哪一份 approved matrix，以及对应的 probe run

## 阶段 2：Batch

目标：

- 在已经通过 probe gate 的 query 上扩出 candidate pool

### Batch 目录规则

每次 batch 固定产出到：

```text
data/sources/met/batch/<theme>/<run-id>/
  query.json
  search-results.json
  raw-details.json
  normalized.json
  batch-report.md
  batch-report.json
```

### Batch 可执行命令

```bash
npm run collect:met:batch -- \
  --theme melancholy \
  --use-approved-matrix \
  --limit 100
```

### Batch Owner

- 执行：`Pipeline`
- 审核：`Curatorial + Design`

### Batch 最低要求

每个通过 probe gate 的主题：

- 至少扩到 `50-200` 条 candidate
- 每条 candidate 至少补齐：
  - `sourceArtworkId`
  - `title`
  - `yearLabel`
  - `imageUrlPreview` 或 `imageUrlFull`
  - `objectUrl`
  - `artistDisplayName` 或 `descriptionRaw`

同时要求：

- `descriptionRaw` 只要有就必须保留到 normalized candidate
- `descriptionRaw` 为空时要记为 metadata gap，而不是直接把 candidate 清空
- 自动 gate 至少保证 `hasImage && title && objectUrl && (artistDisplayName || descriptionRaw)`

### 自动剔除规则

batch 阶段必须自动检查：

- duplicate object id
- 缺图
- 缺 `title`
- 缺 `objectUrl`
- 图片不可访问
- 图像过小
- 同时缺 `artistDisplayName` 和 `descriptionRaw`
- 明显偏题

说明：

- `descriptionRaw` 为空 = metadata gap，不是自动剔除
- `artistDisplayName` 为空但 `descriptionRaw` 存在 = 允许保留

### Batch 输出去向

- canonical review 输入进入 `data/curation/review-queue/`
- `data/curation/candidate-pool/` 当前仅作为 bootstrap mirror snapshot
- 每轮都必须写 `gap report`

建议 gap report 路径：

- `data/curation/reports/gap-report-<run-id>.json`

要求：

- review loop 只读取 `review-queue/`
- 如果 `candidate-pool/` 仍然双写同一份数据，summary 必须显式标注它只是 mirror，而不是另一个独立 gate

## 阶段 3：Review Loop

目标：

- 用多轮 review 和 targeted backfill，把 candidate pool 收敛成 `release-ready corpus`

### Review Loop 固定输入

每轮 review 只处理一批固定规模：

- `50-150` 件

输入来源：

- `data/curation/review-queue/`

### Review 决策文件

每轮 review 必须产出：

```text
data/curation/reports/review-<run-id>.jsonl
data/curation/reports/review-<run-id>.md
```

`jsonl` 每条最少字段：

- `runId`
- `sourceArtworkId`
- `decision`
- `decisionOwner`
- `decisionAt`
- `reasonCodes[]`
- `notes`
- `nextAction`

### 决策枚举

每件作品只能进入三类之一：

- `promote`
- `hold`
- `reject`

### Reject Reason Codes

- `low-image-quality`
- `weak-metadata`
- `duplicate`
- `weak-emotion-fit`
- `weak-display-fit`
- `out-of-scope`

### Promote 后的状态流转

- `promote` -> 进入 `confirmed/`
- 经过 metadata backfill -> 进入 `metadata-backfill/`
- 经过 Phase 1 contract 补齐和发布校验后 -> 进入 `release-ready/`

### release-ready 审核

在进入 `release-ready/` 前，Pipeline 必须额外跑一次发布校验：

- Phase 1 字段完整性检查
- `mediaVersion / sourceAssetFingerprint` 检查
- `searchText` 非空检查
- tag 基础覆盖检查
- 去重检查

## Coverage / Gap 审计

每轮 review 后必须更新一份 coverage report：

- `data/curation/reports/coverage-<run-id>.json`

最低统计维度：

- emotion coverage
- source coverage
- portrait / landscape / square
- A/B/C 分级预估分布
- 可匹配背景 scene 的作品占比

### 继续回补的触发条件

如果出现下面任一情况，就必须回到 probe 或 batch：

- 某主主题 confirmed 少于 `30`
- portrait / landscape / square 任一类型少于目标池的 `15%`
- 可匹配背景 scene 的作品占比低于 `60%`
- source 过度集中，单馆占比高于 `70%`

## 停止条件

不是“凑够数量就停”，而是同时满足：

- `release-ready` works 在 `500-1000` 之间
- 10 个主主题都不为空
- portrait / landscape / square 分布可用
- 可匹配背景 scene 的作品占比 `>= 70%`
- 没有明显的单馆、单时代、单媒介偏科
- benchmark prompts 复跑后，top 10 结果仍满足 Phase 1 可信度门槛

## 第一周可执行清单

### Day 1

- 建目录
- 建 `phase1-prompts.json`
- 选 10 个主题
- 写每个主题的 query matrix

### Day 2

- 对 10 个主题执行标准 probe
- 检查每个 probe 是否产出 4 个固定文件

### Day 3

- Pipeline 汇总 `probe-summary.json`
- Curatorial 和 Design 开始抽样 review

### Day 4

- 给 10 个主题打 `pass / mixed / fail`
- 标记需要重跑的 query

### Day 5

- 锁定可进 batch 的 5 个主题
- 写下周 batch 计划
- 补第一版 gap report

## 本周完成定义

如果第一周结束时满足以下条件，就表示 runbook 已经真正启动：

- 10 个 probe 全部执行完成
- 每个 probe 都有唯一 `run-id`
- 每个 probe 都产出 4 个固定文件
- 至少 5 个主题拿到明确 verdict
- 至少 1 份 `probe-summary.json` 落盘
- 至少 1 份 `phase1-prompts.json` 可供 benchmark 重放

## 一句话总结

V2 的作品采集不是“先抓满再说”，而是：

- 先用可运行的 probe 入口验证 query
- 再用 batch 扩出 candidate pool
- 最后把 `confirmed` 和 `release-ready` 分开，靠 review + gap backfill 收敛到真正可发布的作品库
