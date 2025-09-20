# ArtDuo 产品需求文档 (PRD v2.0)

## 一、产品定位

### ArtDuo MVP 核心流程：
**用户输入情绪** → **LLM 智能策展** → **MCP 工具检索开放馆藏** → **前端渲染沉浸式展览** → **AI 对话互动**

### 产品目标：

**🚀 快**：无数据库依赖，最小成本快速上线
**💡 轻**：临时会话展示，用户数据不持久化存储  
**⚖️ 合法**：仅使用开放 API，严格遵守版权协议
**🎯 智能**：AI 驱动的个性化艺术策展体验

## 二、核心功能需求

### 2.1 智能策展流程

**用户输入**：
- 支持情绪关键词输入（如：孤独、平静、激动）
- 支持情绪曲线选择（预设情绪组合）
- 支持自然语言描述（如："我想看一些让人感到宁静的作品"）

**LLM 策展**：
- 基于用户输入生成策展主题
- 智能匹配艺术风格、时代、艺术家
- 生成 9 件作品的策展逻辑和排序

**MCP 工具检索**：
- 并发调用多个开放 API 获取作品数据
- 智能去重和排序
- 版权验证和合规检查

### 2.2 沉浸式展览展示

**3×3 网格布局**：
- 响应式设计，支持桌面和移动端
- 渐进式加载：优先显示核心作品
- 流畅的动画过渡效果

**作品信息展示**：
- 高清图像（支持 IIIF 协议）
- 完整元数据：标题、作者、年代、材质、尺寸
- 来源馆藏信息和链接
- 策展说明："为什么选择这件作品"

**交互功能**：
- 点击作品 → 详情弹层
- 触摸手势支持（移动端）
- 键盘快捷键（ESC 关闭，R 重置）

### 2.3 AI 对话系统

**智能对话**：
- 基于作品上下文的 AI 回答
- 支持艺术史、技法、情绪等多维度提问
- 实时流式响应

**对话功能**：
- 作品背景介绍
- 艺术技法解析
- 情绪共鸣讨论
- 策展逻辑解释

### 2.4 临时会话管理

**状态管理**：
- 前端 sessionStorage 存储当前展览
- 对话历史临时保存
- 页面刷新自动恢复状态

**会话特性**：
- 无用户注册要求
- 数据不持久化
- 隐私保护优先

### 2.5 外链跳转

**馆藏链接**：
- 原馆藏查看链接
- Google Arts & Culture 跳转
- 相关作品推荐链接

## 三、非功能需求

### 3.1 性能要求

**响应时间**：
- 首次展览加载：≤ 8 秒（考虑 API 调用延迟）
- 渐进式加载：前 3 件作品 ≤ 3 秒显示
- 对话响应：≤ 2 秒
- 图片加载：支持懒加载和压缩

**并发处理**：
- 支持 100+ 并发用户
- API 调用超时：10 秒
- 自动重试机制：最多 3 次

### 3.2 合规要求

**版权合规**：
- 仅使用 CC0/Public Domain 作品
- 所有图片附带来源和许可信息
- 严格遵守各 API 使用条款

**数据保护**：
- 不收集用户个人信息
- 临时数据自动清理
- 符合 GDPR 基本要求

### 3.3 用户体验

**响应式设计**：
- 移动端优先设计
- 支持触摸手势（滑动、缩放）
- 键盘导航支持

**可访问性**：
- 支持屏幕阅读器
- 高对比度模式
- 字体大小可调节

## 四、技术架构

### 4.1 前端架构 (Next.js 15 + App Router)

**技术栈**：
- **框架**：Next.js 15 + App Router、Edge Runtime
- **路由**：App Router (文件系统路由)
- **UI 组件**：shadcn/ui + TailwindCSS
- **状态管理**：React Context + useReducer + Zustand
- **动画**：GSAP + Framer Motion
- **3D 渲染**：Three.js + React Three Fiber
- **渲染策略**：SSR/SSG + 流式渲染

**页面结构**：
- `/` - 情绪输入页 (Server Component)
- `/gallery` - 展览展示页 (SSR + Client Component)
- `/gallery/[id]` - 作品详情页 (动态路由)

**核心组件**：
- `app/(marketing)/page.tsx` - 情绪输入界面 (Server Component)
- `app/gallery/page.tsx` - 3×3 展览网格 (SSR)
- `app/components/DialogueOverlay.tsx` - AI 对话弹层 (ChatUI + Client Component)
- `app/components/ArtworkCard.tsx` - 作品卡片组件 (Client Component)

### 4.2 后端架构 (Next.js 全栈架构)

**架构说明**：
- **无传统后端**：使用 Next.js App Router 提供全栈能力
- **平台**：Next.js 15 App Router + Edge Runtime
- **语言**：TypeScript/JavaScript
- **部署**：Vercel Edge Functions / Cloudflare Edge
- **优势**：统一部署、简化架构、降低运维成本

**API 设计**：
```typescript
// 策展 API - app/api/query/route.ts
POST /api/query
{
  emotion: string,
  userInput?: string
}
Response: {
  success: boolean,
  artworks: Artwork[],
  curation: CurationInfo
}

// 作品详情 API - app/api/details/[id]/route.ts
GET /api/details/[id]
Response: {
  success: boolean,
  artwork: Artwork,
  details: ArtworkDetails,
  gacLink: string
}

// 对话 API - app/api/chat/route.ts
POST /api/chat
{
  artworkId: string,
  message: string,
  context: ChatContext
}
Response: ReadableStream (SSE/NDJSON)
```

### 4.3 MCP 工具层

**核心工具**：

```typescript
// 作品搜索工具
const searchArtwork = async (query: SearchQuery) => {
  // 并发调用多个 API
  const [metResults, commonsResults, rijksResults] = await Promise.allSettled([
    searchMetAPI(query),
    searchCommonsAPI(query), 
    searchRijksAPI(query)
  ]);
  
  // 智能去重和排序
  return deduplicateAndRank(results);
};

// 作品详情获取
const getArtworkDetails = async (artworkId: string, source: string) => {
  // 获取完整元数据和 IIIF manifest
  return await fetchArtworkMetadata(artworkId, source);
};

// 版权验证
const licenseGuard = (metadata: ArtworkMetadata) => {
  // 验证是否为 CC0/Public Domain
  return metadata.license === 'CC0' || metadata.license === 'PD';
};

// GA&C 链接生成
const generateGACLink = (artwork: Artwork) => {
  // 生成 Google Arts & Culture 跳转链接
  return `https://artsandculture.google.com/asset/${artwork.gacId}`;
};
```

### 4.4 缓存策略

**多层缓存**：
- **浏览器缓存**：静态资源 24 小时
- **API 缓存**：Edge KV 缓存 1 小时
- **图片缓存**：CDN 缓存 7 天
- **会话缓存**：sessionStorage 临时存储

## 五、技术栈详细说明

### 5.1 前端技术栈

**核心框架**：
- **Next.js 15** - 全栈 React 框架，支持 App Router
- **React 18** - 用户界面库，支持并发特性
- **TypeScript** - 类型安全的 JavaScript
- **App Router** - 文件系统路由，支持 Server/Client 组件

**UI 和样式**：
- **TailwindCSS** - 原子化 CSS 框架
- **shadcn/ui** - 高质量 React 组件库
- **ChatUI** - 专业对话式 UI 组件库（阿里巴巴开源）
- **Lucide React** - 图标库

**交互和动画**：
- **GSAP** - 高性能动画库
- **Framer Motion** - React 动画库
- **Three.js + React Three Fiber** - 3D 渲染

**状态管理**：
- **React Context** - 全局状态管理
- **useReducer** - 复杂状态逻辑
- **Zustand** - 轻量级状态管理
- **React Query** - 服务端状态管理

**渲染策略**：
- **Server Components** - 服务器端渲染
- **Client Components** - 客户端交互
- **SSR/SSG** - 静态生成和服务器渲染
- **Streaming** - 流式渲染支持

### 5.2 后端技术栈

**运行环境**：
- **Next.js 15 App Router** - 全栈框架
- **Edge Runtime** - 边缘计算运行时
- **Vercel Edge Functions** - Serverless 函数
- **TypeScript** - 类型安全

**API 通信**：
- **Route Handlers** - App Router API 路由
- **Server-Sent Events (SSE)** - 流式对话响应
- **ReadableStream** - 流式数据传输
- **JSON** - 数据交换格式

### 5.3 外部 API 集成

**分阶段实现策略**：

**第一阶段（MVP）**：
- ✅ **Met Museum MCP (GitHub 开源)** - 免费，开源可控，优先级最高
- ✅ **Rijksmuseum MCP Server** - 数据质量高，需要申请 API 密钥
- ✅ **Wikimedia Commons API** - 免费，无需密钥
- ✅ **本地作品库** - 作为降级方案

**第二阶段（扩展）**：
- 🔄 **Louvre MCP Server** - 卢浮宫数据，评估 API 复杂度
- 🔑 **Europeana API** - 需要申请 API 密钥
- 🔗 **Google Arts & Culture** - 外链跳转

**第三阶段（聚合）**：
- 🔄 **Glama.ai Art & Culture 服务汇总** - 统一管理多个数据源

**API 配置**：
```typescript
const API_CONFIG = {
  met: {
    baseUrl: 'https://collectionapi.metmuseum.org/public/collection/v1',
    requiresKey: false,
    rateLimit: '1000/hour'
  },
  commons: {
    baseUrl: 'https://commons.wikimedia.org/w/api.php',
    requiresKey: false,
    rateLimit: '5000/hour'
  },
  rijks: {
    baseUrl: 'https://www.rijksmuseum.nl/api/nl/collection',
    requiresKey: true,
    rateLimit: '10000/day'
  }
};
```

### 5.4 部署和基础设施

**部署平台**：
- **Vercel** - Next.js 全栈部署
- **Vercel Edge Network** - 全球 CDN
- **Vercel KV** - 边缘缓存存储
- **Edge Runtime** - 边缘计算优化

**监控和分析**：
- **Vercel Analytics** - 性能监控
- **Sentry** - 错误追踪
- **Google Analytics** - 用户行为分析

**域名和 SSL**：
- **自定义域名** - artduo.app
- **自动 SSL** - Let's Encrypt 证书
- **HTTP/2** - 性能优化
- **Edge Functions** - 全球边缘部署

## 六、API 策略和风险控制

### 6.1 分阶段实现计划

**Phase 1: 基础 MVP（2-3 周）**
- 实现 Met API 和 Commons API 集成
- 基础策展功能
- 简单对话系统
- 本地作品库作为备用

**Phase 2: 功能完善（2-3 周）**
- 申请并集成 Rijksmuseum API
- 完善 MCP 工具层
- 优化缓存策略
- 增强对话功能

**Phase 3: 体验优化（1-2 周）**
- 申请 Europeana API
- 性能优化
- 移动端适配
- 用户体验改进

### 6.2 错误处理和降级策略

**API 失败处理**：
```typescript
const handleAPIFailure = async (primaryAPI: string, fallbackAPIs: string[]) => {
  try {
    return await callAPI(primaryAPI);
  } catch (error) {
    console.warn(`${primaryAPI} failed, trying fallbacks:`, error);
    
    for (const fallback of fallbackAPIs) {
      try {
        return await callAPI(fallback);
      } catch (fallbackError) {
        console.warn(`${fallback} also failed:`, fallbackError);
      }
    }
    
    // 最终降级到本地作品库
    return getLocalArtworks();
  }
};
```

**用户体验降级**：
- API 超时 → 显示加载状态 → 使用缓存数据
- 部分作品加载失败 → 显示占位符 → 提供重试选项
- 对话服务不可用 → 显示预设回答 → 引导用户查看作品信息

### 6.3 性能优化策略

**图片优化**：
- WebP 格式优先
- 响应式图片尺寸
- 懒加载和预加载
- CDN 缓存

**代码分割**：
- 路由级别的代码分割
- 组件懒加载
- 第三方库按需加载

**缓存策略**：
- 浏览器缓存：静态资源 24 小时
- API 缓存：Edge KV 1 小时
- 图片缓存：CDN 7 天
- 会话缓存：sessionStorage

## 七、详细实施计划

### 7.1 开发里程碑

**Week 1-2: 基础架构搭建**
- [ ] 初始化 Next.js 15 + App Router 项目
- [ ] 配置 TailwindCSS、shadcn/ui 和 ChatUI
- [ ] 实现 App Router 路由结构 (`/` 和 `/gallery`)
- [ ] 创建 Server/Client 组件框架

**Week 3-4: MCP 服务集成和策展功能**
- [ ] 实现 App Router Route Handlers (`app/api/query`, `app/api/details`, `app/api/chat`)
- [ ] 集成 Met Museum MCP (GitHub 开源项目) - 优先级最高
- [ ] 申请并集成 Rijksmuseum MCP Server
- [ ] 集成 Wikimedia Commons API
- [ ] 实现 MCP 工具层基础功能
- [ ] 开发策展算法和作品排序逻辑

**Week 5-6: 展览展示和交互**
- [ ] 实现 SSR 的 3×3 网格布局 (`/gallery`)
- [ ] 开发作品卡片和详情弹层 (Client Components)
- [ ] 添加动画和过渡效果
- [ ] 实现移动端响应式设计

**Week 7-8: AI 对话系统**
- [ ] 集成 LLM 服务（OpenAI/Claude）
- [ ] 实现 SSE 流式响应 (`app/api/chat/route.ts`)
- [ ] 使用 ChatUI 开发对话界面和交互逻辑 (Client Components)
- [ ] 添加对话历史和上下文管理

**Week 9-10: 优化和部署**
- [ ] 性能优化和缓存实现 (Edge Runtime)
- [ ] 错误处理和降级策略
- [ ] 测试和调试
- [ ] 部署到 Vercel Edge 并配置域名

### 7.2 技术债务和风险

**高风险项**：
- 🔴 **API 密钥申请**：Rijksmuseum 和 Europeana API 需要审核
- 🔴 **LLM 成本控制**：对话功能可能产生较高费用
- 🔴 **版权合规**：需要仔细验证每个作品的版权状态

**中风险项**：
- 🟡 **性能优化**：多 API 并发调用可能影响加载速度
- 🟡 **移动端适配**：3×3 网格在小屏幕上的显示效果
- 🟡 **缓存策略**：需要平衡数据新鲜度和性能

**低风险项**：
- 🟢 **基础功能实现**：前端展示和交互逻辑
- 🟢 **Met API 集成**：免费且文档完善
- 🟢 **部署和基础设施**：Vercel 平台稳定可靠

### 7.3 成功指标

**技术指标**：
- 首次展览加载时间 ≤ 8 秒
- 对话响应时间 ≤ 2 秒
- 页面加载性能评分 ≥ 90
- 移动端适配评分 ≥ 95

**用户体验指标**：
- 用户完成策展流程比例 ≥ 80%
- 平均对话轮次 ≥ 3 轮
- 用户停留时间 ≥ 2 分钟
- 作品点击率 ≥ 60%

**业务指标**：
- 日活跃用户数 ≥ 100
- 用户留存率（7天）≥ 30%
- 外链点击率 ≥ 20%
- 用户满意度评分 ≥ 4.0/5.0

## 八、总结和下一步

### 8.1 PRD 优化总结

**主要改进**：
1. ✅ **技术栈统一**：采用 Next.js 15 + App Router，支持 SSR/SSG 和流式渲染
2. ✅ **API 策略优化**：使用 App Router Route Handlers，分阶段实现，降低风险
3. ✅ **错误处理完善**：详细的降级策略和用户体验保障
4. ✅ **性能要求调整**：更现实的响应时间目标
5. ✅ **实施计划详细**：明确的时间线和里程碑

**风险控制**：
- 分阶段实现降低技术风险
- 多重降级策略保障用户体验
- 详细的错误处理机制
- 合理的性能指标设定

### 8.2 立即行动项

**本周内完成**：
1. 申请 Rijksmuseum API 密钥
2. 研究 Met Museum MCP (GitHub 开源项目) 部署方案
3. 设置 OpenAI/Claude API 账户
4. 配置 Vercel 项目和环境变量

**下周开始**：
1. 初始化 Next.js 15 + App Router 项目
2. 部署 Met Museum MCP 服务 (GitHub 开源)
3. 实现 MCP 工具层基础功能
4. 开始策展算法开发

### 8.3 长期规划

**V2.0 功能扩展**：
- 用户收藏和历史记录
- 社交分享功能
- 更多艺术馆 API 集成
- 个性化推荐算法

**V3.0 高级功能**：
- AR/VR 展览体验
- 多语言支持
- 艺术家和策展人认证
- 商业化和会员体系

---

**文档版本**：v2.0  
**最后更新**：2024年12月  
**负责人**：产品团队  
**审核状态**：待审核