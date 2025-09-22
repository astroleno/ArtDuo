# Next.js 15 App Router 改造方案

## 背景
- PRD 指定 Next.js 15 + App Router、Edge Functions 与流式响应，以支撑 LLM/MCP 工具链、无数据库的会话状态和移动端性能。
- 现有前端位于 `frontend/`，使用 Vite + React Router 构建纯 SPA（参考 `frontend/src/App.tsx`），无法直接提供服务器组件、Edge API、图片优化等能力。
- 为减少基础设施成本、统一部署到 Vercel/Cloudflare Edge，需要将产品迁移到 Next.js 平台。

## 改造目标
- 框架升级：前端统一采用 Next.js 15 App Router，并保留 React 18。
- 路由结构：提供 `/` 输入页与 `/gallery` 展览页，支持移动端优先布局。
- 数据服务：在 `app/api/*` 下实现 LLM Prompt、MCP 聚合与许可证过滤的 Edge Route Handler，并支持 SSE/NDJSON。
- 静态与流式渲染：关键内容 SSR/SSG，作品详情和对话支持流式更新。
- UI 资产复用：迁移 Tailwind、shadcn/ui、Three.js 等现有配置，减少重复工作。

## 迁移方案概览
1. **初始化项目骨架**：在仓库中新建 `web/`（或替换现有 `frontend/`）目录，使用 `create-next-app@latest --ts --app` 初始化。
2. **复用工程配置**：迁移 Tailwind、PostCSS、`tsconfig` 基础选项，重新安装 shadcn/ui 组件库；清理 Vite 专属配置（`vite.config.ts`、`index.html` 等）。
3. **重建路由与布局**：使用 App Router 的 `app/layout.tsx` 定义全局 Providers（React Query、Tooltip、Toaster），在 `app/(marketing)/page.tsx` 与 `app/gallery/page.tsx` 中实现核心页面。
4. **数据流改造**：
   - 在 `app/api/query/route.ts` 实现 LLM 提示与作品检索聚合。
   - 在 `app/api/details/[id]/route.ts` 实现作品详情与说明生成。
   - 采用 `Response` + `ReadableStream` 输出 SSE/NDJSON 以支持对话流。
5. **组件与状态迁移**：
   - 将现有 UI 组件迁移到 `app/components` 或 `components/ui`，保持模块化。
   - 使用 Server Component + Client Component 组合：数据查询留在服务器组件，通过 props 传入，交互部分使用 "use client"。
   - 用 Zustand/Context 管理前端临时状态，与 localStorage 同步。
6. **构建与部署**：配置 `next.config.js` 以启用边缘运行时（`experimental.runtime = "edge"`），接入 Vercel/Cloudflare 部署；配置环境变量注入（API Key）。
7. **质量保障**：补充关键单元/集成测试（React Testing Library、Playwright），并验证移动端 Lighthouse 指标。

## 详细步骤
### 1. 项目初始化
- 在根目录执行 `pnpm dlx create-next-app@latest artduo-web --ts --app --tailwind --eslint --src-dir --import-alias "@/*"`。
- 若计划替换 `frontend/`，完成初始化后迁移并删除旧目录。

### 2. 基础设施迁移
- 将原有 `tailwind.config.ts` 中的自定义主题、插件迁移到 Next 项目。
- 更新 `postcss.config.js`、`tsconfig.json`（保留路径别名与严格模式）。
- 通过 `npx shadcn-ui@latest init` 重新生成 `components.json` 与 UI 目录。

### 3. 路由与布局
- `app/layout.tsx`: 注入 `QueryClientProvider`、`TooltipProvider`、`Toaster`/`Sonner` 等全局组件；设置全局 metadata。
- `app/(main)/page.tsx`: 输入页（关键词/情绪曲线），使用 Server Action 或 Route Handler 触发查询。
- `app/gallery/page.tsx`: 展览页 3×3 网格，首次加载 SSR（预取 9 件作品），后续交互由客户端管理。
- `app/gallery/[id]/page.tsx` 或 `@modal` 并行路由：实现详情弹层与 Agent 对话。

### 4. API 与数据层
- `app/api/search/route.ts`: 处理用户输入，调用 MCP `search_artwork` 并返回 9 件候选作品。
- `app/api/artworks/[id]/route.ts`: 取作品详情、许可证校验、`gaac.link` 生成。
- `app/api/chat/route.ts`: SSE/NDJSON 流，面向前端 Agent 对话。
- 抽象 `lib/mcp-client.ts`、`lib/cache.ts`，封装对 MCP SDK 与 Edge KV 的调用。

### 5. 状态与组件迁移
- 将现有 `src/components` 移入 Next 项目，按需标记 "use client"。
- 重构作品卡片、详情弹层、对话框以兼容服务器端传入的数据。
- 使用 React Query 处理局部异步请求；对需 SSR 的数据使用 `fetch`（`cache: "no-store"` 或 `revalidate` 控制）。

### 6. 构建、测试与部署
- 更新脚本：`dev`、`build`、`lint`、`test`、`preview` 对应 Next 命令。
- 本地通过 `next dev` 联调；使用 `next build` + `next start` 验证生产模式。
- 配置 GitHub Actions（可选）进行 CI（Lint、Test、`next build`）。
- 部署到 Vercel/Cloudflare，验证 Edge Logs、SSE 正常。

## 风险与应对
- **学习曲线**：团队需适应 App Router 的 Server/Client 组件模式 → 先在小组件上实践，编写示例与代码规范。
- **第三方依赖兼容性**：部分库仅支持浏览器环境 → 使用 "use client" 包裹或替换同等功能库。
- **Edge 环境限制**：Node.js 特定 API 不可用 → 在封装层内统一限制（如改用 `fetch`、`crypto.subtle`）。
- **性能指标**：首次加载需要在 5 秒内完成 → 建立缓存、并发请求与渐进式渲染策略。

## 时间与里程碑（示例）
- **第 1 周**：初始化 Next.js 项目、迁移工程配置、完成基础路由骨架。
- **第 2 周**：迁移核心组件与页面、实现搜索 API、完成作品列表 SSR。
- **第 3 周**：实现详情弹层、Agent SSE，对接 MCP 工具；补充测试。
- **第 4 周**：性能优化、移动端适配、验收与部署上线。

## 验收标准
- `next build` 顺利通过，页面路由 `/` 与 `/gallery` 正常渲染。
- Edge Route Handler 完成：搜索、详情、对话接口均可在测试环境返回数据。
- Lighthouse 移动端性能评分 ≥ 85，首屏可交互时间 < 5 秒。
- 文档与 README 更新，开发者可在 30 分钟内完成环境搭建并启动项目。

## 后续工作
- 视需求接入缓存存储（Vercel KV/Cloudflare KV），优化热门展览响应时间。
- 制定 shadcn 组件使用规范与主题定制指南。
- 评估是否需要 `app/(marketing)` 等并行路由以支持后续多页面扩展。
