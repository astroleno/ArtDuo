import type { GrowthForm } from "@artduo/contracts";

import { buildAffectiveGrowthForm } from "./affective-negotiation";
import type { WebBackgroundScene, WebSearchResult } from "./release-catalog";

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
  intentSignals: string[];
  growthForm: GrowthForm;
}

const STAGE_LABELS = ["开场", "行进", "回望"] as const;

const TONE_COPY: Record<string, string> = {
  admiration: "仰望",
  anxiety: "微微收紧",
  awe: "敬畏",
  contemplation: "凝视",
  desire: "暗涌",
  despair: "低沉",
  drama: "戏剧张力",
  euphoria: "明亮高点",
  fatigue: "缓慢疲惫",
  grief: "哀悼余波",
  hope: "向上的光",
  joy: "轻快喜悦",
  longing: "未抵达的想念",
  melancholy: "沉静忧郁",
  mystery: "隐约谜面",
  nostalgia: "回望的温度",
  serenity: "平静呼吸",
  silence: "留白里的安静",
  tension: "悬而未落",
  tranquility_deep: "深处平静",
  wonder: "轻微惊奇",
  yearning: "向远处延伸",
};

function clampIntensity(value: number): number {
  return Math.max(0.18, Math.min(0.94, value));
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function uniqueScenes(values: Array<WebBackgroundScene | undefined>): WebBackgroundScene[] {
  const seen = new Set<string>();
  const scenes: WebBackgroundScene[] = [];

  for (const scene of values) {
    if (scene && !seen.has(scene.id)) {
      seen.add(scene.id);
      scenes.push(scene);
    }
  }

  return scenes;
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

function toneLabel(value: string | undefined): string {
  if (!value) {
    return "安静";
  }

  return TONE_COPY[value.toLowerCase().replaceAll(" ", "_")] ?? value;
}

function growthHardSignals(growthForm: GrowthForm): Set<string> {
  return new Set(
    growthForm.rules
      .filter((rule) => rule.severity === "hard")
      .map((rule) => rule.signal.toLowerCase()),
  );
}

function growthSignals(growthForm: GrowthForm): string[] {
  return unique([
    ...growthForm.stages.flatMap((stage) => stage.signals.map((signal) => signal.value)),
    ...growthForm.rules.map((rule) => rule.signal),
  ].map((value) => value.toLowerCase()));
}

function signalConflictsWithHardRule(signal: string, hardSignals: Set<string>): boolean {
  const normalized = signal.toLowerCase().replaceAll(" ", "_");

  if (hardSignals.has("bright")) {
    return ["bright", "light", "joy", "celebration", "cheerful", "gold", "golden"].includes(normalized);
  }
  if (hardSignals.has("loud")) {
    return ["loud", "festival", "celebration", "active", "drama"].includes(normalized);
  }
  if (hardSignals.has("heavy-drama")) {
    return ["drama", "dramatic", "despair", "grief", "high_contrast"].includes(normalized);
  }
  if (hardSignals.has("heavy-grief")) {
    return ["grief", "despair", "sad", "sorrow", "heavy_grief"].includes(normalized);
  }

  return hardSignals.has(normalized);
}

function filterSignalsByHardRules(signals: string[], growthForm: GrowthForm): string[] {
  const hardSignals = growthHardSignals(growthForm);
  if (hardSignals.size === 0) {
    return signals;
  }

  return signals.filter((signal) => !signalConflictsWithHardRule(signal, hardSignals));
}

function inferGrowthTone(growthForm: GrowthForm): string | undefined {
  const hardSignals = growthHardSignals(growthForm);
  const signals = new Set(growthSignals(growthForm));

  if (hardSignals.has("bright") && (signals.has("low-light") || signals.has("burgundy") || signals.has("walnut"))) {
    return "低光木色";
  }
  if (hardSignals.has("heavy-grief") && (signals.has("restful") || signals.has("held") || signals.has("quiet"))) {
    return "睡前静光";
  }
  if (hardSignals.has("heavy-drama") && (signals.has("serenity") || signals.has("quiet") || signals.has("contemplation"))) {
    return "克制平静";
  }
  if (hardSignals.has("loud") && (signals.has("desire") || signals.has("intimate") || signals.has("quiet"))) {
    return "安静靠近";
  }
  if (hardSignals.has("cartoonish") && signals.has("joy")) {
    return "克制喜悦";
  }

  return toneLabel(growthForm.stages[0]?.signals[0]?.value);
}

function inferQueryTone(query: string): string | undefined {
  const normalized = query.toLowerCase();

  if (/先.*(安静|平静|quiet).*再.*(惊叹|wonder|awe).*最后.*(平静|安静|calm|serenity)/.test(normalized)) {
    return "平静到惊奇再回望";
  }
  if (/教堂|庄重|古老|reverent|reverence|church|cathedral|old world/.test(normalized)) {
    return "敬畏";
  }
  if (/书房|专注|留白|不想说话|沉思|focus|silence|contemplation/.test(normalized)) {
    return "凝视";
  }
  if (/蓝灰|冷一点|冷色|睡前|quiet room|serene|serenity|calm/.test(normalized)) {
    return "平静呼吸";
  }
  if (/happiness|happy|joy|快乐|跳跃|节日/.test(normalized)) {
    return "轻快喜悦";
  }
  if (/暖金|金色|gold|warm/.test(normalized)) {
    return "暖金静光";
  }

  return undefined;
}

function inferQuerySignals(query: string, resultSignals: string[]): string[] {
  const normalized = query.toLowerCase();
  const signals: string[] = [];

  const add = (...values: string[]) => {
    signals.push(...values);
  };

  if (/教堂|庄重|古老|reverent|reverence|church|cathedral|old world/.test(normalized)) {
    add("awe", "contemplation", "reverence");
  }
  if (/月光|moon|moonlight/.test(normalized)) {
    add("serenity", "contemplation", "light");
  }
  if (/焦虑|呼吸|压力|anxiety|anxious|stress|breath/.test(normalized)) {
    add("serenity", "calm", "light");
  }
  if (/孤独|不绝望|alone|lonely/.test(normalized)) {
    add("melancholy", "hope", "contemplation");
  }
  if (/书房|专注|沉思|focus|focused|contemplation/.test(normalized)) {
    add("contemplation", "focus", "serenity");
  }
  if (/留白|不想说话|沉默|silence|quiet whisper/.test(normalized)) {
    add("contemplation", "silence", "serenity");
  }
  if (/happiness.*whisper|happy.*whisper|joy.*whisper/.test(normalized)) {
    add("joy", "quiet", "serenity");
  }
  if (/happiness|happy|joy|快乐|跳跃|节日/.test(normalized)) {
    add("joy", "bright", "celebration");
  }
  if (/蓝灰|冷一点|冷色|quiet room|serene|serenity|calm/.test(normalized)) {
    add("serenity", "blue", "charcoal");
  }
  if (/暗红|深木|朱红|burgundy|walnut/.test(normalized)) {
    add("burgundy", "walnut", "melancholy");
  }
  if (/老照片|怀旧|nostalgia|old photo/.test(normalized)) {
    add("nostalgia", "melancholy", "silver");
  }
  if (/暖金|金色|gold|warm/.test(normalized)) {
    add("gold", "warmth", "serenity");
  }
  if (/风景|远处|landscape|distance/.test(normalized)) {
    add("landscape", "yearning", "hope");
  }
  if (/先.*(安静|平静|quiet).*再.*(惊叹|wonder|awe).*最后.*(平静|安静|calm|serenity)/.test(normalized)) {
    add("serenity", "wonder", "contemplation");
  }

  return unique([...signals, ...resultSignals]).slice(0, 10);
}

function inferEmotionalNeed(query: string, tone: string, growthForm: GrowthForm): string {
  const normalized = query.toLowerCase();
  const hardSignals = growthHardSignals(growthForm);
  const signals = new Set(growthSignals(growthForm));

  if (hardSignals.has("bright") && (signals.has("low-light") || signals.has("burgundy") || signals.has("walnut"))) {
    return "把光压低一点，让暗红、木色和低光把观看安静地包住";
  }
  if (hardSignals.has("heavy-grief") && (signals.has("restful") || signals.has("held") || /睡前|bedtime|before sleep/.test(normalized))) {
    return "停在睡前那种被轻轻托住的安静里，不往沉重处走";
  }
  if (hardSignals.has("heavy-drama") && (signals.has("serenity") || signals.has("quiet") || signals.has("contemplation") || /剧情太满|no drama/.test(normalized))) {
    return "保留克制和留白，不让剧情把观看填满";
  }
  if (hardSignals.has("loud") && (signals.has("desire") || signals.has("quiet") || signals.has("intimate"))) {
    return "把靠近感放低声一点，不让浪漫变得喧闹";
  }
  if (hardSignals.has("cartoonish") && signals.has("joy")) {
    return "保留喜悦，但避开卡通式的甜腻";
  }

  if (/焦虑|anxiety|anxious|紧张|panic|压力|stress/.test(normalized)) {
    return "先把紧绷感放到画面外面一点";
  }
  if (/快乐|跳跃|明亮|节日|happiness|happy|joy|delight|celebration/.test(normalized)) {
    return "让轻一点的喜悦先在展厅里亮起来";
  }
  if (/神秘|谜|秘密|低光|剧场|mystery|occult|secret|shadow/.test(normalized)) {
    return "把谜面留在暗处，只沿着可见的光往前走";
  }
  if (/欲望|靠近|想念|远方|longing|desire|yearning/.test(normalized)) {
    return "靠近那些还没有说出口的牵引";
  }
  if (/孤独|alone|lonely|失眠|怀旧|老照片|grief|悲伤|sad|失去/.test(normalized)) {
    return "让没有被说完的部分被温柔看见";
  }
  if (/希望|春|清晨|亮起来|鼓励|hope|spring|dawn|renewal|治愈|heal|疗愈/.test(normalized)) {
    return "替自己找回一点可以继续向前的光";
  }
  if (/沉思|专注|书房|留白|不想说话|quiet|calm|安静|平静|月光|moon|serenity|rest|minimal|contemplation/.test(normalized)) {
    return "把注意力从噪声里慢慢收回来";
  }

  return `沿着“${tone}”找到一个更能容纳自己的位置`;
}

export function buildJourneyIntensities(results: WebSearchResult["results"]): number[] {
  if (results.length === 0) {
    return [];
  }

  const maxScore = Math.max(...results.map((result) => result.combinedScore), 0.01);

  return results.map((result, index) => {
    const normalized = result.combinedScore / maxScore;
    const stageLift = index / Math.max(results.length - 1, 1) * 0.16;

    return clampIntensity(0.24 + normalized * 0.56 + stageLift);
  });
}

export function buildCurationNarrative(search: WebSearchResult): CurationNarrative {
  const results = search.results;
  const backgroundScenes = uniqueScenes(results.map((result) => result.scene));
  const growthForm = buildAffectiveGrowthForm({
    query: search.query,
    results,
    backgroundScenes,
  });
  const top = results[0];
  const topTitle = top?.artwork.title ?? "第一幅作品";
  const sceneLabel = unique(results.map((result) => result.scene?.label))[0] ?? "安静的展厅";
  const resultSignals = unique([
    ...results.slice(0, 5).flatMap((result) => result.artwork.moodTags),
    ...results.slice(0, 5).flatMap((result) => result.artwork.emotionLabels),
    ...results.slice(0, 5).flatMap((result) => result.matchedTokens),
  ]);
  const stageSignals = growthForm.stages.flatMap((stage) => stage.signals.map((signal) => signal.value));
  const intentSignals = filterSignalsByHardRules(inferQuerySignals(search.query, unique([...stageSignals, ...resultSignals])), growthForm);
  const growthTone = inferGrowthTone(growthForm);
  const tone = growthHardSignals(growthForm).size > 0
    ? growthTone ?? inferQueryTone(search.query) ?? toneLabel(filterSignalsByHardRules(resultSignals, growthForm)[0])
    : inferQueryTone(search.query) ?? growthTone ?? toneLabel(resultSignals[0]);
  const need = inferEmotionalNeed(search.query, tone, growthForm);

  const curve = growthForm.stages.map((stage, index) => ({
    label: STAGE_LABELS[index] ?? stage.label,
    tone: toneLabel(stage.signals[0]?.value),
    intensity: clampIntensity(stage.intensity),
  }));

  return {
    title: `${tone}的观展路线`,
    preface: `我把这句愿望理解成：你想${need}。从《${topTitle}》进入，先让眼睛适应${sceneLabel}里的光，接下来的作品会沿着“${tone}”慢慢展开。`,
    closing: `这条路线在“${tone}”里收束。刚才的 ${results.length} 件作品不是答案，而是把你的感受照亮了一点；下一次可以从其中任何一幅重新进入。`,
    curve,
    intentSignals,
    growthForm,
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
