# ArtDuo V2 背景场景与转场轻量 Schema

Created: 2026-04-23
Status: active
References:

- `docs/brainstorms/artduo-v2-lightweight-rebuild-requirements.md`
- `docs/plans/artduo-v2-lightweight-rebuild-plan.md`
- `docs/specs/artduo-v2-local-corpus-and-media-schema.md`
- `public/artduo-gallery/`

## 目标

这份规格不再只解决“背景图怎么给 VLM 打标”。

现在更准确的目标是：

1. 把背景图整理成可解析、可落盘、可检索的 scene asset
2. 让背景可以和画作做稳定匹配
3. 让每个“画作 + 背景”组合成为独立 unit
4. 为 unit 到 unit 的转场预留结构化语义

一句话说：

背景不是壁纸，而是展览里的空间单元。

## 先给结论

如果目标只是“把一张背景图交给 VLM，产出基础标签并落盘”，你现在这份 schema 已经有大约 70% 到 80% 够用了。

但如果目标是你刚刚描述的这一版产品方向：

- 每个画作和画廊都看作一个单元
- 背景要参与画作匹配
- 不同单元切换时要生成不同转场

那当前 schema 还不够。

缺的不是更多情绪词，而是 3 块更接近展示组装的结构：

1. `stage_profile`
   描述这张背景里画作应该挂在哪里、空间轴线怎么走、哪里适合承接单件作品
2. 一组更明确的匹配字段
   描述它更适合接什么方向的画作与展示角色
3. `transition_profile`
   描述这个背景作为一个 unit 时，适合怎样进入、怎样离开、怎样和下一个 unit 连起来

所以现在应该把 schema 从“背景标签存储格式”升级为“背景 scene unit 规格”。

## 背景资产边界

ArtDuo V2 里建议把背景场景看作独立于 artwork corpus 的一条资产轨。

区分如下：

- 作品库：本地存 metadata、清洗字段、检索字段和远端媒体引用
- 背景库：以你自有的场景图和对应 metadata 为主，初始来源是 `public/artduo-gallery/`

这两套资产最终会在运行时被组装成展览 unit，但不应该在源数据层强行混成一种记录。

## 推荐结构

```ts
type BackgroundSceneRecord = {
  id: string

  asset: BackgroundSceneAsset
  image_info: BackgroundImageInfo
  visual_profile: BackgroundVisualProfile
  curation_profile: BackgroundCurationProfile
  ui_profile: BackgroundUiProfile
  stage_profile: BackgroundStageProfile
  transition_profile: BackgroundTransitionProfile
  retrieval_profile?: BackgroundRetrievalProfile
  parse_meta?: BackgroundParseMeta

  confidence?: number
}
```

一句话理解：

- `asset` 解决“这张图是谁、文件在哪”
- `image_info` 解决“它是什么尺寸和方向”
- `visual_profile` 解决“它看起来像什么”
- `curation_profile` 解决“它适合配什么画”
- `ui_profile` 解决“它能不能承接信息层”
- `stage_profile` 解决“画作应该摆在哪里”
- `transition_profile` 解决“它怎么接前后两个 unit”
- `retrieval_profile` 解决“后续怎么搜它”

## BackgroundSceneAsset

```ts
type BackgroundSceneAsset = {
  original_filename: string
  suggested_filename?: string
  local_public_path: string

  label_cn: string
  label_en?: string

  asset_group?: string
  metadata_version?: string
}
```

建议：

- `local_public_path` 明确指向 `public/artduo-gallery/...`
- `asset_group` 方便后续把同一组空间变体收在一起
- `metadata_version` 方便将来重复跑 VLM parse 或人工修订

## BackgroundImageInfo

```ts
type BackgroundImageInfo = {
  width?: number
  height?: number
  aspect_ratio?: "16:9" | "3:2" | "4:3" | "1:1" | "9:16" | "custom"
  orientation?: "landscape" | "portrait" | "square"
}
```

这层仍然是轻量必需项，因为：

- 前端裁切会用到
- 匹配横幅/竖幅画作时会用到
- VLM 和人工都很容易补全

## BackgroundVisualProfile

```ts
type BackgroundVisualProfile = {
  scene_type:
    | "gallery_interior"
    | "museum_hall"
    | "architectural_space"
    | "editorial_space"
    | "abstract_atmosphere"

  styles: string[]
  materials: string[]
  lighting: string[]
  mood: string[]
  palette: string[]
  composition: string[]

  negative_space_level?: "low" | "medium" | "high"
  space_depth?: "flat" | "layered" | "deep"
  focal_density?: "low" | "medium" | "high"

  reference_inference?: string[]
}
```

这部分和你原来的方向一致，仍然成立。

它主要给三件事服务：

- VLM 视觉理解
- 背景检索
- 背景之间的视觉连续性判断

## BackgroundCurationProfile

```ts
type BackgroundCurationProfile = {
  emotion_ids: string[]

  art_styles?: string[]
  art_style_ids?: string[]
  time_periods?: string[]
  time_period_ids?: string[]
  media_types?: string[]
  cultural_contexts?: string[]
  departments?: string[]
  classifications?: string[]
  sources?: string[]
  museum_keys?: string[]
  location_affinity?: {
    countries?: string[]
    cities?: string[]
    regions?: string[]
  }

  artwork_subject_modes?: (
    | "portrait"
    | "figure"
    | "interior"
    | "landscape"
    | "still_life"
    | "architecture"
    | "abstract"
  )[]

  artwork_palette_modes?: (
    | "warm_neutral"
    | "cool_muted"
    | "earthy"
    | "low_saturation"
    | "high_contrast"
    | "monochrome"
  )[]

  artwork_composition_modes?: (
    | "centered"
    | "asymmetrical"
    | "open_space"
    | "close_crop"
    | "single_subject"
    | "horizon_heavy"
  )[]

  artwork_orientation_modes?: ("portrait" | "landscape" | "square")[]
  supported_artwork_grades?: ("A" | "B" | "C")[]
  preferred_unit_roles?: ("opening" | "bridge" | "focus" | "closing")[]

  avoid?: string[]
}
```

这里新增 3 个很关键的运行时匹配字段：

- `artwork_orientation_modes`
- `supported_artwork_grades`
- `preferred_unit_roles`

原因：

- 有些空间天然适合横构图大画，有些更适合竖构图单件聚焦
- 有些背景适合 A 级导演式聚焦，有些更适合 B/C 级过渡
- 同一背景是否适合开场、过渡或收尾，也会影响最终转场设计

另外，为了让背景真正参与“来源 / 馆藏 / 现存地”匹配，建议再明确 4 个标准化字段：

- `art_style_ids`
  用于存放后处理归一化后的风格 ID；`art_styles` 可以保留 VLM 产出的可读标签
- `time_period_ids`
  用于存放后处理归一化后的时代 ID；`time_periods` 可以保留馆方原始时期名或人类可读标签
- `museum_keys`
  用于匹配具体机构，比如 `the_met`、`rijksmuseum`、`moma`
- `location_affinity`
  用于表达更适合承接“现存地/馆藏地”在哪些国家、城市或区域的作品

这几个字段的职责要分清：

- `sources` 表达上游语料来源，优先对齐 artwork corpus 里的 `source`，例如 `met`、`custom`
- `museum_keys` 表达具体收藏机构
- `location_affinity` 表达馆藏所在地或现存地，不等于作品创作地或艺术家国籍
- `art_style_ids` / `time_period_ids` 表达规则层可稳定匹配的标准枚举，不要求 VLM 一步到位

推荐做法：

- VLM 先产出 `art_styles`、`time_periods` 这类可读标签
- 后处理再把它们映射成 `art_style_ids`、`time_period_ids`
- `sources`、`museum_keys`、`location_affinity` 默认走“VLM 草稿 + 规则修订”，不要把它们当作纯视觉事实

## BackgroundUiProfile

```ts
type BackgroundUiProfile = {
  overlay_readability: "low" | "medium" | "high"
  safe_text_zones: ("left" | "left-center" | "center" | "right-center" | "bottom" | "top")[]
  mobile_crop_tolerance: "poor" | "fair" | "good" | "excellent"
  visual_busyness: number
}
```

这层仍然保留，而且足够轻。

它主要决定：

- 这个背景能不能承接标题、引导文案和卡片
- 同一场景在移动端是否还能成立

## BackgroundStageProfile

这是当前 schema 最需要补上的一层。

如果背景要真的承接画作，它必须告诉系统：

- 作品挂在哪一块区域最合理
- 画面空间是平的、深的还是带通道感的
- 视觉主轴从哪里进入和离开

```ts
type BackgroundStageProfile = {
  primary_mount_zone: NormalizedZone
  secondary_mount_zones?: NormalizedZone[]

  preferred_artwork_scale?: "small" | "medium" | "large"
  wall_visibility?: "low" | "medium" | "high"

  depth_strategy?: "flat-wall" | "layered-room" | "corridor" | "window-lit"
  dominant_axis?: "center" | "left-to-right" | "right-to-left" | "forward-depth"

  vanishing_point?: {
    x: number
    y: number
  }
}

type NormalizedZone = {
  shape: "rect" | "polygon"
  rect?: {
    x: number
    y: number
    width: number
    height: number
  }
  points?: { x: number; y: number }[]
}
```

说明：

- 所有坐标建议都用 `0..1` 的归一化值
- `primary_mount_zone` 是运行时最重要的字段，哪怕先只支持矩形也很值
- `dominant_axis` 和 `vanishing_point` 对后面做转场特别有帮助

为什么这层不能省：

- 你这些背景图很多都有明确的墙面承载区
- 如果没有 mount zone，画作和背景的绑定只能靠 UI 猜
- 没有空间主轴，后面转场就容易退化成统一的淡入淡出

## BackgroundTransitionProfile

这是第二个必须补上的展示层。

它不是把具体动画硬编码进 JSON，也不是把 schema 绑死到某个引擎上。
它更接近 PPT、Keynote 或视频剪辑里的“转场语义”。
默认理解应该是动画层，而不是 WebGL 配置。

```ts
type BackgroundTransitionProfile = {
  entry_families: (
    | "fade"
    | "dissolve"
    | "match-cut"
    | "depth-push"
    | "lateral-pan"
    | "light-swell"
    | "scale-focus"
  )[]

  exit_families: (
    | "fade"
    | "dissolve"
    | "match-cut"
    | "depth-push"
    | "lateral-pan"
    | "light-swell"
    | "scale-focus"
  )[]

  transition_tempo?: "slow" | "medium" | "fast"
  transition_intensity?: "soft" | "moderate" | "dramatic"
  implementation_hint?: "auto" | "css" | "motion" | "video" | "webgl" | "three"

  continuity_bias?: {
    palette_bridge?: boolean
    light_bridge?: boolean
    axis_bridge?: boolean
    depth_bridge?: boolean
  }

  bridge_tokens?: string[]
}
```

前端转场层可以这样消费：

- 优先取 `source.exit_families` 和 `target.entry_families` 的交集
- 再参考 `continuity_bias` 决定是走色彩桥接、光感桥接还是空间推进
- 如果没有交集，就回退到系统默认转场

这样做的好处是：

- JSON 仍然轻
- 动画实现仍然有创作空间
- 默认用 CSS、Motion 或视频式转场就可以成立
- 如果以后要接 WebGL/Three.js，只需要消费 `implementation_hint`
- 不同 unit 确实能切出不同的感觉

## BackgroundRetrievalProfile

```ts
type BackgroundRetrievalProfile = {
  search_text?: string
  search_terms?: string[]
  embedding_text?: string
}
```

建议：

- `search_text` 适合轻量全文检索
- `search_terms` 适合规则匹配
- `embedding_text` 方便将来给背景也做语义向量检索

## BackgroundParseMeta

```ts
type BackgroundParseMeta = {
  parsed_by?: "vlm" | "manual" | "hybrid"
  parser_model?: string
  parsed_at?: string
  needs_review?: boolean
}
```

这层很薄，但值得保留。

因为有些字段 VLM 很擅长，有些字段更适合人工校正：

- VLM 擅长：风格、光线、情绪、留白、场景类型
- 人工更适合：mount zone、grade 适配、转场语义微调

## 三层落地边界

如果直接让 VLM 输出完整 `BackgroundSceneRecord`，有两个风险：

- schema 对 VLM 来说过重，容易把“视觉判断”和“运行时派生字段”混写
- 后面批量跑 50 张、100 张图时，解析结果会在稳定性上明显分层

更稳的做法是把这套结构分成 3 层：

### Layer A: `BackgroundSceneVlmDraft`

只负责“图像看起来是什么”以及少量粗粒度推断。

建议字段：

- `asset`
- `image_info`
- `visual_profile`
- `ui_profile`
- `curation_profile.emotion_ids`
- `curation_profile.art_styles`
- `curation_profile.time_periods`
- `curation_profile.media_types`
- `curation_profile.cultural_contexts`
- `curation_profile.departments`
- `curation_profile.classifications`
- `curation_profile.artwork_subject_modes`
- `curation_profile.artwork_palette_modes`
- `curation_profile.artwork_composition_modes`
- `curation_profile.artwork_orientation_modes`
- `stage_profile.primary_mount_zone`
- `transition_profile.entry_families`
- `transition_profile.exit_families`
- `transition_profile.transition_tempo`
- `transition_profile.transition_intensity`
- `parse_meta`
- `confidence`

一句话说：

- VLM draft 负责产出“视觉上可信”的一稿
- 不要求它一次就把标准 ID、机构归属和最终转场决策写死

### Layer B: `BackgroundSceneRecord`

这是最终落盘、可检索、可匹配的增强记录。

这层在 VLM 草稿基础上补齐：

- `art_style_ids`
- `time_period_ids`
- `sources`
- `museum_keys`
- `location_affinity`
- `supported_artwork_grades`
- `preferred_unit_roles`
- 更精确的 `stage_profile`
- 更稳定的 `transition_profile`
- `retrieval_profile`

建议这层通过“规则映射 + 人工抽查 + 小范围修订”得到，而不是完全交给 VLM。

### Layer C: `ExhibitionUnit`

这是运行时组合层，不是素材层。

它负责把：

- 单件作品
- 一个背景 scene
- 当前 unit role
- 当前转场 hint

组装成真正要展示的展览单元。

所以边界应该是：

- VLM 输出 draft
- 后处理把 draft 变成可检索的 scene record
- 运行时再把 artwork 和 scene record 组装成 `ExhibitionUnit`

## VLM parse 到哪一步就够

建议把 VLM 的职责定成“产出一版 draft”，而不是最终真理。

### VLM 适合直接产出的字段

- `image_info`
- `visual_profile`
- `ui_profile`
- `curation_profile` 的大部分枚举字段
- `stage_profile.primary_mount_zone` 的粗略矩形
- `transition_profile` 的初步标签
- `art_styles` / `time_periods` 这类可读标签

### 更适合人工或规则修订的字段

- `art_style_ids` / `time_period_ids`
- `sources`
- `museum_keys`
- `location_affinity`
- 精确的 `primary_mount_zone`
- `secondary_mount_zones`
- `supported_artwork_grades`
- `preferred_unit_roles`
- `entry_families / exit_families` 的最终取舍

所以结论是：

- 拿去做 VLM parse：够，但要升级字段
- 拿去直接做完整展示：现在还不够

## 背景匹配流程

你现在的正确链路应该是：

1. 用户输入情绪
2. 本地检索得到一组画作
3. 从画作聚合出一组 exhibition features
4. 用 exhibition features 去匹配背景 scene
5. 将画作和背景组装成 unit
6. 再根据 unit 之间的差异生成转场

推荐聚合特征：

```ts
type ExhibitionFeatures = {
  emotion_ids: string[]
  palette_modes: string[]
  composition_modes: string[]
  orientation_modes: ("portrait" | "landscape" | "square")[]
  artwork_grades: ("A" | "B" | "C")[]
  source_keys?: string[]
  museum_keys?: string[]
  location_signals?: {
    countries?: string[]
    cities?: string[]
    regions?: string[]
  }
  role?: "opening" | "bridge" | "focus" | "closing"
}
```

推荐匹配优先级：

1. `curation_profile.emotion_ids`
2. `curation_profile.artwork_palette_modes`
3. `curation_profile.artwork_composition_modes`
4. `curation_profile.artwork_orientation_modes`
5. `curation_profile.supported_artwork_grades`
6. `curation_profile.sources` / `curation_profile.museum_keys`
7. `curation_profile.location_affinity`
8. `ui_profile.overlay_readability`
9. `stage_profile.preferred_artwork_scale`

## 背景检索匹配模块

建议把背景匹配明确做成一个独立模块，而不是散在画廊页面里临时判断。

推荐职责拆分：

1. `feature-aggregator`
   从一组画作里聚合展览级特征
2. `background-filter`
   做硬过滤，先排除明显不适配的背景
3. `background-scorer`
   对剩余背景做加权打分
4. `background-selector`
   根据当前 unit 角色选出最终背景

建议接口：

```ts
type BackgroundMatcher = {
  match(input: BackgroundMatchInput): BackgroundMatchResult
}

type BackgroundMatchInput = {
  artworks: ArtworkRecord[]
  exhibitionFeatures: ExhibitionFeatures
  candidateScenes: BackgroundSceneRecord[]
  role: "opening" | "bridge" | "focus" | "closing"
}

type BackgroundMatchResult = {
  sceneId: string
  score: number
  breakdown: BackgroundScoreBreakdown
}

type BackgroundScoreBreakdown = {
  emotionScore: number
  paletteScore: number
  compositionScore: number
  orientationScore: number
  gradeScore: number
  sourceScore: number
  locationScore: number
  uiScore: number
  stageScore: number
}
```

建议打分逻辑：

- 第一步：硬过滤
  - `preferred_unit_roles` 不兼容时降权或剔除
  - `overlay_readability` 明显不满足时剔除
  - `primary_mount_zone` 缺失时不用于需要挂载的 unit
- 第二步：软打分
  - 情绪、色板、构图、横竖比、作品等级、来源/馆藏/现存地分别计分
- 第三步：回退
  - 如果没有强匹配，就回退到 `neutral-safe` 背景组

这样做的好处是：

- 背景检索逻辑可以独立测试
- 后面即使换 VLM 模型，匹配模块也不需要重写
- 画作检索和背景检索不会混成一团

## 运行时单元结构

为了让“每个画和画廊是一个单独单元”真正落地，建议运行时引入一个组合层：

```ts
type ExhibitionUnit = {
  unitId: string
  artworkId: string
  backgroundSceneId: string

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
  continuitySources?: ("palette" | "light" | "axis" | "depth" | "motion")[]
  implementationHint?: "auto" | "css" | "motion" | "video" | "webgl" | "three"
}
```

这层不是背景 schema 本身，但 background schema 应该为这层提供数据。

说明：

- 这层首先服务“动画式转场”
- `implementationHint` 只是留一个轻量扩展口子
- 不应该把 WebGL/Three.js 变成默认前提

## 模块化转场约定

建议把转场层做成模块化 registry，而不是在页面组件里写成一大串 `if/else`。

推荐结构：

```ts
type TransitionModule = {
  family:
    | "fade"
    | "dissolve"
    | "match-cut"
    | "depth-push"
    | "lateral-pan"
    | "light-swell"
    | "scale-focus"

  canHandle(input: TransitionContext): boolean
  build(input: TransitionContext): TransitionPlan
}

type TransitionContext = {
  fromUnit?: ExhibitionUnit
  toUnit: ExhibitionUnit
  hint?: TransitionHint
}

type TransitionPlan = {
  family: string
  durationMs: number
  implementation: "css" | "motion" | "video" | "webgl" | "three"
  fallbackFamily?: "fade" | "dissolve"
}
```

推荐第一版转场模块：

- `fade`
- `dissolve`
- `light-swell`
- `match-cut`
- `depth-push`

推荐消费方式：

1. 先读 `transitionOut` 和 `transitionIn`
2. 选出共同支持的 family
3. 从 registry 中找到对应模块
4. 如果模块不可用，回退到 `fade`

这样做的好处是：

- 转场是可组合、可测试、可回退的
- 可以先用轻量动画实现
- 以后加更强的 WebGL/Three.js 版本时，只需要替换某个 module 的实现

## 最小必需字段

如果你现在要先把这套流程跑起来，我建议最小必需项是：

### 背景 scene 必需

- `id`
- `asset.original_filename`
- `asset.local_public_path`
- `asset.label_cn`
- `image_info.aspect_ratio`
- `visual_profile.scene_type`
- `visual_profile.lighting`
- `visual_profile.mood`
- `visual_profile.palette`
- `visual_profile.composition`
- `visual_profile.negative_space_level`
- `curation_profile.emotion_ids`
- `curation_profile.artwork_palette_modes`
- `curation_profile.artwork_composition_modes`
- `ui_profile.overlay_readability`
- `ui_profile.safe_text_zones`
- `stage_profile.primary_mount_zone`
- `transition_profile.entry_families`
- `transition_profile.exit_families`
- `transition_profile.implementation_hint`

### 强烈建议补充

- `curation_profile.art_style_ids`
- `curation_profile.time_period_ids`
- `curation_profile.sources`
- `curation_profile.museum_keys`
- `curation_profile.location_affinity`
- `curation_profile.artwork_orientation_modes`
- `curation_profile.supported_artwork_grades`
- `curation_profile.preferred_unit_roles`
- `stage_profile.dominant_axis`
- `stage_profile.vanishing_point`
- `transition_profile.continuity_bias`
- `retrieval_profile.search_terms`
- `parse_meta`
- `confidence`

## 轻量示例

```json
{
  "id": "bg-001",
  "asset": {
    "original_filename": "ChatGPT Image 2026年4月23日 00_44_09.png",
    "suggested_filename": "bg-gallery-warm-plaster-softlight-001.png",
    "local_public_path": "/artduo-gallery/ChatGPT Image 2026年4月23日 00_44_09.png",
    "label_cn": "暖木构留白展厅",
    "asset_group": "warm-gallery-series",
    "metadata_version": "2026-04-23"
  },
  "image_info": {
    "width": 2048,
    "height": 1152,
    "aspect_ratio": "16:9",
    "orientation": "landscape"
  },
  "visual_profile": {
    "scene_type": "gallery_interior",
    "styles": ["warm minimalism", "museum calm"],
    "materials": ["lime plaster", "oak wood", "stone tile"],
    "lighting": ["soft daylight", "warm ambient"],
    "mood": ["serenity", "contemplation"],
    "palette": ["ivory", "sand", "oak", "warm beige"],
    "composition": ["centered", "large negative space", "symmetrical"],
    "negative_space_level": "high",
    "space_depth": "layered",
    "focal_density": "low"
  },
  "curation_profile": {
    "emotion_ids": ["serenity", "hope", "contentment"],
    "art_styles": ["minimalism", "japonisme-adjacent"],
    "art_style_ids": ["minimalism", "japonisme"],
    "time_periods": ["modern", "late 19th century"],
    "time_period_ids": ["modern", "late_19th_century"],
    "sources": ["met", "custom"],
    "museum_keys": ["the_met"],
    "location_affinity": {
      "countries": ["united_states", "japan"],
      "cities": ["new_york"]
    },
    "artwork_subject_modes": ["landscape", "still_life", "interior"],
    "artwork_palette_modes": ["warm_neutral", "earthy", "low_saturation"],
    "artwork_composition_modes": ["centered", "open_space", "single_subject"],
    "artwork_orientation_modes": ["landscape", "portrait"],
    "supported_artwork_grades": ["A", "B", "C"],
    "preferred_unit_roles": ["opening", "focus", "closing"],
    "avoid": ["anger", "high-chaos", "dense-baroque"]
  },
  "ui_profile": {
    "overlay_readability": "high",
    "safe_text_zones": ["center", "left-center", "bottom"],
    "mobile_crop_tolerance": "good",
    "visual_busyness": 0.22
  },
  "stage_profile": {
    "primary_mount_zone": {
      "shape": "rect",
      "rect": {
        "x": 0.17,
        "y": 0.14,
        "width": 0.66,
        "height": 0.58
      }
    },
    "preferred_artwork_scale": "large",
    "wall_visibility": "high",
    "depth_strategy": "flat-wall",
    "dominant_axis": "center",
    "vanishing_point": {
      "x": 0.5,
      "y": 0.48
    }
  },
  "transition_profile": {
    "entry_families": ["fade", "light-swell", "scale-focus"],
    "exit_families": ["dissolve", "match-cut", "depth-push"],
    "transition_tempo": "slow",
    "transition_intensity": "soft",
    "implementation_hint": "auto",
    "continuity_bias": {
      "palette_bridge": true,
      "light_bridge": true,
      "axis_bridge": true,
      "depth_bridge": false
    },
    "bridge_tokens": ["warm", "calm", "centered-wall", "soft-daylight"]
  },
  "retrieval_profile": {
    "search_terms": [
      "warm gallery",
      "minimal interior",
      "high negative space",
      "soft daylight",
      "calm exhibition background"
    ],
    "embedding_text": "warm quiet gallery with centered blank wall and soft daylight"
  },
  "parse_meta": {
    "parsed_by": "hybrid",
    "parser_model": "vlm-v1",
    "parsed_at": "2026-04-23T09:00:00Z",
    "needs_review": false
  },
  "confidence": 0.86
}
```

## 最终建议

如果只问一句：

“现在这份 schema 拿去给 VLM parse 背景够了吗？”

我的答案是：

- 做基础背景标注：基本够，但建议按这次补齐
- 做画作-背景匹配：原版不够，补完后够用
- 做 unit 转场系统：原版不够，必须加 `stage_profile` 和 `transition_profile`

最值得先落地的字段顺序是：

1. `asset.local_public_path`
2. `stage_profile.primary_mount_zone`
3. `curation_profile.sources / museum_keys / location_affinity`
4. `curation_profile.artwork_orientation_modes`
5. `curation_profile.supported_artwork_grades`
6. `transition_profile.entry_families / exit_families`
7. `transition_profile.continuity_bias`
8. `transition_profile.implementation_hint`

一句话总结：

这份 schema 现在应该从“背景标签格式”升级成“背景 scene unit 合同”，转场默认按动画语义建模，再给 WebGL/Three.js 留一个轻量扩展口子。
