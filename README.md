# ArtDuo - AI驱动的个性化艺术策展平台

## 🚀 MVP系统已完成！

### ✨ 纯前端MVP架构

**技术栈**：
- **前端**：Next.js + React + TypeScript
- **状态管理**：Zustand
- **动画**：Framer Motion
- **样式**：Tailwind CSS
- **AI集成**：BigModel GLM-4.5
- **数据源**：MCP (Model Context Protocol)
- **缓存**：IndexedDB
- **部署**：Vercel (静态托管)

**核心特性**：
- 🤖 **智能Agent**：4阶段状态机 (planning → searching → judging → complete)
- 🧠 **直接LLM调用**：前端直接调用BigModel GLM API
- 🔍 **MCP集成**：通过代理服务调用Met Museum MCP
- 💾 **本地缓存**：IndexedDB存储搜索结果，支持离线使用
- 📱 **移动端支持**：PWA + 响应式设计
- ⚡ **零服务器成本**：纯静态部署，Vercel免费托管

### 🎯 系统优势

1. **部署简单**：`git push`即可部署
2. **成本极低**：零服务器成本
3. **响应快速**：无服务器延迟
4. **离线可用**：本地缓存支持
5. **移动友好**：完美支持手机端
6. **扩展性强**：组件化架构，易于维护

## 🎨 项目简介

ArtDuo 是一个基于AI的个性化艺术策展平台，通过用户输入的情绪或关键词，智能生成个性化的艺术展览。平台整合了多个世界知名艺术馆的开放API，为用户提供沉浸式的艺术体验。

### 核心特性

- **🤖 AI智能策展**：基于用户情绪生成个性化展览
- **🌍 全球艺术馆整合**：Met、Rijksmuseum、Europeana等
- **💬 AI对话互动**：与艺术作品进行深度对话
- **📱 响应式设计**：完美适配桌面和移动端
- **⚡ 无数据库架构**：轻量级，快速部署

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn
- Git

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/your-username/ArtDuo.git
cd ArtDuo

# 2. 安装依赖
cd frontend
npm install

# 3. 启动开发服务器
npm run dev

# 4. 打开浏览器访问
# http://localhost:5173
```

### 环境配置

创建 `.env.local` 文件：

```env
# API 配置
VITE_MET_API_URL=https://collectionapi.metmuseum.org/public/collection/v1
VITE_COMMONS_API_URL=https://commons.wikimedia.org/w/api.php
VITE_RIJKS_API_URL=https://www.rijksmuseum.nl/api/nl/collection
VITE_RIJKS_API_KEY=your_rijks_api_key

# LLM 配置
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key

# 部署配置
VITE_APP_URL=https://artduo.app
```

## 📁 项目结构

```
ArtDuo/
├── frontend/                 # 前端应用
│   ├── src/
│   │   ├── components/       # React 组件
│   │   │   ├── ui/          # shadcn/ui 组件
│   │   │   ├── IntroPortal.jsx
│   │   │   ├── ExhibitionCanvas.jsx
│   │   │   └── DialogueOverlay.jsx
│   │   ├── pages/           # 页面组件
│   │   ├── services/        # API 服务
│   │   ├── hooks/           # 自定义 Hooks
│   │   └── lib/             # 工具函数
│   ├── public/              # 静态资源
│   └── package.json
├── prd.md                   # 产品需求文档
└── README.md               # 项目说明
```

## 🛠️ 技术栈

### 前端
- **Vite** - 快速构建工具
- **React 18** - 用户界面库
- **TypeScript** - 类型安全
- **TailwindCSS** - 样式框架
- **shadcn/ui** - 组件库
- **GSAP** - 动画库
- **Three.js** - 3D渲染

### 后端
- **Vercel Edge Functions** - Serverless 函数
- **Node.js** - 运行时环境
- **TypeScript** - 类型安全

### 外部服务
- **Metropolitan Museum API** - 大都会艺术博物馆
- **Wikimedia Commons API** - 维基媒体共享
- **Rijksmuseum API** - 荷兰国家博物馆
- **OpenAI/Anthropic** - AI对话服务

## 🎯 功能特性

### 1. 智能策展
- 用户输入情绪关键词
- AI分析并生成策展主题
- 从多个艺术馆API获取作品
- 智能排序和去重

### 2. 沉浸式展览
- 3×3网格布局展示
- 高清作品图片
- 完整元数据信息
- 流畅动画过渡

### 3. AI对话系统
- 基于作品上下文的智能回答
- 支持艺术史、技法、情绪讨论
- 实时流式响应
- 对话历史管理

### 4. 响应式设计
- 移动端优先设计
- 触摸手势支持
- 键盘快捷键
- 无障碍访问

## 📊 性能指标

- **首次加载时间**：≤ 8秒
- **对话响应时间**：≤ 2秒
- **页面性能评分**：≥ 90
- **移动端适配**：≥ 95

## 🔧 开发指南

### 项目配置
- **环境变量**：复制 `.env.example` 到 `.env.local` 并配置API密钥
- **Git配置**：项目已配置完整的 `.gitignore` 文件，自动忽略敏感文件和构建产物
- **代码规范**：使用 TypeScript 进行类型检查，遵循 ESLint 配置

### 代码规范
- 使用 TypeScript 进行类型检查
- 遵循 ESLint 和 Prettier 配置
- 组件使用函数式组件和 Hooks
- 样式使用 TailwindCSS 类名

### 提交规范
```bash
# 功能开发
git commit -m "feat: 添加作品详情弹层功能"

# 问题修复
git commit -m "fix: 修复移动端布局问题"

# 文档更新
git commit -m "docs: 更新API文档"
```

### 测试
```bash
# 运行测试
npm run test

# 代码检查
npm run lint

# 类型检查
npm run type-check
```

## 🚀 部署

### Vercel 部署
```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署到 Vercel
vercel --prod
```

### 环境变量配置
在 Vercel 控制台配置以下环境变量：
- `VITE_RIJKS_API_KEY`
- `VITE_OPENAI_API_KEY`
- `VITE_ANTHROPIC_API_KEY`

## 📈 路线图

### Phase 1: MVP (已完成)
- [x] 基础架构搭建
- [x] Met API 集成
- [x] 基础策展功能
- [x] 简单对话系统

### Phase 2: 功能完善 (进行中)
- [ ] Rijksmuseum API 集成
- [ ] 完善 MCP 工具层
- [ ] 优化缓存策略
- [ ] 增强对话功能

### Phase 3: 体验优化 (计划中)
- [ ] Europeana API 集成
- [ ] 性能优化
- [ ] 移动端适配
- [ ] 用户体验改进

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系我们

- 项目链接：[https://github.com/your-username/ArtDuo](https://github.com/your-username/ArtDuo)
- 在线演示：[https://artduo.app](https://artduo.app)
- 问题反馈：[Issues](https://github.com/your-username/ArtDuo/issues)

## 🙏 致谢

- [Metropolitan Museum of Art](https://www.metmuseum.org/) - 提供开放API
- [Wikimedia Commons](https://commons.wikimedia.org/) - 免费图片资源
- [Rijksmuseum](https://www.rijksmuseum.nl/) - 荷兰艺术收藏
- [shadcn/ui](https://ui.shadcn.com/) - 优秀的React组件库

---

**ArtDuo** - 让艺术触手可及 🎨
