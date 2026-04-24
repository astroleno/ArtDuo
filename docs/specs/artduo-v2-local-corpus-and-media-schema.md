# ArtDuo V2 本地语料与远端媒体 Schema

Created: 2026-04-23
Status: active
References:

- `docs/brainstorms/artduo-v2-lightweight-rebuild-requirements.md`
- `docs/plans/artduo-v2-lightweight-rebuild-plan.md`
- `docs/specs/artduo-v2-shared-contracts-and-api.md`
- `docs/specs/artduo-v2-background-scene-schema.md`
- `reference/chatgpt/分级.md`
- `reference/chatgpt/动画.md`

## 目标

这份规格用于明确五件事：

1. runtime 到底消费什么 release artifact
2. 本地语料库存什么
3. background scene catalog 和 artwork corpus 怎么共处
4. 远端媒体如何被引用并保持尽量可重放
5. embedding shard 在什么阶段接入

## 核心原则

- 本地优先，但本地不承载重媒体二进制
- runtime 只认一份 release manifest
- background scene catalog 是 release manifest 的一部分
- artwork corpus 和 background scene asset 在源数据层分离，在 release 层汇总
- `embeddings` 在 Phase 1 是可选字段，不得成为 thin slice 前提
- 远端媒体引用必须带 `mediaVersion` 或等价 fingerprint，尽量保证 release 可重放

## Release Artifact 边界

ArtDuo V2 运行时应消费一份版本化 release artifact，而不是分散的临时 JSON。

这份 release artifact 至少包含：

- release 版本信息
- artwork metadata shards
- artwork search shards
- artwork media index shards
- background scene shards
- optional embedding shards

运行时主路径只需要：

- `metadata`
- `search`
- `backgroundScenes`
- 视情况使用 `mediaIndex`

## 推荐实体结构

### SourceVersions

```ts
type SourceVersions = {
  corpusVersion: string
  backgroundCatalogVersion: string
  contractsVersion: string
}
```

### ReleaseManifest

```ts
type ReleaseManifest = {
  release: SourceVersions & {
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

type ShardInfo = {
  id: string
  url: string
  checksum: string
  sizeBytes: number
  recordCount: number
}
```

说明：

- `backgroundScenes` 必须进入 manifest
- `embeddings` 在 Phase 1 可缺席
- runtime 主协议不依赖额外的 `GET /v1/background-scenes`

### ArtworkRecord

```ts
type ArtworkRecord = {
  id: string
  source: "met" | "custom"
  sourceArtworkId: string
  version: string
  locale?: string

  metadata: ArtworkMetadata
  retrieval: ArtworkRetrieval
  media: ArtworkMediaRefs
  presentation: ArtworkPresentation
}
```

## ArtworkMetadata

```ts
type ArtworkMetadata = {
  title: string
  artistDisplayName?: string
  yearLabel?: string
  medium?: string
  culture?: string
  department?: string
  dimensions?: string
  creditLine?: string

  objectUrl?: string
  sourceApiUrl?: string

  descriptionRaw?: string
  descriptionClean?: string
  storySnippet?: string

  moodTags: string[]
  colorTags: string[]
  subjectTags: string[]
  compositionTags: string[]
}
```

说明：

- `descriptionRaw` 保留源描述，便于回溯
- `descriptionClean` 存清洗后的可读版本
- `storySnippet` 是前端可直接消费的短引导文案
- `moodTags`、`colorTags` 等是粗召回和展示的关键输入

## ArtworkRetrieval

```ts
type ArtworkRetrieval = {
  searchText: string
  searchTextShort?: string

  emotionLabels: string[]
  energyLevel?: "low" | "medium" | "high"
  valence?: "dark" | "mixed" | "bright"
  pace?: "still" | "gentle" | "active"
  spaceSense?: "close" | "balanced" | "open"

  keywordBoosts?: string[]
  embeddingRef?: string
  embedding?: number[]
}
```

说明：

- Phase 1 以 `searchText`、标签和映射字段为主
- Phase 2 再通过 `embeddingRef` 或量化 `embedding` 接入向量检索
- `embedding` 不应跟 metadata 首屏一起全量下发

## ArtworkMediaRefs

```ts
type ArtworkMediaRefs = {
  baseImageUrl?: string
  imageUrlPreview?: string
  imageUrlFull?: string

  videoUrlMain?: string
  videoUrlVertical?: string
  videoUrlCloseup?: string
  videoPosterUrl?: string

  aspectRatioHint?: "portrait" | "landscape" | "square"
  hasMotionAsset: boolean

  mediaVersion?: string
  sourceAssetFingerprint?: string
}
```

说明：

- `mediaVersion` 是媒体版本号
- `sourceAssetFingerprint` 可使用 checksum、etag、尺寸哈希或托管后的版本化 key
- 这两个字段至少要有一个，才能支撑 release 可重放

## ArtworkPresentation

```ts
type ArtworkPresentation = {
  grade: "A" | "B" | "C"
  gradeLabel: "director-focus" | "emotional-pillar" | "ambient-bridge"

  motionProfile:
    | "static"
    | "ambient-loop"
    | "parallax"
    | "zoom"
    | "push-in"
    | "out-of-frame"

  focusTarget?: {
    x: number
    y: number
    radius?: number
  }

  narrationMode?: "none" | "caption" | "voiceover"
  gestureOverlayRef?: string
  highlightMaskRef?: string

  sceneAffinity?: {
    sceneTypes?: string[]
    paletteModes?: string[]
    spatialModes?: string[]
    transitionTags?: string[]
  }
}
```

说明：

- `grade` 对齐 A/B/C 分级思路
- `motionProfile` 对齐动态媒体增强方向
- `sceneAffinity` 给背景匹配和 unit 组装提供轻量提示

## 本地语料边界

### 本地必须存储

- 作品基础 metadata
- 清洗后的结构化字段
- 展示所需摘要
- 检索文本、标签和映射字段
- 向量检索相关数据或索引引用
- 远端媒体 URL 和媒体版本信息
- 分级字段和动态展示字段

### 本地不应存储

- 原始高清图文件本体
- 循环视频文件本体
- 放大镜头视频文件本体
- 大体积音频本体
- 任意不影响首屏检索的重二进制资源

补充说明：

- `public/artduo-gallery/` 下的背景场景资产属于独立本地 scene asset 集
- background scene asset 不计入 artwork corpus 的重媒体约束
- artwork corpus 和 background scene asset 会在 release 层汇总，在运行时组装成 `ExhibitionUnit`

## 渐进加载策略

### Phase 1

- 首屏只拉 `GET /v1/corpus/manifest`
- 根据首屏需要拉最小 `metadata`、`search` 和 `backgroundScenes` shard
- 本地完成轻量召回和背景匹配
- 卡片默认只使用 `imageUrlPreview` 或 `baseImageUrl`

### Phase 2

- 用户进入深度检索后再按需预热 `embeddings`
- detail 页进入时拉 `imageUrlFull`
- explanation 通过 API 按需补全

### Phase 3

- immersive 页进入时按需拉取 `videoUrlMain`、`videoUrlVertical` 或 `videoUrlCloseup`
- A 级作品优先预热导演式资产
- 视频不可用时自动回退为静态图 + 轻动态效果

## 远端媒体的可重放约束

如果同一个 release version 要尽量渲染出同样的结果，媒体引用必须有版本策略。

建议遵守以下约束：

1. 优先使用版本化 CDN URL 或托管后的不可变 key
2. 如果只能拿到上游可变 URL，pipeline 必须记录：
   - `mediaVersion` 或上游更新时间
   - `sourceAssetFingerprint`
   - 媒体尺寸、比例和 MIME 信息
3. `mediaIndex` shard 必须保留这些版本与指纹信息
4. 发布流程必须校验 manifest 中引用的媒体元信息是否完整

## 背景 scene 与 artwork corpus 的关系

- background scene catalog 是 release manifest 的一部分
- 它和 artwork corpus 不是同一份 record，但同属一份 release
- 前端在 runtime 中同时加载 artwork shards 与 background scene shards
- 最终通过 `ExhibitionUnit` 把 artwork 和 background scene 组装在一起

## Phase 对应字段要求

### Phase 1 必需字段

- `id`
- `metadata.title`
- `metadata.artistDisplayName`
- `metadata.storySnippet`
- `metadata.moodTags`
- `metadata.colorTags`
- `retrieval.searchText`
- `media.baseImageUrl` 或 `media.imageUrlPreview`
- `media.mediaVersion` 或 `media.sourceAssetFingerprint`

### Phase 2 新增要求

- `retrieval.embeddingRef` 或 `retrieval.embedding`
- `media.imageUrlFull`
- `presentation.grade`
- `presentation.motionProfile`

### Phase 3 新增要求

- `media.videoUrlMain`
- `media.videoUrlVertical`
- `media.videoUrlCloseup`
- `presentation.focusTarget`
- `presentation.gestureOverlayRef`
- `presentation.highlightMaskRef`
- `presentation.narrationMode`

## JSON 示例

### ReleaseManifest

```json
{
  "release": {
    "corpusVersion": "2026-04-24-a",
    "backgroundCatalogVersion": "2026-04-24-a",
    "contractsVersion": "0.1.0",
    "createdAt": "2026-04-24T10:00:00.000Z"
  },
  "shards": {
    "metadata": [
      {
        "id": "metadata-01",
        "url": "https://cdn.example.com/corpus/2026-04-24-a/metadata-01.json",
        "checksum": "sha256:abc",
        "sizeBytes": 120034,
        "recordCount": 250
      }
    ],
    "search": [
      {
        "id": "search-01",
        "url": "https://cdn.example.com/corpus/2026-04-24-a/search-01.json",
        "checksum": "sha256:def",
        "sizeBytes": 88340,
        "recordCount": 250
      }
    ],
    "mediaIndex": [
      {
        "id": "media-01",
        "url": "https://cdn.example.com/corpus/2026-04-24-a/media-01.json",
        "checksum": "sha256:ghi",
        "sizeBytes": 44012,
        "recordCount": 250
      }
    ],
    "backgroundScenes": [
      {
        "id": "background-scenes-01",
        "url": "https://cdn.example.com/corpus/2026-04-24-a/background-scenes-01.json",
        "checksum": "sha256:jkl",
        "sizeBytes": 16020,
        "recordCount": 24
      }
    ]
  }
}
```

### ArtworkRecord

```json
{
  "id": "met-12345",
  "source": "met",
  "sourceArtworkId": "12345",
  "version": "2026-04-24-a",
  "metadata": {
    "title": "Evening Harbor",
    "artistDisplayName": "Unknown",
    "yearLabel": "ca. 1890",
    "descriptionClean": "A quiet harbor scene with dim evening light.",
    "storySnippet": "像是一天快结束时，世界终于肯慢下来。",
    "moodTags": ["安静", "克制", "黄昏"],
    "colorTags": ["低饱和", "冷暖混合"],
    "subjectTags": ["港口", "水面"],
    "compositionTags": ["远景", "留白"]
  },
  "retrieval": {
    "searchText": "quiet harbor dusk restrained reflective calm low saturation",
    "emotionLabels": ["calm", "restrained", "reflective"],
    "energyLevel": "low",
    "valence": "mixed",
    "pace": "still",
    "spaceSense": "open",
    "embeddingRef": "embeddings-03:184"
  },
  "media": {
    "baseImageUrl": "https://cdn.example.com/met-12345/base.jpg",
    "imageUrlPreview": "https://cdn.example.com/met-12345/preview.jpg",
    "imageUrlFull": "https://cdn.example.com/met-12345/full.jpg",
    "videoUrlMain": "https://cdn.example.com/met-12345/main-loop.mp4",
    "aspectRatioHint": "landscape",
    "hasMotionAsset": true,
    "mediaVersion": "1",
    "sourceAssetFingerprint": "sha256:xyz"
  },
  "presentation": {
    "grade": "B",
    "gradeLabel": "emotional-pillar",
    "motionProfile": "ambient-loop",
    "narrationMode": "caption"
  }
}
```

## 落地顺序建议

1. 先让 pipeline 稳定产出 `metadata + search + mediaIndex + backgroundScenes + release manifest`
2. 再让前端基于 `metadata + search + backgroundScenes` 跑通 Phase 1 薄切片
3. Phase 2 再把 `embeddings` 接进本地检索
4. Phase 3 再把动态媒体和导演式 presentation 字段真正消费起来

一句话总结：

本地语料负责“知道这件作品是什么、为什么会被召回、有哪些远端资产可用”，release manifest 负责“把 artwork 和 background 放在同一个可消费版本里”，远端媒体负责“把它真正演出来”。
