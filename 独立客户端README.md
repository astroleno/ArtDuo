# ArtDuo 独立客户端

> 基于解耦架构的纯前端客户端，专注于用户体验和界面交互

## 🎯 项目概述

ArtDuo 独立客户端是 ArtDuo 画廊系统的前端应用，采用现代化的 React + Next.js 技术栈，提供优雅的艺术作品策展和浏览体验。

### 核心特性

- 🎨 **情绪化策展**：基于用户情绪智能推荐艺术作品
- 🖼️ **沉浸式画廊**：优雅的作品展示和交互体验
- 💬 **AI 对话**：与艺术作品进行深度对话交流
- 📱 **响应式设计**：完美适配桌面端和移动端
- ⚡ **高性能**：优化的加载速度和流畅动画

## 🏗️ 架构设计

### 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS + Framer Motion
- **状态管理**: Zustand
- **数据获取**: SWR + Fetch API
- **图标**: Lucide React
- **部署**: Vercel

### 项目结构

```
frontend/src/app/client-shell/
├── page.tsx                 # 客户端首页
├── layout.tsx               # 客户端布局
├── loading.tsx              # 加载状态
├── error.tsx                # 错误边界
├── components/              # 客户端专用组件
│   ├── ui/                  # 基础 UI 组件
│   ├── gallery/             # 画廊相关组件
│   ├── curation/            # 策展相关组件
│   └── chat/                # 对话相关组件
├── hooks/                   # 自定义 Hooks
├── lib/                     # 工具函数和配置
├── types/                   # TypeScript 类型定义
└── styles/                  # 样式文件
```

## 🚀 快速开始

### 环境要求

- Node.js 18.0+
- npm 或 yarn 或 pnpm

### 安装依赖

```bash
cd frontend
npm install
```

### 环境配置

创建 `.env.local` 文件：

```env
# API 配置
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_API_TIMEOUT=30000

# 功能开关
NEXT_PUBLIC_ENABLE_ANALYTICS=false
NEXT_PUBLIC_ENABLE_DEBUG=true

# 第三方服务
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
```

### 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:3000/client-shell` 查看客户端界面。

## 📱 功能模块

### 1. 情绪化策展

- **情绪输入**：支持文本描述和情绪标签选择
- **智能推荐**：基于情绪和偏好的作品推荐
- **策展流程**：可视化的策展进度和状态

### 2. 画廊展示

- **瀑布流布局**：自适应的作品展示网格
- **虚拟滚动**：大量作品的高性能渲染
- **图片优化**：懒加载、占位符、多格式支持

### 3. AI 对话

- **上下文感知**：基于当前作品和策展状态的对话
- **流式响应**：实时的对话体验
- **多模态支持**：文本、图片、链接等丰富内容

### 4. 用户体验

- **响应式设计**：移动端和桌面端完美适配
- **无障碍支持**：键盘导航、屏幕阅读器支持
- **性能优化**：代码分割、预加载、缓存策略

## 🎨 设计系统

### 色彩主题

```typescript
const themes = {
  lonely: {
    primary: '#3b82f6',
    secondary: '#60a5fa',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
  },
  passion: {
    primary: '#ef4444',
    secondary: '#f87171',
    background: 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)',
  },
  joy: {
    primary: '#f59e0b',
    secondary: '#fbbf24',
    background: 'linear-gradient(135deg, #451a03 0%, #78350f 100%)',
  },
}
```

### 动画配置

```typescript
const animations = {
  cardHover: {
    scale: 1.02,
    y: -8,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  spotlight: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.8 }
  },
  breath: {
    animate: {
      scale: [1, 1.05, 1],
      opacity: [0.4, 1, 0.4]
    },
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' }
  }
}
```

## 🔧 开发指南

### 组件开发

```typescript
// components/ui/Button.tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  onClick?: () => void
}

export function Button({ variant = 'primary', size = 'md', children, onClick }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size]
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
```

### 状态管理

```typescript
// lib/store.ts
interface AppState {
  currentEmotion: string
  artworks: Artwork[]
  curationState: CurationState
  setEmotion: (emotion: string) => void
  setArtworks: (artworks: Artwork[]) => void
  updateCurationState: (state: Partial<CurationState>) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentEmotion: '',
  artworks: [],
  curationState: 'idle',
  setEmotion: (emotion) => set({ currentEmotion: emotion }),
  setArtworks: (artworks) => set({ artworks }),
  updateCurationState: (state) => set((prev) => ({ 
    curationState: { ...prev.curationState, ...state } 
  })),
}))
```

### API 调用

```typescript
// lib/api.ts
class ApiClient {
  private baseURL: string
  private timeout: number

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'
    this.timeout = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '30000')
  }

  async curateArtworks(emotion: string, preferences?: UserPreferences) {
    const response = await fetch(`${this.baseURL}/api/curate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emotion, preferences }),
      signal: AbortSignal.timeout(this.timeout)
    })

    if (!response.ok) {
      throw new Error(`策展失败: ${response.statusText}`)
    }

    return response.json()
  }
}

export const apiClient = new ApiClient()
```

## 🧪 测试

### 单元测试

```bash
npm run test
```

### 端到端测试

```bash
npm run test:e2e
```

### 测试覆盖率

```bash
npm run test:coverage
```

## 📊 性能监控

### Web Vitals

- **LCP** (最大内容绘制): < 1.5s
- **FID** (首次输入延迟): < 100ms
- **CLS** (累积布局偏移): < 0.1
- **FCP** (首次内容绘制): < 0.9s

### 性能优化

- 图片懒加载和占位符
- 代码分割和动态导入
- 服务端渲染 (SSR)
- 静态生成 (SSG)
- 边缘缓存

## 🚀 部署

### 构建

```bash
npm run build
```

### 预览

```bash
npm run start
```

### 部署到 Vercel

```bash
vercel --prod
```

## 🔒 安全

- 输入验证和清理
- XSS 防护
- CSRF 保护
- 内容安全策略 (CSP)
- HTTPS 强制

## 📚 相关文档

- [API 文档](./docs/api.md)
- [组件库](./docs/components.md)
- [设计规范](./docs/design.md)
- [部署指南](./docs/deployment.md)

## 🤝 贡献

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 支持

如有问题或建议，请：

- 提交 [Issue](../../issues)
- 发送邮件至 support@artduo.com
- 查看 [FAQ](./docs/faq.md)

---

**版本**: v1.0.0  
**最后更新**: 2025-01-22  
**维护者**: ArtDuo 团队
