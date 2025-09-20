'use client';

import { useState, useEffect } from 'react';

export default function DynamicBackground({ children }: { children: React.ReactNode }) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isInputFocused, setIsInputFocused] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        setIsInputFocused(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        setIsInputFocused(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return (
    <div className={`gallery-background ${isInputFocused ? 'input-focused' : ''}`}>
      {/* 主背景：极简深灰/深蓝渐变 */}
      <div className="base-gradient" />
      
      {/* 纹理质感：亚麻/纸纹理叠加 */}
      <div className="texture-overlay" />
      
      {/* 灯光投射：中心光晕效果 */}
      <div className="spotlight-effect" />
      
      {/* 动态情绪色彩层 */}
      <div className="emotion-overlay" />
      
      {/* 鼠标跟随光效 */}
      <div 
        className="mouse-light"
        style={{
          left: mousePosition.x - 100,
          top: mousePosition.y - 100,
        }}
      />
      
      {/* 内容层 */}
      <div className="content-layer">
        {children}
      </div>
    </div>
  );
}