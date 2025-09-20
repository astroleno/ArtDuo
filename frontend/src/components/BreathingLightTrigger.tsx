'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';

interface BreathingLightTriggerProps {
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
}

export default function BreathingLightTrigger({
  onClick,
  size = 'md',
  className = '',
  disabled = false,
}: BreathingLightTriggerProps) {
  const [isHovered, setIsHovered] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const iconSizes = {
    sm: 16,
    md: 24,
    lg: 32,
  };

  return (
    <motion.button
      className={`
        relative group
        ${sizeClasses[size]}
        ${className}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={disabled ? {} : { scale: 1.1 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* 外层呼吸光晕 */}
      <motion.div
        className="absolute inset-0 rounded-full bg-accent-secondary/20"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* 中层呼吸光晕 */}
      <motion.div
        className="absolute inset-0 rounded-full bg-accent-secondary/30"
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.5,
        }}
      />
      
      {/* 内层呼吸光晕 */}
      <motion.div
        className="absolute inset-0 rounded-full bg-accent-secondary/40"
        animate={{
          scale: [1, 1.05, 1],
          opacity: [0.1, 0.3, 0.1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1,
        }}
      />
      
      {/* 按钮主体 */}
      <div className="
        relative z-10
        w-full h-full
        rounded-full
        bg-background-secondary/80
        backdrop-blur-sm
        border border-accent-secondary/30
        flex items-center justify-center
        transition-all duration-300
        group-hover:bg-background-tertiary/80
        group-hover:border-accent-secondary/50
        group-hover:shadow-lg
        group-hover:shadow-accent-secondary/20
      ">
        <MessageCircle
          size={iconSizes[size]}
          className="
            text-accent-secondary
            transition-all duration-300
            group-hover:text-accent-primary
            group-hover:scale-110
          "
        />
      </div>
      
      {/* 悬停时的额外光效 */}
      {isHovered && !disabled && (
        <motion.div
          className="absolute inset-0 rounded-full bg-accent-secondary/10"
          initial={{ scale: 1, opacity: 0 }}
          animate={{ scale: 1.5, opacity: 1 }}
          exit={{ scale: 1, opacity: 0 }}
          transition={{ duration: 0.3 }}
        />
      )}
      
      {/* 点击波纹效果 */}
      <motion.div
        className="absolute inset-0 rounded-full bg-accent-secondary/20"
        initial={{ scale: 0, opacity: 0 }}
        whileTap={{ scale: 1.2, opacity: 1 }}
        transition={{ duration: 0.2 }}
      />
    </motion.button>
  );
}
