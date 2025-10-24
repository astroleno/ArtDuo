# 评分系统优化方案

## 当前问题分析

1. **初筛有效但可能过于严格**：当前预筛选最多18件作品，但可能筛选逻辑过于保守
2. **分批次评分效率低**：batchSize=20，但maxConcurrent=1，串行处理耗时过长
3. **token限制影响质量**：max_tokens=2000可能不够

## 优化方案

### 1. 确保初筛真正起作用

```typescript
// 当前的smartPreFilter已经有效，但可以进一步优化：
async function optimizedSmartPreFilter(artworks: Artwork[], emotion: string, userInput?: string): Promise<Artwork[]> {
  console.log(`🔍 智能预筛选：${artworks.length} 件作品 → 目标：15件`);

  // 1. 优先级评分（快速计算，无需LLM）
  const scored = artworks.map(artwork => {
    let priority = 0;

    // 有图片 +10分
    if (artwork.imageUrl) priority += 10;

    // 绘画类优先 +8分
    if (artwork.medium?.toLowerCase().includes('painting')) priority += 8;
    if (artwork.medium?.toLowerCase().includes('oil')) priority += 8;

    // 知名艺术家 +5分
    const knownArtists = ['达芬奇', '梵高', '莫奈', '毕加索', '伦勃朗', 'Rembrandt', 'Van Gogh', 'Monet', 'Picasso'];
    if (knownArtists.some(name => artwork.artist?.toLowerCase().includes(name.toLowerCase()))) {
      priority += 5;
    }

    // 年代多样性 +3分
    const year = parseInt(artwork.year);
    if (year >= 1800 && year <= 1900) priority += 3; // 近现代

    return { artwork, priority };
  });

  // 2. 按优先级排序
  scored.sort((a, b) => b.priority - a.priority);

  // 3. 确保多样性（避免同一艺术家过多）
  const result: Artwork[] = [];
  const artistCounts = new Map<string, number>();

  for (const { artwork } of scored) {
    if (result.length >= 15) break;

    const artist = artwork.artist || 'Unknown';
    const count = artistCounts.get(artist) || 0;

    // 每个艺术家最多2件，除非是优先级极高的作品
    if (count < 2 || result.length < 8) {
      result.push(artwork);
      artistCounts.set(artist, count + 1);
    }
  }

  console.log(`✅ 预筛选完成：${result.length} 件作品`);
  return result;
}
```

### 2. 合并为单次请求（最多分3批）

```typescript
async function optimizedBatchScoreWithGLM(
  artworks: Artwork[],
  emotion: string,
  userInput?: string
): Promise<{ scores: ArtworkScore[], failureCount: number }> {

  // 根据作品数量决定批次策略
  let batches: Artwork[][];

  if (artworks.length <= 15) {
    // 15件以下：单次请求
    batches = [artworks];
    console.log(`🎯 单次评分：${artworks.length} 件作品`);
  } else if (artworks.length <= 30) {
    // 16-30件：分2批
    const mid = Math.ceil(artworks.length / 2);
    batches = [artworks.slice(0, mid), artworks.slice(mid)];
    console.log(`📦 分2批评分：${mid} + ${artworks.length - mid} 件作品`);
  } else {
    // 31-45件：分3批
    const third = Math.ceil(artworks.length / 3);
    batches = [
      artworks.slice(0, third),
      artworks.slice(third, third * 2),
      artworks.slice(third * 2)
    ];
    console.log(`📦 分3批评分：${third}, ${third}, ${artworks.length - third * 2} 件作品`);
  }

  const allScores: ArtworkScore[] = [];
  let failureCount = 0;

  // 并行处理各批次（而不是串行）
  const batchPromises = batches.map(async (batch, index) => {
    console.log(`🚀 处理第${index + 1}批：${batch.length} 件作品`);

    const prompt = generateOptimizedScoringPrompt(batch, emotion, userInput);

    const response = await glmOptimizedClient.chat([
      {
        role: 'system' as const,
        content: '你是专业的艺术作品评分专家，请根据用户情绪为作品打分。'
      },
      {
        role: 'user' as const,
        content: prompt
      }
    ], {
      model: 'glm-4.5-air',
      temperature: 0.3,
      // 移除max_tokens限制，让LLM充分输出
      thinking: 'enabled'
    });

    // 解析响应...
    const result = parseScoringResponse(response.choices[0].message.content, batch);
    console.log(`✅ 第${index + 1}批完成：${result.scores.length} 成功，${result.failureCount} 失败`);

    return result;
  });

  // 等待所有批次完成
  const results = await Promise.all(batchPromises);

  results.forEach(result => {
    allScores.push(...result.scores);
    failureCount += result.failureCount;
  });

  return { scores: allScores, failureCount };
}
```

### 3. 优化评分Prompt

```typescript
function generateOptimizedScoringPrompt(artworks: Artwork[], emotion: string, userInput?: string): string {
  return `请为以下艺术作品评分，用户当前情绪是"${emotion}"${userInput ? `，用户想法："${userInput}"` : ''}。

评分标准：
1. **情绪契合度** (0-10分)：作品与"${emotion}"情绪的匹配程度
2. **艺术价值** (0-10分)：作品的艺术技法、创新性、历史地位
3. **视觉表现力** (0-10分)：作品的视觉冲击力和表现力
4. **整体推荐度** (0-10分)：综合以上因素的整体推荐程度

作品列表：
${artworks.map((art, index) => `
${index + 1}. 作品ID: ${art.id}
   标题: ${art.title}
   艺术家: ${art.artist}
   年代: ${art.year}
   材质: ${art.medium}
   描述: ${art.description || '暂无描述'}
   图片: ${art.imageUrl ? '有' : '无'}
`).join('')}

请以JSON格式返回评分结果，格式如下：
{
  "scores": [
    {
      "artworkId": "作品ID",
      "emotionFit": 情绪契合度分数,
      "artisticValue": 艺术价值分数,
      "visualImpact": 视觉表现力分数,
      "overallRecommendation": 整体推荐度分数,
      "confidence": 置信度(0-1),
      "reasoning": "评分理由（简短说明）"
    }
  ]
}

请确保：
1. 每件作品都要评分
2. 分数为0-10的整数或小数
3. 评分理由要结合作品特点和用户情绪
4. JSON格式必须正确`;
}
```

### 4. 配置优化

```typescript
// 在 stream/route.ts 中的配置修改：
const scoring = await batchJudgeArtworksEnhanced(artworkResult.artworks, emotion, userInput, {
  maxConcurrent: 3, // 改为3，允许并行处理
  strategy: 'ai_first',
  retryConfig: {
    maxRetries: 1,
    baseDelay: 1000,
    maxDelay: 3000,
    timeoutMs: 60000 // 增加到60秒
  },
  fallbackConfig: {
    enableRuleBasedScoring: true,
    enableDefaultScoring: true,
    minConfidenceThreshold: 0.2,
    maxFailureRate: 0.8
  }
});
```

## 预期效果

1. **初筛更有效**：通过优先级评分确保真正优质的作品进入LLM评分
2. **评分更高效**：最多分3批，并行处理，大幅减少耗时
3. **质量更稳定**：移除token限制，让LLM充分输出高质量评分
4. **支持策展需求**：保持足够的作品数量供后续情绪曲线和选择使用

## 预期耗时改善

- **当前**：124秒（50件作品串行处理）
- **优化后**：15-20秒（15件预筛选作品，3批次并行处理）