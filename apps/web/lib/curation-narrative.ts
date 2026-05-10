import type { WebSearchResult } from "./release-catalog";

export interface EmotionalCurvePoint {
  label: string;
  tone: string;
  intensity: number;
}

export interface CurationNarrative {
  title: string;
  preface: string;
  closing: string;
  curve: EmotionalCurvePoint[];
}

const STAGE_LABELS = ["Opening", "Drift", "Return"] as const;

function clampIntensity(value: number): number {
  return Math.max(0.18, Math.min(0.94, value));
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function formatList(values: string[]): string {
  if (values.length === 0) {
    return "quiet looking";
  }

  return values.slice(0, 3).join(", ");
}

function stageResults(results: WebSearchResult["results"], index: number): WebSearchResult["results"] {
  if (index === 0) {
    return results.slice(0, 4);
  }
  if (index === 1) {
    return results.slice(4, 8);
  }

  return results.slice(8, 12);
}

export function buildCurationNarrative(search: WebSearchResult): CurationNarrative {
  const results = search.results;
  const top = results[0];
  const topTitle = top?.artwork.title ?? "the first work";
  const sceneLabels = unique(results.map((result) => result.scene?.label));
  const moodTags = unique(results.flatMap((result) => result.artwork.moodTags.slice(0, 2)));
  const subjectTags = unique(results.flatMap((result) => result.artwork.subjectTags.slice(0, 2)));
  const matchedTokens = unique(results.flatMap((result) => result.matchedTokens));
  const tone = formatList(moodTags.length > 0 ? moodTags : matchedTokens);
  const subjects = formatList(subjectTags);
  const room = sceneLabels[0] ?? "a quiet gallery room";

  const curve = STAGE_LABELS.map((label, index) => {
    const stage = stageResults(results, index);
    const averageScore = stage.length > 0
      ? stage.reduce((sum, result) => sum + result.combinedScore, 0) / stage.length
      : 0.35 + index * 0.08;
    const stageTone = unique(stage.flatMap((result) => result.artwork.moodTags))[0]
      ?? unique(stage.flatMap((result) => result.matchedTokens))[0]
      ?? label.toLowerCase();

    return {
      label,
      tone: stageTone,
      intensity: clampIntensity(averageScore),
    };
  });

  return {
    title: `A route through ${tone}`,
    preface: `We begin with ${topTitle}, then let the room move through ${tone}. The selection follows your sentence toward ${subjects}, using ${room} as the first atmosphere rather than a neutral search result.`,
    closing: `The exhibition closes by returning the eye to ${tone}: not as a score, but as a small path through ${results.length} works that can still be read one at a time.`,
    curve,
  };
}

export function curvePath(points: EmotionalCurvePoint[]): string {
  if (points.length === 0) {
    return "";
  }

  return points.map((point, index) => {
    const x = points.length === 1 ? 150 : (index / (points.length - 1)) * 300;
    const y = 84 - point.intensity * 66;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}
