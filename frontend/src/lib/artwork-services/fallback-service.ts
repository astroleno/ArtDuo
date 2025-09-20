// 降级服务组件 - 本地mock数据
import { Artwork, ArtworkService, ArtworkServiceResponse, CurationInfo } from './types';

export class FallbackService implements ArtworkService {
  private serviceName = 'Fallback';
  
  // 本地mock艺术作品数据
  private mockArtworks: Artwork[] = [
    {
      id: '1',
      title: '星夜',
      artist: '文森特·梵高',
      year: '1889',
      medium: '布面油画',
      dimensions: '73.7 × 92.1 cm',
      imageUrl: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop&auto=format&q=80',
      description: '这幅画描绘了一个充满动感的夜空，展现了艺术家内心的情感波动。',
      museum: '纽约现代艺术博物馆',
      license: 'CC0',
    },
    {
      id: '2',
      title: '蒙娜丽莎',
      artist: '列奥纳多·达·芬奇',
      year: '1503-1519',
      medium: '木板油画',
      dimensions: '77 × 53 cm',
      imageUrl: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&h=600&fit=crop&auto=format&q=80',
      description: '世界上最著名的肖像画之一，以其神秘的微笑而闻名。',
      museum: '卢浮宫',
      license: 'CC0',
    },
    {
      id: '3',
      title: '呐喊',
      artist: '爱德华·蒙克',
      year: '1893',
      medium: '纸板蛋彩画',
      dimensions: '91 × 73.5 cm',
      imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop&auto=format&q=80',
      description: '表现主义代表作，表达了现代人的焦虑和孤独。',
      museum: '挪威国家美术馆',
      license: 'CC0',
    },
    {
      id: '4',
      title: '向日葵',
      artist: '文森特·梵高',
      year: '1888',
      medium: '布面油画',
      dimensions: '92 × 73 cm',
      imageUrl: 'https://images.unsplash.com/photo-1594736797933-d0401ba2fe65?w=800&h=600&fit=crop&auto=format&q=80',
      description: '梵高最著名的静物画之一，展现了生命的活力和希望。',
      museum: '伦敦国家美术馆',
      license: 'CC0',
    },
    {
      id: '5',
      title: '格尔尼卡',
      artist: '巴勃罗·毕加索',
      year: '1937',
      medium: '布面油画',
      dimensions: '349.3 × 776.6 cm',
      imageUrl: 'https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&h=600&fit=crop&auto=format&q=80',
      description: '反战主题的杰作，表达了艺术家对战争的愤怒和悲痛。',
      museum: '索菲亚王后国家艺术中心',
      license: 'CC0',
    },
    {
      id: '6',
      title: '睡莲',
      artist: '克劳德·莫奈',
      year: '1919',
      medium: '布面油画',
      dimensions: '100 × 200 cm',
      imageUrl: 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=800&h=600&fit=crop&auto=format&q=80',
      description: '印象派大师的晚期作品，展现了光影变化的魅力。',
      museum: '橘园美术馆',
      license: 'CC0',
    },
    {
      id: '7',
      title: '最后的晚餐',
      artist: '列奥纳多·达·芬奇',
      year: '1495-1498',
      medium: '壁画',
      dimensions: '460 × 880 cm',
      imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop&auto=format&q=80',
      description: '文艺复兴时期的杰作，描绘了耶稣与门徒的最后晚餐。',
      museum: '圣玛丽亚感恩教堂',
      license: 'CC0',
    },
    {
      id: '8',
      title: '创世纪',
      artist: '米开朗基罗',
      year: '1508-1512',
      medium: '壁画',
      dimensions: '14 × 40 m',
      imageUrl: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&h=600&fit=crop&auto=format&q=80',
      description: '西斯廷教堂的天顶画，展现了上帝创造亚当的经典场景。',
      museum: '梵蒂冈西斯廷教堂',
      license: 'CC0',
    },
    {
      id: '9',
      title: '夜巡',
      artist: '伦勃朗',
      year: '1642',
      medium: '布面油画',
      dimensions: '363 × 437 cm',
      imageUrl: 'https://images.unsplash.com/photo-1594736797933-d0401ba2fe65?w=800&h=600&fit=crop&auto=format&q=80',
      description: '荷兰黄金时代的杰作，展现了光影大师的精湛技艺。',
      museum: '阿姆斯特丹国家博物馆',
      license: 'CC0',
    }
  ];

  async isAvailable(): Promise<boolean> {
    // 降级服务总是可用的
    return true;
  }

  async searchArtworks(emotion: string, userInput?: string, llmAnalysis?: any): Promise<ArtworkServiceResponse> {
    console.log('🎨 降级服务 - 使用本地mock数据:', emotion, userInput);
    
    // 根据情绪选择作品
    const selectedArtworks = this.selectArtworksByEmotion(emotion, this.mockArtworks);
    
    return {
      success: true,
      artworks: selectedArtworks,
      curation: {
        theme: emotion,
        description: `这是一个精心策划的艺术展览，展现了"${emotion}"这一主题的艺术表达。由于网络服务暂时不可用，我们为您展示了精选的经典作品。`,
        emotionCurve: this.generateEmotionCurve(emotion, selectedArtworks),
        totalWorks: selectedArtworks.length
      },
      source: 'fallback'
    };
  }

  private selectArtworksByEmotion(emotion: string, artworks: Artwork[]): Artwork[] {
    const emotionKeywords = {
      '孤独': ['呐喊', '星夜', '夜巡'],
      '平静': ['睡莲', '蒙娜丽莎', '向日葵'],
      '激动': ['格尔尼卡', '创世纪', '最后的晚餐'],
      '忧郁': ['呐喊', '星夜', '夜巡'],
      '喜悦': ['向日葵', '睡莲', '蒙娜丽莎'],
      '沉思': ['蒙娜丽莎', '最后的晚餐', '创世纪'],
      'lonely': ['呐喊', '星夜', '夜巡'],
      'calm': ['睡莲', '蒙娜丽莎', '向日葵'],
      'excited': ['格尔尼卡', '创世纪', '最后的晚餐'],
      'melancholy': ['呐喊', '星夜', '夜巡'],
      'joy': ['向日葵', '睡莲', '蒙娜丽莎'],
      'contemplative': ['蒙娜丽莎', '最后的晚餐', '创世纪']
    };

    const keywords = emotionKeywords[emotion as keyof typeof emotionKeywords] || [];
    
    // 优先选择匹配关键词的作品，然后随机选择其他作品
    const selected: Artwork[] = [];
    const used = new Set<string>();

    // 先选择匹配关键词的作品
    for (const keyword of keywords) {
      const artwork = artworks.find(a => a.title.includes(keyword) && !used.has(a.id));
      if (artwork) {
        selected.push(artwork);
        used.add(artwork.id);
      }
    }

    // 随机选择其他作品直到达到9件
    const remaining = artworks.filter(a => !used.has(a.id));
    while (selected.length < 9 && remaining.length > 0) {
      const randomIndex = Math.floor(Math.random() * remaining.length);
      selected.push(remaining.splice(randomIndex, 1)[0]);
    }

    return selected;
  }

  private generateEmotionCurve(emotion: string, artworks: Artwork[]): number[] {
    const baseCurves = {
      '孤独': [0.2, 0.1, 0.3, 0.4, 0.2, 0.1, 0.3, 0.5, 0.4],
      '平静': [0.5, 0.6, 0.5, 0.4, 0.5, 0.6, 0.5, 0.4, 0.5],
      '激动': [0.9, 0.7, 0.8, 0.9, 0.6, 0.8, 0.9, 0.7, 0.8],
      '忧郁': [0.2, 0.1, 0.3, 0.4, 0.2, 0.1, 0.3, 0.5, 0.4],
      '喜悦': [0.8, 0.9, 0.7, 0.8, 0.9, 0.8, 0.7, 0.8, 0.9],
      '沉思': [0.3, 0.4, 0.2, 0.3, 0.5, 0.4, 0.3, 0.2, 0.4],
      'lonely': [0.2, 0.1, 0.3, 0.4, 0.2, 0.1, 0.3, 0.5, 0.4],
      'calm': [0.5, 0.6, 0.5, 0.4, 0.5, 0.6, 0.5, 0.4, 0.5],
      'excited': [0.9, 0.7, 0.8, 0.9, 0.6, 0.8, 0.9, 0.7, 0.8],
      'melancholy': [0.2, 0.1, 0.3, 0.4, 0.2, 0.1, 0.3, 0.5, 0.4],
      'joy': [0.8, 0.9, 0.7, 0.8, 0.9, 0.8, 0.7, 0.8, 0.9],
      'contemplative': [0.3, 0.4, 0.2, 0.3, 0.5, 0.4, 0.3, 0.2, 0.4]
    };

    let curve = baseCurves[emotion as keyof typeof baseCurves] || [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    
    // 根据实际作品数量调整曲线长度
    if (artworks.length < 9) {
      curve = curve.slice(0, artworks.length);
    } else if (artworks.length > 9) {
      const extendedCurve = [];
      for (let i = 0; i < artworks.length; i++) {
        extendedCurve.push(curve[i % curve.length]);
      }
      curve = extendedCurve;
    }
    
    return curve;
  }
}
