/**
 * 图片服务 - 独立处理图片URL映射和加载
 * 与向量检索分离，提高性能和可维护性
 */

import fs from 'fs';
import path from 'path';

export interface ImageData {
  id: string;
  primary: string | null;
  alternatives: string[];
  thumbnail: string | null;
  additionalImages: string[];
}

export interface ImageServiceConfig {
  imagesDataPath: string;
  maxRetries: number;
  retryDelay: number;
}

export class ImageService {
  private imagesData: Map<string, ImageData> = new Map();
  private isInitialized = false;
  private config: ImageServiceConfig;

  constructor(config?: Partial<ImageServiceConfig>) {
    this.config = {
      imagesDataPath: path.join(process.cwd(), 'public', 'data', 'artworks-images.json'),
      maxRetries: 5,
      retryDelay: 1000,
      ...config
    };
  }

  /**
   * 初始化图片服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🖼️ 初始化图片服务...');
      await this.loadImageData();
      this.isInitialized = true;
      console.log(`✅ 图片服务初始化完成，加载了${this.imagesData.size}个图片映射`);
    } catch (error) {
      console.error('❌ 图片服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 加载图片映射数据
   */
  private async loadImageData(): Promise<void> {
    try {
      const fileContent = fs.readFileSync(this.config.imagesDataPath, 'utf-8');
      const imagesData: ImageData[] = JSON.parse(fileContent);
      
      // 构建ID到图片数据的映射
      this.imagesData = new Map();
      imagesData.forEach(imageData => {
        this.imagesData.set(imageData.id, imageData);
      });
      
      console.log(`📚 成功加载 ${imagesData.length} 个图片映射`);
    } catch (error) {
      console.error('❌ 加载图片数据失败:', error);
      throw new Error('无法加载图片映射数据，请检查数据文件');
    }
  }

  /**
   * 获取作品的图片URL
   */
  getImageUrl(artworkId: string): string | null {
    if (!this.isInitialized) {
      console.warn('⚠️ 图片服务未初始化');
      return null;
    }

    const imageData = this.imagesData.get(artworkId);
    if (!imageData) {
      console.warn(`⚠️ 未找到作品 ${artworkId} 的图片数据`);
      return null;
    }

    // 优先返回主要URL
    if (imageData.primary) {
      return imageData.primary;
    }

    // 如果没有主要URL，返回第一个备用URL
    if (imageData.alternatives.length > 0) {
      return imageData.alternatives[0];
    }

    return null;
  }

  /**
   * 获取作品的所有图片URL（包括备用URL）
   */
  getAllImageUrls(artworkId: string): string[] {
    if (!this.isInitialized) {
      return [];
    }

    const imageData = this.imagesData.get(artworkId);
    if (!imageData) {
      return [];
    }

    const urls: string[] = [];
    if (imageData.primary) {
      urls.push(imageData.primary);
    }
    urls.push(...imageData.alternatives);
    return urls;
  }

  /**
   * 获取作品的缩略图URL
   */
  getThumbnailUrl(artworkId: string): string | null {
    if (!this.isInitialized) {
      return null;
    }

    const imageData = this.imagesData.get(artworkId);
    return imageData?.thumbnail || null;
  }

  /**
   * 获取作品的额外图片URL
   */
  getAdditionalImages(artworkId: string): string[] {
    if (!this.isInitialized) {
      return [];
    }

    const imageData = this.imagesData.get(artworkId);
    return imageData?.additionalImages || [];
  }

  /**
   * 获取完整的图片数据
   */
  getImageData(artworkId: string): ImageData | null {
    if (!this.isInitialized) {
      return null;
    }

    return this.imagesData.get(artworkId) || null;
  }

  /**
   * 检查作品是否有图片数据
   */
  hasImageData(artworkId: string): boolean {
    if (!this.isInitialized) {
      return false;
    }

    return this.imagesData.has(artworkId);
  }

  /**
   * 获取图片统计信息
   */
  getStats(): {
    total: number;
    withPrimary: number;
    withThumbnail: number;
    withAdditional: number;
  } {
    if (!this.isInitialized) {
      return { total: 0, withPrimary: 0, withThumbnail: 0, withAdditional: 0 };
    }

    let withPrimary = 0;
    let withThumbnail = 0;
    let withAdditional = 0;

    this.imagesData.forEach(imageData => {
      if (imageData.primary) withPrimary++;
      if (imageData.thumbnail) withThumbnail++;
      if (imageData.additionalImages.length > 0) withAdditional++;
    });

    return {
      total: this.imagesData.size,
      withPrimary,
      withThumbnail,
      withAdditional
    };
  }
}

// 单例实例
let imageServiceInstance: ImageService | null = null;

/**
 * 获取图片服务实例
 */
export function getImageService(): ImageService {
  if (!imageServiceInstance) {
    imageServiceInstance = new ImageService();
  }
  return imageServiceInstance;
}

/**
 * 初始化图片服务
 */
export async function initializeImageService(): Promise<ImageService> {
  const service = getImageService();
  await service.initialize();
  return service;
}






