# ArtDuo 完整流程架构文档

## 🎯 整体架构概览

ArtDuo 是一个基于 Next.js 的 AI 驱动艺术策展平台，采用纯前端架构，通过 API 路由处理策展逻辑，使用本地向量库进行语义匹配，通过 SSE 流式处理提供沉浸式艺术体验。

## 🔄 完整策展流程

### Phase A · 规划层（后端角度）

#### 1. 用户输入阶段
- **页面**: `首页 (page.html)`
- **功能**: 用户输入情绪描述
- **跳转**: `/gallery/immersive?emotion=用户输入`

#### 2. LLM策展规划（单次调用）
- **耗时**: ~10s
- **组件**: `frontend/src/lib/curation/real-llm-curation-intent.ts`
- **功能**: LLM一次性产出三样关键结构化结果：
  1. **情绪曲线** (time → emotion/intensity)
  2. **策展分段** (比如「序曲 / 紧缩 / 破裂 / 残响」)
  3. **作品需求清单** (每段要几件作品，目标氛围说明)
- **决定**: 本场展需要的作品数量（6-12件）

#### 3. 检索引擎（向量库 + 本地DB）
- **耗时**: ~1s
- **组件**: `frontend/src/lib/vector-search/hybrid-search.ts`
- **功能**: 
  - 对每个"需求slot"用向量检索
  - 选出最像的候选作品
  - 去本地DB取已缓存的enriched metadata
  - 拿作品ID向Met拿大图URL

**→ 前端此时可以渲染完整画廊骨架（所有作品占位）⚡**

### Phase B · 叙述层（SSE阶段）

#### 4. Narration流（序言+结语生成）
- **耗时**: ~5s
- **组件**: `frontend/src/lib/curation/artwork-explanation.ts`
- **功能**: 生成并缓存「序言文本」「结语文本」
- **SSE事件**: `preface_chunk` → 先把"序言"流式送给前端

#### 5. Artwork流（批次2-2-2…）
- **耗时**: ~10s
- **组件**: `frontend/src/lib/curation/artwork-explanation.ts`
- **功能**: 依次生成并发送作品解读
- **SSE事件**: 
  - `artwork_batch_chunk for [1,2]`
  - `artwork_batch_chunk for [3,4]`
  - `artwork_batch_chunk for [5,6]`
  - `artwork_batch_chunk for [7,8]`
  - `artwork_batch_chunk for [9]`

#### 6. 结语流式输出
- **SSE事件**: `closing_chunk` → 把"结语文本"流给前端

## 📡 SSE输出顺序（事件流顺序）

```
1. preface_chunk（序言，开场段落）
2. artwork_batch_chunk for [1,2]
3. artwork_batch_chunk for [3,4]  
4. artwork_batch_chunk for [5,6]
5. artwork_batch_chunk for [7,8]
6. artwork_batch_chunk for [9]
7. closing_chunk（结语，收束段落）
```

## 🎨 前端展示策略（用户实际看到的节奏）

### 3.1 初始渲染（检索完成后，LLM讲述还没开始）
- **时间**: 12s后
- **功能**: 
  - 把6~12张作品全部排在时间线上
  - 每个作品卡片下方放"生成中…"占位（skeleton shimmer）
  - 画廊头尾留两个区域：`<IntroBlock>` 和 `<ClosingBlock>`

### 3.2 SSE事件进来时
- **preface_chunk**: 流式打在IntroBlock里
- **artwork_batch_chunk**: 填充对应作品卡片，从"灰态"→"高亮"
- **closing_chunk**: 流进ClosingBlock

## ⏱️ 真实时间线

### Phase A · 规划层
- **0-10s**: LLM策展+情绪曲线设计
- **10-11s**: 检索引擎+本地向量库选作品
- **11-12s**: 去Met请求图片URL
- **12s**: 前端渲染完整画廊骨架

### Phase B · 叙述层
- **12-17s**: 序言流式出现
- **17-27s**: 作品逐步点亮（2-2-2批次）
- **27s**: 结语出现

## 🧩 核心组件架构

### 1. LLM策展意图生成器
- **文件**: `frontend/src/lib/curation/real-llm-curation-intent.ts`
- **功能**: 调用智谱AI GLM-4.5生成策展意图
- **输入**: 用户情绪描述
- **输出**: 策展主题、情绪弧线、情绪阶段、视觉特征、审美偏好

### 2. 情绪曲线生成器
- **文件**: `frontend/src/lib/curation/emotion-curve.ts`
- **功能**: 根据策展意图生成情绪曲线
- **输入**: 策展意图
- **输出**: 情绪曲线点、曲线类型、总时长

### 3. 混合检索服务
- **文件**: `frontend/src/lib/vector-search/hybrid-search.ts`
- **功能**: 向量检索+元数据过滤+LLM精排
- **输入**: 检索查询
- **输出**: 匹配的作品列表

### 4. 向量索引管理
- **文件**: `frontend/src/lib/vector-search/vector-index.ts`
- **功能**: 管理HNSW向量索引
- **输入**: 作品数据
- **输出**: 向量索引

### 5. 数据质量权重
- **文件**: `frontend/src/lib/vector-search/data-quality-weights.ts`
- **功能**: 管理作品数据质量权重
- **输入**: 作品元数据
- **输出**: 质量权重

### 6. 情绪分类器
- **文件**: `frontend/src/lib/vector-search/emotion-classifier.ts`
- **功能**: 情绪分类
- **输入**: 用户输入
- **输出**: 情绪分类结果

### 7. 作品解释生成器
- **文件**: `frontend/src/lib/curation/artwork-explanation.ts`
- **功能**: 生成作品解释
- **输入**: 作品列表
- **输出**: 作品解释文本

### 8. LLM引导策展
- **文件**: `frontend/src/lib/curation/llm-guided-curation.ts`
- **功能**: 整合所有组件进行策展
- **输入**: 用户输入
- **输出**: 完整策展结果

## 🔧 技术栈

### 前端技术
- **框架**: Next.js 14
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **UI组件**: 自定义组件

### 后端技术
- **API**: Next.js API Routes
- **SSE**: Server-Sent Events
- **LLM**: 智谱AI GLM-4.5
- **向量库**: HNSW (hnswlib-node)
- **嵌入模型**: @xenova/transformers

### 数据存储
- **本地存储**: IndexedDB
- **向量索引**: HNSW
- **作品数据**: Met Museum API
- **图片存储**: Met Museum CDN

## 🎯 关键设计原则

### 1. 时序控制
- **规划层**: 12s完成所有检索和作品选择
- **叙述层**: 15s完成所有文本生成
- **总耗时**: 27s

### 2. 并发处理
- **序言+结语**: 一次LLM生成，分两次SSE输出
- **作品解释**: 2-2-2批次处理，避免上下文爆炸
- **前端渲染**: 检索完成后立即渲染画廊骨架

### 3. 用户体验
- **立即反馈**: 12s后画廊骨架出现
- **渐进式加载**: 作品逐步点亮
- **沉浸式体验**: 序言→作品→结语的完整叙事

## 📊 性能指标

### 响应时间
- **LLM策展**: 10s
- **向量检索**: 1s
- **图片请求**: 1s
- **文本生成**: 15s
- **总耗时**: 27s

### 并发能力
- **SSE连接**: 单连接多事件类型
- **批次处理**: 2-2-2模式
- **上下文管理**: 避免过长的prompt

### 用户体验
- **等待时间**: 12s（可接受）
- **渐进式加载**: 作品逐步点亮
- **沉浸式体验**: 完整的叙事流程

## 🚀 部署架构

### 开发环境
- **前端**: Next.js dev server
- **API**: Next.js API routes
- **数据**: 本地JSON文件
- **向量**: 本地HNSW索引

### 生产环境
- **前端**: Vercel Edge Functions
- **API**: Vercel Serverless Functions
- **数据**: Vercel KV存储
- **向量**: 本地HNSW索引（CDN缓存）

## 📝 总结

ArtDuo 通过精心设计的时序控制和并发处理，实现了从用户输入到沉浸式艺术体验的完整流程。关键创新点包括：

1. **LLM引导的策展规划** - 确保策展的专业性和个性化
2. **本地向量库的语义匹配** - 提供快速精准的作品检索
3. **SSE流式处理** - 实现渐进式的用户体验
4. **批次化文本生成** - 平衡性能和用户体验

这套架构既保证了策展质量，又提供了流畅的用户体验，是AI驱动艺术策展的理想实现方案。
