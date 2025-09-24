// Tailwind CSS v4 配置 - 扩展版本
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // 背景颜色映射
      backgroundColor: {
        'background-primary': 'var(--bg-primary)',
        'background-secondary': 'var(--bg-secondary)',
        'background-tertiary': 'var(--bg-tertiary)',
        'background-overlay': 'var(--bg-overlay)',
      },
      // 文字颜色映射
      textColor: {
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'text-accent': 'var(--text-accent)',
      },
      // 强调色映射
      borderColor: {
        'accent-primary': 'var(--accent-primary)',
        'accent-secondary': 'var(--accent-secondary)',
        'accent-tertiary': 'var(--accent-tertiary)',
        'accent-blue': 'var(--accent-blue)',
      },
      // 特殊效果
      backgroundImage: {
        'gradient-bg': 'linear-gradient(-45deg, var(--bg-primary), var(--bg-secondary), var(--bg-tertiary), var(--bg-primary))',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      // 动画配置
      animation: {
        'breathe': 'breathe 3s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 20s ease infinite',
        'emotion-breathe': 'emotion-breathe 12s ease-in-out infinite',
        'fade-in': 'fadeIn 0.8s ease-out',
        'slide-in': 'slideIn 0.6s ease-out',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        'gradient-shift': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'emotion-breathe': {
          '0%, 100%': { opacity: '0.3', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(1.05)' },
        },
        fadeIn: {
          'from': { opacity: '0', transform: 'translateY(20px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          'from': { opacity: '0', transform: 'translateX(-30px)' },
          'to': { opacity: '1', transform: 'translateX(0)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      // 间距系统
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      // Z-index层级管理
      zIndex: {
        'background': '1',
        'texture': '2',
        'spotlight': '3',
        'emotion': '4',
        'mouse': '5',
        'content': '10',
        'modal': '50',
        'tooltip': '60',
      },
      // 字体系统
      fontFamily: {
        'sans': ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        'serif': ['var(--font-playfair)', 'Georgia', 'serif'],
        'display': ['var(--font-playfair)', 'serif'],
        'chinese-sans': ['var(--font-noto-sans)', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        'chinese-serif': ['var(--font-noto-serif)', 'SimSun', 'serif'],
      },
      // 阴影系统
      boxShadow: {
        'gallery': '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        'spotlight': '0 0 60px rgba(245, 158, 11, 0.1)',
        'emotion': '0 0 40px rgba(139, 92, 246, 0.1)',
      },
      // 边框圆角
      borderRadius: {
        'gallery': '1rem',
        'card': '0.75rem',
        'button': '0.5rem',
      },
      // 背景模糊
      backdropBlur: {
        'gallery': '16px',
      },
      // 过渡效果
      transitionProperty: {
        'gallery': 'all',
      },
      transitionDuration: {
        'gallery': '300ms',
      },
      transitionTimingFunction: {
        'gallery': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
  // 暗色模式配置
  darkMode: 'class',
}

export default config