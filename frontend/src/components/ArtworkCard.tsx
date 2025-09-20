'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Artwork } from '@/lib/store';

interface ArtworkCardProps {
  artwork: Artwork;
  onClick: () => void;
  className?: string;
}

export default function ArtworkCard({ 
  artwork, 
  onClick, 
  className = '' 
}: ArtworkCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <motion.div
      className={`
        group relative
        bg-background-secondary/20
        rounded-xl
        overflow-hidden
        cursor-pointer
        transition-all duration-500
        hover:bg-background-secondary/40
        hover:shadow-xl
        hover:shadow-accent-secondary/10
        ${className}
      `}
      onClick={onClick}
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* 图片容器 */}
      <div className="relative aspect-square overflow-hidden">
        {/* 加载状态 */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-background-tertiary animate-pulse flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-accent-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* 错误状态 */}
        {imageError && (
          <div className="absolute inset-0 bg-background-tertiary flex items-center justify-center">
            <div className="text-center text-text-muted">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-background-primary flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21,15 16,10 5,21"/>
                </svg>
              </div>
              <p className="text-xs">图片加载失败</p>
            </div>
          </div>
        )}

        {/* 艺术作品图片 */}
        <motion.img
          src={artwork.imageUrl}
          alt={artwork.title}
          className={`
            w-full h-full object-cover
            transition-all duration-500
            group-hover:scale-110
            ${imageLoaded ? 'opacity-100' : 'opacity-0'}
          `}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          initial={{ opacity: 0 }}
          animate={{ opacity: imageLoaded ? 1 : 0 }}
          transition={{ duration: 0.5 }}
        />

        {/* 悬停遮罩 */}
        <motion.div
          className="absolute inset-0 bg-background-primary/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
        >
          <motion.div
            className="text-center"
            initial={{ y: 20, opacity: 0 }}
            whileHover={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-text-primary text-sm font-medium mb-1">查看详情</p>
            <p className="text-text-secondary text-xs">点击了解更多</p>
          </motion.div>
        </motion.div>

        {/* 角标 */}
        <div className="absolute top-3 right-3">
          <div className="w-2 h-2 bg-accent-secondary rounded-full opacity-60" />
        </div>
      </div>

      {/* 作品信息 */}
      <div className="p-4 md:p-6">
        <motion.h3
          className="
            text-text-primary
            text-lg md:text-xl
            font-medium
            mb-2
            line-clamp-2
            group-hover:text-accent-secondary
            transition-colors duration-300
          "
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          {artwork.title}
        </motion.h3>

        <motion.p
          className="
            text-text-secondary
            text-sm md:text-base
            mb-3
            line-clamp-1
          "
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          {artwork.artist}
        </motion.p>

        <motion.div
          className="flex items-center justify-between text-xs text-text-muted"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          <span>{artwork.year}</span>
          <span>{artwork.medium}</span>
        </motion.div>

        {/* 博物馆信息 */}
        <motion.div
          className="mt-3 pt-3 border-t border-text-muted/20"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
        >
          <p className="text-text-muted text-xs">
            {artwork.museum}
          </p>
        </motion.div>
      </div>

      {/* 装饰性边框 */}
      <motion.div
        className="absolute inset-0 border border-accent-secondary/20 rounded-xl pointer-events-none"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  );
}
