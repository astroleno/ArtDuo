/**
 * 数据质量权重管理
 * 负责计算和管理作品数据质量权重
 */

// 数据质量等级配置
export const QUALITY_LEVELS = {
  excellent: {
    description: '完整信息',
    criteria: ['hasDescription', 'hasTags', 'hasArtist', 'hasMedium', 'hasCulture'],
    weight: 1.0,
    color: '#10B981' // 绿色
  },
  good: {
    description: '基础信息完整',
    criteria: ['hasTitle', 'hasArtist', 'hasMedium'],
    weight: 0.9,
    color: '#3B82F6' // 蓝色
  },
  basic: {
    description: '仅基础信息',
    criteria: ['hasTitle', 'hasArtist'],
    weight: 0.7,
    color: '#F59E0B' // 橙色
  },
  minimal: {
    description: '仅标题',
    criteria: ['hasTitle'],
    weight: 0.5,
    color: '#EF4444' // 红色
  }
} as const;

export type QualityLevel = keyof typeof QUALITY_LEVELS;

/**
 * 数据质量权重计算器
 */
export class DataQualityWeightCalculator {
  /**
   * 计算作品数据质量权重
   */
  static calculateWeight(artwork: any): number {
    if (!artwork) return 0.5;
    
    // 如果已有质量权重，直接使用
    if (artwork.dataQuality?.weight !== undefined) {
      return artwork.dataQuality.weight;
    }
    
    // 计算字段完整性
    const hasDescription = !!(artwork.description && artwork.description.trim().length > 50);
    const hasTags = !!(artwork.tags && artwork.tags.length > 0);
    const hasArtist = !!(artwork.artist && artwork.artist.trim().length > 0);
    const hasMedium = !!(artwork.medium && artwork.medium.trim().length > 0);
    const hasCulture = !!(artwork.culture && artwork.culture.trim().length > 0);
    const hasTitle = !!(artwork.title && artwork.title.trim().length > 0);
    
    // 根据完整性确定质量等级
    if (hasDescription && hasTags && hasArtist && hasMedium && hasCulture) {
      return QUALITY_LEVELS.excellent.weight;
    } else if (hasArtist && hasMedium && hasTitle) {
      return QUALITY_LEVELS.good.weight;
    } else if (hasArtist && hasTitle) {
      return QUALITY_LEVELS.basic.weight;
    } else if (hasTitle) {
      return QUALITY_LEVELS.minimal.weight;
    } else {
      return 0.3; // 最低权重
    }
  }

  /**
   * 确定作品质量等级
   */
  static determineQualityLevel(artwork: any): QualityLevel {
    if (!artwork) return 'minimal';
    
    // 如果已有质量等级，直接使用
    if (artwork.dataQuality?.level) {
      return artwork.dataQuality.level as QualityLevel;
    }
    
    const hasDescription = !!(artwork.description && artwork.description.trim().length > 50);
    const hasTags = !!(artwork.tags && artwork.tags.length > 0);
    const hasArtist = !!(artwork.artist && artwork.artist.trim().length > 0);
    const hasMedium = !!(artwork.medium && artwork.medium.trim().length > 0);
    const hasCulture = !!(artwork.culture && artwork.culture.trim().length > 0);
    const hasTitle = !!(artwork.title && artwork.title.trim().length > 0);
    
    if (hasDescription && hasTags && hasArtist && hasMedium && hasCulture) {
      return 'excellent';
    } else if (hasArtist && hasMedium && hasTitle) {
      return 'good';
    } else if (hasArtist && hasTitle) {
      return 'basic';
    } else if (hasTitle) {
      return 'minimal';
    } else {
      return 'minimal';
    }
  }

  /**
   * 计算加权相似度
   */
  static calculateWeightedSimilarity(similarity: number, artwork: any): number {
    const weight = this.calculateWeight(artwork);
    return similarity * weight;
  }

  /**
   * 批量计算权重
   */
  static calculateBatchWeights(artworks: any[]): Array<{ id: string, weight: number, level: QualityLevel }> {
    return artworks.map(artwork => ({
      id: artwork.id,
      weight: this.calculateWeight(artwork),
      level: this.determineQualityLevel(artwork)
    }));
  }

  /**
   * 获取质量等级统计
   */
  static getQualityStats(artworks: any[]): {
    total: number,
    excellent: number,
    good: number,
    basic: number,
    minimal: number,
    averageWeight: number
  } {
    const stats = {
      total: artworks.length,
      excellent: 0,
      good: 0,
      basic: 0,
      minimal: 0,
      averageWeight: 0
    };

    let totalWeight = 0;

    artworks.forEach(artwork => {
      const level = this.determineQualityLevel(artwork);
      const weight = this.calculateWeight(artwork);
      
      stats[level]++;
      totalWeight += weight;
    });

    stats.averageWeight = stats.total > 0 ? totalWeight / stats.total : 0;

    return stats;
  }
}

/**
 * 数据质量过滤器
 */
export class DataQualityFilter {
  /**
   * 按质量等级过滤
   */
  static filterByQualityLevel(artworks: any[], levels: QualityLevel[]): any[] {
    return artworks.filter(artwork => {
      const level = DataQualityWeightCalculator.determineQualityLevel(artwork);
      return levels.includes(level);
    });
  }

  /**
   * 按权重阈值过滤
   */
  static filterByWeightThreshold(artworks: any[], minWeight: number): any[] {
    return artworks.filter(artwork => {
      const weight = DataQualityWeightCalculator.calculateWeight(artwork);
      return weight >= minWeight;
    });
  }

  /**
   * 按字段完整性过滤
   */
  static filterByFieldCompleteness(artwork: any, requiredFields: string[]): boolean {
    const fieldChecks = {
      hasDescription: !!(artwork.description && artwork.description.trim().length > 50),
      hasTags: !!(artwork.tags && artwork.tags.length > 0),
      hasArtist: !!(artwork.artist && artwork.artist.trim().length > 0),
      hasMedium: !!(artwork.medium && artwork.medium.trim().length > 0),
      hasCulture: !!(artwork.culture && artwork.culture.trim().length > 0),
      hasTitle: !!(artwork.title && artwork.title.trim().length > 0)
    };

    return requiredFields.every(field => fieldChecks[field as keyof typeof fieldChecks]);
  }
}

/**
 * 数据质量排序器
 */
export class DataQualitySorter {
  /**
   * 按质量权重排序
   */
  static sortByWeight(artworks: any[], ascending: boolean = false): any[] {
    return artworks.sort((a, b) => {
      const weightA = DataQualityWeightCalculator.calculateWeight(a);
      const weightB = DataQualityWeightCalculator.calculateWeight(b);
      
      return ascending ? weightA - weightB : weightB - weightA;
    });
  }

  /**
   * 按加权相似度排序
   */
  static sortByWeightedSimilarity(results: Array<{ similarity: number, artwork: any }>): any[] {
    return results.sort((a, b) => {
      const weightedA = DataQualityWeightCalculator.calculateWeightedSimilarity(a.similarity, a.artwork);
      const weightedB = DataQualityWeightCalculator.calculateWeightedSimilarity(b.similarity, b.artwork);
      
      return weightedB - weightedA;
    });
  }

  /**
   * 混合排序：质量权重 + 相似度
   */
  static hybridSort(results: Array<{ similarity: number, artwork: any }>, qualityWeight: number = 0.3): any[] {
    return results.sort((a, b) => {
      const weightA = DataQualityWeightCalculator.calculateWeight(a.artwork);
      const weightB = DataQualityWeightCalculator.calculateWeight(b.artwork);
      
      const scoreA = a.similarity * (1 - qualityWeight) + weightA * qualityWeight;
      const scoreB = b.similarity * (1 - qualityWeight) + weightB * qualityWeight;
      
      return scoreB - scoreA;
    });
  }
}

/**
 * 数据质量报告生成器
 */
export class DataQualityReporter {
  /**
   * 生成质量报告
   */
  static generateReport(artworks: any[]): {
    summary: any,
    distribution: any,
    recommendations: string[]
  } {
    const stats = DataQualityWeightCalculator.getQualityStats(artworks);
    
    const summary = {
      total: stats.total,
      averageWeight: Math.round(stats.averageWeight * 100) / 100,
      qualityScore: Math.round((stats.excellent + stats.good) / stats.total * 100)
    };

    const distribution = {
      excellent: { count: stats.excellent, percentage: Math.round(stats.excellent / stats.total * 100) },
      good: { count: stats.good, percentage: Math.round(stats.good / stats.total * 100) },
      basic: { count: stats.basic, percentage: Math.round(stats.basic / stats.total * 100) },
      minimal: { count: stats.minimal, percentage: Math.round(stats.minimal / stats.total * 100) }
    };

    const recommendations = [];
    
    if (stats.minimal > stats.total * 0.1) {
      recommendations.push('建议清理或补全minimal级别的作品数据');
    }
    
    if (stats.excellent < stats.total * 0.2) {
      recommendations.push('建议提升数据质量，增加excellent级别的作品');
    }
    
    if (stats.averageWeight < 0.8) {
      recommendations.push('建议优化数据质量权重计算策略');
    }

    return { summary, distribution, recommendations };
  }
}

// 导出工具函数
export const dataQualityUtils = {
  calculateWeight: DataQualityWeightCalculator.calculateWeight,
  determineQualityLevel: DataQualityWeightCalculator.determineQualityLevel,
  calculateWeightedSimilarity: DataQualityWeightCalculator.calculateWeightedSimilarity,
  filterByQualityLevel: DataQualityFilter.filterByQualityLevel,
  filterByWeightThreshold: DataQualityFilter.filterByWeightThreshold,
  sortByWeight: DataQualitySorter.sortByWeight,
  sortByWeightedSimilarity: DataQualitySorter.sortByWeightedSimilarity,
  hybridSort: DataQualitySorter.hybridSort,
  generateReport: DataQualityReporter.generateReport
};
