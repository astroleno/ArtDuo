# ArtDuo 前端需求文档 (Frontend Requirements v1.0)

## 项目概览

**项目名称**：ArtDuo (中文名: 艺遇)  
**核心概念**：一个AI驱动的沉浸式情感艺术策展网站。用户输入一个描述情绪的词语，网站会动态生成一个包含9件艺术品的、具有情感曲线叙事线的线上展览。每一件艺术品都配有一个AI助手，用户可以与之对话，深入了解作品。

## 一、前端架构概述

### 技术栈
- **框架**：Next.js 15 + App Router
- **语言**：TypeScript
- **UI 组件**：shadcn/ui + TailwindCSS + ChatUI
- **状态管理**：React Context + useReducer + Zustand
- **动画**：GSAP + Framer Motion
- **3D 渲染**：Three.js + React Three Fiber
- **渲染策略**：SSR/SSG + 流式渲染

### 页面结构
```
app/
├── (marketing)/
│   └── page.tsx              # 情绪输入页 (Server Component)
├── gallery/
│   ├── page.tsx              # 展览展示页 (SSR)
│   └── [id]/
│       └── page.tsx          # 作品详情页 (动态路由)
├── components/
│   ├── DialogueOverlay.tsx   # AI 对话弹层 (ChatUI + Client Component)
│   ├── ArtworkCard.tsx       # 作品卡片组件 (Client Component)
│   ├── EmotionInput.tsx      # 情绪输入组件
│   ├── GalleryGrid.tsx       # 3×3 展览网格
│   └── ui/                   # shadcn/ui 组件
└── api/
    ├── query/route.ts        # 策展 API
    ├── details/[id]/route.ts # 作品详情 API
    └── chat/route.ts         # 对话 API
```

## 二、核心用户流程

### 2.1 第一步：情绪入口
**用户体验**：用户访问网站，看到一个全屏的、极简的动态界面。中央有一个引导性问题（例如"此刻，世界于你是什么颜色？"）和一个输入框。

**设计要求**：
- 全屏沉浸式体验
- 极简主义设计
- 动态背景效果
- 引导性问题突出显示

### 2.2 第二步：沉浸式展览
**用户体验**：用户输入情绪词并提交后，界面平滑过渡到一个无干扰的观展空间。9件艺术品会按照预设的"情绪曲线"逐一、聚焦式地展示。作品间的转场必须是流畅的、电影化的，而非简单的幻灯片切换。

**设计要求**：
- 无干扰的观展空间
- 电影化转场效果
- 情绪曲线叙事线
- 聚焦式作品展示

### 2.3 第三步：AI对话
**用户体验**：在每件作品的展示界面，都有一个非侵入式的触发点（如一个呼吸灯效果的图标）。用户点击后，会弹出一个半透明的浮层式对话窗口，可以与专属的AI Agent进行问答互动。

**设计要求**：
- 非侵入式触发点
- 呼吸灯效果
- 半透明浮层
- 专属AI Agent

## 三、设计风格与美学

### 3.1 整体风格
**设计理念**：极简主义、氛围感、神秘感。参考冥想App或独立游戏的美学，而非传统的画廊网站。

**风格特点**：
- 极简主义设计语言
- 营造氛围感和神秘感
- 参考冥想App美学
- 独立游戏风格元素

### 3.2 色彩方案
**主色调**：优先采用暗色模式 (Dark Mode)，以深灰、近黑为背景，突出艺术品本身。

**色彩规范**：
```css
/* 主色调 */
--bg-primary: #0a0a0a;        /* 近黑背景 */
--bg-secondary: #1a1a1a;      /* 深灰背景 */
--bg-tertiary: #2a2a2a;       /* 中灰背景 */

/* 高光和点缀色 */
--accent-primary: #f5f5f5;    /* 柔和白色 */
--accent-secondary: #d4af37;  /* 柔和金色 */
--accent-tertiary: #8b5cf6;   /* 柔和紫色 */

/* 文字颜色 */
--text-primary: #ffffff;      /* 主文字 */
--text-secondary: #a0a0a0;    /* 次要文字 */
--text-muted: #666666;        /* 弱化文字 */
```

### 3.3 字体设计
**字体选择**：
- **正文**：优雅的无衬线字体（如 Noto Sans SC）
- **标题/引导语**：有格调的衬线字体
- **特殊效果**：可考虑使用艺术感字体

**字体规范**：
```css
/* 字体定义 */
--font-sans: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
--font-serif: 'Noto Serif SC', Georgia, serif;
--font-display: 'Playfair Display', serif; /* 艺术感标题字体 */

/* 字体大小 */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
```

### 3.4 布局设计
**设计原则**：大量留白，聚焦核心内容，避免任何不必要的UI元素干扰。

**布局规范**：
- 最小化UI元素
- 大量留白空间
- 聚焦核心内容
- 无干扰设计

### 3.5 动效设计
**设计理念**：所有动画都应流畅、有物理感、有意义。使用GSAP来创造细腻的缓动效果和过渡动画。

**动效规范**：
```typescript
// GSAP 缓动配置
const easing = {
  smooth: "power2.out",
  bouncy: "back.out(1.7)",
  elastic: "elastic.out(1, 0.3)",
  dramatic: "power4.out"
};

// 动画时长
const duration = {
  fast: 0.3,
  normal: 0.6,
  slow: 1.2,
  dramatic: 2.0
};
```

## 四、页面需求详细说明

### 4.1 情绪输入页 (`/`)

**功能需求**：
- 全屏沉浸式情绪输入界面
- 支持多种输入方式
- 动态背景效果
- 引导性问题展示

**交互需求**：
- 情绪关键词输入（如：孤独、平静、激动）
- 情绪曲线选择（预设情绪组合）
- 自然语言描述输入
- 输入验证和提示

**UI 组件**：
```typescript
// 主要组件
- EmotionInput.tsx          # 情绪输入组件
- EmotionCurveSelector.tsx  # 情绪曲线选择器
- NaturalLanguageInput.tsx  # 自然语言输入框
- SubmitButton.tsx          # 提交按钮
- DynamicBackground.tsx     # 动态背景效果
- GuideQuestion.tsx         # 引导性问题
```

**状态管理**：
```typescript
interface EmotionInputState {
  emotion: string;
  userInput?: string;
  emotionCurve?: EmotionCurve;
  isValid: boolean;
  isLoading: boolean;
}
```

**样式要求**：
- 全屏沉浸式布局
- 极简主义设计
- 动态背景效果
- 引导性问题突出显示
- 使用 GSAP 实现流畅动画
- 移动端触摸友好

### 4.2 展览展示页 (`/gallery`)

**功能需求**：
- 无干扰的观展空间
- 电影化转场效果
- 情绪曲线叙事线
- 聚焦式作品展示
- AI 对话功能

**交互需求**：
- 点击作品 → 详情弹层
- 触摸手势支持（移动端）
- 键盘快捷键（ESC 关闭，R 重置）
- 呼吸灯效果触发点 → 打开 AI 对话

**UI 组件**：
```typescript
// 主要组件
- GalleryGrid.tsx           # 3×3 展览网格
- ArtworkCard.tsx          # 作品卡片组件
- ArtworkDetailModal.tsx   # 作品详情弹层
- BreathingLightTrigger.tsx # 呼吸灯效果触发点
- LoadingSkeleton.tsx      # 加载骨架屏
- EmotionCurveIndicator.tsx # 情绪曲线指示器
```

**状态管理**：
```typescript
interface GalleryState {
  artworks: Artwork[];
  selectedArtwork: Artwork | null;
  isDetailModalOpen: boolean;
  isDialogueOpen: boolean;
  isLoading: boolean;
  error: string | null;
  currentEmotionCurve: EmotionCurve;
  currentArtworkIndex: number;
}
```

**样式要求**：
- 无干扰的观展空间设计
- 电影化转场效果（GSAP）
- 情绪曲线叙事线展示
- 聚焦式作品展示
- 呼吸灯效果触发点
- 移动端滑动支持

### 4.3 作品详情页 (`/gallery/[id]`)

**功能需求**：
- 单件作品详细信息展示
- 高清图像查看
- 元数据展示
- 相关作品推荐
- 专属AI Agent对话

**交互需求**：
- 图片缩放和拖拽
- 元数据展开/收起
- 返回展览页面
- 分享功能
- 呼吸灯效果触发AI对话

**UI 组件**：
```typescript
// 主要组件
- ArtworkDetailView.tsx    # 作品详情视图
- ImageViewer.tsx          # 图片查看器
- MetadataPanel.tsx        # 元数据面板
- RelatedArtworks.tsx      # 相关作品推荐
- ShareButton.tsx          # 分享按钮
- BreathingLightTrigger.tsx # 呼吸灯效果触发点
```

## 五、核心组件需求

### 5.1 AI 对话弹层 (DialogueOverlay)

**技术实现**：基于 ChatUI 组件库

**功能需求**：
- 半透明浮层式对话窗口
- 流式 AI 对话
- 艺术作品上下文对话
- 对话历史管理
- 快捷回复建议
- 专属AI Agent

**UI 组件**：
```typescript
// ChatUI 集成
import { Chat, Message, Input, Toolbar } from '@chatui/core';

// 自定义组件
- DialogueOverlay.tsx      # 半透明浮层式对话容器
- ArtworkContextCard.tsx   # 作品上下文卡片
- QuickReplyButtons.tsx    # 快捷回复按钮
- MessageHistory.tsx       # 对话历史
- BreathingLightTrigger.tsx # 呼吸灯效果触发点
```

**状态管理**：
```typescript
interface DialogueState {
  messages: Message[];
  isOpen: boolean;
  isLoading: boolean;
  currentArtwork: Artwork | null;
  context: ChatContext;
  aiAgent: AIAgent;
}
```

**交互需求**：
- 半透明浮层设计
- 支持文本输入
- 支持语音输入（可选）
- 支持图片上传（可选）
- 支持快捷回复
- 支持对话导出
- 专属AI Agent交互

### 5.2 作品卡片组件 (ArtworkCard)

**功能需求**：
- 作品缩略图展示
- 基本信息显示
- 悬停效果
- 点击交互
- 呼吸灯效果触发点

**UI 组件**：
```typescript
// 主要组件
- ArtworkCard.tsx          # 作品卡片
- ArtworkImage.tsx         # 作品图片
- ArtworkInfo.tsx          # 作品信息
- ArtworkActions.tsx       # 操作按钮
- BreathingLightTrigger.tsx # 呼吸灯效果触发点
```

**样式要求**：
- 极简主义设计
- 大量留白
- 图片懒加载
- 悬停动画效果（GSAP）
- 响应式尺寸
- 无干扰设计

### 5.3 情绪输入组件 (EmotionInput)

**功能需求**：
- 多种输入方式支持
- 输入验证
- 实时反馈
- 历史记录
- 动态背景效果
- 引导性问题展示

**UI 组件**：
```typescript
// 主要组件
- EmotionInput.tsx         # 情绪输入主组件
- KeywordInput.tsx         # 关键词输入
- CurveSelector.tsx        # 曲线选择器
- NaturalLanguageInput.tsx # 自然语言输入
- InputValidator.tsx       # 输入验证器
- DynamicBackground.tsx    # 动态背景效果
- GuideQuestion.tsx        # 引导性问题
```

**样式要求**：
- 全屏沉浸式布局
- 极简主义设计
- 动态背景效果
- 引导性问题突出显示
- 使用 GSAP 实现流畅动画

## 六、状态管理需求

### 6.1 全局状态 (Zustand)

```typescript
interface AppState {
  // 用户输入状态
  emotionInput: EmotionInputState;
  
  // 展览状态
  gallery: GalleryState;
  
  // 对话状态
  dialogue: DialogueState;
  
  // UI 状态
  ui: {
    theme: 'light' | 'dark';
    sidebarOpen: boolean;
    loading: boolean;
  };
  
  // 缓存状态
  cache: {
    artworks: Map<string, Artwork>;
    conversations: Map<string, Message[]>;
  };
}
```

### 6.2 本地存储策略

```typescript
// sessionStorage 存储
interface SessionStorage {
  currentExhibition: Artwork[];
  conversationHistory: Message[];
  userPreferences: UserPreferences;
}

// localStorage 存储
interface LocalStorage {
  theme: 'light' | 'dark';
  language: string;
  visitedArtworks: string[];
}
```

## 七、性能优化需求

### 7.1 图片优化

**实现方案**：
- WebP 格式优先
- 响应式图片尺寸
- 懒加载和预加载
- CDN 缓存

**技术实现**：
```typescript
// Next.js Image 组件优化
import Image from 'next/image';

const ArtworkImage = ({ artwork }: { artwork: Artwork }) => (
  <Image
    src={artwork.imageUrl}
    alt={artwork.title}
    width={300}
    height={300}
    placeholder="blur"
    blurDataURL={artwork.blurDataURL}
    loading="lazy"
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  />
);
```

### 7.2 代码分割

**实现方案**：
- 路由级别的代码分割
- 组件懒加载
- 第三方库按需加载

**技术实现**：
```typescript
// 动态导入
const DialogueOverlay = dynamic(() => import('./DialogueOverlay'), {
  loading: () => <LoadingSkeleton />,
  ssr: false
});

const ThreeJSViewer = dynamic(() => import('./ThreeJSViewer'), {
  loading: () => <div>Loading 3D viewer...</div>
});
```

### 7.3 缓存策略

**实现方案**：
- 浏览器缓存：静态资源 24 小时
- API 缓存：Edge KV 缓存 1 小时
- 图片缓存：CDN 缓存 7 天
- 会话缓存：sessionStorage 临时存储

## 八、响应式设计需求

### 8.1 断点设计

```css
/* TailwindCSS 断点 */
sm: '640px',   /* 手机横屏 */
md: '768px',   /* 平板 */
lg: '1024px',  /* 桌面 */
xl: '1280px',  /* 大桌面 */
2xl: '1536px'  /* 超大桌面 */
```

### 8.2 移动端适配

**布局要求**：
- 移动端优先设计
- 触摸友好的按钮尺寸（最小 44px）
- 手势支持（滑动、缩放）
- 键盘导航支持

**交互优化**：
- 触摸反馈
- 滑动操作
- 长按菜单
- 手势识别

### 8.3 可访问性要求

**实现标准**：
- 支持屏幕阅读器
- 高对比度模式
- 字体大小可调节
- 键盘导航支持
- ARIA 标签完整

## 九、动画和交互需求

### 9.1 页面过渡动画

**使用 Framer Motion**：
```typescript
import { motion, AnimatePresence } from 'framer-motion';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -20 }
};

const pageTransition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.5
};
```

### 9.2 组件动画

**作品卡片动画**：
- 悬停效果
- 点击反馈
- 加载动画
- 进入/退出动画

**对话界面动画**：
- 消息出现动画
- 输入框焦点动画
- 按钮点击反馈
- 模态框打开/关闭

### 9.3 3D 效果（可选）

**使用 Three.js + React Three Fiber**：
- 作品展示的 3D 效果
- 展览空间的 3D 渲染
- 交互式 3D 模型查看

## 十、错误处理和用户体验

### 10.1 错误边界

```typescript
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

### 10.2 加载状态

**加载组件**：
- 骨架屏加载
- 进度条显示
- 加载动画
- 超时处理

### 10.3 离线支持

**实现方案**：
- Service Worker 缓存
- 离线页面显示
- 数据同步机制
- 网络状态检测

## 十一、开发工具和配置

### 11.1 开发环境配置

```typescript
// next.config.js
const nextConfig = {
  experimental: {
    runtime: 'edge',
  },
  images: {
    domains: ['collectionapi.metmuseum.org', 'commons.wikimedia.org'],
    formats: ['image/webp', 'image/avif'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};
```

### 11.2 代码质量工具

**配置工具**：
- ESLint + Prettier
- TypeScript 严格模式
- Husky + lint-staged
- Jest + Testing Library

### 11.3 性能监控

**监控工具**：
- Vercel Analytics
- Sentry 错误追踪
- Web Vitals 监控
- Bundle Analyzer

## 十二、测试需求

### 12.1 单元测试

**测试覆盖**：
- 组件渲染测试
- 状态管理测试
- 工具函数测试
- API 调用测试

### 12.2 集成测试

**测试场景**：
- 用户流程测试
- API 集成测试
- 状态同步测试
- 错误处理测试

### 12.3 E2E 测试

**测试用例**：
- 完整策展流程
- 对话功能测试
- 移动端交互测试
- 性能测试

## 十三、部署和构建

### 13.1 构建优化

**优化策略**：
- 代码分割
- 资源压缩
- 图片优化
- 缓存策略

### 13.2 部署配置

**部署平台**：Vercel
**配置要求**：
- 环境变量配置
- 域名配置
- SSL 证书
- CDN 配置

---

**文档版本**：v1.0  
**最后更新**：2024年12月  
**负责人**：前端团队  
**审核状态**：待审核
