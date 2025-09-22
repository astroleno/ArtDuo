'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Artwork } from '@/lib/store';

interface ImageLightboxProps {
  artwork: Artwork | null;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export default function ImageLightbox({
  artwork,
  isOpen,
  onClose,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
}: ImageLightboxProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // 重置状态当artwork变化时
  useEffect(() => {
    if (artwork) {
      setImageLoaded(false);
      setImageError(false);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [artwork]);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (hasPrevious && onPrevious) onPrevious();
          break;
        case 'ArrowRight':
          if (hasNext && onNext) onNext();
          break;
        case '+':
        case '=':
          setScale(prev => Math.min(prev + 0.25, 3));
          break;
        case '-':
        case '_':
          setScale(prev => Math.max(prev - 0.25, 0.5));
          break;
        case '0':
          setScale(1);
          setPosition({ x: 0, y: 0 });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onNext, onPrevious, hasPrevious, hasNext]);

  // 防止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY,
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!artwork) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            {/* 关闭按钮 */}
            <motion.button
              className="absolute top-4 right-4 z-50 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-all"
              onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="关闭查看器"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </motion.button>

            {/* 导航按钮 */}
            {hasPrevious && onPrevious && (
              <motion.button
                className="absolute left-4 z-50 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  onPrevious();
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label="上一张"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </motion.button>
            )}

            {hasNext && onNext && (
              <motion.button
                className="absolute right-4 z-50 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  onNext();
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label="下一张"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </motion.button>
            )}

            {/* 缩放控制 */}
            <div className="absolute bottom-4 left-4 z-50 flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg p-2">
              <motion.button
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded flex items-center justify-center text-white text-sm transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  setScale(prev => Math.max(0.5, prev - 0.25));
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label="缩小"
                disabled={scale <= 0.5}
              >
                −
              </motion.button>
              <span className="text-white text-xs min-w-[3rem] text-center">
                {Math.round(scale * 100)}%
              </span>
              <motion.button
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded flex items-center justify-center text-white text-sm transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  setScale(prev => Math.min(3, prev + 0.25));
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label="放大"
                disabled={scale >= 3}
              >
                +
              </motion.button>
              <motion.button
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded flex items-center justify-center text-white text-xs transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  setScale(1);
                  setPosition({ x: 0, y: 0 });
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label="重置"
              >
                ⟲
              </motion.button>
            </div>

            {/* 作品信息 */}
            <motion.div
              className="absolute bottom-4 right-4 z-50 max-w-xs bg-white/10 backdrop-blur-sm rounded-lg p-4 text-white"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="font-medium text-lg mb-1">{artwork.title}</h3>
              <p className="text-sm opacity-90 mb-1">{artwork.artist}, {artwork.year}</p>
              <p className="text-xs opacity-80 mb-2">{artwork.medium}</p>
              <p className="text-xs opacity-70">{artwork.museum}</p>
              {artwork.description && (
                <p className="text-xs opacity-80 mt-2 leading-relaxed">{artwork.description}</p>
              )}
            </motion.div>

            {/* 图片容器 */}
            <motion.div
              className="relative max-w-[90vw] max-h-[90vh] cursor-grab active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                cursor: scale > 1 ? 'grab' : 'default',
              }}
            >
              {/* 加载状态 */}
              {!imageLoaded && !imageError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* 错误状态 */}
              {imageError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white/80">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21,15 16,10 5,21"/>
                      </svg>
                    </div>
                    <p>图片加载失败</p>
                  </div>
                </div>
              )}

              {/* 图片 */}
              <motion.img
                src={artwork.imageUrl}
                alt={`${artwork.title} by ${artwork.artist}, ${artwork.year}`}
                className="max-w-[90vw] max-h-[90vh] object-contain select-none"
                style={{
                  scale,
                  x: position.x,
                  y: position.y,
                  transformOrigin: 'center',
                }}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                initial={{ opacity: 0 }}
                animate={{ opacity: imageLoaded ? 1 : 0 }}
                transition={{ duration: 0.5 }}
                draggable={false}
              />
            </motion.div>

            {/* 键盘提示 */}
            <motion.div
              className="absolute top-4 left-4 z-50 bg-white/10 backdrop-blur-sm rounded-lg p-3 text-white text-xs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 1 }}
            >
              <div className="space-y-1">
                <div>ESC 关闭</div>
                <div>← → 导航</div>
                <div>+ - 缩放</div>
                <div>0 重置</div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}