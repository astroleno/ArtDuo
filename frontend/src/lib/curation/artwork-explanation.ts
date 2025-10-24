// 作品讲解和用户关联分析系统
import { glmOptimizedClient } from '@/lib/glm-optimized-client';
import { openaiClient } from '@/lib/openai';
import { Artwork } from './types';

/**
 * 作品讲解结果接口
 */
export interface ArtworkExplanation {
  artworkId: string;
  title?: string;
  artist?: string;
  
  // 核心讲解内容
  emotionalConnection: string;    // 与用户情绪输入的关联（兼容旧字段）
  artisticAnalysis: string;       // 艺术分析（兼容旧字段）
  historicalContext: string;      // 历史背景
  curationReason: string;         // 策展理由
  userRelevance: string;          // 与用户输入的相关性
  
  // 增强版讲解内容（可选）
  stageNarrative?: string;        // 阶段叙事作用
  emotionTransition?: string;     // 情绪转换预期
  viewingGuidance?: string;       // 观看体验建议
  
  confidence: number;
  processingTime?: number;
  
  // 兼容旧格式
  explanation?: {
    emotionalConnection: string;
    artisticAnalysis: string;
    historicalContext: string;
    curationReason: string;
    userRelevance: string;
    // 新增：直接产出 introduction/detail，前端无需映射
    introduction?: string;
    detail?: string;
  };
}

/**
 * 批量作品讲解结果
 */
export interface BatchExplanationResult {
  explanations: ArtworkExplanation[];
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  // 新增：缓存命中计数，用于诊断统计
  fromCacheCount: number;
  processingTime: number;
}

/**
 * 更严格的英文检测函数
 */
function needsChineseConversion(text: string): boolean {
  if (!text) return false;

  // 检测连续英文单词（降低到2个字母）
  const hasEnglishWords = /[A-Za-z]{2,}/.test(text);

  // 检测常见英文句式结构和介词
  const hasEnglishPatterns = /\b(the|and|or|but|in|on|at|to|for|of|with|by|is|are|was|were|has|have|will|would|could|should)\b/i.test(text);

  // 检测英文标点符号组合
  const hasEnglishPunctuation = /[A-Za-z]+[,.!?][A-Za-z]/.test(text);

  // 检测以英文开头的句子
  const hasEnglishStart = /^[A-Za-z]/.test(text.trim());

  return hasEnglishWords || hasEnglishPatterns || hasEnglishPunctuation || hasEnglishStart;
}

/**
 * 为策展作品生成讲解和用户关联分析
 */
export async function generateArtworkExplanations(
  artworks: Artwork[],
  emotion: string,
  userInput?: string,
  curationStrategy?: string
): Promise<BatchExplanationResult> {
  console.log(`🎨 开始生成作品讲解: ${artworks.length} 件作品`);
  const startTime = Date.now();
  
  const explanations: ArtworkExplanation[] = [];
  let successCount = 0;
  let failureCount = 0;
  let fromCacheCount = 0;
  
  // 分批处理并可通过环境变量提升并发，默认并发更激进以缩短总耗时
  const maxConcurrent = Number(process.env.EXPLAIN_MAX_CONCURRENCY || 9);
  const batchSize = Math.max(1, Math.min(maxConcurrent, artworks.length));
  for (let i = 0; i < artworks.length; i += batchSize) {
    const batch = artworks.slice(i, i + batchSize);
    console.log(`📝 处理批次 ${Math.floor(i/batchSize) + 1}: ${batch.length} 件作品`);
    
    // 批内并发执行，轻微抖动以降低瞬时并发尖峰
    const batchPromises = batch.map(async (artwork, idx) => {
      try {
        // 轻微抖动（30-80ms）
        await new Promise(r => setTimeout(r, 30 + Math.floor(Math.random() * 50)));
        // 可控的缓存开关（默认关闭）。仅当 EXPLAIN_CACHE_ENABLED === 'true' 时启用。
        const cacheEnabled = process.env.EXPLAIN_CACHE_ENABLED === 'true';
        if (cacheEnabled) {
          const cached = getCachedExplanation(artwork.id, emotion, userInput);
          if (cached) {
            console.log(`📦 讲解命中缓存: artwork=${artwork.id}`);
            fromCacheCount++;
            successCount++;
            return cached;
          }
        }

        // 添加超时控制 + 指数退避重试（缓存未命中）
        const explanation = await generateWithRetry(
          () => generateSingleArtworkExplanation(artwork, emotion, userInput, curationStrategy),
          [1000, 2000, 4000] // 1s, 2s, 4s
        );

        // 写入缓存（受开关控制）
        if (cacheEnabled) {
          try {
            cacheExplanationFields(explanation, emotion, userInput);
          } catch (cacheErr) {
            console.warn('写入讲解缓存失败:', cacheErr);
          }
        }
        
        successCount++;
        return explanation;
      } catch (error) {
        console.error(`作品 ${artwork.id} 讲解生成失败:`, error);
        failureCount++;
        return createFallbackExplanation(artwork, emotion, userInput);
      }
    });
    
    const batchResults: ArtworkExplanation[] = await Promise.all(batchPromises);
    explanations.push(...batchResults);
    
    // 批次间延迟（尽量缩短）
    if (i + batchSize < artworks.length) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  const processingTime = Date.now() - startTime;
  console.log(`✅ 作品讲解生成完成: ${explanations.length} 个讲解，耗时 ${processingTime}ms`);
  
  return {
    explanations,
    totalProcessed: artworks.length,
    successCount,
    failureCount,
    fromCacheCount,
    processingTime
  };
}

/**
 * 生成单个作品的讲解
 */
async function generateSingleArtworkExplanation(
  artwork: Artwork,
  emotion: string,
  userInput?: string,
  curationStrategy?: string
): Promise<ArtworkExplanation> {
  const startTime = Date.now();
  
  // 预翻译标题为中文译名（括号保留原文），仅当检测到显著英文时触发
  async function translateTitleIfEnglish(title: string | undefined): Promise<string> {
    const t = title || '';
    if (!needsChineseConversion(t)) {
      console.log('✅ 标题无需翻译:', t);
      return t;
    }
    console.log('🔄 预翻译英文标题:', t);
    const titlePrompt = `请将艺术作品标题翻译为中文。要求：1. 先给出中文译名 2. 在括号内保留英文原文 3. 不要添加其他解释文字。

示例：
输入：Mona Lisa
输出：蒙娜丽莎（Mona Lisa）

输入：The Starry Night
输出：星夜（The Starry Night）

现在请翻译：${t}`;
    try {
      let result;
      if (glmOptimizedClient.hasValidApiKey()) {
        const r = await glmOptimizedClient.chat([
          { role: 'system' as const, content: '你是专业的艺术作品翻译专家，请严格按照用户要求的格式输出翻译结果。' },
          { role: 'user' as const, content: titlePrompt }
        ], { temperature: 0.1, max_tokens: 100, thinking: 'disabled' as const });
        result = (r.choices[0]?.message?.content || t).trim();
      } else {
        const r = await openaiClient.chat([
          { role: 'system' as const, content: '你是专业的艺术作品翻译专家，请严格按照用户要求的格式输出翻译结果。' },
          { role: 'user' as const, content: titlePrompt }
        ], { temperature: 0.1, max_tokens: 100 });
        result = (r.choices[0]?.message?.content || t).trim();
      }

      // 清理结果，移除可能的markdown标记
      result = result.replace(/^[\s\n]*|[\s\n]*$/g, '');

      if (result && result !== t) {
        console.log('✅ 标题预翻译完成:', result);
        return result;
      } else {
        console.warn('⚠️ 标题翻译返回空或相同结果，使用原文');
        return t;
      }
    } catch (error) {
      console.error('❌ 标题预翻译失败:', error);
      return t;
    }
  }

  const displayTitle = await translateTitleIfEnglish(artwork.title);
  
  // 使用优化的情感语境分析提示词
  const prompt = `请以艺术史学家的专业视角，为"${emotion}"情绪的用户深度解读这件作品。

**用户情境**：
用户现在的情绪是"${emotion}"${userInput ? `，用户的想法是："${userInput}"` : ''}。请站在用户的角度思考：为什么在这个心情下，这件作品特别值得一看？

**作品背景**：
标题：《${displayTitle}》
创作者：${artwork.artist}
创作年代：${artwork.year}（这个年代发生了什么？）
材质技法：${artwork.medium}（这种技法有什么特点？）
历史背景：${artwork.description || '需要结合时代背景分析'}
收藏机构：${artwork.museum}

**请从以下角度深度分析**：

1. **时代语境**：
   - ${artwork.year}年是什么时代？这个时代的艺术特点和社会背景
   - 艺术家${artwork.artist}的创作风格和历史地位
   - 这件作品在艺术史上的意义

2. **情感密码**：
   - 作品如何表达"${emotion}"相关的情感？
   - 色彩、构图、题材如何与用户心情对话？
   - 为什么在"${emotion}"的心情下看这件作品会有特殊感受？

3. **观看之道**：
   - 建议用户从哪些角度欣赏这件作品？
   - 哪些细节特别值得注意？
   - 如何在欣赏中获得情感慰藉或启发？

4. **生命共鸣**：
   - 这件作品与"${userInput || emotion}"这种生活情感有什么关联？
   - 能给用户带来什么样的思考或感动？

**写作要求**：
- 用温暖、专业的语调，像一位懂艺术的朋友在娓娓道来
- 避免空洞的形容词，要用具体的作品细节和背景故事
- 总长度400-600字，让用户有深度阅读的收获
- 让讲解既有学术深度又充满人情味

请直接输出讲解文本，不需要JSON格式或小标题。`;

  const messages = [
    {
      role: 'system' as const,
      content: '你是一位资深的艺术史学家的策展人，擅长深度解读艺术作品的时代背景、情感密码和生命共鸣。你的讲解既有学术深度又充满人情味，能帮助用户在特定心情下与作品建立深刻的连接。'
    },
    {
      role: 'user' as const,
      content: prompt
    }
  ];

  try {
    let response;
    
    // 优先使用GLM客户端，如果不可用则降级到OpenAI客户端
    if (glmOptimizedClient.hasValidApiKey()) {
      console.log('🔑 使用GLM客户端生成作品讲解(快速, no thinking)...');
      try {
        // 优化：增加token限制以支持深度分析内容
        const temperature = process.env.EXPLAIN_TEMPERATURE ? Number(process.env.EXPLAIN_TEMPERATURE) : 0.8;
        const maxTokens = process.env.EXPLAIN_MAX_TOKENS ? Number(process.env.EXPLAIN_MAX_TOKENS) : 1200;
        // 使用chat方法以支持thinking参数
        response = await glmOptimizedClient.chat(messages, {
          temperature,
          max_tokens: maxTokens,
          thinking: 'enabled' as const
        });
        console.log('✅ GLM讲解生成成功(快速)');
      } catch (glmError) {
        console.error('❌ GLM快速讲解失败:', glmError);
        throw glmError;
      }
    } else {
      console.log('🔑 GLM不可用，使用OpenAI客户端生成作品讲解...');
      const temperature = process.env.EXPLAIN_TEMPERATURE ? Number(process.env.EXPLAIN_TEMPERATURE) : 0.8;
      const maxTokens = process.env.EXPLAIN_MAX_TOKENS ? Number(process.env.EXPLAIN_MAX_TOKENS) : 1200;
      response = await openaiClient.chat(messages, {
        temperature,
        max_tokens: maxTokens
      });
    }

    let content = response.choices[0]?.message?.content || '';
    if (!content || content.trim().length < 5) {
      console.warn('⚠️ LLM返回内容为空，尝试快速重试');
      const retryPrompt = `仅输出两段文本：\n简介：一句话（≤40字）\n详情：一到两段自由文本（覆盖情绪关联/艺术/历史/策展/相关性，可合并）。\n作品：${artwork.title}（${artwork.artist}，${artwork.year}，${artwork.medium}）\n情绪：${emotion}；用户：${userInput || '无'}`;
      const retryMessages = [
        { role: 'system' as const, content: '你是专业策展人，请用中文简洁表达。' },
        { role: 'user' as const, content: retryPrompt }
      ];
      try {
        if (glmOptimizedClient.hasValidApiKey()) {
          const r = await glmOptimizedClient.chat(retryMessages, {
            temperature: 0.5,
            max_tokens: Number(process.env.EXPLAIN_MAX_TOKENS || 300),
            thinking: 'disabled' as const
          });
          content = r.choices[0]?.message?.content || '';
        } else {
          const r = await openaiClient.chat(retryMessages, {
            temperature: 0.5,
            max_tokens: Number(process.env.EXPLAIN_MAX_TOKENS || 300)
          });
          content = r.choices[0]?.message?.content || '';
        }
      } catch (re) {
        console.warn('⚠️ 重试仍失败，将使用回退文本');
      }
    }
    console.log('📝 LLM原始讲解(前200):', (content || '').slice(0, 200));

    // 优化：智能解析自由形式的深度讲解内容
    let parsed = parseEnhancedExplanation(content);

    // 兜底：如果解析失败，则用作品元信息+情绪合成简短文案
    if (!parsed.intro || parsed.intro.trim().length === 0) {
      const safeTitle = displayTitle || artwork.title || '此作';
      parsed.intro = `在"${emotion}"的心情下，${safeTitle}展现出特别的艺术魅力和情感深度。`;
    }
    if (!parsed.details || parsed.details.trim().length === 0) {
      const parts: string[] = [];
      const metaA = artwork.artist ? `艺术家${artwork.artist}` : '';
      const metaY = artwork.year ? `创作于${artwork.year}` : '';
      const metaM = artwork.medium ? `采用${artwork.medium}技法` : '';
      if (metaA || metaY || metaM) {
        parts.push([metaA, metaY, metaM].filter(Boolean).join('，') + '。');
      }
      if (artwork.description) parts.push(artwork.description);
      if (parts.length === 0) parts.push('作品通过独特的视觉语言和艺术表现，为观众提供了丰富的审美体验和思考空间。');
      parsed.details = parts.join('\n\n');
    }

  
  // 二次中文化：若仍包含英文，调用LLM将文本改写为纯中文（保留专名中文译名或音译+括号原文）
  async function enforceChinese(text: string): Promise<string> {
    console.log('🔍 检测文本是否需要中文化:', text.slice(0, 50));

    if (!needsChineseConversion(text)) {
      console.log('✅ 文本已是中文，无需转换');
      return text;
    }

    console.log('🔄 执行中文化处理...');
    const chPrompt = `将以下文本完整改写为中文，不得出现英文字母；如需保留专名，请给出中文译名或音译，并在括号中保留原文。\n文本：${text}`;
    try {
      let result;
      if (glmOptimizedClient.hasValidApiKey()) {
        const r = await glmOptimizedClient.chat([
          { role: 'system' as const, content: '你是专业中文编辑，负责将任何内容改写为地道中文。' },
          { role: 'user' as const, content: chPrompt }
        ], { temperature: 0.2, max_tokens: 200, thinking: 'disabled' as const });
        result = r.choices[0]?.message?.content?.trim() || text;
      } else {
        const r = await openaiClient.chat([
          { role: 'system' as const, content: '你是专业中文编辑，负责将任何内容改写为地道中文。' },
          { role: 'user' as const, content: chPrompt }
        ], { temperature: 0.2, max_tokens: 200 });
        result = r.choices[0]?.message?.content?.trim() || text;
      }

      console.log('✅ 中文化完成:', result.slice(0, 50));
      return result;
    } catch (error) {
      console.error('❌ 中文化处理失败:', error);
      // 返回一个基础的中文版本而不是原英文
      return `（中文化处理失败）${text}`;
    }
  }

  parsed.intro = await enforceChinese(parsed.intro);
  parsed.details = await enforceChinese(parsed.details);

  // 标题中文化（仅作用于简介首句的标题部分，不改动后续句式）
  try {
    const title = artwork.title || '';
    const hasAscii = needsChineseConversion(title);
    if (title && hasAscii) {
      console.log('🔄 翻译英文标题:', title);
      const titlePrompt = `请将艺术作品标题翻译为中文。要求：1. 先给出中文译名 2. 在括号内保留英文原文 3. 不要添加其他解释文字。

示例：
输入：Mona Lisa
输出：蒙娜丽莎（Mona Lisa）

现在请翻译：${title}`;
      let cnTitle = '';
      try {
        if (glmOptimizedClient.hasValidApiKey()) {
          const r = await glmOptimizedClient.chat([
            { role: 'system' as const, content: '你是专业的艺术作品翻译专家，请严格按照用户要求的格式输出翻译结果。' },
            { role: 'user' as const, content: titlePrompt }
          ], { temperature: 0.1, max_tokens: 100, thinking: 'disabled' as const });
          cnTitle = (r.choices[0]?.message?.content || '').trim();
        } else {
          const r = await openaiClient.chat([
            { role: 'system' as const, content: '你是专业的艺术作品翻译专家，请严格按照用户要求的格式输出翻译结果。' },
            { role: 'user' as const, content: titlePrompt }
          ], { temperature: 0.1, max_tokens: 100 });
          cnTitle = (r.choices[0]?.message?.content || '').trim();
        }
        // 清理结果，移除可能的markdown标记
        cnTitle = cnTitle.replace(/^[\s\n]*|[\s\n]*$/g, '');
      } catch (titleError) {
        console.error('❌ 标题翻译失败:', titleError);
      }

      if (cnTitle && cnTitle !== title) {
        console.log('✅ 标题翻译完成:', cnTitle);
        // 将简介中可能出现的原题名替换为 中文译名（原文） 的形式
        const safeCn = cnTitle.replace(/\s+/g, '');
        const pattern = new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        if (pattern.test(parsed.intro)) {
          parsed.intro = parsed.intro.replace(pattern, `${safeCn}（${title}）`);
        } else {
          // 若简介未直接包含原题名，则在开头补一个"中文题名（原文）"
          parsed.intro = `${safeCn}（${title}）—— ${parsed.intro}`;
        }
      } else {
        console.warn('⚠️ 标题翻译返回空或相同结果，跳过处理');
      }
    } else {
      console.log('✅ 标题无需翻译:', title);
    }
  } catch (error) {
    console.error('❌ 标题中文化处理失败:', error);
  }

  const processingTime = Date.now() - startTime;
  
  const result: ArtworkExplanation = {
    artworkId: artwork.id,
    title: artwork.title,
    artist: artwork.artist,
    emotionalConnection: parsed.intro || content.trim(),
    artisticAnalysis: parsed.details || '',
    historicalContext: '',
    curationReason: '',
    userRelevance: '',
    explanation: {
      emotionalConnection: parsed.intro || content.trim(),
      artisticAnalysis: parsed.details || '',
      historicalContext: '',
      curationReason: '',
      userRelevance: '',
      // 直接输出 LLM 产出的简介/详情，供前端使用
      introduction: parsed.intro || content.trim(),
      detail: parsed.details || ''
    },
    confidence: 0.8,
    processingTime
  };
  return result;
    
  } catch (error) {
    console.error('作品讲解生成失败:', error);
    throw error;
  }

}

// ===================
// 本地内存缓存（服务器侧）
// 键规则：artworkId + emotion + hash(userInput) + 字段
// TTL：24h
// ===================
type ExplanationFieldKey = 'emotionalConnection' | 'artisticAnalysis' | 'historicalContext' | 'curationReason' | 'userRelevance' | 'confidence';

interface ExplanationCacheEntry {
  value: string | number;
  expiresAt: number;
}

const EXPLANATION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时
const explanationCache: Map<string, ExplanationCacheEntry> = new Map();

function stableHash(input: string): string {
  try {
    // 简单且稳定的FNV-1a变体哈希（字符串转16进制）
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  } catch {
    return '0';
  }
}

function buildFieldKey(artworkId: string, emotion: string, userInput: string | undefined, field: ExplanationFieldKey): string {
  const uiHash = stableHash(userInput || '');
  return `exp:${artworkId}:${emotion}:${uiHash}:${field}`;
}

function setCache(artworkId: string, emotion: string, userInput: string | undefined, field: ExplanationFieldKey, value: string | number): void {
  const key = buildFieldKey(artworkId, emotion, userInput, field);
  explanationCache.set(key, {
    value,
    expiresAt: Date.now() + EXPLANATION_CACHE_TTL
  });
}

function getCache(artworkId: string, emotion: string, userInput: string | undefined, field: ExplanationFieldKey): string | number | null {
  const key = buildFieldKey(artworkId, emotion, userInput, field);
  const entry = explanationCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    explanationCache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheExplanationFields(exp: ArtworkExplanation, emotion: string, userInput?: string): void {
  try {
    if (!exp.explanation) return;
    setCache(exp.artworkId, emotion, userInput, 'emotionalConnection', exp.explanation.emotionalConnection);
    setCache(exp.artworkId, emotion, userInput, 'artisticAnalysis', exp.explanation.artisticAnalysis);
    setCache(exp.artworkId, emotion, userInput, 'historicalContext', exp.explanation.historicalContext);
    setCache(exp.artworkId, emotion, userInput, 'curationReason', exp.explanation.curationReason);
    setCache(exp.artworkId, emotion, userInput, 'userRelevance', exp.explanation.userRelevance);
    setCache(exp.artworkId, emotion, userInput, 'confidence', exp.confidence);
  } catch (e) {
    // 缓存失败不影响主流程
    console.warn('cacheExplanationFields error:', e);
  }
}

function getCachedExplanation(artworkId: string, emotion: string, userInput?: string): ArtworkExplanation | null {
  try {
    const emotionalConnection = getCache(artworkId, emotion, userInput, 'emotionalConnection');
    const artisticAnalysis = getCache(artworkId, emotion, userInput, 'artisticAnalysis');
    const historicalContext = getCache(artworkId, emotion, userInput, 'historicalContext');
    const curationReason = getCache(artworkId, emotion, userInput, 'curationReason');
    const userRelevance = getCache(artworkId, emotion, userInput, 'userRelevance');
    const confidence = getCache(artworkId, emotion, userInput, 'confidence');

    // 只有在字段都齐全时才返回命中，保证严格JSON字段完整
    if (
      emotionalConnection != null &&
      artisticAnalysis != null &&
      historicalContext != null &&
      curationReason != null &&
      userRelevance != null &&
      confidence != null
    ) {
      const cachedResult = {
        artworkId,
        title: '',
        artist: '',
        emotionalConnection: String(emotionalConnection),
        artisticAnalysis: String(artisticAnalysis),
        historicalContext: String(historicalContext),
        curationReason: String(curationReason),
        userRelevance: String(userRelevance),
        explanation: {
          emotionalConnection: String(emotionalConnection),
          artisticAnalysis: String(artisticAnalysis),
          historicalContext: String(historicalContext),
          curationReason: String(curationReason),
          userRelevance: String(userRelevance)
        },
        confidence: Number(confidence),
        processingTime: 0
      };

      // 检查缓存内容是否包含英文，如果是则清除缓存并重新生成
      const hasEnglish = needsChineseConversion(
        cachedResult.explanation?.emotionalConnection +
        cachedResult.explanation?.artisticAnalysis +
        cachedResult.explanation?.historicalContext +
        cachedResult.explanation?.curationReason +
        cachedResult.explanation?.userRelevance
      );

      if (hasEnglish) {
        console.log('🔄 缓存内容包含英文，清除缓存并重新生成');
        // 清除相关缓存项
        const fields: ExplanationFieldKey[] = ['emotionalConnection', 'artisticAnalysis', 'historicalContext', 'curationReason', 'userRelevance', 'confidence'];
        fields.forEach(field => {
          const key = buildFieldKey(artworkId, emotion, userInput, field);
          explanationCache.delete(key);
        });
        return null;
      }

      return cachedResult;
    }
    return null;
  } catch (e) {
    console.warn('getCachedExplanation error:', e);
    return null;
  }
}

// 带指数退避的重试封装，针对各种可恢复错误
async function generateWithRetry<T>(fn: () => Promise<T>, delaysMs: number[]): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      // 外围超时保护（15s，减少超时时间）
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('讲解生成超时')), 15000));
      // 竞速：函数 vs 超时
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await Promise.race([fn(), timeout]) as any as T;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      
      // 扩展重试条件，包含更多可恢复的错误类型
      const is429 = msg.includes('429') || msg.includes('High concurrency') || msg.includes('Too Many Requests');
      const isTimeout = msg.includes('超时') || msg.includes('timeout') || msg.includes('aborted');
      const isAbortError = msg.includes('AbortError') || msg.includes('aborted') || msg.includes('This operation was aborted');
      const isJsonParseError = msg.includes('无法解析') || msg.includes('JSON') || msg.includes('解析失败');
      const isFormatError = msg.includes('格式错误') || msg.includes('格式') || msg.includes('格式不正确');
      const isContentError = msg.includes('内容质量') || msg.includes('内容') || msg.includes('质量');
      const isNetworkError = msg.includes('网络') || msg.includes('network') || msg.includes('连接');
      const isApiError = msg.includes('API') || msg.includes('api') || msg.includes('服务');
      
      const isRetriable = is429 || isTimeout || isAbortError || isJsonParseError || isFormatError || isContentError || isNetworkError || isApiError;
      
      console.log(`🔄 重试检查 (尝试 ${attempt + 1}/${delaysMs.length + 1}): ${msg} -> 可重试: ${isRetriable}`);
      
      if (attempt === delaysMs.length || !isRetriable) break;
      const delay = delaysMs[attempt] + Math.floor(Math.random() * 200);
      console.log(`⏳ 重试延迟: ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('讲解生成失败');
}

// 增强解析：处理自由形式的深度讲解内容
function parseEnhancedExplanation(content: string): { intro: string; details: string } {
  const text = (content || '').trim();

  // 首先尝试匹配原有的"简介："和"详情："格式
  const introMatch = text.match(/简介：\s*(.+)/);
  const detailsMatch = text.match(/详情：\s*([\s\S]+)/);

  if (introMatch && detailsMatch) {
    // 保留原有解析逻辑
    let intro = (introMatch?.[1] || '').trim().slice(0, 80);
    let detailsRaw = (detailsMatch?.[1] || '').trim();
    const paras = detailsRaw.split(/\n{2,}/).map(s => s.trim()).filter(Boolean).slice(0, 2);
    const details = paras.join('\n\n');
    return { intro, details };
  }

  // 新的智能解析逻辑：将长文本分为简介和详情
  const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const all = lines.join(' ');

  // 尝试按句子分割
  const sentences = all.split(/。|\.|!|！|\?|？/).map(s => s.trim()).filter(s => s.length > 0);

  if (sentences.length === 0) {
    return { intro: '', details: '' };
  }

  // 简介取前1-2句话，控制在60字以内
  let intro = '';
  let introLength = 0;
  for (let i = 0; i < Math.min(2, sentences.length); i++) {
    const sentence = sentences[i];
    if (introLength + sentence.length <= 60) {
      intro += (intro ? '' : '') + sentence + '。';
      introLength += sentence.length + 1;
    } else {
      break;
    }
  }

  // 详情取剩余内容
  const introEndIndex = all.indexOf(intro);
  let details = introEndIndex >= 0 ? all.substring(introEndIndex + intro.length).trim() : all;

  // 如果没有详情，则用全部内容作为详情
  if (!details) {
    details = all;
  }

  // 清理格式，保留最多两段
  const detailsParagraphs = details.split(/\n{2,}/).map(s => s.trim()).filter(Boolean).slice(0, 2);
  const cleanDetails = detailsParagraphs.join('\n\n');

  return { intro: intro.trim(), details: cleanDetails || details };
}

// 宽松解析：从Markdown小标题中提取五段内容，缺失则用简短自然语句补齐（保留作为备用）
function parseFreeformExplanation(content: string): { intro: string; details: string } {
  const text = (content || '').trim();
  const introMatch = text.match(/简介：\s*(.+)/);
  const detailsMatch = text.match(/详情：\s*([\s\S]+)/);
  let intro = (introMatch?.[1] || '').trim().slice(0, 40);
  let detailsRaw = (detailsMatch?.[1] || '').trim();
  // 前缀未命中时，退化为首句=简介，余下文本=详情
  if (!intro || !detailsRaw) {
    const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
    const all = lines.join(' ');
    const sentSplit = all.split(/。|\.|!|！|\?|？/);
    const firstSentence = (sentSplit[0] || '').trim();
    const restText = all.substring(all.indexOf(firstSentence) + firstSentence.length).trim();
    if (!intro) intro = firstSentence.slice(0, 40);
    if (!detailsRaw) detailsRaw = restText;
  }
  // 只保留最多两段
  const paras = detailsRaw.split(/\n{2,}/).map(s => s.trim()).filter(Boolean).slice(0, 2);
  const details = paras.join('\n\n');
  return { intro, details };
}

/**
 * 创建降级讲解 - 优化版本，提供更有价值的内容
 */
function createFallbackExplanation(
  artwork: Artwork,
  emotion: string,
  userInput?: string
): ArtworkExplanation {
  // 根据情绪生成更有针对性的描述
  const emotionDescriptions = {
    'joy': '欢快明亮的色彩和动态构图',
    'melancholy': '深沉内敛的色调和富有表现力的构图',
    'calm': '柔和平衡的色彩和宁静的构图',
    'lonely': '空旷冷峻的构图和孤独的氛围',
    'passion': '强烈对比的色彩和充满激情的笔触'
  };
  
  const emotionStyle = emotionDescriptions[emotion as keyof typeof emotionDescriptions] || '独特的艺术表现力';
  
  // 根据材质和年代生成更具体的分析
  const mediumAnalysis = artwork.medium.includes('Oil') ? '油画技法' : 
                        artwork.medium.includes('Watercolor') ? '水彩技法' :
                        artwork.medium.includes('Print') ? '版画技法' :
                        artwork.medium.includes('Sculpture') ? '雕塑技法' : '独特技法';
  
  const periodContext = parseInt(artwork.year) < 1800 ? '古典艺术时期' :
                       parseInt(artwork.year) < 1900 ? '19世纪艺术' :
                       parseInt(artwork.year) < 2000 ? '现代艺术' : '当代艺术';
  
  return {
    artworkId: artwork.id,
    title: artwork.title,
    artist: artwork.artist,
    emotionalConnection: `《${artwork.title}》通过${emotionStyle}，与"${emotion}"情绪产生深刻共鸣。作品在视觉表现上直接呼应了这种情感状态。`,
    artisticAnalysis: `${artwork.artist}在${artwork.year}年运用${mediumAnalysis}创作了这件${artwork.medium}作品，展现了艺术家独特的创作风格和技法特点。`,
    historicalContext: `这件作品创作于${periodContext}，体现了当时的社会文化背景和艺术发展趋势，具有重要的历史价值。`,
    curationReason: `这件作品被选中是因为它通过${emotionStyle}完美地诠释了"${emotion}"这一策展主题，为观众提供了深刻的情感体验。`,
    userRelevance: userInput ? `这件作品与您的描述"${userInput}"在情感表达上高度契合，能够满足您对"${emotion}"情绪的艺术探索需求。` : `这件作品与您对"${emotion}"情绪的需求高度匹配，提供了丰富的艺术体验。`,
    explanation: {
      emotionalConnection: `《${artwork.title}》通过${emotionStyle}，与"${emotion}"情绪产生深刻共鸣。作品在视觉表现上直接呼应了这种情感状态。`,
      artisticAnalysis: `${artwork.artist}在${artwork.year}年运用${mediumAnalysis}创作了这件${artwork.medium}作品，展现了艺术家独特的创作风格和技法特点。`,
      historicalContext: `这件作品创作于${periodContext}，体现了当时的社会文化背景和艺术发展趋势，具有重要的历史价值。`,
      curationReason: `这件作品被选中是因为它通过${emotionStyle}完美地诠释了"${emotion}"这一策展主题，为观众提供了深刻的情感体验。`,
      userRelevance: userInput ? `这件作品与您的描述"${userInput}"在情感表达上高度契合，能够满足您对"${emotion}"情绪的艺术探索需求。` : `这件作品与您对"${emotion}"情绪的需求高度匹配，提供了丰富的艺术体验。`
    },
    confidence: 0.7, // 提高置信度，因为内容更有价值
    processingTime: 0
  };
}

/**
 * 生成策展总结
 */
export async function generateCurationSummary(
  artworks: Artwork[],
  emotion: string,
  explanations: ArtworkExplanation[],
  userInput?: string
): Promise<string> {
  const prompt = `基于以下策展结果，生成一个简洁而深刻的策展总结。

策展主题：${emotion}
${userInput ? `用户需求：${userInput}` : ''}

策展作品：
${artworks.map((artwork, index) => `${index + 1}. 《${artwork.title}》- ${artwork.artist} (${artwork.year})`).join('\n')}

作品讲解要点：
${explanations.map((exp, index) => `${index + 1}. ${exp.title}: ${exp.explanation?.emotionalConnection || ''}`).join('\n')}

请生成一个200-300字的策展总结，包括：
1. 策展主题的核心理念
2. 作品选择的逻辑
3. 整体策展的艺术价值
4. 与用户需求的契合度

语言要求：专业而生动，富有感染力。`;

  const messages = [
    { role: 'system' as const, content: '你是一位资深的艺术策展人，擅长撰写富有感染力的策展总结。' },
    { role: 'user' as const, content: prompt }
  ];

  try {
    let response;
    if (glmOptimizedClient.hasValidApiKey()) {
      console.log('🔑 使用GLM客户端生成策展总结...');
      response = await glmOptimizedClient.deepAnalysis(messages, { temperature: 0.8, max_tokens: 512 });
    } else {
      console.log('🔑 GLM不可用，使用OpenAI客户端生成策展总结...');
      response = await openaiClient.chat(messages, { temperature: 0.8, max_tokens: 512 });
    }
    return response.choices[0]?.message?.content || '这是一个精心策划的艺术展览，展现了深刻的情感表达和艺术价值。';
  } catch (error) {
    console.error('策展总结生成失败:', error);
    return '这是一个精心策划的艺术展览，通过精选的作品展现了深刻的情感表达和艺术价值。';
  }
}