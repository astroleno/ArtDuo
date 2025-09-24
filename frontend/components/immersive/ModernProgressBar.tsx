'use client';

import { motion } from 'framer-motion';

interface ModernProgressBarProps {
  currentIndex: number;
  total: number;
  className?: string;
}

// 使用Magic MCP设计理念的现代进度条
export default function ModernProgressBar({ 
  currentIndex, 
  total, 
  className = '' 
}: ModernProgressBarProps) {
  const progress = ((currentIndex + 1) / total) * 100;

  return (
    <motion.div
      className={`w-full max-w-md ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* 进度信息 */}
      <div className="flex justify-between items-center text-sm text-gray-300 mb-3">
        <motion.span
          key={currentIndex}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          作品 {currentIndex + 1} / {total}
        </motion.span>
        <motion.span
          key={progress}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          {Math.round(progress)}%
        </motion.span>
      </div>

      {/* 进度条容器 */}
      <div className="relative w-full h-3 bg-gray-700/50 rounded-full overflow-hidden backdrop-blur-sm">
        {/* 背景渐变 */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-full" />
        
        {/* 进度条 */}
        <motion.div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 rounded-full shadow-lg"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ 
            duration: 0.8, 
            ease: "easeOut",
            type: "spring",
            stiffness: 100
          }}
        >
          {/* 进度条光效 */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ x: ['-100%', '100%'] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        </motion.div>

        {/* 进度点 */}
        <motion.div
          className="absolute top-1/2 w-4 h-4 bg-white rounded-full shadow-lg transform -translate-y-1/2"
          style={{ left: `${progress}%` }}
          initial={{ scale: 0, x: '-50%' }}
          animate={{ scale: 1, x: '-50%' }}
          transition={{ 
            duration: 0.5,
            type: "spring",
            stiffness: 200
          }}
        >
          {/* 进度点光晕 */}
          <motion.div
            className="absolute inset-0 bg-white/30 rounded-full"
            animate={{ scale: [1, 1.5, 1] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </motion.div>
      </div>

      {/* 进度标签 */}
      <motion.div
        className="mt-2 text-center"
        key={currentIndex}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <span className="text-xs text-gray-400">
          {currentIndex === 0 && '开始您的艺术之旅'}
          {currentIndex > 0 && currentIndex < total - 1 && '继续探索'}
          {currentIndex === total - 1 && '即将完成'}
        </span>
      </motion.div>
    </motion.div>
  );
}
