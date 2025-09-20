# MCP建议实施TODO清单

基于`mcp建议.md`的技术审查报告，制定具体的实施计划。

## 🎯 总体目标

解决当前架构中的核心问题：
- ❌ 模拟MCP数据进入生产链路
- ❌ LLM分析为空仍继续检索  
- ❌ 数据解析缺少严格校验
- ❌ 缺少数据溯源和去重
- ❌ child_process安全控制不足

**扩展目标**：构建完整的LLM + MCP联动，产出**个性化但无记忆（stateless）**的沉浸式策展体验

## 📋 实施计划

### Phase 1: 核心问题修复 (优先级：🔥 严重)

#### A. 终止Mock回落
- [ ] **修改 `frontend/src/app/api/mcp/route.ts`**
  - [ ] 移除默认mock返回逻辑
  - [ ] 当上游不可用时返回 `502/503` 状态码
  - [ ] 在响应body中写入 `{code: "MCP_UPSTREAM_UNAVAILABLE"}`
  - [ ] 添加环境变量开关 `NEXT_PUBLIC_MCP_MOCK_ENABLED` (仅开发环境)

- [ ] **修改 `frontend/src/lib/frontend-mcp-client.ts`**
  - [ ] 检测到 `MCP_UPSTREAM_UNAVAILABLE` 错误码时直接fail
  - [ ] 不生成任何占位数据
  - [ ] 向上层传递明确的错误信息

#### B. 分析空值硬断言与兜底映射
- [ ] **修改 `frontend/src/lib/frontend-agent.ts`**
  - [ ] 在 `generateAnalysis` 方法中添加空值检查：
    ```typescript
    if (!analysis || Object.keys(analysis).length === 0) {
      return setState({ 
        status: 'error', 
        code: 'ANALYSIS_EMPTY', 
        message: '请更具体地描述你的情绪或场景' 
      });
    }
    ```
  - [ ] 完善 `generateDefaultAnalysis` 方法
  - [ ] 添加用户确认机制，仅在用户同意后使用兜底映射

### Phase 1.5: 查询理解与情绪语义层 (优先级：🔥 严重)

#### G. 情绪语义映射
- [ ] **创建情绪映射文件**
  - [ ] 新建 `frontend/src/lib/emotion-map.json`
  - [ ] 定义情绪→关键词权重表（含中英对照、同义词集）
  - [ ] 基于Plutchik/Valence-Arousal二维模型
  - [ ] 包含颜色/材质/主题词映射

- [ ] **实现查询理解器**
  - [ ] 新建 `frontend/src/lib/query-understander.ts`
  - [ ] 实现 `buildQuery(input, seed)` 方法
  - [ ] 产出 `{keywords[], themes[], paletteHint}`
  - [ ] 支持颜色/材质/主题词抽取

- [ ] **输入质量护栏**
  - [ ] 检测空输入、仅停用词、过短文本
  - [ ] 提供重写建议或候选模板
  - [ ] 生成可控随机种子 `seed`，保证可复现且无记忆

### Phase 2: 数据质量提升 (优先级：🔥 严重)

#### C. 结构化校验
- [ ] **安装依赖**
  - [ ] `npm install zod`
  - [ ] `npm install @types/zod --save-dev`

- [ ] **创建Schema定义**
  - [ ] 新建 `frontend/src/lib/schemas/artwork.ts`
  - [ ] 定义 `ArtworkSchema`：
    ```typescript
    import { z } from 'zod';
    
    export const ArtworkSchema = z.object({
      id: z.string(),
      title: z.string(),
      artist: z.string(),
      year: z.string().optional(),
      medium: z.string().optional(),
      description: z.string().optional(),
      imageUrl: z.string().url().optional(),
      objectUrl: z.string().url().optional(),
      museum: z.enum(['Met', 'GAC', 'Tate']).optional(),
      source: z.enum(['mcp', 'api']),
      rights: z.string().optional(),
      score: z.number().optional()
    });
    ```

- [ ] **修改 `frontend/src/lib/frontend-mcp-client.ts`**
  - [ ] 导入 `ArtworkSchema`
  - [ ] 在 `convertMCPArtworkFromText` 和 `convertMCPArtworkFromJSON` 中使用 `ArtworkSchema.safeParse`
  - [ ] 解析失败时抛出 `MCP_SCHEMA_INVALID` 错误
  - [ ] 不进入Phase 3，直接返回错误状态

#### D. 溯源字段与去重
- [ ] **更新Artwork类型定义**
  - [ ] 修改 `frontend/src/lib/artwork-services/types.ts`
  - [ ] 添加新字段：`objectUrl`, `museum`, `source`, `rights`, `score`

- [ ] **实现去重逻辑**
  - [ ] 在 `frontend/src/lib/frontend-agent.ts` 中添加去重方法
  - [ ] 以 `title+artist` 和 `imageUrl` 双键去重
  - [ ] 重复时保留得分最高的一条
  - [ ] 记录去重统计信息

- [ ] **更新UI显示**
  - [ ] 修改 `frontend/src/components/ArtworkCard.tsx`
  - [ ] 显示来源博物馆、版权信息
  - [ ] 添加跳转到原站的链接

#### H. 多源检索编排
- [ ] **SourceAdapter实现**
  - [ ] 新建 `frontend/src/lib/source-adapters/`
  - [ ] 支持Met、Tate、Rijks、GA&C/IIIF源
  - [ ] 统一ArtworkSchema规范化
  - [ ] 按题材/年代/开放许可可用性对不同源加权

- [ ] **路由策略**
  - [ ] 实现失败快速切换机制
  - [ ] 并行批量请求 + 超时与退避
  - [ ] 命中一组即可进入重排，后续增量补齐

#### I. 重排评分与多样性约束
- [ ] **重排器实现**
  - [ ] 新建 `frontend/src/lib/reranker.ts`
  - [ ] 实现 `rerank(items, constraints, seed)` 方法
  - [ ] 基础分：文本相关 × 许可可用性 × 图像清晰度
  - [ ] 多样性约束：时期、流派、地域、媒介的MMR算法

- [ ] **9件套编曲器**
  - [ ] 实现1-9位点位规则（起-承-转-合）
  - [ ] 三种曲线模板：平缓/对比/波动
  - [ ] 视觉一致性：与情绪色谱的色相/明度差评估

### Phase 3: 安全性与监控 (优先级：⚠️ 高)

#### E. child_process安全与资源控制
- [ ] **修改 `frontend/src/lib/artwork-services/metmuseum-mcp.ts`**
  - [ ] 使用 `execFile` 替代字符串拼接
  - [ ] 设置 `timeout`、`maxBuffer`、`killSignal`
  - [ ] 实现并发队列控制 (使用 `p-queue`)
  - [ ] 在异常路径的 `finally` 中确保进程清理

- [ ] **安装依赖**
  - [ ] `npm install p-queue`
  - [ ] `npm install @types/p-queue --save-dev`

#### F. 可观测性
- [ ] **添加correlationId**
  - [ ] 在 `frontend/src/lib/frontend-agent.ts` 中生成唯一ID
  - [ ] 透传给LLM和MCP调用
  - [ ] 统一日志格式

- [ ] **关键指标监控**
  - [ ] `phase_duration_ms` - 各阶段耗时
  - [ ] `mcp_qps` - MCP请求QPS
  - [ ] `mcp_error_rate` - MCP错误率
  - [ ] `llm_empty_ratio` - LLM空结果比例
  - [ ] `dedupe_ratio` - 去重比例
  - [ ] `cache_hit_rate` - 缓存命中率

#### J. 策展叙事与展签生成
- [ ] **JSON契约定义**
  - [ ] 新建 `frontend/src/lib/schemas/exhibition.ts`
  - [ ] 定义强Schema：
    ```typescript
    export const ExhibitionSchema = z.object({
      exhibition_title: z.string(),
      curatorial_statement: z.string().max(300),
      sections: z.array(z.object({
        mood: z.string(),
        transition_text: z.string(),
        items: z.array(z.object({
          id: z.string(),
          why_here: z.string().max(80),
          wall_label: z.string().max(120),
          keywords: z.array(z.string())
        }))
      })),
      palette: z.object({
        primary: z.string(),
        secondary: z.string(),
        background_intensity: z.number()
      })
    });
    ```

- [ ] **叙事生成器**
  - [ ] 新建 `frontend/src/lib/narrative-generator.ts`
  - [ ] 提示词硬约束：禁止幻造来源，只许使用传入字段
  - [ ] 审计器：自动校验JSON与字数/字符集/占位检查
  - [ ] 失败自动重试机制

#### K. 视觉/色谱联动
- [ ] **情绪色谱映射**
  - [ ] 新建 `frontend/src/lib/palette-mapper.ts`
  - [ ] 情绪→`hue/sat/lum` 与光锥半径映射
  - [ ] 生成页面背景渐变与Spotlight强度

- [ ] **布局策略**
  - [ ] 三种展线布局：直线、折返、对称
  - [ ] 依据"曲线模板"选择布局
  - [ ] 图片占位与比例自适应卡片
  - [ ] 边框与标题样式跟随色谱

#### L. 运行时体验优化
- [ ] **渐进式呈现**
  - [ ] T0：先出展名+氛围背景
  - [ ] T0+0.8s：出1/3件"锚点"作品卡（高分）
  - [ ] T0+1.5s：补全余下作品与"转场文字"

- [ ] **部分失败降级**
  - [ ] 某一源失败不打断展线
  - [ ] 在卡片角标显示"来源暂不可用，已替换"
  - [ ] 会话级 `sessionId` + `seed` 管理

#### M. 合规与版权
- [ ] **许可过滤**
  - [ ] 过滤非开放许可或无清晰图的大图
  - [ ] 展示 `rights`、`museum`、`objectUrl`
  - [ ] 明确署名规范统一落在卡片与详情页

- [ ] **图像代理**
  - [ ] 自托管Thumb/CDN，加Referer/缓存策略
  - [ ] 批量化：IIIF `?region/size` 一次性取适配尺寸
  - [ ] 首屏只取 `w=800`，进场后懒加载大图

## 🧪 测试计划

### 单元测试
- [ ] **Schema校验测试**
  - [ ] 错误字段应fail
  - [ ] 缺字段应fail  
  - [ ] 脏JSON应fail

- [ ] **MCP代理测试**
  - [ ] 上游断开时返回503
  - [ ] 不生成本地数据

### 集成测试
- [ ] **正常路径测试**
  - [ ] 输入"孤独" → Analysis非空 → MCP返回真实数据 → 去重后≥8条
  - [ ] 每条数据包含museum和objectUrl

- [ ] **失败路径测试**
  - [ ] Analysis为空 → 显示友好提示，不进入Phase 2
  - [ ] MCP 503 → UI显示"来源服务暂时不可用"

### 性能测试
- [ ] **性能基线**
  - [ ] Gallery首屏加载 < 3s (Wi-Fi)
  - [ ] 交互帧率 > 60fps
  - [ ] MCP请求超时 6-8s

### 金丝雀测试
- [ ] **固定情绪词测试**
  - [ ] 6组情绪词：开心、孤独、平静、忧郁、激动、愤怒
  - [ ] 日巡检对比：来源分布/多样性/许可通过率
  - [ ] 无状态可复现：同一输入+种子→结果排序与叙事一致

## 📊 验收标准

### 功能验收
- [ ] 不再有模拟数据进入生产链路
- [ ] LLM分析为空时正确提示用户
- [ ] 数据解析失败时fail-fast
- [ ] 显示真实的作品来源和版权信息
- [ ] 去重后数据质量提升

### 性能验收
- [ ] 响应时间不显著增加
- [ ] 错误率控制在可接受范围
- [ ] 内存使用稳定

### 用户体验验收
- [ ] 错误提示友好易懂
- [ ] 加载状态清晰
- [ ] 数据来源可追溯

### 策展体验验收（新增）
- [ ] **召回多样性**：9件中≥4个不同时期/≥3种媒介/≥2个地理区域
- [ ] **许可通过率**：公开可用（CC0/开放获取）占比≥80%
- [ ] **叙事一致性**：曲线模板与色谱冲突率<10%
- [ ] **无状态可复现**：同一输入+种子→结果排序与叙事一致
- [ ] **端到端耗时**：P95≤8s；首交互≤1.5s

## 🚀 实施时间线

| 阶段 | 预计时间 | 关键里程碑 |
|------|----------|------------|
| Phase 1 | 2-3天 | 解决核心Mock和LLM问题 |
| Phase 1.5 | 2-3天 | 情绪语义映射和查询理解完成 |
| Phase 2 | 4-5天 | 数据质量提升+多源检索+重排完成 |
| Phase 3 | 3-4天 | 叙事生成+视觉联动+合规完成 |
| 测试 | 3-4天 | 全链路测试+金丝雀测试通过 |

## 📝 注意事项

1. **渐进式部署**：建议先在开发环境验证，再逐步推广到生产
2. **回滚准备**：保留当前代码分支，确保可以快速回滚
3. **用户沟通**：提前告知用户可能的服务中断时间
4. **监控告警**：部署后密切监控关键指标
5. **无状态设计**：所有"个性化"都从当前输入与当次检索上下文推导，不落库用户画像
6. **多样性保证**：确保策展结果的多样性和代表性，避免同质化
7. **合规优先**：优先使用开放许可的艺术作品，确保商业化安全

## 🔗 相关文件

- `mcp建议.md` - 原始技术审查报告
- `mcp建议2.md` - 策展体验扩展建议
- `diagnose/` - 相关代码文件备份
- `frontend/src/lib/` - 主要修改目录
- `frontend/src/app/api/mcp/` - MCP代理路由

---

**最后更新**: 2025-01-21  
**负责人**: 开发团队  
**状态**: 🟡 待开始
