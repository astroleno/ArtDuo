import type { GrowthForm, GrowthStage, TransitionIntent } from "@artduo/contracts";

import type { WebBackgroundScene, WebSceneSearchResult, WebSearchResult } from "./release-catalog";

export interface GallerySceneRouteStop {
  stageLabel: string;
  growthStageId?: string;
  transitionIntent?: TransitionIntent;
  scene: WebBackgroundScene;
  reason: string;
  sourceLabel: "观看意图直达" | "作品情绪带出";
  whisper: string;
  stageTone: string;
  startIndex: number;
  endIndex: number;
}

interface GallerySceneRouteOptions {
  sceneResults?: WebSceneSearchResult["results"];
  growthForm?: GrowthForm;
}

interface RouteStageProfile {
  label: string;
  growthStageId?: string;
  transitionIntent?: TransitionIntent;
  startIndex: number;
  endIndex: number;
  stageTone: string;
  intent: string;
  profile: string[];
}

const ROUTE_STAGES: RouteStageProfile[] = [
  {
    label: "Opening",
    startIndex: 0,
    endIndex: 4,
    stageTone: "开场",
    intent: "把第一眼放慢",
    profile: [
      "quiet",
      "introspective",
      "contemplation",
      "calm",
      "melancholy",
      "depth",
      "cool_dark",
      "midnight blue",
      "museum_hall",
    ],
  },
  {
    label: "Drift",
    startIndex: 4,
    endIndex: 8,
    stageTone: "慢慢漂移",
    intent: "让视线向安静处漂移",
    profile: [
      "serene",
      "focused",
      "neutral",
      "clarity",
      "calm",
      "cool_neutral",
      "monochrome",
      "light gray",
      "off-white",
      "gallery_interior",
    ],
  },
  {
    label: "Return",
    startIndex: 8,
    endIndex: 12,
    stageTone: "回到余光",
    intent: "把余光收束回来",
    profile: [
      "dramatic",
      "intimate",
      "formal",
      "reverent",
      "warm-rich",
      "dark-rich",
      "burgundy",
      "carmine",
      "walnut",
      "museum_hall",
    ],
  },
];

const TOKEN_NORMALIZER = /[_-]+/g;

const SIGNAL_COPY: Record<string, string> = {
  airy: "通透感",
  amber: "暖金",
  aubergine: "紫黑暗场",
  awe: "庄重感",
  beige: "暖石",
  black: "暗场",
  burgundy: "暗红",
  calm: "平静",
  carmine: "暗红",
  charcoal: "暗灰",
  clarity: "清澈留白",
  concrete: "冷静灰墙",
  contemplation: "凝视感",
  contemplative: "凝视感",
  cool: "冷色",
  cool_dark: "夜色",
  cool_neutral: "冷静中性",
  depth: "深处感",
  dramatic: "戏剧张力",
  earthy: "土色温度",
  elegant: "古典秩序",
  emerald: "墨绿",
  focus: "聚焦感",
  focused: "聚焦感",
  formal: "仪式感",
  gallery_interior: "展墙留白",
  gold: "微金",
  golden: "暖金",
  high_contrast: "明暗对照",
  highcontrast: "明暗对照",
  introspective: "内省",
  ivory: "象牙白",
  jewel_tone: "宝石色",
  jeweltone: "宝石色",
  light: "浅光",
  "light gray": "雾灰",
  luxury: "华丽感",
  melancholy: "低回情绪",
  midnight: "夜蓝",
  "midnight blue": "夜蓝",
  monochrome: "单色秩序",
  museum_hall: "古典空间感",
  muted: "低饱和",
  "muted gold": "微金",
  neutral: "中性色",
  "off white": "雾白",
  "off-white": "雾白",
  opulent: "华丽感",
  quiet: "静默",
  reverent: "肃静",
  rose: "玫瑰暗调",
  sand: "砂色",
  serene: "平静",
  serenity: "平静",
  slate: "冷石蓝",
  solemn: "肃静",
  taupe: "灰褐墙面",
  terracotta: "陶土暖色",
  walnut: "深木",
  warm: "暖色",
  "warm stone": "暖石",
  white: "白场",
};

function normalizeSignal(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(TOKEN_NORMALIZER, " ");
}

function signalCopy(value: string): string | undefined {
  const raw = value.trim().toLowerCase();
  const normalized = normalizeSignal(value);
  return SIGNAL_COPY[raw] ?? SIGNAL_COPY[normalized] ?? SIGNAL_COPY[normalized.replace(/\s+/g, "")];
}

function intersectionScore(left: string[], right: string[], weight: number): number {
  const rightSet = new Set(right.map(normalizeSignal));
  return left.reduce((score, value) => score + (rightSet.has(normalizeSignal(value)) ? weight : 0), 0);
}

function sceneSignals(scene: WebBackgroundScene): string[] {
  return [
    scene.sceneType,
    ...scene.moods,
    ...scene.palette,
    ...scene.emotionIds,
    ...scene.artworkPaletteModes,
    scene.searchText,
  ].filter((value): value is string => Boolean(value));
}

function scoreScene(
  scene: WebBackgroundScene,
  stage: RouteStageProfile,
  results: WebSearchResult["results"],
  sceneResults: WebSceneSearchResult["results"],
): number {
  const stageArtworks = results.map((result) => result.artwork);
  const stageMoodTags = stageArtworks.flatMap((artwork) => artwork.moodTags);
  const stageEmotionLabels = stageArtworks.flatMap((artwork) => artwork.emotionLabels);
  const stageColorTags = stageArtworks.flatMap((artwork) => artwork.colorTags);
  const stagePaletteModes = stageArtworks.flatMap((artwork) => artwork.sceneAffinity.paletteModes);
  const stageSceneTypes = stageArtworks.flatMap((artwork) => artwork.sceneAffinity.sceneTypes);
  const selectedSceneBoost = results.filter((result) => result.scene?.id === scene.id).length * 2;
  const directSceneResult = sceneResults.find((result) => result.scene.id === scene.id);
  const directSceneBoost = directSceneResult
    ? directSceneResult.combinedScore * 42 + Math.max(0, sceneResults.length - directSceneResult.rank) * 0.8
    : 0;

  return (
    directSceneBoost +
    selectedSceneBoost +
    intersectionScore(stageMoodTags, [...scene.emotionIds, ...scene.moods], 4) +
    intersectionScore(stageEmotionLabels, [...scene.emotionIds, ...scene.moods], 4) +
    intersectionScore(stagePaletteModes, scene.artworkPaletteModes, 3) +
    intersectionScore(stageColorTags, scene.palette, 2) +
    intersectionScore(stageSceneTypes, scene.sceneType ? [scene.sceneType] : [], 2) +
    intersectionScore(stage.profile, sceneSignals(scene), 2.4)
  );
}

function chooseScene(
  scenes: WebBackgroundScene[],
  stage: RouteStageProfile,
  results: WebSearchResult["results"],
  usedSceneIds: Set<string>,
  sceneResults: WebSceneSearchResult["results"],
): WebBackgroundScene | undefined {
  const ranked = scenes
    .map((scene) => ({ scene, score: scoreScene(scene, stage, results, sceneResults) }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.scene.id.localeCompare(right.scene.id);
    });

  return ranked.find((candidate) => !usedSceneIds.has(candidate.scene.id))?.scene ?? ranked[0]?.scene;
}

function buildReason(scene: WebBackgroundScene, stage: RouteStageProfile): string {
  const copiedSignals = sceneSignals(scene)
    .flatMap((value) => normalizeSignal(value).split(/\s+/).length > 3 ? [] : [value])
    .map((value) => signalCopy(value))
    .filter((value): value is string => Boolean(value));
  const signals = [...new Set(copiedSignals)].slice(0, 3);

  if (signals.length === 0) {
    return `因光线、空间和情绪接近这一段的观看节奏，适合${stage.intent}。`;
  }

  return `因${signals.join("、")}，这一段适合${stage.intent}。`;
}

function buildWhisper(_scene: WebBackgroundScene, stage: RouteStageProfile): string {
  if (stage.label === "Opening") {
    return "这间展厅先把光放轻，第一眼慢下来。";
  }
  if (stage.label === "Drift") {
    return "墙面安静下来，脚步自然往里走。";
  }

  if (stage.transitionIntent === "return" || stage.label === "Return") {
    return "最后一点光收住，视线回到画前。";
  }

  return "这一段顺着情绪换气，让空间继续往前打开。";
}

function tokenizeIntent(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_\-\u4e00-\u9fff]+/u)
    .filter((token) => token.length > 1)
    .slice(0, 8);
}

function partitionRange(index: number, total: number, resultCount: number): { startIndex: number; endIndex: number } {
  const startIndex = Math.floor(index * resultCount / total);
  const endIndex = Math.max(startIndex + 1, Math.floor((index + 1) * resultCount / total));

  return {
    startIndex,
    endIndex: Math.min(endIndex, resultCount),
  };
}

function growthStageRange(
  stage: GrowthStage,
  index: number,
  total: number,
  results: WebSearchResult["results"],
): { startIndex: number; endIndex: number } {
  const indexes = stage.artworkIds
    .map((artworkId) => results.findIndex((result) => result.artwork.id === artworkId))
    .filter((candidate) => candidate >= 0);

  if (indexes.length === 0) {
    return partitionRange(index, total, results.length);
  }

  return {
    startIndex: Math.min(...indexes),
    endIndex: Math.min(Math.max(...indexes) + 1, results.length),
  };
}

function stageProfilesFromGrowthForm(
  growthForm: GrowthForm | undefined,
  results: WebSearchResult["results"],
): RouteStageProfile[] {
  if (!growthForm) {
    return ROUTE_STAGES;
  }

  return growthForm.stages.map((stage, index) => {
    const range = growthStageRange(stage, index, growthForm.stages.length, results);

    return {
      label: stage.label,
      growthStageId: stage.id,
      transitionIntent: stage.transitionIntent,
      startIndex: range.startIndex,
      endIndex: range.endIndex,
      stageTone: stage.signals[0]?.value ?? stage.role,
      intent: stage.sceneIntent,
      profile: [
        ...stage.signals.map((signal) => signal.value),
        ...tokenizeIntent(stage.sceneIntent),
      ],
    };
  });
}

function buildSourceLabel(
  scene: WebBackgroundScene,
  sceneResults: WebSceneSearchResult["results"],
): GallerySceneRouteStop["sourceLabel"] {
  return sceneResults.some((result) => result.scene.id === scene.id)
    ? "观看意图直达"
    : "作品情绪带出";
}

export function buildGallerySceneRoute(
  search: WebSearchResult,
  backgroundScenes: WebBackgroundScene[],
  options: GallerySceneRouteOptions = {},
): GallerySceneRouteStop[] {
  if (search.results.length === 0 || backgroundScenes.length === 0) {
    return [];
  }

  const usedSceneIds = new Set<string>();
  const sceneResults = options.sceneResults ?? [];
  const stages = stageProfilesFromGrowthForm(options.growthForm, search.results);

  return stages.flatMap((stage) => {
    const stageResults = search.results.slice(stage.startIndex, stage.endIndex);
    if (stageResults.length === 0) {
      return [];
    }

    const scene = chooseScene(backgroundScenes, stage, stageResults, usedSceneIds, sceneResults);
    if (!scene) {
      return [];
    }

    usedSceneIds.add(scene.id);

    return [{
      stageLabel: stage.label,
      scene,
      reason: buildReason(scene, stage),
      sourceLabel: buildSourceLabel(scene, sceneResults),
      whisper: buildWhisper(scene, stage),
      stageTone: stage.stageTone,
      growthStageId: stage.growthStageId,
      transitionIntent: stage.transitionIntent,
      startIndex: stage.startIndex,
      endIndex: Math.min(stage.endIndex, search.results.length),
    }];
  });
}

export function sceneRouteStopForIndex(
  route: GallerySceneRouteStop[],
  index: number,
): GallerySceneRouteStop | undefined {
  return route.find((stop) => index >= stop.startIndex && index < stop.endIndex) ?? route.at(-1);
}
