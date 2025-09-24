// 统一策展生成器 - 合并阶段456为一次LLM请求
import { Artwork } from './types';
import { ArtworkScore } from './llm-judge-ultra-optimized';
import { glmClient } from '@/lib/glm-optimized-client';

/**
 * 统一策展结果 - 基于专业情绪曲线设计理论
 */
export interface UnifiedCurationResult {
  // 专业情绪曲线设计
  emotionCurve: {
    curveType: 'guided_journey' | 'sandbox_discovery' | 'rhythmic_pulse';
    emotionalGoal: 'awe_wonder' | 'contemplation' | 'playfulness' | 'tension_release' | 'empathy_connection';
    userArchetype: 'explorer' | 'story_seeker' | 'socializer' | 'scholar';
    totalStages: number;
    emotionJourney: {
      stage: number;
      stageName: string;
      intensity: number; // 0-1
      emotionalTexture: string; // 温暖明亮|冷静深沉|紧张动感|舒缓柔和
      psychologicalState: string; // 好奇探索|深度沉思|情绪释放|内省反思
      description: string;
      artworkRequirement: string;
      visualAtmosphere: string; // 详细的视觉氛围描述
      transitionNote: string; // 与前后阶段的过渡逻辑
    }[];
    overallNarrative: string;
    designPhilosophy: string; // 情绪弧线原型选择理由
    colorPalette: string[];
  };
  
  // 基于情绪景观的智能作品编排
  artworkOrdering: {
    orderedArtworks: string[]; // 作品ID数组，按情绪曲线排序
    matchingReasons: {
      artworkId: string;
      stage: number;
      emotionalMatch: string; // 情绪匹配分析
      visualImpact: string; // 视觉冲击力分析
      narrativeRole: string; // 在整体叙事中的作用
      reason: string; // 综合选择理由
    }[];
    curveAlignment: string; // 作品排序如何契合情绪弧线原型
  };
  
  // 沉浸式策展文案
  curationTexts: {
    introduction: string; // 深度个性化序言
    conclusion: string; // 情绪闭环结语
    overallTheme: string; // 诗意而有力的策展主题
    designRationale: string; // 策展设计理念说明
  };
}

/**
 * 统一策展生成器
 */
export class UnifiedCurationGenerator {
  
  /**
   * 一次性生成情绪曲线、作品排序、序言结语
   */
  static async generateUnifiedCuration(
    emotion: string,
    userInput: string,
    artworks: Artwork[],
    scores: ArtworkScore[]
  ): Promise<UnifiedCurationResult> {
    console.log('🎨 开始统一策展生成 (合并456阶段)...');
    
    // 准备作品信息
    const artworkInfo = artworks.map((artwork, index) => ({
      index,
      id: artwork.id,
      title: artwork.title,
      artist: artwork.artist,
      year: artwork.year,
      medium: artwork.medium,
      description: artwork.description?.substring(0, 200) || '',
      score: scores.find(s => s.artworkId === artwork.id)?.overallRecommendation || 5,
      reasoning: scores.find(s => s.artworkId === artwork.id)?.reasoning || ''
    }));

    const prompt = `你是一位结合了心理学、艺术治疗和沉浸式展览设计专业知识的策展专家。请基于专业的情绪曲线设计理论，为用户创造一个深度个性化的艺术情绪体验。

## 用户情绪深度分析
- **核心情绪**: ${emotion}
- **具体情境**: ${userInput}
- **情绪目标分析**: 请首先判断用户最需要的情绪目标类型：
  * 敬畏与惊奇 (Awe & Wonder) - 震撼心灵的美学体验
  * 沉思与反思 (Contemplation & Reflection) - 内省和自我对话
  * 游戏与快乐 (Playfulness & Joy) - 轻松愉悦的情绪提升
  * 张力与释放 (Tension & Release) - 情绪的宣泄和解脱
  * 共情与连接 (Empathy & Connection) - 与他人和世界的情感联结

## 用户心理类型识别
基于用户的"${userInput}"，判断其可能的心理类型：
- **探索者** (好奇心驱动，喜欢自主发现)
- **故事寻求者** (需要完整叙事弧线)
- **社交者** (通过互动和共鸣体验)
- **学者** (通过理解和学习获得满足)

## 可选艺术作品库
${artworkInfo.map(art => 
  `[${art.index}] ${art.title} - ${art.artist} (${art.year})
  媒介: ${art.medium} | 情绪匹配度: ${art.score}/10
  作品描述: ${art.description}
  情绪分析: ${art.reasoning}`
).join('\n\n')}

## 专业策展设计任务

请运用沉浸式展览的专业理论，设计一个9阶段的情绪转化体验：

### 1. 情绪弧线原型选择与设计
基于用户情绪和心理类型，选择最适合的情绪弧线原型：

**A. 引导之旅 (The Guided Journey)** - 适合故事寻求者
- Act I: 门槛期 (Threshold) - 好奇与定向 (阶段1-3)
- Act II: 沉浸期 (Immersion) - 敬畏与挑战 (阶段4-7) 
- Act III: 反思期 (Reflection) - 整合与解决 (阶段8-9)

**B. 发现沙盒 (Sandbox of Discovery)** - 适合探索者
- 中心枢纽：情绪中性的起点
- 惊奇峰值：独立的强烈情绪体验点
- 过渡谷地：情绪重置和缓冲区间
- 隐藏宝石：个人发现的满足感

**C. 节奏脉冲 (Rhythmic Pulse)** - 适合沉思型用户
- 流动状态：一致的情绪节奏
- 渐强渐弱：强度的周期性变化
- 用户同步：与内在节奏的共鸣

为每个阶段设计：
- 情绪强度 (0-1，其中0.5为中性)
- 情绪质感 (温暖/冷静、明亮/深沉、紧张/舒缓)
- 心理状态目标
- 视觉氛围要求
- 作品类型需求

### 2. 基于情绪弧线的智能作品编排
运用"情绪景观"理念，为每个阶段精确匹配作品：
- **空间设计思维**: 考虑作品的"压缩与扩张"效果
- **视觉节奏**: 色彩、光线、构图的情绪引导
- **叙事连贯性**: 作品间的情绪过渡和呼应关系
- **峰终定律**: 确保高峰体验和完美结尾

优先级排序：
1. 情绪匹配度最高的作品
2. "painting"媒介作品（视觉冲击力强）
3. 年代和风格的多样性平衡
4. 艺术家知名度和作品影响力

### 3. 沉浸式策展文案创作
基于选定的情绪弧线原型，创作深度个性化文案：

**序言设计** (180-220字):
- 直接回应用户的具体情境和情绪状态
- 预告即将体验的情绪转化旅程
- 建立艺术与用户内心世界的桥梁
- 设定适当的心理期待和参与方式

**结语设计** (150-180字):
- 呼应序言，形成完整的情绪闭环
- 总结情绪转化的深层意义
- 提供持续的心理支持和启发
- 运用"峰终定律"，留下深刻的正面印象

**核心主题** (一句话):
- 概括整个情绪旅程的精神内核
- 结合用户个人情境的独特表达
- 富有诗意但不失真诚和力量

## 输出格式

返回JSON格式：
{
  "emotionCurve": {
    "curveType": "guided_journey|sandbox_discovery|rhythmic_pulse",
    "emotionalGoal": "awe_wonder|contemplation|playfulness|tension_release|empathy_connection",
    "userArchetype": "explorer|story_seeker|socializer|scholar",
    "totalStages": 9,
    "emotionJourney": [
      {
        "stage": 1,
        "stageName": "具体阶段名称",
        "intensity": 0.3,
        "emotionalTexture": "温暖明亮|冷静深沉|紧张动感|舒缓柔和",
        "psychologicalState": "好奇探索|深度沉思|情绪释放|内省反思",
        "description": "这个阶段的情绪特征和转化目标",
        "artworkRequirement": "需要什么类型的艺术作品及其情绪特质",
        "visualAtmosphere": "视觉氛围和空间感受的详细描述",
        "transitionNote": "与前后阶段的情绪过渡逻辑"
      }
    ],
    "overallNarrative": "整个情绪旅程的深层叙事逻辑和心理学原理",
    "designPhilosophy": "选用的情绪弧线原型及其适配理由",
    "colorPalette": ["#color1", "#color2", "#color3", "#color4", "#color5"]
  },
  "artworkOrdering": {
    "orderedArtworks": ["artworkId1", "artworkId2", ...],
    "matchingReasons": [
      {
        "artworkId": "artworkId1",
        "stage": 1,
        "emotionalMatch": "情绪匹配分析",
        "visualImpact": "视觉冲击力分析",
        "narrativeRole": "在整体叙事中的作用",
        "reason": "综合选择理由"
      }
    ],
    "curveAlignment": "作品排序如何契合选定的情绪弧线原型"
  },
  "curationTexts": {
    "introduction": "深度个性化序言 (180-220字)",
    "conclusion": "情绪闭环结语 (150-180字)",
    "overallTheme": "诗意而有力的策展主题（一句话）",
    "designRationale": "策展设计理念的简要说明"
  }
}`;

    try {
      const messages = [
        {
          role: 'system' as const,
          content: '你是一位结合艺术治疗和策展经验的专家，擅长设计个性化的艺术情绪体验。请始终返回有效的JSON格式。'
        },
        {
          role: 'user' as const,
          content: prompt
        }
      ];

      console.log('🧠 [DEBUG] 调用统一策展生成...');
      console.log('🧠 [DEBUG] 作品数量:', artworks.length);
      console.log('🧠 [DEBUG] 提示词长度:', prompt.length);
      
      const response = await glmClient.chat(messages, {
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
        thinking: 'disabled'
      });
      
      console.log('🧠 [DEBUG] 统一策展响应成功，内容长度:', response.choices[0]?.message?.content?.length || 0);

      const resultText = response.choices[0]?.message?.content || '{}';
      
      // 解析统一策展结果
      let result: UnifiedCurationResult;
      try {
        result = JSON.parse(resultText);
      } catch (error) {
        console.error('❌ [DEBUG] 统一策展结果解析失败:', error);
        console.error('❌ [DEBUG] 原始响应:', resultText.substring(0, 500));
        throw new Error('统一策展结果解析失败');
      }

      // 验证和修正结果
      result = this.validateAndFixResult(result, artworks);
      
      console.log('✅ 统一策展生成完成:', {
        curveType: result.emotionCurve.curveType,
        selectedArtworks: result.artworkOrdering.orderedArtworks.length,
        hasIntroduction: !!result.curationTexts.introduction,
        hasConclusion: !!result.curationTexts.conclusion
      });
      
      return result;

    } catch (error) {
      console.error('❌ [DEBUG] 统一策展生成失败:', error);
      console.error('❌ [DEBUG] 错误详情:', JSON.stringify(error, null, 2));
      
      // 返回降级方案
      return this.getDefaultUnifiedResult(emotion, userInput, artworks, scores);
    }
  }

  /**
   * 验证和修正统一策展结果
   */
  private static validateAndFixResult(
    result: UnifiedCurationResult, 
    artworks: Artwork[]
  ): UnifiedCurationResult {
    // 确保情绪曲线有9个阶段
    if (!result.emotionCurve.emotionJourney || result.emotionCurve.emotionJourney.length !== 9) {
      console.warn('⚠️ 修正情绪曲线阶段数量');
      result.emotionCurve.emotionJourney = Array.from({ length: 9 }, (_, i) => ({
        stage: i + 1,
        stageName: `阶段${i + 1}`,
        intensity: 0.3 + Math.sin(i / 8 * Math.PI) * 0.4,
        emotionalTexture: '深沉而富有表现力',
        psychologicalState: '情绪探索',
        description: `情绪转化的第${i + 1}个阶段`,
        artworkRequirement: '符合当前情绪阶段的艺术作品',
        visualAtmosphere: '营造深沉而富有表现力的视觉氛围',
        transitionNote: '与前后阶段形成自然的情绪过渡'
      }));
    }

    // 确保作品排序有效
    if (!result.artworkOrdering.orderedArtworks || result.artworkOrdering.orderedArtworks.length === 0) {
      console.warn('⚠️ 修正作品排序');
      result.artworkOrdering.orderedArtworks = artworks.slice(0, 9).map(a => a.id);
      result.artworkOrdering.matchingReasons = artworks.slice(0, 9).map((artwork, i) => ({
        artworkId: artwork.id,
        stage: i + 1,
        emotionalMatch: `与第${i + 1}阶段情绪特征相匹配`,
        visualImpact: '具有适当的视觉冲击力',
        narrativeRole: `在整体叙事中承担第${i + 1}阶段的情绪表达`,
        reason: `选择作为第${i + 1}阶段的代表作品`
      }));
      result.artworkOrdering.curveAlignment = '基于评分排序，与情绪曲线基本匹配';
    }

    // 确保策展文案存在
    if (!result.curationTexts.introduction) {
      result.curationTexts.introduction = '欢迎开启这场个性化的艺术情绪之旅。';
    }
    if (!result.curationTexts.conclusion) {
      result.curationTexts.conclusion = '通过艺术的陪伴，愿您找到内心的平静与力量。';
    }
    if (!result.curationTexts.overallTheme) {
      result.curationTexts.overallTheme = '情绪与艺术的深度对话';
    }
    if (!result.curationTexts.designRationale) {
      result.curationTexts.designRationale = '基于专业情绪曲线设计理论的个性化策展方案';
    }

    // 确保基础字段存在
    if (!result.emotionCurve.curveType) {
      result.emotionCurve.curveType = 'guided_journey';
    }
    if (!result.emotionCurve.emotionalGoal) {
      result.emotionCurve.emotionalGoal = 'contemplation';
    }
    if (!result.emotionCurve.userArchetype) {
      result.emotionCurve.userArchetype = 'story_seeker';
    }
    if (!result.emotionCurve.designPhilosophy) {
      result.emotionCurve.designPhilosophy = '采用引导之旅原型，提供完整的情绪转化体验';
    }

    return result;
  }

  /**
   * 降级方案 - 基于专业理论的智能降级
   */
  private static getDefaultUnifiedResult(
    emotion: string,
    userInput: string,
    artworks: Artwork[],
    scores: ArtworkScore[]
  ): UnifiedCurationResult {
    console.log('🔄 [DEBUG] 使用基于专业理论的统一策展降级方案');
    
    // 按评分排序作品，优先选择painting媒介
    const sortedArtworks = artworks
      .map(artwork => ({
        artwork,
        score: scores.find(s => s.artworkId === artwork.id)?.overallRecommendation || 0,
        isPainting: artwork.medium?.toLowerCase().includes('oil') || 
                   artwork.medium?.toLowerCase().includes('canvas') ||
                   artwork.medium?.toLowerCase().includes('paint')
      }))
      .sort((a, b) => {
        // 优先painting媒介，然后按评分排序
        if (a.isPainting && !b.isPainting) return -1;
        if (!a.isPainting && b.isPainting) return 1;
        return b.score - a.score;
      })
      .slice(0, 9)
      .map(item => item.artwork);

    // 基于情绪类型选择合适的弧线原型
    let curveType: 'guided_journey' | 'sandbox_discovery' | 'rhythmic_pulse' = 'guided_journey';
    let emotionalGoal: 'awe_wonder' | 'contemplation' | 'playfulness' | 'tension_release' | 'empathy_connection' = 'contemplation';
    let userArchetype: 'explorer' | 'story_seeker' | 'socializer' | 'scholar' = 'story_seeker';
    
    // 根据情绪智能推断
    const emotionLower = emotion.toLowerCase();
    if (emotionLower.includes('孤独') || emotionLower.includes('忧郁') || emotionLower.includes('沉思')) {
      emotionalGoal = 'empathy_connection';
      curveType = 'rhythmic_pulse';
    } else if (emotionLower.includes('焦虑') || emotionLower.includes('紧张') || emotionLower.includes('压力')) {
      emotionalGoal = 'tension_release';
      curveType = 'guided_journey';
    } else if (emotionLower.includes('快乐') || emotionLower.includes('兴奋') || emotionLower.includes('愉悦')) {
      emotionalGoal = 'playfulness';
      curveType = 'sandbox_discovery';
      userArchetype = 'explorer';
    } else if (emotionLower.includes('惊讶') || emotionLower.includes('震撼') || emotionLower.includes('敬畏')) {
      emotionalGoal = 'awe_wonder';
      curveType = 'guided_journey';
    }

    return {
      emotionCurve: {
        curveType,
        emotionalGoal,
        userArchetype,
        totalStages: 9,
        emotionJourney: Array.from({ length: 9 }, (_, i) => ({
          stage: i + 1,
          stageName: `${emotion}转化阶段${i + 1}`,
          intensity: 0.3 + Math.sin(i / 8 * Math.PI) * 0.4,
          emotionalTexture: i < 3 ? '深沉内敛' : i < 7 ? '逐渐明亮' : '温暖舒缓',
          psychologicalState: i < 3 ? '接纳现状' : i < 7 ? '积极转化' : '内心平和',
          description: `${emotion}情绪的第${i + 1}个转化阶段，通过艺术作品引导情绪的自然流动`,
          artworkRequirement: `符合第${i + 1}阶段情绪转化需求的艺术作品，具有相应的视觉表现力`,
          visualAtmosphere: `营造适合第${i + 1}阶段的视觉氛围，支持情绪的渐进转化`,
          transitionNote: i === 0 ? '从现实情境进入艺术空间' : 
                         i === 8 ? '完成情绪转化，回归内心平静' :
                         '与前后阶段形成自然的情绪过渡'
        })),
        overallNarrative: `基于"${emotion}"情绪特征，运用${curveType === 'guided_journey' ? '引导之旅' : curveType === 'sandbox_discovery' ? '发现沙盒' : '节奏脉冲'}原型，通过9件艺术作品构建完整的情绪转化旅程`,
        designPhilosophy: `针对"${userInput}"的具体情境，采用${curveType === 'guided_journey' ? '三幕式结构引导用户完成情绪转化' : curveType === 'sandbox_discovery' ? '多元化体验点让用户自主探索' : '波浪式节奏引导用户进入冥想状态'}`,
        colorPalette: emotionalGoal === 'contemplation' ? ['#4A5568', '#718096', '#A0AEC0', '#CBD5E0', '#E2E8F0'] :
                     emotionalGoal === 'tension_release' ? ['#742A2A', '#9C4221', '#C05621', '#DD6B20', '#ED8936'] :
                     emotionalGoal === 'playfulness' ? ['#553C9A', '#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD'] :
                     emotionalGoal === 'awe_wonder' ? ['#1A202C', '#2D3748', '#4A5568', '#718096', '#A0AEC0'] :
                     ['#2D3748', '#4A5568', '#718096', '#A0AEC0', '#CBD5E0']
      },
      artworkOrdering: {
        orderedArtworks: sortedArtworks.map(a => a.id),
        matchingReasons: sortedArtworks.map((artwork, i) => ({
          artworkId: artwork.id,
          stage: i + 1,
          emotionalMatch: `作品的情绪表达与第${i + 1}阶段的${i < 3 ? '深度内省' : i < 7 ? '积极转化' : '平和释然'}状态相契合`,
          visualImpact: `${artwork.medium?.includes('paint') ? '绘画媒介提供强烈的视觉冲击力' : '独特媒介带来不同的感官体验'}`,
          narrativeRole: `在整体情绪转化叙事中承担第${i + 1}阶段的核心表达作用`,
          reason: `基于评分排序和媒介优先级选择，适合第${i + 1}阶段的情绪引导需求`
        })),
        curveAlignment: `作品排序遵循${curveType}原型的设计逻辑，确保情绪转化的连贯性和有效性`
      },
      curationTexts: {
        introduction: `在"${emotion}"的情绪中，让我们踏上一场深度的艺术心灵之旅。结合您"${userInput}"的具体情境，我们精心设计了这场基于专业情绪曲线理论的艺术体验。通过9件精选作品的陪伴，您将经历一个完整的情绪转化过程——从接纳现状到积极转化，最终达到内心的平和与释然。每一件作品都承载着特定的情绪能量，它们将以${curveType === 'guided_journey' ? '引导之旅的方式带您走过完整的三幕式情绪转化' : curveType === 'sandbox_discovery' ? '多元化的体验点让您自主探索内心的情感景观' : '波浪式的节奏引导您进入深度的冥想状态'}。`,
        conclusion: `通过这9件精选作品的深度陪伴，我们完成了一次完整的情绪转化旅程。从最初"${emotion}"的情绪状态，到现在内心的平和与释然，艺术成为了我们情绪疗愈的桥梁。每一幅作品都在您心中留下了独特的印记，它们不仅是美的载体，更是情感共鸣的源泉。愿这次艺术之旅带给您的不仅是视觉的享受，更是心灵的滋养和成长。当您再次面对类似的情绪挑战时，请记住艺术所给予您的力量和智慧。`,
        overallTheme: `"${emotion}"与艺术的深度对话：一场基于专业情绪曲线设计的心灵疗愈之旅`,
        designRationale: `本策展方案基于沉浸式展览设计的专业理论，采用${curveType}原型，旨在通过艺术作品的情绪引导实现${emotionalGoal}的治疗目标，为${userArchetype}类型的用户提供最适合的情绪体验路径`
      }
    };
  }
}
