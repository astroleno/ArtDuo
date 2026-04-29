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
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const TOKEN_PATTERN = /[\p{Script=Han}]+|[a-z0-9]+/giu;

const TOKEN_ALIASES: Record<string, string[]> = {
  calm: ["serenity", "tranquil", "peaceful", "still"],
  celebration: ["joy", "delight", "playful", "bright"],
  contemplation: ["reflective", "meditative", "quiet", "stillness"],
  dawn: ["hope", "renewal", "rebirth", "light"],
  desire: ["yearning", "longing", "passion", "craving"],
  delight: ["joy", "cheerful", "playful", "bright"],
  enigmatic: ["mystery", "oracle", "secret", "shadow"],
  festival: ["joy", "celebration", "delight", "dance", "music"],
  gentle: ["hope", "optimism", "renewal"],
  hope: ["optimism", "renewal", "uplift", "dawn", "promise"],
  hush: ["serenity", "tranquil", "calm", "quiet", "stillness"],
  impossible: ["wonder", "awe", "amazement", "marvel"],
  inward: ["contemplation", "reflective", "meditative"],
  joy: ["cheerful", "delight", "playful", "bright"],
  laughter: ["joy", "cheerful", "delight", "playful"],
  melancholy: ["somber", "pensive", "quiet", "sorrow"],
  monastic: ["contemplation", "cloister", "meditative", "quiet"],
  mystery: ["enigmatic", "oracle", "secret", "shadow"],
  occult: ["mystery", "oracle", "secret", "shadow", "apparition"],
  optimism: ["hope", "renewal", "uplift", "promise"],
  pause: ["contemplation", "stillness", "quiet"],
  rebirth: ["hope", "renewal", "dawn", "light"],
  repose: ["serenity", "tranquil", "calm", "restful"],
  restful: ["serenity", "tranquil", "calm", "repose"],
  reflective: ["contemplation", "meditative", "quiet", "stillness"],
  revelation: ["wonder", "awe", "amazement", "marvel"],
  renewal: ["hope", "optimism", "rebirth", "dawn", "light"],
  serenity: ["tranquil", "calm", "still", "peaceful"],
  skies: ["wonder", "awe", "impossible", "light"],
  sorrow: ["melancholy", "somber", "pensive", "grief"],
  stillness: ["serenity", "quiet", "still"],
  tranquil: ["serenity", "calm", "peaceful", "still"],
  wonder: ["awe", "amazement", "curiosity", "marvel"],
  whisper: ["mystery", "oracle", "secret", "shadow"],
  yearning: ["desire", "longing", "passion", "craving"],
  之后: ["hope", "renewal"],
  宁静: ["serenity", "tranquil", "calm", "repose"],
  希望: ["hope", "optimism", "renewal", "dawn"],
  忧伤: ["melancholy", "sorrow", "pensive", "somber"],
  惊叹: ["wonder", "awe", "amazement", "marvel"],
  欢庆: ["joy", "celebration", "delight", "bright"],
  沉思: ["contemplation", "reflective", "meditative", "quiet"],
  渴望: ["desire", "yearning", "longing", "passion"],
  神谕: ["mystery", "oracle", "secret", "shadow"],
  静默: ["contemplation", "serenity", "quiet", "stillness"],
  黑暗: ["melancholy", "shadow", "hope"],
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
  const baseTokens = collectBaseTokens(value);

  return unique([...expandAliases(baseTokens), ...buildAdjacentBigrams(baseTokens)]);
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
