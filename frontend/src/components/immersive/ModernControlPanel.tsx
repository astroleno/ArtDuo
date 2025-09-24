'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface ModernControlPanelProps {
  showDetails: boolean;
  isPlayingAudio: boolean;
  onToggleDetails: () => void;
  onToggleAudio: () => void;
  onShare?: () => void;
  onFavorite?: () => void;
  className?: string;
}

// 使用Magic MCP设计理念的现代控制面板
export default function ModernControlPanel({
  showDetails,
  isPlayingAudio,
  onToggleDetails,
  onToggleAudio,
  onShare,
  onFavorite,
  className = ''
}: ModernControlPanelProps) {
  const [isFavorited, setIsFavorited] = useState(false);

  const handleFavorite = () => {
    setIsFavorited(!isFavorited);
    onFavorite?.();
  };

  const controls = [
    {
      id: 'details',
      label: showDetails ? '隐藏详情' : '查看详情',
      icon: showDetails ? '👁️‍🗨️' : '👁️',
      action: onToggleDetails,
      variant: 'primary' as const,
      description: showDetails ? '隐藏作品详细分析' : '查看作品详细分析'
    },
    {
      id: 'audio',
      label: isPlayingAudio ? '暂停音频' : '播放音频',
      icon: isPlayingAudio ? '⏸️' : '▶️',
      action: onToggleAudio,
      variant: 'secondary' as const,
      description: isPlayingAudio ? '暂停音频讲解' : '播放音频讲解'
    },
    {
      id: 'favorite',
      label: isFavorited ? '已收藏' : '收藏',
      icon: isFavorited ? '❤️' : '🤍',
      action: handleFavorite,
      variant: 'accent' as const,
      description: isFavorited ? '取消收藏' : '添加到收藏'
    },
    {
      id: 'share',
      label: '分享',
      icon: '📤',
      action: onShare || (() => {}),
      variant: 'tertiary' as const,
      description: '分享这件作品'
    }
  ];

  const getVariantStyles = (variant: string) => {
    switch (variant) {
      case 'primary':
        return 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-500/25';
      case 'secondary':
        return 'bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-700 hover:to-pink-800 text-white shadow-lg shadow-pink-500/25';
      case 'accent':
        return 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25';
      case 'tertiary':
        return 'bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white border border-white/20 hover:border-white/30';
      default:
        return 'bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white';
    }
  };

  return (
    <motion.div
      className={`flex flex-wrap justify-center gap-3 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
    >
      {controls.map((control, index) => (
        <motion.button
          key={control.id}
          onClick={control.action}
          className={`
            relative px-6 py-3 rounded-xl font-medium transition-all duration-300
            focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent
            ${getVariantStyles(control.variant)}
          `}
          whileHover={{ 
            scale: 1.05,
            y: -2
          }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.5, 
            delay: 0.5 + index * 0.1,
            type: "spring",
            stiffness: 200
          }}
          title={control.description}
        >
          {/* 按钮内容 */}
          <div className="flex items-center gap-2">
            <span className="text-lg">{control.icon}</span>
            <span className="text-sm font-medium">{control.label}</span>
          </div>

          {/* 悬停时的光效 */}
          <motion.div
            className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/10 to-transparent"
            initial={{ x: '-100%' }}
            whileHover={{ x: '100%' }}
            transition={{ duration: 0.6 }}
          />

          {/* 点击波纹效果 */}
          <motion.div
            className="absolute inset-0 rounded-xl bg-white/20"
            initial={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
        </motion.button>
      ))}

      {/* 键盘快捷键提示 */}
      <motion.div
        className="w-full mt-4 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <div className="inline-flex items-center gap-4 text-xs text-gray-400 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/10">
          <span>💡 快捷键:</span>
          <span>← → 切换作品</span>
          <span>ESC 关闭详情</span>
          <span>Space 播放/暂停</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
