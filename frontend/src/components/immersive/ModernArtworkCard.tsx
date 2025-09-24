'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface ModernArtworkCardProps {
  artwork: {
    id: string;
    title: string;
    artist: string;
    year: string;
    medium: string;
    imageUrl?: string;
    description?: string;
    museum?: string;
  };
  onImageLoad?: () => void;
  onImageError?: () => void;
}

// 使用Magic MCP设计理念的现代艺术作品卡片
export default function ModernArtworkCard({ 
  artwork, 
  onImageLoad, 
  onImageError 
}: ModernArtworkCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = () => {
    setImageLoaded(true);
    onImageLoad?.();
  };

  const handleImageError = () => {
    setImageError(true);
    onImageError?.();
  };

  return (
    <motion.div
      className="group relative bg-white/5 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/10 hover:border-white/20 transition-all duration-500"
      whileHover={{ y: -8, scale: 1.02 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* 图片容器 */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-pink-900/20 animate-pulse flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
        
        {imageError ? (
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-4xl mb-2">🖼️</div>
              <p className="text-sm">图片加载失败</p>
            </div>
          </div>
        ) : (
          <img
            src={artwork.imageUrl || 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop'}
            alt={artwork.title}
            className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}

        {/* 悬停时的信息覆盖层 */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
        >
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <motion.h3
              className="text-2xl font-bold text-white mb-2"
              initial={{ y: 20, opacity: 0 }}
              whileHover={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              {artwork.title}
            </motion.h3>
            <motion.p
              className="text-gray-300 text-lg"
              initial={{ y: 20, opacity: 0 }}
              whileHover={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {artwork.artist} · {artwork.year}
            </motion.p>
            <motion.p
              className="text-gray-400 text-sm"
              initial={{ y: 20, opacity: 0 }}
              whileHover={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {artwork.medium}
            </motion.p>
          </div>
        </motion.div>

        {/* 博物馆标签 */}
        {artwork.museum && (
          <motion.div
            className="absolute top-4 right-4 px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-xs rounded-full border border-white/30"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            {artwork.museum}
          </motion.div>
        )}
      </div>

      {/* 底部信息 */}
      <div className="p-6">
        <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-purple-300 transition-colors">
          {artwork.title}
        </h3>
        <p className="text-gray-400 text-sm mb-3">
          {artwork.artist} · {artwork.year}
        </p>
        {artwork.description && (
          <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">
            {artwork.description}
          </p>
        )}
      </div>

      {/* 装饰性元素 */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </motion.div>
  );
}
