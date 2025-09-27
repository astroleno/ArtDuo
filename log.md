# ArtDuo 错误日志

## 修复记录
- [2025-09-27] 修复了 "The default export is not a React Component in "/page"" 错误
- 改用API路由方案：React客户端组件 + API路由提供HTML内容

## 当前架构
- 主页：`page.tsx` (客户端组件) + `/api/html?page=home` API路由
- 画廊：`gallery/page.tsx` (客户端组件) + `/api/html?page=gallery` API路由
- 沉浸式：`gallery/immersive/route.ts` (直接API路由)

## 测试状态
- ✅ HTML API路由工作正常
- ✅ 主页组件渲染中（显示加载动画）
- ⏳ 等待HTML内容加载完成

这个方案应该能正常工作，React组件保持不变，其他业务逻辑完全不受影响。