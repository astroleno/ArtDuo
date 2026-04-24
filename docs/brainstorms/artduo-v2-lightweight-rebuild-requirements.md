# ArtDuo V2 轻量重建需求

Created: 2026-04-23
Status: active

## 背景

ArtDuo 已经验证出一个非常明确的方向：

- 情绪输入驱动的艺术策展体验是有吸引力的
- UI、叙事节奏和沉浸式观展氛围有继续演进的价值
- 作品与背景空间组合成单元的体验方向是对的

但当前实现也已经暴露出结构性问题：

- 首个可见结果出现太慢
- 数据层并没有形成稳定的可消费在线查询层
- 运行时仍然需要拼接多份大 JSON
- SSE 被当成主链路补丁，而不是增强能力
- 页面架构分裂为 `route.ts + page.html` 和 React/Next 两条路线
- 前端承担了过多编排职责，包括检索控制、远端调用和跨页面状态同步

这意味着下一阶段不应该继续在旧链路上叠功能，而应该在保留体验资产的前提下，进行一次轻量但有边界的重建。

## 产品目标

### 主目标

构建一个轻量、可维护、首屏响应快的新 ArtDuo，让用户可以从一句情绪输入快速进入一个可信的艺术展览，并逐步获得更深的作品解读和沉浸式体验。

### 次目标

- 保留旧项目最有价值的体验层资产
- 让前端和后端可以按共享协议并行开工
- 让作品库演进成真正的版本化 release artifact
- 让背景匹配、scene unit 和转场成为有 contract 的一等能力
- 让未来的动态媒体增强有稳定资产模型可接

## 设计原则

1. 首个可见结果优先于完整结果
2. 本地优先，但本地不承载重媒体二进制
3. release manifest 是 runtime 唯一真相源
4. API 是补充层，不是首屏检索热路径
5. SSE 是增强项，不是生命线
6. Phase 1 只做薄切片，不做平台化铺陈
7. 前后端先冻结共享协议，再分别推进
8. 背景与画作按 `ExhibitionUnit` 建模，转场默认按动画语义表达
9. 任何远端增强失败，都不能把主路径带崩
10. Phase 1 验收不仅证明“能跑”，还要证明“结果基本可信”

## 新项目姿态

这里说的“新项目”，不是另起一个完全无关的仓库，而是：

- 保留当前项目在独立 legacy 分支上
- 在新分支上启动 V2
- 在同一仓库根目录逐步建立 `apps/` + `packages/` 新工作区
- 旧 `frontend/` 保持 donor/reference 身份，不继续承担主路径实现

前端资产策略明确为：

- 当前 `frontend/` 是主要 UI donor
- `reference/artduo/` 是轻壳、灯光、基础动效 donor
- 两者都不直接作为 V2 前端基底

## 范围

### In Scope

- 新建一个可并行推进的 ArtDuo V2 路线
- 建立 `apps/` + `packages/` 的新工作区骨架
- 建立共享 contracts、fixture 和 release manifest
- 建立本地优先、渐进加载的作品库消费方式
- 建立背景场景 catalog、背景匹配和 `ExhibitionUnit` 合同
- 建立三阶段路线，确保每一阶段都有独立可验证交付物
- 建立名画采集 runbook，支持 `probe -> batch -> review loop`

### Out of Scope

- 继续扩张旧浏览器端 Agent 架构
- 在 Phase 1 支持多馆藏复杂聚合
- 在 Phase 1 一次性生成完整深度讲解
- 保留旧 `localStorage` 轮询同步方案
- 让浏览器直接持有 LLM 或第三方服务密钥
- 让 WebGL/Three.js 成为转场默认前提

## 需要保留的资产

以下资产属于 V2 应优先继承的价值：

- `frontend/src/app/gallery/page.html` 的叙事式进入体验
- `frontend/src/app/gallery/immersive/page.html` 的沉浸式节奏与布局语言
- `frontend/src/components/ArtworkCard.tsx` 的展示型卡片思路
- `frontend/src/components/ImageLightbox.tsx` 的作品查看器交互
- `frontend/src/components/DynamicBackground.tsx` 的氛围背景思路
- `reference/artduo/components/LandingPage.tsx` 的轻壳和进入节奏
- `reference/artduo/components/Gallery.tsx` 的基础动效、光照和陈列感
- `reference/artduo/components/Spotlight.tsx` 与 `ParticleSystem.tsx` 的氛围动效语言
- `public/artduo-gallery/` 的背景场景资产

这些资产应以“设计与交互 donor”的形式迁移，而不是连带旧数据流和旧状态流一起复制。

## 必须舍弃的实现

以下内容不应进入 V2 主链路：

- `frontend/src/lib/frontend-agent.ts`
- `frontend/src/lib/frontend-llm-client.ts`
- `frontend/src/lib/frontend-mcp-client.ts`
- `frontend/src/lib/vector-search/js-vector-search.ts` 的当前检索实现
- `frontend/src/app/api/curate/stream/route.ts` 的长链路阻塞式编排
- `route.ts + page.html` 的混合页面架构
- 基于 `localStorage` 的跨页面主状态同步

## 功能与约束要求

### R1. 快速生成可浏览展览

用户提交情绪输入后，系统必须先返回一组可浏览作品和最小展览引导，而不是等待完整讲解、排序增强或沉浸式资源全部完成。

### R2. 非流式条件下也能成立

即使 SSE 不可用，用户也必须能完成：

- 提交输入
- 进入展览
- 浏览作品
- 打开单件作品详情

### R3. 数据必须来自稳定的数据层

新系统必须通过稳定的数据生产链路生成版本化 release manifest，而不是在请求阶段读取和拼接大 JSON 文件。

这套 release artifact 至少要支持：

- release 版本信息
- metadata shard
- search shard
- media index shard
- background scenes shard
- 可选 embedding shard
- 校验、大小、时间戳和版本号

### R4. 讲解必须解耦主链路

序言、作品讲解和结语可以分层返回：

- 首屏只需要最小叙事文案
- 单件作品讲解按需加载
- 全展览深度文案允许后台生成

### R5. 前端只保留体验层职责

前端负责：

- 输入收集
- 本地语料加载与缓存
- 本地候选召回和结果展示
- 背景匹配与 `ExhibitionUnit` 消费
- 画廊、详情和沉浸式交互
- loading / partial / error / offline 的展示

前端不再负责：

- 直接调用 LLM
- 直接调用馆藏源
- 直接持有远端服务密钥
- 主状态的跨页面编排

### R6. 服务端必须拥有安全边界

所有密钥、外部数据源调用、离线构建、版本发布和 LLM 编排必须放在服务端。

### R7. 需要有明确的可观测性

系统至少要能记录：

- release manifest 加载耗时
- 本地检索耗时
- 背景匹配耗时
- 策展请求耗时
- 讲解生成耗时
- 降级是否触发
- SSE 是否启用

### R8. 保留沉浸式路线

V2 必须继续提供从画廊进入沉浸式观展的路线，而不是退化为纯搜索结果页。

### R9. 为动态媒体增强预留资产模型

系统必须从一开始就为以下增强能力预留字段：

- 走出画框式循环视频
- 局部放大或镜头推进视频
- 不同比例的视频版本
- 作品分级后的差异化表现

Phase 1 不要求全部实现，但字段模型不能与后续方向冲突。

### R10. 背景场景与画作必须作为单元建模

系统必须支持把单件画作与背景场景组合成 `ExhibitionUnit`，并为 unit 之间的切换提供结构化转场提示。

至少需要支持：

- 背景场景元数据和 VLM 标注结果
- 画作到背景的匹配字段和 score breakdown
- 背景中的挂载区域或展示区域
- unit 的进入与退出转场语义
- 默认按动画/PPT/视频转场理解的切换方式
- 为 WebGL、Three.js 或其他渲染实现预留轻量扩展口子

### R11. 前后端必须通过共享协议协作

系统必须支持前后端分开推进，并通过共享 contract 和 fixture 对齐。

至少需要支持：

- `v0.1` display/data contracts freeze
- `v0.2` session/explanation/event contracts freeze
- 共享类型定义
- API 请求响应契约
- 统一错误结构
- fixture 样本

### R12. 作品收集流程必须支持探针、批量和循环收敛

数据准备流程必须支持：

- 先用 probe 验证馆源、查询词和命中质量
- 再用 batch 扩出候选池
- 再通过多轮 review 和 gap backfill 收敛到 500-1000 张 confirmed works

### R13. Session、stream 和 explanation 必须有 ownership / privacy / cost 边界

一旦进入会话类 API，系统必须定义：

- 谁能读谁的 session
- 谁能消费 explanation
- request 的 idempotency 方式
- rate limit 和 budget guard
- `userText` 的 retention / redaction 规则

### R14. 必须有明确的信息架构和状态矩阵

系统必须明确：

- `Landing -> Gallery -> Detail -> Immersive` 的主导航顺序
- 返回规则
- 各页面在 `loading / partial / ready / empty / error / offline` 下的行为
- `pending / partial / ready / failed` 的统一语义

### R15. 版本化语料必须是可重放的 release artifact

同一个 release version 必须尽量渲染出相同结果。

这意味着：

- background scene catalog 属于 release manifest 的一部分
- 远端媒体引用必须有 `mediaVersion` 或等价的不可变指纹
- 如果上游只提供可变 URL，pipeline 必须补充 checksum、尺寸、更新时间或托管后的版本化 URL
- runtime 不依赖额外的 runtime `background-scenes` endpoint

### R16. Phase 1 必须有可信度门槛，而不只是一条能跑的链路

Phase 1 必须建立一套可重复执行的 relevance benchmark 和人工评审门槛。

至少要包含：

- 一组固定 benchmark prompts
- probe 结果报告
- 人工评审结果
- 通过门槛定义

## 成功标准

### 用户体验

- 用户能在短时间内进入真实展览，而不是长时间等待“处理中”
- 即使讲解尚未完成，作品也已经可浏览
- 即使远端增强失败，主路径仍成立
- 沉浸式路线仍保留并可逐步恢复

### 架构质量

- 只有一套前端主栈
- 旧 `frontend/` 保持 donor/reference 身份，而不是继续承担主逻辑
- runtime 只认一套 release manifest
- background scenes 进入同一套 release artifact
- API 契约、错误结构和事件契约只有一套
- `ExhibitionUnit` 是作品、背景和转场的统一运行时组合层

### 数据与质量

- Phase 1 的 benchmark 可重复执行
- 作品库可按 release 版本回溯
- 本地语料不承载重媒体二进制，只承载结构化元数据和远端媒体引用
- 同一 release 下的媒体引用具备版本或指纹信息

### 安全与成本

- 前端不持有服务密钥
- session / explanation API 有 ownership 和 authz 约束
- `userText` 有 retention / redaction 规则
- `curations` / `stream` / `explanation` 有 rate limit、budget 和 idempotency 边界

### 迭代效率

- 每个阶段都可以独立验证
- 前端、后端和 pipeline 可以并行推进
- 新数据源加入时不需要重写整条主链路

## 三阶段范围定义

### 阶段 1：薄切片重建

目标是用最小范围证明：

- 新工作区能建立起来
- `v0.1` contract 真正冻结
- release manifest 可以产出并被前端消费
- 本地召回、背景匹配和基础画廊成立
- relevance benchmark 和人工评审门槛成立

### 阶段 2：策展体验成型

目标是把策展逻辑从“能跑”升级为“可信、可读、可浏览”，重点补齐：

- 本地向量检索与 rerank
- 作品详情与按需讲解
- session / explanation / stream 契约
- ownership、authz、budget 和 retention 约束
- 更稳定的状态流

### 阶段 3：沉浸式与产品化

目标是补齐：

- 沉浸式路线
- 动态媒体增强
- 模块化转场
- 指标、日志、缓存、回退和发布质量

## 当前假设

- V2 在新分支上推进，当前项目保留在 legacy 分支
- repo 迁移采用 `parallel workspace bootstrap + strangler`
- 第一阶段优先服务单一主数据源和本地子集，后续再扩馆
- 第一阶段不强依赖 SSE
- 第一阶段不强依赖 embedding shard
- `frontend/` 和 `reference/artduo/` 都是 donor，不是基底

## 交付物

本需求文档之后，必须继续维护：

- `docs/plans/artduo-v2-lightweight-rebuild-plan.md`
- `docs/plans/artduo-v2-frontend-backend-workstreams.md`
- `docs/plans/artduo-v2-artwork-collection-runbook.md`
- `docs/roadmaps/artduo-v2-three-phase-roadmap.md`
- `docs/specs/artduo-v2-shared-contracts-and-api.md`
- `docs/specs/artduo-v2-ux-flow-and-state-matrix.md`
- `docs/specs/artduo-v2-local-corpus-and-media-schema.md`
- `docs/specs/artduo-v2-background-scene-schema.md`
