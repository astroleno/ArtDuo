// 智能作品选择器 - 阶段6的核心功能
import { Artwork, ArtworkScore, EmotionPoint } from './types';
import { calculateOverallScore } from './llm-judge';

/**
 * 选择配置
 */
export interface SelectionConfig {
  targetCount: number;        // 目标作品数量
  diversityWeight: number;    // 多样性权重 (0-1)
  qualityWeight: number;      // 质量权重 (0-1)
  emotionWeight: number;      // 情绪契合度权重 (0-1)
  minScore: number;          // 最低评分要求 (0-10)
  maxSameArtist: number;     // 同一艺术家最大作品数
  maxSamePeriod: number;     // 同一时期最大作品数
  maxSameMedium: number;     // 同一材质最大作品数
}

/**
 * 选择结果
 */
export interface SelectionResult {
  selectedArtworks: Artwork[];
  selectedScores: ArtworkScore[];
  selectionReasoning: string;
  diversityMetrics: {
    artistCount: number;
    periodCount: number;
    mediumCount: number;
    avgScore: number;
    emotionFit: number;
  };
}

/**
 * 智能作品选择器
 */
export class ArtworkSelector {
  
  /**
   * 选择最佳作品组合
   */
  static selectBestArtworks(
    artworks: Artwork[],
    scores: ArtworkScore[],
    emotionCurve: EmotionPoint[],
    config?: Partial<SelectionConfig>
  ): SelectionResult {
    console.log(`🎯 开始智能作品选择: ${artworks.length} 件候选作品`);
    
    const defaultConfig: SelectionConfig = {
      targetCount: 9,
      diversityWeight: 0.3,
      qualityWeight: 0.4,
      emotionWeight: 0.3,
      minScore: 5.0,  // 降低最低评分要求，从6.0降到5.0
      maxSameArtist: 3,  // 增加同一艺术家最大作品数
      maxSamePeriod: 4,  // 增加同一时期最大作品数
      maxSameMedium: 4,  // 增加同一材质最大作品数
      ...config
    };

    // 过滤低分作品
    const qualifiedArtworks = this.filterQualifiedArtworks(artworks, scores, defaultConfig);
    console.log(`📊 符合条件作品: ${qualifiedArtworks.length} 件`);

    if (qualifiedArtworks.length <= defaultConfig.targetCount) {
      // 如果符合条件的作品数量不足，直接返回所有作品
      const selectedScores = scores.filter(score => 
        qualifiedArtworks.some(artwork => artwork.id === score.artworkId)
      );
      
      return {
        selectedArtworks: qualifiedArtworks,
        selectedScores,
        selectionReasoning: '符合条件作品数量不足，返回所有作品',
        diversityMetrics: this.calculateDiversityMetrics(qualifiedArtworks, selectedScores)
      };
    }

    // 使用多种策略选择作品
    const strategies = [
      () => this.selectByScore(qualifiedArtworks, scores, defaultConfig),
      () => this.selectByDiversity(qualifiedArtworks, scores, defaultConfig),
      () => this.selectByEmotionCurve(qualifiedArtworks, scores, emotionCurve, defaultConfig),
      () => this.selectByBalanced(qualifiedArtworks, scores, emotionCurve, defaultConfig)
    ];

    let bestResult: SelectionResult | null = null;
    let bestScore = -1;

    // 尝试不同策略，选择最佳结果
    for (const strategy of strategies) {
      try {
        const result = strategy();
        const score = this.evaluateSelection(result, defaultConfig);
        
        if (score > bestScore) {
          bestScore = score;
          bestResult = result;
        }
      } catch (error) {
        console.warn('选择策略失败:', error);
      }
    }

    if (!bestResult) {
      throw new Error('所有选择策略都失败了');
    }

    console.log(`✅ 作品选择完成: ${bestResult.selectedArtworks.length} 件作品，评分: ${bestScore.toFixed(2)}`);
    return bestResult;
  }

  /**
   * 过滤符合条件的作品
   */
  private static filterQualifiedArtworks(
    artworks: Artwork[],
    scores: ArtworkScore[],
    config: SelectionConfig
  ): Artwork[] {
    const scoreMap = new Map(scores.map(score => [score.artworkId, score]));
    
    return artworks.filter(artwork => {
      const score = scoreMap.get(artwork.id);
      if (!score) return false;
      
      const overallScore = calculateOverallScore(score);
      return overallScore >= config.minScore;
    });
  }

  /**
   * 按评分选择
   */
  private static selectByScore(
    artworks: Artwork[],
    scores: ArtworkScore[],
    config: SelectionConfig
  ): SelectionResult {
    const scoreMap = new Map(scores.map(score => [score.artworkId, score]));
    
    const sortedArtworks = [...artworks].sort((a, b) => {
      const scoreA = scoreMap.get(a.id);
      const scoreB = scoreMap.get(b.id);
      
      if (!scoreA || !scoreB) return 0;
      
      const overallA = calculateOverallScore(scoreA);
      const overallB = calculateOverallScore(scoreB);
      
      return overallB - overallA;
    });

    const selectedArtworks = sortedArtworks.slice(0, config.targetCount);
    const selectedScores = selectedArtworks.map(artwork => 
      scoreMap.get(artwork.id)!
    );

    return {
      selectedArtworks,
      selectedScores,
      selectionReasoning: '基于综合评分选择最高分作品',
      diversityMetrics: this.calculateDiversityMetrics(selectedArtworks, selectedScores)
    };
  }

  /**
   * 按多样性选择
   */
  private static selectByDiversity(
    artworks: Artwork[],
    scores: ArtworkScore[],
    config: SelectionConfig
  ): SelectionResult {
    const scoreMap = new Map(scores.map(score => [score.artworkId, score]));
    const selected: Artwork[] = [];
    const artistCount = new Map<string, number>();
    const periodCount = new Map<string, number>();
    const mediumCount = new Map<string, number>();

    // 按评分排序
    const sortedArtworks = [...artworks].sort((a, b) => {
      const scoreA = scoreMap.get(a.id);
      const scoreB = scoreMap.get(b.id);
      
      if (!scoreA || !scoreB) return 0;
      
      const overallA = calculateOverallScore(scoreA);
      const overallB = calculateOverallScore(scoreB);
      
      return overallB - overallA;
    });

    for (const artwork of sortedArtworks) {
      if (selected.length >= config.targetCount) break;

      const artist = artwork.artist;
      const period = this.extractPeriod(artwork.year);
      const medium = artwork.medium;

      // 检查多样性限制
      const currentArtistCount = artistCount.get(artist) || 0;
      const currentPeriodCount = periodCount.get(period) || 0;
      const currentMediumCount = mediumCount.get(medium) || 0;

      if (currentArtistCount < config.maxSameArtist &&
          currentPeriodCount < config.maxSamePeriod &&
          currentMediumCount < config.maxSameMedium) {
        
        selected.push(artwork);
        artistCount.set(artist, currentArtistCount + 1);
        periodCount.set(period, currentPeriodCount + 1);
        mediumCount.set(medium, currentMediumCount + 1);
      }
    }

    const selectedScores = selected.map(artwork => scoreMap.get(artwork.id)!);

    return {
      selectedArtworks: selected,
      selectedScores,
      selectionReasoning: '基于多样性原则选择作品，确保风格、时期、材质的平衡',
      diversityMetrics: this.calculateDiversityMetrics(selected, selectedScores)
    };
  }

  /**
   * 按情绪曲线选择
   */
  private static selectByEmotionCurve(
    artworks: Artwork[],
    scores: ArtworkScore[],
    emotionCurve: EmotionPoint[],
    config: SelectionConfig
  ): SelectionResult {
    const scoreMap = new Map(scores.map(score => [score.artworkId, score]));
    const selected: Artwork[] = [];
    
    // 按情绪契合度排序
    const sortedArtworks = [...artworks].sort((a, b) => {
      const scoreA = scoreMap.get(a.id);
      const scoreB = scoreMap.get(b.id);
      
      if (!scoreA || !scoreB) return 0;
      
      return scoreB.emotionFit - scoreA.emotionFit;
    });

    // 从情绪曲线中选择高强度点对应的作品
    const highIntensityPoints = emotionCurve
      .filter(point => point.intensity > 0.7)
      .sort((a, b) => b.intensity - a.intensity);

    for (const point of highIntensityPoints) {
      if (selected.length >= config.targetCount) break;
      
      if (point.artworkId) {
        const artwork = sortedArtworks.find(a => a.id === point.artworkId);
        if (artwork && !selected.includes(artwork)) {
          selected.push(artwork);
        }
      }
    }

    // 如果还不够，补充高分作品
    for (const artwork of sortedArtworks) {
      if (selected.length >= config.targetCount) break;
      
      if (!selected.includes(artwork)) {
        selected.push(artwork);
      }
    }

    const selectedScores = selected.map(artwork => scoreMap.get(artwork.id)!);

    return {
      selectedArtworks: selected,
      selectedScores,
      selectionReasoning: '基于情绪曲线选择最能体现情绪强度的作品',
      diversityMetrics: this.calculateDiversityMetrics(selected, selectedScores)
    };
  }

  /**
   * 平衡选择策略
   */
  private static selectByBalanced(
    artworks: Artwork[],
    scores: ArtworkScore[],
    emotionCurve: EmotionPoint[],
    config: SelectionConfig
  ): SelectionResult {
    const scoreMap = new Map(scores.map(score => [score.artworkId, score]));
    const selected: Artwork[] = [];
    const artistCount = new Map<string, number>();
    const periodCount = new Map<string, number>();
    const mediumCount = new Map<string, number>();

    // 计算每个作品的综合得分
    const artworkScores = artworks.map(artwork => {
      const score = scoreMap.get(artwork.id)!;
      const overallScore = calculateOverallScore(score);
      
      // 多样性奖励
      const artist = artwork.artist;
      const period = this.extractPeriod(artwork.year);
      const medium = artwork.medium;
      
      const artistBonus = (artistCount.get(artist) || 0) === 0 ? 0.5 : 0;
      const periodBonus = (periodCount.get(period) || 0) === 0 ? 0.3 : 0;
      const mediumBonus = (mediumCount.get(medium) || 0) === 0 ? 0.2 : 0;
      
      const diversityBonus = artistBonus + periodBonus + mediumBonus;
      const finalScore = overallScore + diversityBonus;
      
      return { artwork, score, finalScore };
    });

    // 按综合得分排序
    artworkScores.sort((a, b) => b.finalScore - a.finalScore);

    // 选择作品
    for (const { artwork, score } of artworkScores) {
      if (selected.length >= config.targetCount) break;

      const artist = artwork.artist;
      const period = this.extractPeriod(artwork.year);
      const medium = artwork.medium;

      const currentArtistCount = artistCount.get(artist) || 0;
      const currentPeriodCount = periodCount.get(period) || 0;
      const currentMediumCount = mediumCount.get(medium) || 0;

      if (currentArtistCount < config.maxSameArtist &&
          currentPeriodCount < config.maxSamePeriod &&
          currentMediumCount < config.maxSameMedium) {
        
        selected.push(artwork);
        artistCount.set(artist, currentArtistCount + 1);
        periodCount.set(period, currentPeriodCount + 1);
        mediumCount.set(medium, currentMediumCount + 1);
      }
    }

    const selectedScores = selected.map(artwork => scoreMap.get(artwork.id)!);

    return {
      selectedArtworks: selected,
      selectedScores,
      selectionReasoning: '平衡质量、多样性和情绪契合度的综合选择策略',
      diversityMetrics: this.calculateDiversityMetrics(selected, selectedScores)
    };
  }

  /**
   * 提取时期信息
   */
  private static extractPeriod(year: string): string {
    const yearNum = parseInt(year.replace(/\D/g, ''));
    
    if (yearNum < 1400) return '古代';
    if (yearNum < 1600) return '文艺复兴';
    if (yearNum < 1800) return '巴洛克/洛可可';
    if (yearNum < 1900) return '19世纪';
    if (yearNum < 1950) return '现代早期';
    if (yearNum < 2000) return '现代';
    return '当代';
  }

  /**
   * 计算多样性指标
   */
  private static calculateDiversityMetrics(
    artworks: Artwork[],
    scores: ArtworkScore[]
  ) {
    const artists = new Set(artworks.map(a => a.artist));
    const periods = new Set(artworks.map(a => this.extractPeriod(a.year)));
    const mediums = new Set(artworks.map(a => a.medium));
    
    const avgScore = scores.reduce((sum, score) => sum + calculateOverallScore(score), 0) / scores.length;
    const avgEmotionFit = scores.reduce((sum, score) => sum + score.emotionFit, 0) / scores.length;

    return {
      artistCount: artists.size,
      periodCount: periods.size,
      mediumCount: mediums.size,
      avgScore,
      emotionFit: avgEmotionFit
    };
  }

  /**
   * 评估选择结果
   */
  private static evaluateSelection(result: SelectionResult, config: SelectionConfig): number {
    const { diversityMetrics, selectedScores } = result;
    
    // 质量得分
    const qualityScore = diversityMetrics.avgScore / 10;
    
    // 多样性得分
    const diversityScore = (
      diversityMetrics.artistCount / config.targetCount +
      diversityMetrics.periodCount / config.targetCount +
      diversityMetrics.mediumCount / config.targetCount
    ) / 3;
    
    // 情绪契合度得分
    const emotionScore = diversityMetrics.emotionFit / 10;
    
    // 综合得分
    return (
      qualityScore * config.qualityWeight +
      diversityScore * config.diversityWeight +
      emotionScore * config.emotionWeight
    );
  }
}
