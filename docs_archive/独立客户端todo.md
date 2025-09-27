# ArtDuo 独立客户端开发计划

> 基于解耦架构，创建新的纯前端客户端，与现有 Next.js BFF 并行开发

## 🎯 总体目标

**保持现有项目不变**，在同一项目中创建新的客户端路由：
- **现有项目**：`frontend/` - 继续作为测试端口和 BFF 使用
- **新客户端**：`frontend/src/app/client-shell/` - 纯前端应用，调用独立后端
- **新后端**：`apps/api-server/` - 独立后端服务
- **共享包**：`packages/` - 类型定义和工具函数

## 📁 项目结构对比

### 当前结构（保持不变）
```
ArtDuo/
├── frontend/              # 现有 Next.js 全栈应用
│   ├── src/app/api/       # BFF API 路由
│   ├── src/components/    # 前端组件
│   └── package.json
└── test/                  # 测试脚本
```

### 目标结构（新增）
```
ArtDuo/
├── frontend/              # 现有项目（保持不变）
│   ├── src/app/
│   │   ├── page.tsx       # 现有首页（保持不变）
│   │   ├── api/           # 现有 BFF API（保持不变）
│   │   └── client-shell/  # 新客户端路由
│   │       └── page.tsx   # 新客户端首页
│   └── package.json
├── apps/
│   └── api-server/        # 新独立后端
├── packages/
│   ├── types/             # 共享类型
│   ├── ui-components/     # 共享组件
│   └── utils/             # 共享工具
└── test/                  # 现有测试（保持不变）
```

## 📋 第一阶段：架构解耦（1-2周）

### 1.1 项目结构重组
- [ ] 创建 Monorepo 结构（在现有项目基础上新增）
  ```
  ArtDuo/
  ├── frontend/              # 现有项目（保持不变）
  │   └── src/app/
  │       ├── page.tsx       # 现有首页
  │       ├── api/           # 现有 BFF API
  │       └── client-shell/  # 新客户端路由
  ├── apps/
  │   └── api-server/        # 新独立后端服务
  ├── packages/
  │   ├── types/             # 共享 TypeScript 类型
  │   ├── ui-components/     # 可复用 UI 组件库
  │   └── utils/             # 共享工具函数
  └── docs/
  ```

- [ ] 在 `frontend/src/app/` 下创建 `client-shell/` 路由
- [ ] **不迁移现有代码**，而是复制并重构到 `client-shell/`
- [ ] 提取共享类型到 `packages/types/`
- [ ] 配置 Monorepo 工具链（pnpm workspaces / nx / lerna）
- [ ] 确保现有路由完全不受影响

### 1.2 后端服务抽离
- [ ] 创建独立 API 服务（推荐 NestJS 或 Fastify）
- [ ] **复制** `/app/api/*` 路由到新后端服务（不删除原有）
- [ ] 重构策展逻辑为独立服务模块
- [ ] 配置环境变量与配置管理
- [ ] 确保现有 `frontend/src/app/api/` 继续可用

### 1.3 类型契约定义
- [ ] 定义 API 接口类型（Request/Response）
- [ ] 定义艺术作品数据结构
- [ ] 定义策展流程状态类型
- [ ] 生成 OpenAPI/Swagger 文档

## 📋 第二阶段：客户端重构（2-3周）

### 2.1 状态管理优化
- [ ] 重构 Zustand store 为纯前端状态
- [ ] 移除服务端状态依赖
- [ ] 实现客户端缓存策略
- [ ] 添加离线状态处理

### 2.2 API 客户端封装
- [ ] 创建统一的 API 客户端类
- [ ] 实现请求/响应拦截器
- [ ] 添加错误处理与重试机制
- [ ] 实现流式响应处理（SSE/WebSocket）

### 2.3 组件架构优化
- [ ] 提取可复用组件到 `packages/ui-components/`
- [ ] 重构页面组件为纯展示组件
- [ ] 实现组件懒加载与代码分割
- [ ] 优化图片加载与缓存策略

## 📋 第三阶段：功能完善（3-4周）

### 3.1 策展流程优化
- [ ] 实现客户端策展状态管理
- [ ] 优化流式策展体验
- [ ] 添加策展进度指示器
- [ ] 实现策展结果缓存

### 3.2 用户体验提升
- [ ] 实现响应式设计优化
- [ ] 添加加载状态与骨架屏
- [ ] 优化错误边界与降级处理
- [ ] 实现 PWA 基础功能

### 3.3 性能优化
- [ ] 实现虚拟滚动（长列表）
- [ ] 优化图片懒加载与预加载
- [ ] 实现服务端渲染（SSR/SSG）
- [ ] 添加性能监控与分析

## 📋 第四阶段：生产化准备（2-3周）

### 4.1 部署架构
- [ ] 配置前端静态部署（Vercel/Netlify）
- [ ] 配置后端服务部署（Docker/K8s）
- [ ] 设置 CDN 与缓存策略
- [ ] 配置域名与 SSL 证书

### 4.2 监控与日志
- [ ] 集成前端错误监控（Sentry）
- [ ] 添加性能监控（Web Vitals）
- [ ] 配置后端日志收集
- [ ] 设置告警与通知

### 4.3 安全加固
- [ ] 实现 API 认证与授权
- [ ] 添加请求限流与防护
- [ ] 配置 CORS 与安全头
- [ ] 实现数据加密与脱敏

## 🛠️ 技术栈选择

### 前端客户端
- **框架**: Next.js (App Router) 或 Vite + React
- **状态管理**: Zustand
- **样式**: Tailwind CSS + Framer Motion
- **类型**: TypeScript
- **构建**: Turbopack 或 Vite

### 后端服务
- **框架**: NestJS 或 Fastify
- **语言**: TypeScript/Node.js
- **数据库**: PostgreSQL + Redis
- **队列**: Bull/BullMQ
- **文档**: Swagger/OpenAPI

### 共享包
- **类型**: TypeScript 严格模式
- **工具**: Zod 数据验证
- **构建**: TypeScript + Rollup

## 📊 验收标准

### 功能验收
- [ ] 策展流程完整可用
- [ ] 艺术作品展示正常
- [ ] 响应式设计适配
- [ ] 错误处理完善

### 性能验收
- [ ] 首屏加载 < 2s
- [ ] LCP < 1.5s
- [ ] FID < 100ms
- [ ] CLS < 0.1

### 质量验收
- [ ] TypeScript 严格模式
- [ ] ESLint 零警告
- [ ] 测试覆盖率 > 70%
- [ ] 可访问性评分 > 90

## 🚀 部署计划

### 开发环境
- **现有项目**: `http://localhost:3000` (frontend/)
- **新客户端**: `http://localhost:3000/client-shell` (frontend/src/app/client-shell/)
- **新后端**: `http://localhost:3001` (apps/api-server/)
- **文档**: `http://localhost:3002`

### 测试环境
- **现有项目**: `https://test.artduo.com` (继续作为测试端口)
- **新客户端**: `https://client-staging.artduo.com`
- **新后端**: `https://api-staging.artduo.com`

### 生产环境
- **新客户端**: `https://artduo.com`
- **新后端**: `https://api.artduo.com`
- **现有项目**: 可保留作为内部工具或逐步下线

## 📝 注意事项

1. **零影响原则**: 现有 `frontend/` 项目完全不受影响，继续作为测试端口
2. **并行开发**: 新旧系统并行运行，可以对比测试
3. **渐进式切换**: 新系统稳定后，逐步将流量切换到新架构
4. **向后兼容**: 确保 API 变更不影响现有客户端
5. **性能监控**: 持续监控前后端性能指标
6. **安全审计**: 定期进行安全漏洞扫描
7. **文档维护**: 保持 API 文档与类型定义同步

## 🔄 迁移策略

### 阶段1：并行开发（0影响）
- 现有路由继续运行在 `localhost:3000`
- 新客户端开发在 `localhost:3000/client-shell`
- 新后端开发在 `localhost:3001`
- 两套系统完全独立，互不影响

### 阶段2：功能验证
- 新系统功能完整性验证
- 性能对比测试
- 用户体验对比

### 阶段3：逐步切换
- 内部测试使用新系统
- 小流量灰度测试
- 全量切换（可选）

### 阶段4：清理（可选）
- 保留 `frontend/` 作为内部工具
- 或逐步下线，专注新架构

---

**创建时间**: 2025-01-22  
**预计完成**: 8-12 周  
**负责人**: 前端团队 + 后端团队  
**状态**: 规划中
