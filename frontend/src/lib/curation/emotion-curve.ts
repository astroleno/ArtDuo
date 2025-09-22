// 情绪曲线生成器 - 阶段6的核心功能
import { Artwork, ArtworkScore } from './types';

/**
 * 情绪曲线点
 */
export interface EmotionPoint {
  position: number;    // 位置 (0-1)
  intensity: number;   // 强度 (0-1)
  artworkId?: string;  // 关联的作品ID
}

/**
 * 情绪曲线配置
 */
export interface EmotionCurveConfig {
  emotion: string;
  totalPoints: number;
  curveType: 'linear' | 'wave' | 'peak' | 'valley' | 'custom';
  intensity: number;   // 整体强度 (0-1)
  variation: number;   // 变化幅度 (0-1)
}

/**
 * 情绪曲线生成器
 */
export class EmotionCurveGenerator {
  
  /**
   * 生成情绪曲线
   */
  static generateCurve(
    artworks: Artwork[], 
    scores: ArtworkScore[], 
    emotion: string,
    config?: Partial<EmotionCurveConfig>
  ): EmotionPoint[] {
    console.log(`🎭 开始生成情绪曲线: ${emotion}`);
    console.log(`🎭 输入作品数量: ${artworks.length}`);
    console.log(`🎭 输入评分数量: ${scores.length}`);
    
    // 如果没有作品，返回空曲线
    if (!artworks || artworks.length === 0) {
      console.log('⚠️ 没有作品数据，返回空情绪曲线');
      return [];
    }
    
    const defaultConfig: EmotionCurveConfig = {
      emotion,
      totalPoints: artworks.length,
      curveType: this.detectCurveType(emotion),
      intensity: 0.7,
      variation: 0.3,
      ...config
    };
    
    console.log(`🔧 情绪曲线配置:`, defaultConfig);
    console.log(`🔧 实际作品ID列表:`, artworks.map(a => a.id));

    let curve: EmotionPoint[];
    
    switch (defaultConfig.curveType) {
      case 'linear':
        curve = this.generateLinearCurve(defaultConfig);
        break;
      case 'wave':
        curve = this.generateWaveCurve(defaultConfig);
        break;
      case 'peak':
        curve = this.generatePeakCurve(defaultConfig);
        break;
      case 'valley':
        curve = this.generateValleyCurve(defaultConfig);
        break;
      default:
        curve = this.generateCustomCurve(artworks, scores, defaultConfig);
    }

    // 将作品分配到曲线点
    return this.assignArtworksToCurve(artworks, scores, curve);
  }

  /**
   * 检测情绪类型对应的曲线类型
   */
  private static detectCurveType(emotion: string): EmotionCurveConfig['curveType'] {
    const emotionMap: Record<string, EmotionCurveConfig['curveType']> = {
      'joy': 'wave',
      'happy': 'wave',
      'excited': 'peak',
      'calm': 'linear',
      'peaceful': 'linear',
      'lonely': 'valley',
      'sad': 'valley',
      'melancholy': 'valley',
      'angry': 'peak',
      'frustrated': 'wave',
      'anxious': 'wave',
      'nostalgic': 'wave',
      'hopeful': 'linear',
      'inspired': 'peak'
    };

    return emotionMap[emotion.toLowerCase()] || 'custom';
  }

  /**
   * 生成线性曲线
   */
  private static generateLinearCurve(config: EmotionCurveConfig): EmotionPoint[] {
    const points: EmotionPoint[] = [];
    const baseIntensity = config.intensity;
    
    for (let i = 0; i < config.totalPoints; i++) {
      const position = i / (config.totalPoints - 1);
      const intensity = baseIntensity + (Math.random() - 0.5) * config.variation;
      
      points.push({
        position,
        intensity: Math.max(0, Math.min(1, intensity))
      });
    }
    
    return points;
  }

  /**
   * 生成波浪曲线
   */
  private static generateWaveCurve(config: EmotionCurveConfig): EmotionPoint[] {
    const points: EmotionPoint[] = [];
    const baseIntensity = config.intensity;
    const waveCount = 2; // 2个完整波形
    
    for (let i = 0; i < config.totalPoints; i++) {
      const position = i / (config.totalPoints - 1);
      const wave = Math.sin(position * Math.PI * waveCount);
      const intensity = baseIntensity + wave * config.variation * 0.5;
      
      points.push({
        position,
        intensity: Math.max(0, Math.min(1, intensity))
      });
    }
    
    return points;
  }

  /**
   * 生成峰值曲线
   */
  private static generatePeakCurve(config: EmotionCurveConfig): EmotionPoint[] {
    const points: EmotionPoint[] = [];
    const baseIntensity = config.intensity;
    const peakPosition = 0.6; // 峰值位置
    
    for (let i = 0; i < config.totalPoints; i++) {
      const position = i / (config.totalPoints - 1);
      const distanceFromPeak = Math.abs(position - peakPosition);
      const intensity = baseIntensity + (1 - distanceFromPeak * 2) * config.variation;
      
      points.push({
        position,
        intensity: Math.max(0, Math.min(1, intensity))
      });
    }
    
    return points;
  }

  /**
   * 生成谷值曲线
   */
  private static generateValleyCurve(config: EmotionCurveConfig): EmotionPoint[] {
    const points: EmotionPoint[] = [];
    const baseIntensity = config.intensity;
    const valleyPosition = 0.4; // 谷值位置
    
    for (let i = 0; i < config.totalPoints; i++) {
      const position = i / (config.totalPoints - 1);
      const distanceFromValley = Math.abs(position - valleyPosition);
      const intensity = baseIntensity - (1 - distanceFromValley * 2) * config.variation;
      
      points.push({
        position,
        intensity: Math.max(0, Math.min(1, intensity))
      });
    }
    
    return points;
  }

  /**
   * 生成自定义曲线（基于作品评分）
   */
  private static generateCustomCurve(
    artworks: Artwork[], 
    scores: ArtworkScore[], 
    config: EmotionCurveConfig
  ): EmotionPoint[] {
    const points: EmotionPoint[] = [];
    const scoreMap = new Map(scores.map(score => [score.artworkId, score]));
    
    for (let i = 0; i < artworks.length; i++) {
      const artwork = artworks[i];
      const score = scoreMap.get(artwork.id);
      const position = i / (artworks.length - 1);
      
      // 基于作品的情绪契合度计算强度
      const baseIntensity = score ? score.emotionFit / 10 : config.intensity;
      const variation = (Math.random() - 0.5) * config.variation * 0.5;
      const intensity = Math.max(0, Math.min(1, baseIntensity + variation));
      
      points.push({
        position,
        intensity,
        artworkId: artwork.id
      });
    }
    
    return points;
  }

  /**
   * 将作品分配到曲线点
   */
  private static assignArtworksToCurve(
    artworks: Artwork[], 
    scores: ArtworkScore[], 
    curve: EmotionPoint[]
  ): EmotionPoint[] {
    const scoreMap = new Map(scores.map(score => [score.artworkId, score]));
    
    // 按评分排序作品
    const sortedArtworks = [...artworks].sort((a, b) => {
      const scoreA = scoreMap.get(a.id);
      const scoreB = scoreMap.get(b.id);
      
      if (!scoreA || !scoreB) return 0;
      return scoreB.emotionFit - scoreA.emotionFit;
    });

    // 将高分作品分配到高强度的曲线点
    const sortedCurve = [...curve].sort((a, b) => b.intensity - a.intensity);
    
    for (let i = 0; i < Math.min(sortedArtworks.length, sortedCurve.length); i++) {
      const artwork = sortedArtworks[i];
      const curvePoint = sortedCurve[i];
      
      // 找到对应的原始曲线点并分配作品
      const originalPoint = curve.find(point => 
        Math.abs(point.position - curvePoint.position) < 0.01
      );
      
      if (originalPoint) {
        originalPoint.artworkId = artwork.id;
      }
    }
    
    return curve;
  }

  /**
   * 优化情绪曲线
   */
  static optimizeCurve(curve: EmotionPoint[]): EmotionPoint[] {
    // 平滑处理
    const smoothed = this.smoothCurve(curve);
    
    // 确保情绪过渡自然
    return this.ensureSmoothTransitions(smoothed);
  }

  /**
   * 平滑曲线
   */
  private static smoothCurve(curve: EmotionPoint[]): EmotionPoint[] {
    if (curve.length < 3) return curve;
    
    const smoothed: EmotionPoint[] = [];
    
    for (let i = 0; i < curve.length; i++) {
      const prev = curve[i - 1];
      const current = curve[i];
      const next = curve[i + 1];
      
      let smoothedIntensity = current.intensity;
      
      if (prev && next) {
        // 三点平滑
        smoothedIntensity = (prev.intensity + current.intensity + next.intensity) / 3;
      } else if (prev) {
        // 两点平滑
        smoothedIntensity = (prev.intensity + current.intensity) / 2;
      } else if (next) {
        // 两点平滑
        smoothedIntensity = (current.intensity + next.intensity) / 2;
      }
      
      smoothed.push({
        ...current,
        intensity: smoothedIntensity
      });
    }
    
    return smoothed;
  }

  /**
   * 确保情绪过渡自然
   */
  private static ensureSmoothTransitions(curve: EmotionPoint[]): EmotionPoint[] {
    const maxChange = 0.3; // 最大变化幅度
    
    for (let i = 1; i < curve.length; i++) {
      const prev = curve[i - 1];
      const current = curve[i];
      
      const change = current.intensity - prev.intensity;
      
      if (Math.abs(change) > maxChange) {
        const sign = change > 0 ? 1 : -1;
        current.intensity = prev.intensity + sign * maxChange;
      }
    }
    
    return curve;
  }

  /**
   * 生成情绪曲线描述
   */
  static generateCurveDescription(curve: EmotionPoint[], emotion: string): string {
    const avgIntensity = curve.reduce((sum, point) => sum + point.intensity, 0) / curve.length;
    const maxIntensity = Math.max(...curve.map(point => point.intensity));
    const minIntensity = Math.min(...curve.map(point => point.intensity));
    
    const variation = maxIntensity - minIntensity;
    
    let description = `这个"${emotion}"情绪曲线展现了情感的动态变化：`;
    
    if (variation < 0.2) {
      description += `整体保持稳定的情绪强度，平均强度为${(avgIntensity * 100).toFixed(0)}%，营造出持续而深刻的情绪体验。`;
    } else if (variation < 0.4) {
      description += `情绪强度有适度的起伏变化，从${(minIntensity * 100).toFixed(0)}%到${(maxIntensity * 100).toFixed(0)}%，创造出丰富的情绪层次。`;
    } else {
      description += `情绪强度有显著的变化，从${(minIntensity * 100).toFixed(0)}%到${(maxIntensity * 100).toFixed(0)}%，形成强烈的情绪对比和戏剧性效果。`;
    }
    
    return description;
  }
}
