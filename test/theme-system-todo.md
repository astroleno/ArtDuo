# ArtDuo 主题色系统实现计划

## 🎯 项目目标
为 ArtDuo 实现完整的深色/浅色主题切换系统，支持原生扩散动画效果。

## 📋 实现计划

### 阶段 1: CSS 变量系统设计
- [ ] **1.1 定义主题变量**
  - [ ] 创建 `:root` 浅色主题变量
  - [ ] 创建 `[data-theme="dark"]` 深色主题变量
  - [ ] 定义颜色语义化命名规范

- [ ] **1.2 颜色变量规划**
  ```css
  /* 背景色 */
  --bg-primary: #f5f5f4;
  --bg-secondary: #e7e5e4;
  --bg-tertiary: #d6d3d1;
  
  /* 文字色 */
  --text-primary: #1c1917;
  --text-secondary: #57534e;
  --text-tertiary: #78716c;
  
  /* 卡片色 */
  --card-bg: rgba(255, 255, 255, 0.95);
  --card-border: rgba(0, 0, 0, 0.12);
  
  /* 按钮色 */
  --btn-primary: linear-gradient(135deg, #1c1917 0%, #44403c 100%);
  --btn-text: #f5f5f4;
  ```

### 阶段 2: 页面样式迁移
- [ ] **2.1 主页 (page.html)**
  - [ ] 替换硬编码颜色为 CSS 变量
  - [ ] 测试浅色/深色主题切换
  - [ ] 确保所有元素正确显示

- [ ] **2.2 画廊页面 (gallery/page.html)**
  - [ ] 迁移卡片样式到变量系统
  - [ ] 更新模态框颜色
  - [ ] 调整按钮和交互元素

- [ ] **2.3 沉浸式页面 (gallery/immersive/page.html)**
  - [ ] 更新轮播图背景
  - [ ] 调整导航指示器颜色
  - [ ] 优化艺术品信息卡片

### 阶段 3: 主题切换组件
- [ ] **3.1 切换按钮设计**
  - [ ] 创建主题切换按钮 UI
  - [ ] 设计太阳/月亮图标
  - [ ] 添加悬停和点击效果

- [ ] **3.2 扩散动画实现**
  - [ ] 创建圆形扩散元素
  - [ ] 实现从按钮中心扩散的动画
  - [ ] 优化动画时长和缓动函数
  - [ ] 确保动画完成后切换主题

- [ ] **3.3 JavaScript 逻辑**
  - [ ] 实现主题状态管理
  - [ ] 添加本地存储支持
  - [ ] 处理系统主题检测
  - [ ] 实现平滑切换逻辑

### 阶段 4: 用户体验优化
- [ ] **4.1 动画优化**
  - [ ] 调整扩散动画速度
  - [ ] 添加主题切换过渡效果
  - [ ] 优化性能，避免卡顿

- [ ] **4.2 响应式适配**
  - [ ] 确保移动端主题切换正常
  - [ ] 优化小屏幕下的按钮位置
  - [ ] 测试不同设备的显示效果

- [ ] **4.3 无障碍支持**
  - [ ] 添加键盘导航支持
  - [ ] 提供屏幕阅读器支持
  - [ ] 确保颜色对比度符合标准

### 阶段 5: 测试与优化
- [ ] **5.1 功能测试**
  - [ ] 测试所有页面的主题切换
  - [ ] 验证本地存储功能
  - [ ] 检查动画性能

- [ ] **5.2 兼容性测试**
  - [ ] 测试不同浏览器支持
  - [ ] 验证移动端兼容性
  - [ ] 检查旧版本浏览器降级

- [ ] **5.3 性能优化**
  - [ ] 优化 CSS 变量性能
  - [ ] 减少重绘和回流
  - [ ] 压缩和优化代码

## 🛠️ 技术实现细节

### CSS 变量结构
```css
:root {
  /* 浅色主题 */
  --theme-bg: #f5f5f4;
  --theme-text: #1c1917;
  --theme-card: rgba(255, 255, 255, 0.95);
}

[data-theme="dark"] {
  /* 深色主题 */
  --theme-bg: #1a1a1a;
  --theme-text: #ffffff;
  --theme-card: rgba(255, 255, 255, 0.1);
}
```

### 扩散动画实现
```javascript
function createRippleEffect(button, callback) {
  const ripple = document.createElement('div');
  ripple.className = 'theme-ripple';
  
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;
  
  ripple.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    width: ${size}px;
    height: ${size}px;
    background: var(--theme-ripple-color);
    border-radius: 50%;
    transform: translate(-50%, -50%) scale(0);
    transition: transform 0.6s ease-out;
    pointer-events: none;
    z-index: 1000;
  `;
  
  button.appendChild(ripple);
  
  requestAnimationFrame(() => {
    ripple.style.transform = 'translate(-50%, -50%) scale(1)';
  });
  
  setTimeout(() => {
    callback();
    ripple.remove();
  }, 600);
}
```

## 📅 时间规划
- **阶段 1-2**: 2-3 天 (CSS 变量系统)
- **阶段 3**: 2-3 天 (切换组件开发)
- **阶段 4-5**: 1-2 天 (优化和测试)
- **总计**: 5-8 天

## 🎨 设计原则
1. **一致性**: 所有页面使用统一的主题变量
2. **性能**: 最小化重绘，优化动画性能
3. **可访问性**: 支持键盘导航和屏幕阅读器
4. **用户体验**: 平滑的动画过渡，直观的交互反馈

## 📝 注意事项
- 确保深色主题下的文字对比度足够
- 测试所有交互元素在两种主题下的可见性
- 保持动画流畅，避免影响页面性能
- 考虑用户的系统主题偏好设置
