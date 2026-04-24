---
title: ArtDuo V2 UX Flow and State Matrix
status: active
created: 2026-04-24
origin: docs/brainstorms/artduo-v2-lightweight-rebuild-requirements.md
---

# ArtDuo V2 信息架构与状态矩阵

## 目标

这份文档用于解决两个问题：

1. 主页、画廊、详情、沉浸式之间到底怎么走
2. loading / partial / empty / error / offline 在各页面怎么表现

## 主路径 IA

V2 的主导航顺序统一为：

1. `/`
2. `/gallery/[exhibitionId]`
3. `/artworks/[artworkId]?from=[exhibitionId]`
4. `/gallery/[exhibitionId]/immersive`

说明：

- `exhibitionId` 在 Phase 1 可以是本地生成 id，不要求后端 session
- Phase 2 开始可以把 `exhibitionId` 映射到服务端 `sessionId`
- 详情页和沉浸式都必须能从当前 exhibition snapshot 返回，而不是丢失上下文

## 页面角色

### Landing

职责：

- 收集 emotion 和 user text
- 启动本地检索
- 创建本地 exhibition snapshot

### Gallery

职责：

- 展示首批作品
- 展示背景匹配结果
- 提供进入 detail 和 immersive 的主入口

### Artwork Detail

职责：

- 展示单件作品
- 展示按需 explanation
- 提供返回 gallery 和进入 immersive 的上下文入口

### Immersive Gallery

职责：

- 消费 `ExhibitionUnit`
- 驱动 scene-to-scene transition
- 消费分级、动态媒体、背景场景和 explanation 补全

## 返回规则

- `Landing -> Gallery`: 前进，不保留输入框焦点状态
- `Gallery -> Detail`: 返回时必须保留 gallery 的当前 scroll / selected unit
- `Gallery -> Immersive`: 返回时必须保留当前 selected unit
- `Detail -> Immersive`: 应从当前 artwork 对应 unit 开始
- `Immersive -> Gallery`: 返回到同一个 exhibition snapshot

## 页面状态矩阵

### Landing

- `idle`: 展示输入和引导
- `loading`: 按钮禁用，显示“正在生成展览”
- `error`: 展示错误提示，可重试
- `offline`: 提示只能使用本地缓存和本地语料

### Gallery

- `loading`: skeleton + 背景占位
- `partial`: 已显示首批作品，preface / closing 仍可补全
- `ready`: 展示完整 gallery
- `empty`: 没有结果时展示兜底文案和重试入口
- `error`: 结果不可用时展示 error view
- `offline`: 只展示本地可用内容，不显示需要远端 explanation 的承诺

### Artwork Detail

- `loading`: 图像和 metadata 先显示，explanation skeleton
- `partial`: metadata ready，explanation pending
- `ready`: explanation ready
- `error`: explanation failed，但 artwork 基础信息仍可看
- `offline`: 只展示本地 metadata 和静态图

### Immersive

- `loading`: 首个 unit 可见，后续 unit 可以延迟准备
- `partial`: dynamic media 或 explanation 未齐，但 unit 可切换
- `ready`: transition、media、explanation 都可用
- `error`: 单个 unit 媒体失败时降级，不中断全局沉浸式
- `offline`: 仅消费本地 scene unit 和静态资源

## 状态语义

### `pending`

- 数据请求已发起，但当前页面还没有可展示核心内容

### `partial`

- 页面主体验已经成立，但补充文案或增强内容还未齐

### `ready`

- 页面所需的主内容和增强内容都已可用

### `failed`

- 当前请求失败，但页面应尽量保留已有可展示内容

## 设计约束

- 任何页面都不应因为 explanation 或 SSE 失败而整页空白
- Gallery 和 Immersive 必须以 `partial` 为可接受状态，而不是只接受 `ready`
- 详情页必须允许 metadata ready / explanation pending
- 画廊主导航不依赖 `localStorage` 轮询

## 一句话总结

V2 的主 UX 规则是：

- 先让页面成立
- 再让补充内容变深
- 即使远端增强失败，也不能把主路径带崩
