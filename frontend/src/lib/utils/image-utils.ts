// 统一的图片处理工具函数
// 供React组件和HTML页面共同使用

export interface ImageLoadResult {
  success: boolean;
  error?: string;
  fallbackUrl?: string;
}

export interface ImageCacheEntry {
  src: string;
  loaded: boolean;
  timestamp: number;
}

// 图片缓存
const imageCache = new Map<string, ImageCacheEntry>();
const imageLoadQueue: string[] = [];
const maxConcurrentLoads = 3;
let currentLoads = 0;

// 备用图片列表
export const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1561736778-92e52a7769ef?w=800&h=600&fit=crop'
];

/**
 * 获取随机备用图片
 */
export function getRandomFallbackImage(): string {
  return FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)];
}

/**
 * 图片错误处理
 */
export function handleImageError(
  img: HTMLImageElement, 
  artworkId: string,
  onError?: (result: ImageLoadResult) => void
): void {
  console.warn(`图片加载失败: ${artworkId}`, img.src);
  
  const fallbackUrl = getRandomFallbackImage();
  img.src = fallbackUrl;
  img.style.opacity = '0.7';
  img.title = '图片加载失败，显示备用图片';
  
  onError?.({
    success: false,
    error: '图片加载失败',
    fallbackUrl
  });
}

/**
 * 图片加载成功处理
 */
export function handleImageLoad(
  img: HTMLImageElement,
  artworkId: string,
  onLoad?: (result: ImageLoadResult) => void
): void {
  console.log(`图片加载成功: ${artworkId}`);
  img.style.opacity = '1';
  
  // 缓存成功加载的图片
  imageCache.set(artworkId, {
    src: img.src,
    loaded: true,
    timestamp: Date.now()
  });
  
  onLoad?.({
    success: true
  });
}

/**
 * 智能预加载策略
 */
export function preloadImages(
  artworks: Array<{ id: string; imageUrl: string }>,
  currentIndex: number
): void {
  const preloadRange = 2; // 预加载当前图片前后2张
  const startIndex = Math.max(0, currentIndex - preloadRange);
  const endIndex = Math.min(artworks.length - 1, currentIndex + preloadRange);
  
  for (let i = startIndex; i <= endIndex; i++) {
    if (i !== currentIndex && !imageCache.has(artworks[i].id)) {
      queueImageLoad(artworks[i].imageUrl, artworks[i].id);
    }
  }
}

/**
 * 图片加载队列管理
 */
function queueImageLoad(imageUrl: string, artworkId: string): void {
  if (imageCache.has(artworkId)) return;
  
  imageLoadQueue.push(artworkId);
  processImageQueue(imageUrl, artworkId);
}

/**
 * 处理图片加载队列
 */
function processImageQueue(imageUrl: string, artworkId: string): void {
  if (currentLoads >= maxConcurrentLoads || imageLoadQueue.length === 0) {
    return;
  }
  
  currentLoads++;
  
  const img = new Image();
  img.onload = () => {
    imageCache.set(artworkId, {
      src: img.src,
      loaded: true,
      timestamp: Date.now()
    });
    currentLoads--;
    processImageQueue(imageUrl, artworkId);
  };
  
  img.onerror = () => {
    console.warn(`预加载失败: ${artworkId}`);
    currentLoads--;
    processImageQueue(imageUrl, artworkId);
  };
  
  img.src = imageUrl;
}

/**
 * 检查图片是否已缓存
 */
export function isImageCached(artworkId: string): boolean {
  return imageCache.has(artworkId);
}

/**
 * 获取缓存的图片信息
 */
export function getCachedImage(artworkId: string): ImageCacheEntry | undefined {
  return imageCache.get(artworkId);
}

/**
 * 清理过期缓存
 */
export function cleanupExpiredCache(maxAge: number = 24 * 60 * 60 * 1000): void {
  const now = Date.now();
  for (const [key, entry] of imageCache.entries()) {
    if (now - entry.timestamp > maxAge) {
      imageCache.delete(key);
    }
  }
}

/**
 * 获取图片加载状态
 */
export function getImageLoadStatus(artworkId: string): 'loading' | 'loaded' | 'error' | 'not_started' {
  const cached = imageCache.get(artworkId);
  if (!cached) return 'not_started';
  if (cached.loaded) return 'loaded';
  return 'loading';
}
