import type {
  AffectSignal,
  AffectState,
  AestheticConstraint,
  MemoryHint,
  SpatialNeed,
  TemporalShape,
  TemporalStageHint,
  UserAffectAgent,
} from "@artduo/contracts";

import { normalizeQueryText, tokenizeQueryText } from "./query-embedding";
import { findAffectResistanceConflict } from "./affect-ontology";

type SignalMetrics = AffectState;

const DEFAULT_STATE: AffectState = {
  valence: 0.5,
  arousal: 0.36,
  tension: 0.28,
  wonder: 0.32,
  intimacy: 0.5,
};

const SIGNAL_METRICS: Record<string, SignalMetrics> = {
  awe: { valence: 0.62, arousal: 0.62, tension: 0.32, wonder: 0.88, intimacy: 0.38 },
  bright: { valence: 0.78, arousal: 0.68, tension: 0.2, wonder: 0.46, intimacy: 0.24 },
  burgundy: { valence: 0.42, arousal: 0.34, tension: 0.36, wonder: 0.42, intimacy: 0.72 },
  calm: { valence: 0.56, arousal: 0.18, tension: 0.12, wonder: 0.26, intimacy: 0.52 },
  contemplation: { valence: 0.48, arousal: 0.24, tension: 0.22, wonder: 0.42, intimacy: 0.5 },
  desire: { valence: 0.56, arousal: 0.58, tension: 0.42, wonder: 0.48, intimacy: 0.82 },
  despair: { valence: 0.12, arousal: 0.46, tension: 0.86, wonder: 0.12, intimacy: 0.38 },
  "heavy-grief": { valence: 0.12, arousal: 0.34, tension: 0.82, wonder: 0.12, intimacy: 0.48 },
  held: { valence: 0.55, arousal: 0.2, tension: 0.12, wonder: 0.28, intimacy: 0.84 },
  hope: { valence: 0.72, arousal: 0.38, tension: 0.16, wonder: 0.58, intimacy: 0.48 },
  intimate: { valence: 0.52, arousal: 0.28, tension: 0.22, wonder: 0.34, intimacy: 0.86 },
  joy: { valence: 0.86, arousal: 0.66, tension: 0.08, wonder: 0.46, intimacy: 0.36 },
  "low-light": { valence: 0.4, arousal: 0.18, tension: 0.3, wonder: 0.46, intimacy: 0.7 },
  loud: { valence: 0.58, arousal: 0.82, tension: 0.54, wonder: 0.28, intimacy: 0.18 },
  melancholy: { valence: 0.32, arousal: 0.28, tension: 0.48, wonder: 0.28, intimacy: 0.58 },
  mystery: { valence: 0.44, arousal: 0.48, tension: 0.48, wonder: 0.7, intimacy: 0.44 },
  quiet: { valence: 0.52, arousal: 0.18, tension: 0.12, wonder: 0.28, intimacy: 0.62 },
  restful: { valence: 0.55, arousal: 0.16, tension: 0.1, wonder: 0.2, intimacy: 0.62 },
  sadness: { valence: 0.26, arousal: 0.3, tension: 0.56, wonder: 0.2, intimacy: 0.54 },
  serenity: { valence: 0.58, arousal: 0.18, tension: 0.1, wonder: 0.28, intimacy: 0.54 },
  walnut: { valence: 0.46, arousal: 0.22, tension: 0.24, wonder: 0.32, intimacy: 0.78 },
  wonder: { valence: 0.68, arousal: 0.66, tension: 0.28, wonder: 0.9, intimacy: 0.36 },
};

const DESIRE_TOKENS = new Set([
  "awe",
  "calm",
  "contemplation",
  "desire",
  "held",
  "hope",
  "intimate",
  "joy",
  "longing",
  "melancholy",
  "mystery",
  "quiet",
  "restful",
  "serenity",
  "stillness",
  "wonder",
  "yearning",
]);

const NEGATIVE_SIGNAL_PATTERNS: Array<[RegExp, string[]]> = [
  [/(不要|别|不想|不能|避免|拒绝)[^，。,.!?；;]{0,10}(明亮|亮|bright)|\b(not too|not|no)\s+bright\b/u, ["bright"]],
  [/(不要|别|不想|不能|避免|拒绝)[^，。,.!?；;]{0,10}(吵|吵闹|热闹|喧闹)|\b(not|no)\s+loud\b/u, ["loud"]],
  [/(不要|别|不想|不能|避免|拒绝|不)[^，。,.!?；;]{0,10}(悲伤|哀伤|忧伤)|\b(not|no)\s+(sad|sadness|sorrow)\b/u, ["sadness"]],
  [/(不要|别|不想|不能|避免|拒绝|不)[^，。,.!?；;]{0,10}(绝望|沉重|悲恸)|\b(not|no)\s+(grief|despair|heavy grief)\b/u, ["heavy-grief"]],
  [/\bnot\s+cartoonish\b|\bno\s+cartoonish\b/u, ["cartoonish"]],
  [/(不要|别|不想|不能|避免|拒绝)[^，。,.!?；;]{0,12}(剧情|戏剧|戏剧性)|\bnot\s+(dramatic|drama)\b|\bno\s+(dramatic|drama)\b/u, ["heavy-drama"]],
];

const VISUAL_PREFERENCES: Array<[RegExp, string[]]> = [
  [/暗红|朱红|burgundy|carmine/u, ["burgundy"]],
  [/深木|木色|walnut|dark wood|wood/u, ["walnut"]],
  [/低光|暗处|暗色|low light|low-light|shadow/u, ["low-light"]],
  [/低饱和|muted|克制/u, ["muted"]],
  [/蓝灰|冷色|cool|blue gray|blue-grey/u, ["blue-gray"]],
  [/暖金|金色|gold|warm/u, ["gold"]],
];

const MEMORY_HINTS: Array<[RegExp, string]> = [
  [/睡前|bedtime|before sleep/u, "bedtime"],
  [/老照片|old photo|nostalgia/u, "old-photo"],
  [/童年|childhood/u, "childhood"],
  [/书房|study room|quiet room/u, "quiet-room"],
];

const SPATIAL_NEEDS: Array<[RegExp, string]> = [
  [/房间|室内|room|interior/u, "room"],
  [/靠近|close|intimate/u, "close"],
  [/远处|远方|distance|distant/u, "distance"],
  [/教堂|cathedral|church|hall/u, "hall"],
];

const STAGE_SPLIT_PATTERN = /(?:先|开头|起初|from|begin with|start with|then|再|中段|中间|finally|最后|return to|ending with)/giu;

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function signal(kind: AffectSignal["kind"], value: string, confidence = 0.78): AffectSignal {
  return {
    kind,
    value,
    confidence,
  };
}

function detectLanguageHints(sourceText: string): string[] {
  const hints: string[] = [];
  if (/\p{Script=Han}/u.test(sourceText)) {
    hints.push("zh");
  }
  if (/[a-z]/iu.test(sourceText)) {
    hints.push("en");
  }

  return hints.length > 0 ? hints : ["unknown"];
}

function collectResistances(normalized: string): AffectSignal[] {
  const values = NEGATIVE_SIGNAL_PATTERNS.flatMap(([pattern, signals]) => pattern.test(normalized) ? signals : []);

  return unique(values).map((value) => signal("resistance", value, 0.88));
}

function collectVisualConstraints(normalized: string, resistances: AffectSignal[]): AestheticConstraint[] {
  const constraints: AestheticConstraint[] = [];

  for (const [pattern, values] of VISUAL_PREFERENCES) {
    if (pattern.test(normalized)) {
      constraints.push(
        ...values.map((value) => ({
          value,
          polarity: "prefer" as const,
          severity: "soft" as const,
          confidence: 0.84,
        })),
      );
    }
  }

  constraints.push(
    ...resistances
      .filter((entry) => ["bright", "loud", "cartoonish"].includes(entry.value))
      .map((entry) => ({
        value: entry.value,
        polarity: "avoid" as const,
        severity: "hard" as const,
        confidence: entry.confidence,
      })),
  );

  return uniqueByValueAndPolarity(constraints);
}

function uniqueByValueAndPolarity(values: AestheticConstraint[]): AestheticConstraint[] {
  const seen = new Set<string>();
  const result: AestheticConstraint[] = [];

  for (const value of values) {
    const key = `${value.polarity}:${value.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }

  return result;
}

function collectMemoryHints(normalized: string): MemoryHint[] {
  return MEMORY_HINTS.flatMap(([pattern, value]) =>
    pattern.test(normalized)
      ? [{ value, confidence: 0.78 }]
      : [],
  );
}

function collectSpatialNeeds(normalized: string): SpatialNeed[] {
  return MEMORY_HINTS.some(([pattern]) => pattern.test(normalized))
    ? unique(
        SPATIAL_NEEDS.flatMap(([pattern, value]) => pattern.test(normalized) ? [value] : []),
      ).map((value) => ({ value, confidence: 0.7 }))
    : unique(
        SPATIAL_NEEDS.flatMap(([pattern, value]) => pattern.test(normalized) ? [value] : []),
      ).map((value) => ({ value, confidence: 0.66 }));
}

function normalizeSignalValue(token: string): string {
  if (token === "stillness" || token === "tranquil") {
    return "quiet";
  }
  if (token === "yearning" || token === "longing") {
    return "desire";
  }
  if (token === "awe" || token === "amazement" || token === "marvel") {
    return token === "awe" ? "awe" : "wonder";
  }
  if (token === "optimism" || token === "renewal") {
    return "hope";
  }

  return token;
}

function collectDesires(tokens: string[], normalized: string, resistances: AffectSignal[]): AffectSignal[] {
  const resistanceValues = new Set(resistances.map((entry) => entry.value));
  const resistedSignals = [...resistanceValues];
  const values = tokens
    .map(normalizeSignalValue)
    .filter((token) => DESIRE_TOKENS.has(token))
    .filter((token) => !findAffectResistanceConflict(resistedSignals, [token]));

  if (/睡前|bedtime|before sleep/u.test(normalized)) {
    values.push("restful", "quiet", "held");
  }
  if (/暗红|深木|低光|burgundy|walnut|low light/u.test(normalized)) {
    values.push("intimate", "low-light");
  }

  return unique(values)
    .filter((value) => !findAffectResistanceConflict(resistedSignals, [value]))
    .map((value) => signal(value === "low-light" ? "visual" : "emotion", value, 0.8));
}

function signalsForSegment(segment: string): AffectSignal[] {
  const tokens = tokenizeQueryText(segment).map(normalizeSignalValue);
  const values = unique(tokens.filter((token) => DESIRE_TOKENS.has(token)));

  if (/孤独|alone|lonely/u.test(segment)) {
    values.unshift("melancholy");
  }
  if (/神秘|mystery|secret/u.test(segment)) {
    values.unshift("mystery");
  }
  if (/希望|hope/u.test(segment)) {
    values.unshift("hope");
  }
  if (/惊叹|wonder|awe/u.test(segment)) {
    values.unshift("wonder");
  }
  if (/安静|平静|quiet|calm/u.test(segment)) {
    values.unshift("quiet");
  }

  return unique(values).slice(0, 4).map((value) => signal("emotion", value, 0.82));
}

function collectTemporalStages(sourceText: string, desires: AffectSignal[]): TemporalStageHint[] {
  const explicitStageLike =
    /(先|开头|起初).{0,40}(再|中段|中间).{0,40}(最后|回到|return|finally)|\b(from|begin|start).{0,40}\b(then|finally)\b/iu.test(sourceText);

  if (!explicitStageLike) {
    const fallbackSignals = desires.length > 0 ? desires.slice(0, 3) : [signal("emotion", "quiet", 0.55)];
    return [
      { label: "threshold", signals: [fallbackSignals[0] ?? signal("emotion", "quiet")] },
      { label: "mirror", signals: [fallbackSignals[1] ?? fallbackSignals[0] ?? signal("emotion", "contemplation")] },
      { label: "return", signals: [fallbackSignals[2] ?? fallbackSignals[0] ?? signal("emotion", "calm")] },
    ];
  }

  const markers = Array.from(sourceText.matchAll(STAGE_SPLIT_PATTERN));
  const segments: Array<{ marker: string; body: string }> = [];

  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    const next = markers[index + 1];
    const start = (marker.index ?? 0) + marker[0].length;
    const end = next?.index ?? sourceText.length;
    const body = sourceText.slice(start, end).replace(/^[，,。.\s]+/, "").trim();

    if (body.length > 0) {
      segments.push({ marker: marker[0], body });
    }
  }

  const parsed = segments.slice(0, 5).map((entry, index) => ({
    label: index === 0 ? "threshold" : index === segments.length - 1 ? "return" : entry.marker,
    signals: signalsForSegment(entry.body),
  }));

  return parsed.length >= 3 ? parsed : [
    { label: "threshold", signals: [desires[0] ?? signal("emotion", "quiet")] },
    { label: "turn", signals: [desires[1] ?? signal("emotion", "wonder")] },
    { label: "return", signals: [desires[2] ?? signal("emotion", "calm")] },
  ];
}

function averageState(signals: AffectSignal[]): AffectState {
  const metrics = signals.map((entry) => SIGNAL_METRICS[entry.value] ?? DEFAULT_STATE);
  if (metrics.length === 0) {
    return DEFAULT_STATE;
  }

  return {
    valence: clamp01(metrics.reduce((sum, entry) => sum + entry.valence, 0) / metrics.length),
    arousal: clamp01(metrics.reduce((sum, entry) => sum + entry.arousal, 0) / metrics.length),
    tension: clamp01(metrics.reduce((sum, entry) => sum + entry.tension, 0) / metrics.length),
    wonder: clamp01(metrics.reduce((sum, entry) => sum + entry.wonder, 0) / metrics.length),
    intimacy: clamp01(metrics.reduce((sum, entry) => sum + entry.intimacy, 0) / metrics.length),
  };
}

function buildTemporalShape(sourceText: string, desires: AffectSignal[]): TemporalShape {
  const stages = collectTemporalStages(sourceText, desires);
  const flattenedSignals = stages.flatMap((stage) => stage.signals.map((entry) => entry.value));
  const peakCount = flattenedSignals.some((value) => ["wonder", "awe", "joy"].includes(value)) ? 1 : 0;
  const slow = /慢|安静|平静|睡前|quiet|calm|slow|still/u.test(sourceText);
  const active = /跳跃|热闹|欢庆|festival|active|loud/u.test(sourceText);

  return {
    arc: stages.length > 3 ? "multi-stage" : peakCount > 0 ? "single-peak" : "settle",
    pace: active ? "active" : slow ? "slow" : "medium",
    stages,
    peakCount,
  };
}

export function buildUserAffectAgent(input: string): UserAffectAgent {
  const sourceText = input.trim();
  const normalized = normalizeQueryText(sourceText);
  const tokens = tokenizeQueryText(sourceText);
  const resistances = collectResistances(normalized);
  const desires = collectDesires(tokens, normalized, resistances);
  const temporalShape = buildTemporalShape(sourceText, desires);

  return {
    sourceText,
    languageHints: detectLanguageHints(sourceText),
    desires,
    resistances,
    memoryHints: collectMemoryHints(normalized),
    visualConstraints: collectVisualConstraints(normalized, resistances),
    spatialNeeds: collectSpatialNeeds(normalized),
    temporalShape,
    currentState: averageState(desires.length > 0 ? desires : temporalShape.stages[0]?.signals ?? []),
    desiredState: averageState(temporalShape.stages.at(-1)?.signals ?? desires),
    confidence: sourceText.length > 0 ? 0.78 : 0.2,
  };
}
