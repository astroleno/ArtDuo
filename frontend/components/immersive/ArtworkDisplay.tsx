'use client';

import { motion } from 'framer-motion';
import { Artwork } from '@/lib/store';
import { useState } from 'react';

interface ArtworkDisplayProps {
  artwork: Artwork;
  className?: string;
  onImageLoad?: () => void;
  onImageError?: () => void;
}

export default function ArtworkDisplay({
  artwork,
  className = '',
  onImageLoad,
  onImageError
}: ArtworkDisplayProps) {
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
      className={`w-full max-w-7xl aspect-[4/3] relative rounded-xl overflow-hidden shadow-gallery bg-background-secondary/20 mb-12 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      role="img"
      aria-label={`艺术作品: ${artwork.title} by ${artwork.artist}, ${artwork.year}`}
    >
      {artwork.imageUrl && !imageError ? (
        <img
          src={artwork.imageUrl}
          alt={`${artwork.title} by ${artwork.artist}, ${artwork.year}, ${artwork.medium}`}
          className="w-full h-full object-contain"
          onLoad={handleImageLoad}
          onError={handleImageError}
          loading="eager"
          decoding="async"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-background-secondary via-accent-tertiary to-background-secondary"
          role="img"
          aria-label={`${artwork.title} by ${artwork.artist}, ${artwork.year} - ${artwork.medium}`}
        >
          <div className="text-center text-text-primary">
            <div
              className="text-6xl mb-4"
              aria-hidden="true"
            >
              {artwork.title.includes('星夜') ? '🌌' : '🎭'}
            </div>
            <h2 className="text-3xl font-light mb-2">
              {artwork.title}
            </h2>
            <p className="text-lg text-text-secondary/80 mb-1">
              {artwork.artist}
            </p>
            <p className="text-sm text-text-secondary/60">
              {artwork.year} · {artwork.medium}
            </p>
          </div>
        </div>
      )}

      {/* 作品信息标签 */}
      <div
        className="absolute bottom-4 left-4 w-48 bg-background-overlay/40 backdrop-blur-lg rounded-lg p-2 text-text-primary text-sm"
        role="complementary"
        aria-label="作品信息"
      >
        <div className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">
          {artwork.title}
        </div>
        <div className="opacity-80 whitespace-nowrap overflow-hidden text-ellipsis">
          {artwork.artist}, {artwork.year}
        </div>
      </div>

      {/* 加载状态 */}
      {!imageLoaded && artwork.imageUrl && !imageError && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-background-secondary/20"
          aria-hidden="true"
        >
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </motion.div>
  );
}