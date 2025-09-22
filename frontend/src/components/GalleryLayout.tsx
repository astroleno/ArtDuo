'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export type GalleryLayout = 'grid' | 'masonry' | 'carousel' | 'fullscreen';

interface GalleryLayoutProps {
  artworks: any[];
  layout: GalleryLayout;
  onLayoutChange: (layout: GalleryLayout) => void;
  onArtworkClick: (artwork: any) => void;
  className?: string;
}

export default function GalleryLayout({
  artworks,
  layout,
  onLayoutChange,
  onArtworkClick,
  className = ''
}: GalleryLayoutProps) {
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);

  // 自动轮播
  useEffect(() => {
    if (layout === 'carousel') {
      const interval = setInterval(() => {
        setCurrentCarouselIndex((prev) => (prev + 1) % artworks.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [layout, artworks.length]);

  const LayoutSelector = () => (
    <motion.div
      className="flex items-center gap-2 bg-background-secondary/20 rounded-lg p-1 backdrop-blur-sm"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      {[
        { key: 'grid', icon: '⊞', label: '网格' },
        { key: 'masonry', icon: '⊟', label: '瀑布流' },
        { key: 'carousel', icon: '▶', label: '轮播' },
        { key: 'fullscreen', icon: '⛶', label: '全屏' }
      ].map(({ key, icon, label }) => (
        <motion.button
          key={key}
          className={`
            px-3 py-2 rounded-md text-sm font-medium transition-all
            ${layout === key
              ? 'bg-accent-secondary text-white shadow-lg'
              : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary/40'
            }
          `}
          onClick={() => onLayoutChange(key as GalleryLayout)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label={`切换到${label}视图`}
        >
          <span className="mr-1">{icon}</span>
          {label}
        </motion.button>
      ))}
    </motion.div>
  );

  const renderGridLayout = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
      {artworks.map((artwork, index) => (
        <motion.div
          key={artwork.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.5 }}
          onClick={() => onArtworkClick(artwork)}
          className="cursor-pointer"
        >
          <div className="group relative bg-background-secondary/20 rounded-xl overflow-hidden transition-all duration-500 hover:bg-background-secondary/40 hover:shadow-xl hover:shadow-accent-secondary/10">
            <div className="relative aspect-square overflow-hidden">
              <img
                src={artwork.imageUrl}
                alt={artwork.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-background-primary/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-text-primary text-sm font-medium mb-1">查看详情</p>
                  <p className="text-text-secondary text-xs">点击了解更多</p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <h3 className="text-text-primary text-lg font-medium mb-1">{artwork.title}</h3>
              <p className="text-text-secondary text-sm">{artwork.artist}, {artwork.year}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );

  const renderMasonryLayout = () => (
    <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
      {artworks.map((artwork, index) => (
        <motion.div
          key={artwork.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.5 }}
          onClick={() => onArtworkClick(artwork)}
          className="cursor-pointer break-inside-avoid mb-6"
        >
          <div className="group relative bg-background-secondary/20 rounded-xl overflow-hidden transition-all duration-500 hover:bg-background-secondary/40 hover:shadow-xl hover:shadow-accent-secondary/10">
            {/* 随机高度的图片容器 */}
            <div className="relative overflow-hidden" style={{ height: `${200 + Math.random() * 200}px` }}>
              <img
                src={artwork.imageUrl}
                alt={artwork.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-background-primary/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-text-primary text-sm font-medium mb-1">查看详情</p>
                  <p className="text-text-secondary text-xs">点击了解更多</p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <h3 className="text-text-primary text-lg font-medium mb-1">{artwork.title}</h3>
              <p className="text-text-secondary text-sm">{artwork.artist}, {artwork.year}</p>
              <p className="text-text-muted text-xs mt-2">{artwork.medium}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );

  const renderCarouselLayout = () => {
    const currentArtwork = artworks[currentCarouselIndex];
    if (!currentArtwork) return null;

    return (
      <div className="relative h-[70vh] max-w-6xl mx-auto">
        <motion.div
          key={currentCarouselIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="h-full flex items-center justify-center"
        >
          <div className="relative w-full h-full max-h-[70vh]">
            <img
              src={currentArtwork.imageUrl}
              alt={currentArtwork.title}
              className="w-full h-full object-contain"
              onClick={() => onArtworkClick(currentArtwork)}
            />

            {/* 作品信息 */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-white">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h2 className="text-2xl font-bold mb-2">{currentArtwork.title}</h2>
                <p className="text-lg opacity-90 mb-1">{currentArtwork.artist}, {currentArtwork.year}</p>
                <p className="text-base opacity-80">{currentArtwork.medium}</p>
                <p className="text-sm opacity-70 mt-2">{currentArtwork.description}</p>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* 导航按钮 */}
        <button
          className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-all"
          onClick={() => setCurrentCarouselIndex((prev) => (prev - 1 + artworks.length) % artworks.length)}
          aria-label="上一张"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          className="absolute right-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-all"
          onClick={() => setCurrentCarouselIndex((prev) => (prev + 1) % artworks.length)}
          aria-label="下一张"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {/* 指示器 */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
          {artworks.map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentCarouselIndex ? 'bg-white w-6' : 'bg-white/50'
              }`}
              onClick={() => setCurrentCarouselIndex(index)}
              aria-label={`跳转到第${index + 1}张`}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderFullscreenLayout = () => (
    <div className="fixed inset-0 bg-black">
      <div className="h-full flex items-center justify-center p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 max-w-7xl mx-auto w-full">
          {artworks.map((artwork, index) => (
            <motion.div
              key={artwork.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              onClick={() => onArtworkClick(artwork)}
              className="cursor-pointer group"
            >
              <div className="relative">
                <img
                  src={artwork.imageUrl}
                  alt={artwork.title}
                  className="w-full h-auto rounded-lg transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-center justify-center">
                  <div className="text-center text-white">
                    <h3 className="text-xl font-bold mb-2">{artwork.title}</h3>
                    <p className="text-lg opacity-90">{artwork.artist}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 关闭按钮 */}
      <button
        className="absolute top-4 right-4 w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-all"
        onClick={() => onLayoutChange('grid')}
        aria-label="退出全屏"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );

  return (
    <div className={className}>
      {/* 布局选择器 */}
      <div className="flex justify-center mb-8">
        <LayoutSelector />
      </div>

      {/* 布局内容 */}
      <div className="min-h-[50vh]">
        {layout === 'grid' && renderGridLayout()}
        {layout === 'masonry' && renderMasonryLayout()}
        {layout === 'carousel' && renderCarouselLayout()}
        {layout === 'fullscreen' && renderFullscreenLayout()}
      </div>
    </div>
  );
}