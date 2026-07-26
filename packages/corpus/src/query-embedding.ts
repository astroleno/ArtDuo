import type { ArtworkRecord } from "@artduo/contracts";

export const DEFAULT_EMBEDDING_DIMENSIONS = 256;
export const LOCAL_EMBEDDING_MODEL_ID = "local-hash-embedding-v1";

const STOP_WORDS = new Set([
  "after",
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "give",
  "i",
  "in",
  "into",
  "me",
  "my",
  "need",
  "of",
  "on",
  "or",
  "show",
  "the",
  "to",
  "want",
  "with",
]);

const TOKEN_PATTERN = /[\p{Script=Han}]+|[a-z0-9]+/giu;

const TOKEN_ALIASES: Record<string, string[]> = {
  calm: ["serenity", "tranquil", "peaceful", "still"],
  celebration: ["joy", "delight", "playful", "bright"],
  charcoal: ["quiet", "melancholy", "serenity"],
  church: ["awe", "wonder", "reverence", "contemplation"],
  contemplation: ["reflective", "meditative", "quiet", "stillness"],
  cool: ["serenity", "quiet", "blue"],
  dark: ["melancholy", "shadow", "black"],
  dawn: ["hope", "renewal", "rebirth", "light"],
  desire: ["yearning", "longing", "passion", "craving"],
  distance: ["yearning", "longing", "landscape"],
  distant: ["yearning", "longing", "landscape"],
  delight: ["joy", "cheerful", "playful", "bright"],
  enigmatic: ["mystery", "oracle", "secret", "shadow"],
  festival: ["joy", "celebration", "delight", "dance", "music"],
  focus: ["contemplation", "quiet", "stillness"],
  focused: ["contemplation", "quiet", "stillness"],
  gentle: ["hope", "optimism", "renewal"],
  gold: ["warmth", "awe", "wonder"],
  golden: ["gold", "warmth", "awe"],
  happiness: ["joy", "delight", "cheerful", "bright"],
  happy: ["joy", "delight", "cheerful", "bright"],
  hope: ["optimism", "renewal", "uplift", "dawn", "promise"],
  hush: ["serenity", "tranquil", "calm", "quiet", "stillness"],
  impossible: ["wonder", "awe", "amazement", "marvel"],
  intimate: ["desire", "quiet", "longing"],
  inward: ["contemplation", "reflective", "meditative"],
  joy: ["cheerful", "delight", "playful", "bright"],
  landscape: ["landscapes", "yearning", "distance"],
  landscapes: ["landscape", "yearning", "distance"],
  laughter: ["joy", "cheerful", "delight", "playful"],
  melancholy: ["somber", "pensive", "quiet", "sorrow"],
  minimal: ["clarity", "neutral", "serenity", "quiet"],
  monastic: ["contemplation", "cloister", "meditative", "quiet"],
  mystery: ["enigmatic", "oracle", "secret", "shadow"],
  occult: ["mystery", "oracle", "secret", "shadow", "apparition"],
  optimism: ["hope", "renewal", "uplift", "promise"],
  pause: ["contemplation", "stillness", "quiet"],
  quiet: ["serenity", "calm", "stillness", "contemplation"],
  rebirth: ["hope", "renewal", "dawn", "light"],
  repose: ["serenity", "tranquil", "calm", "restful"],
  reverence: ["awe", "wonder", "contemplation", "reverent"],
  reverent: ["awe", "wonder", "contemplation", "reverence"],
  restful: ["serenity", "tranquil", "calm", "repose"],
  reflective: ["contemplation", "meditative", "quiet", "stillness"],
  revelation: ["wonder", "awe", "amazement", "marvel"],
  renewal: ["hope", "optimism", "rebirth", "dawn", "light"],
  serene: ["serenity", "tranquil", "calm", "peaceful"],
  serenity: ["tranquil", "calm", "still", "peaceful"],
  skies: ["wonder", "awe", "impossible", "light"],
  silence: ["contemplation", "quiet", "serenity", "stillness"],
  sorrow: ["melancholy", "somber", "pensive", "grief"],
  stillness: ["serenity", "quiet", "still"],
  tranquil: ["serenity", "calm", "peaceful", "still"],
  warm: ["warmth", "gold", "serenity"],
  warmth: ["warm", "gold", "serenity"],
  wonder: ["awe", "amazement", "curiosity", "marvel"],
  whisper: ["quiet", "serenity", "stillness", "mystery", "secret"],
  yearning: ["desire", "longing", "passion", "craving"],
  之后: ["hope", "renewal"],
  专注: ["contemplation", "focus", "quiet", "stillness"],
  东方: ["asian", "ink", "serenity"],
  不想: ["silence", "quiet", "contemplation"],
  不绝: ["hope", "renewal"],
  人物: ["portrait", "intimate", "contemplation"],
  书房: ["contemplation", "focus", "quiet"],
  亮起: ["hope", "light", "renewal"],
  蓝灰: ["blue", "charcoal", "serenity"],
  蓝色: ["blue", "serenity", "cool"],
  低光: ["mystery", "shadow", "black"],
  到平: ["serenity", "calm", "stillness"],
  回到: ["contemplation", "serenity", "return"],
  克制: ["contemplation", "restraint", "quiet"],
  剧场: ["mystery", "drama", "theater", "black"],
  危险: ["desire", "drama", "tension", "red"],
  古老: ["awe", "contemplation", "reverence"],
  古典: ["awe", "contemplation", "museum_hall"],
  余韵: ["contemplation", "serenity", "wonder"],
  吵闹: ["serenity", "quiet", "calm"],
  呼吸: ["serenity", "calm", "light"],
  哀伤: ["melancholy", "sorrow", "grief"],
  回望: ["nostalgia", "melancholy", "contemplation"],
  好奇: ["wonder", "curiosity", "awe"],
  安静: ["serenity", "tranquil", "calm", "quiet", "stillness"],
  室内: ["gallery", "interior", "quiet"],
  庄重: ["awe", "contemplation", "reverence"],
  宁静: ["serenity", "tranquil", "calm", "repose"],
  希冀: ["hope", "optimism", "renewal"],
  希望: ["hope", "optimism", "renewal", "dawn"],
  平静: ["serenity", "tranquil", "calm", "stillness"],
  幸福: ["joy", "delight", "bright"],
  很吵: ["serenity", "quiet", "calm"],
  孤独: ["melancholy", "contemplation", "quiet"],
  忧伤: ["melancholy", "sorrow", "pensive", "somber"],
  怀旧: ["nostalgia", "melancholy", "silver"],
  想念: ["desire", "yearning", "longing", "melancholy"],
  惊叹: ["wonder", "awe", "amazement", "marvel"],
  愿望: ["hope", "desire", "longing"],
  慢慢: ["serenity", "quiet", "stillness"],
  戏剧: ["drama", "mystery", "tension"],
  房间: ["gallery", "interior", "quiet"],
  教堂: ["awe", "contemplation", "reverence"],
  明亮: ["joy", "bright", "hope", "light"],
  暗处: ["mystery", "shadow", "black"],
  暗红: ["burgundy", "red", "melancholy"],
  暗色: ["mystery", "shadow", "black"],
  暖金: ["gold", "warmth", "serenity"],
  月光: ["serenity", "quiet", "light"],
  朱红: ["red", "burgundy", "melancholy"],
  木色: ["walnut", "wood", "warmth"],
  灰色: ["gray", "silver", "melancholy"],
  冷一: ["cool", "blue", "serenity"],
  冷点: ["cool", "blue", "serenity"],
  冷色: ["cool", "blue", "serenity"],
  深木: ["walnut", "wood", "dark"],
  温柔: ["serenity", "hope", "gentle"],
  欢庆: ["joy", "celebration", "delight", "bright"],
  快乐: ["joy", "cheerful", "delight", "bright"],
  沉思: ["contemplation", "reflective", "meditative", "quiet"],
  沉默: ["contemplation", "silence", "quiet"],
  治愈: ["hope", "serenity", "light"],
  清晨: ["hope", "dawn", "light"],
  欲望: ["desire", "yearning", "longing", "passion"],
  灰调: ["melancholy", "silver", "gray"],
  照片: ["nostalgia", "melancholy", "silver"],
  留白: ["contemplation", "silence", "serenity", "quiet"],
  疲惫: ["serenity", "restful", "melancholy"],
  睡前: ["serenity", "quiet", "restful", "melancholy"],
  渴望: ["desire", "yearning", "longing", "passion"],
  版画: ["prints", "black", "white", "contemplation"],
  画像: ["portrait", "contemplation", "intimate"],
  神秘: ["mystery", "oracle", "secret", "shadow"],
  神谕: ["mystery", "oracle", "secret", "shadow"],
  秘密: ["mystery", "secret", "shadow"],
  红色: ["red", "desire", "drama"],
  线条: ["line", "prints", "contemplation"],
  绝望: ["melancholy", "despair", "sorrow"],
  绿色: ["hope", "renewal", "serenity"],
  美丽: ["wonder", "awe", "serenity"],
  肖像: ["portrait", "contemplation", "intimate"],
  金色: ["gold", "warmth", "awe"],
  说话: ["silence", "quiet", "contemplation"],
  节日: ["joy", "celebration", "delight", "light"],
  跳跃: ["joy", "playful", "bright"],
  远处: ["yearning", "distance", "hope"],
  远方: ["yearning", "distance", "desire"],
  靠近: ["desire", "intimate", "longing"],
  静默: ["contemplation", "serenity", "quiet", "stillness"],
  风景: ["landscape", "yearning", "hope"],
  馆厅: ["museum_hall", "awe", "contemplation"],
  黑白: ["black", "white", "monochrome", "contemplation"],
  黑暗: ["melancholy", "shadow", "hope"],
  墨色: ["ink", "black", "contemplation"],
  纸本: ["paper", "asian", "contemplation"],
};

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function hashToken(value: string, seed = 2166136261): number {
  let hash = seed;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function normalizeVector(values: number[]): number[] {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0));

  if (magnitude === 0) {
    return values;
  }

  return values.map((value) => Number((value / magnitude).toFixed(6)));
}

function splitHanToken(value: string): string[] {
  if (!/^\p{Script=Han}+$/u.test(value)) {
    return [value];
  }

  if (value.length === 1) {
    return [value];
  }

  const grams: string[] = [];

  for (let index = 0; index < value.length - 1; index += 1) {
    grams.push(value.slice(index, index + 2));
  }

  return grams;
}

function buildAdjacentBigrams(tokens: string[]): string[] {
  const bigrams: string[] = [];

  for (let index = 0; index < tokens.length - 1; index += 1) {
    bigrams.push(`${tokens[index]}:${tokens[index + 1]}`);
  }

  return bigrams;
}

function applyNegativeIntentFilters(normalizedText: string, tokens: string[]): string[] {
  const blocked = new Set<string>();
  const blocksBrightness = /(不要|别|不想)[\p{L}\p{N}\s]{0,8}明亮/u.test(normalizedText) ||
    /\b(not too|not|no)\s+bright\b/.test(normalizedText);
  const blocksCelebration = /(不要|别|不想)[\p{L}\p{N}\s]{0,8}(热闹|快乐)/u.test(normalizedText) ||
    /\b(not too|not|no)\s+(loud|dramatic)\b/.test(normalizedText);

  if (blocksBrightness || blocksCelebration) {
    for (const token of ["joy", "bright", "cheerful", "delight", "playful", "celebration"]) {
      blocked.add(token);
    }
  }
  if (blocksBrightness) {
    for (const token of ["hope", "light", "renewal", "dawn"]) {
      blocked.add(token);
    }
  }

  return tokens.filter((token) => !blocked.has(token));
}

function expandAliases(tokens: string[]): string[] {
  const expanded: string[] = [];

  for (const token of tokens) {
    expanded.push(token);
    expanded.push(...(TOKEN_ALIASES[token] ?? []));
  }

  return unique(expanded);
}

function collectBaseTokens(value: string): string[] {
  const normalized = normalizeQueryText(value);
  const rawTokens = normalized.match(TOKEN_PATTERN) ?? [];

  return unique(
    rawTokens
      .flatMap((token) => splitHanToken(token))
      .map((token) => token.trim())
      .filter((token) => token.length > 0)
      .filter((token) => !STOP_WORDS.has(token)),
  );
}

export function normalizeQueryText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeQueryText(value: string): string[] {
  const normalizedText = normalizeQueryText(value);
  const baseTokens = collectBaseTokens(value);
  const tokens = [...expandAliases(baseTokens), ...buildAdjacentBigrams(baseTokens)];

  return unique(applyNegativeIntentFilters(normalizedText, tokens));
}

export function tokenizeKeywordText(value: string): string[] {
  return collectBaseTokens(value);
}

export function embedText(
  value: string,
  options: {
    dimensions?: number;
  } = {},
): {
  model: string;
  dimensions: number;
  normalizedText: string;
  tokens: string[];
  vector: number[];
} {
  const dimensions = options.dimensions ?? DEFAULT_EMBEDDING_DIMENSIONS;
  const normalizedText = normalizeQueryText(value);
  const tokens = tokenizeQueryText(value);
  const vector = new Array<number>(dimensions).fill(0);

  for (const token of tokens) {
    const index = hashToken(token) % dimensions;
    const sign = hashToken(`${token}:sign`) % 2 === 0 ? 1 : -1;
    const weight = token.includes(":") ? 0.65 : 1;

    vector[index] += sign * weight;
  }

  return {
    model: LOCAL_EMBEDDING_MODEL_ID,
    dimensions,
    normalizedText,
    tokens,
    vector: normalizeVector(vector),
  };
}

export function buildArtworkEmbeddingText(record: ArtworkRecord): string {
  return [
    record.metadata.title,
    record.metadata.artistDisplayName,
    record.metadata.storySnippet,
    record.metadata.descriptionClean,
    ...record.metadata.moodTags,
    ...record.metadata.colorTags,
    ...record.metadata.subjectTags,
    ...record.metadata.compositionTags,
    record.retrieval.searchText,
    ...record.retrieval.emotionLabels,
    ...(record.retrieval.keywordBoosts ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}
