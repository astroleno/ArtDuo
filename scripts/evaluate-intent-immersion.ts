import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildCurationNarrative } from "../apps/web/lib/curation-narrative";
import {
  buildHardFilteredExhibition,
  visibleHardResistanceViolationIds,
} from "../apps/web/lib/exhibition-results";
import { buildGallerySceneRoute } from "../apps/web/lib/gallery-route";
import {
  loadWebReleaseCatalog,
  searchBackgroundScenes,
  searchReleaseCatalog,
  type WebSearchResult,
} from "../apps/web/lib/release-catalog";
import { buildUserAffectAgent } from "../packages/corpus/src/affective-intent";

interface EvaluationCase {
  id: string;
  input: string;
  expectedSignals: string[];
  expectedMood?: string;
  expectedRejectedArtworkIds?: string[];
  forbiddenVisibleSignals?: string[];
}

interface EvaluationResult {
  id: string;
  input: string;
  expectedSignals: string[];
  expectedMood?: string;
  normalizedQuery: string;
  output: {
    narrativeTitle: string;
    narrativePreface: string;
    narrativeClosing: string;
    intentSignals: string[];
    curve: Array<{ label: string; tone: string; intensity: number }>;
    userAgent: ReturnType<typeof buildUserAffectAgent>;
    growthForm: ReturnType<typeof buildCurationNarrative>["growthForm"];
    negotiationTrace: ReturnType<typeof buildCurationNarrative>["growthForm"]["trace"];
    rejectedArtworkIds: string[];
    curveMetrics: {
      stageCount: number;
      peakCount: number;
      startsNearRequestedState: boolean;
      endsNearRequestedState: boolean;
      hardResistanceViolations: number;
    };
    route: Array<{
      stage: string;
      scene: string;
      source: string;
      reason: string;
      whisper: string;
    }>;
    topArtworks: Array<{
      rank: number;
      title: string;
      artist?: string;
      year?: string;
      moods: string[];
      colors: string[];
      subjects: string[];
      matchedTokens: string[];
      score: number;
      scene?: string;
    }>;
  };
  scores: {
    intent: number;
    immersion: number;
    growthForm: number;
    total: number;
  };
  notes: string[];
}

const EVALUATION_CASES: EvaluationCase[] = [
  { id: "T01", input: "我想看一间安静的月光展厅", expectedSignals: ["serenity", "contemplation", "light"], expectedMood: "serenity" },
  { id: "T02", input: "今天脑子很吵，想慢慢安静下来", expectedSignals: ["serenity", "contemplation", "quiet"], expectedMood: "serenity" },
  { id: "T03", input: "给我一点春天和希望，不要太热闹", expectedSignals: ["hope", "renewal", "light"], expectedMood: "hope" },
  { id: "T04", input: "像刚下雨的清晨，有一点亮起来", expectedSignals: ["hope", "light", "serenity"], expectedMood: "hope" },
  { id: "T05", input: "我有点焦虑，想找可以呼吸的画", expectedSignals: ["serenity", "calm", "light"], expectedMood: "serenity" },
  { id: "T06", input: "失眠后的凌晨，给我一个很轻的展厅", expectedSignals: ["melancholy", "serenity", "quiet"], expectedMood: "melancholy" },
  { id: "T07", input: "我想看孤独但不绝望的东西", expectedSignals: ["melancholy", "hope", "contemplation"], expectedMood: "melancholy" },
  { id: "T08", input: "关于想念、远方和没说出口的话", expectedSignals: ["desire", "melancholy", "yearning"], expectedMood: "desire" },
  { id: "T09", input: "带一点暗色谜面，像走进秘密房间", expectedSignals: ["mystery", "black", "shadow"], expectedMood: "mystery" },
  { id: "T10", input: "我想要神秘、低光、像旧剧场一样", expectedSignals: ["mystery", "drama", "black"], expectedMood: "mystery" },
  { id: "T11", input: "给我华丽一点，有金色和仪式感", expectedSignals: ["gold", "awe", "wonder"], expectedMood: "wonder" },
  { id: "T12", input: "像进入一座古老教堂，庄重但温柔", expectedSignals: ["awe", "contemplation", "reverence"], expectedMood: "contemplation" },
  { id: "T13", input: "我想被惊叹一下，看一点不可思议的画", expectedSignals: ["wonder", "awe", "marvel"], expectedMood: "wonder" },
  { id: "T14", input: "让我像第一次进博物馆那样好奇", expectedSignals: ["wonder", "curiosity", "awe"], expectedMood: "wonder" },
  { id: "T15", input: "今天想看快乐、跳跃、明亮的东西", expectedSignals: ["joy", "bright", "celebration"], expectedMood: "joy" },
  { id: "T16", input: "像节日之后还留在空气里的光", expectedSignals: ["joy", "hope", "light"], expectedMood: "joy" },
  { id: "T17", input: "我想看有欲望和靠近感的作品", expectedSignals: ["desire", "longing", "passion"], expectedMood: "desire" },
  { id: "T18", input: "一点红色、一点危险、一点想靠近", expectedSignals: ["desire", "red", "drama"], expectedMood: "desire" },
  { id: "T19", input: "我想沉思，不要剧情太满", expectedSignals: ["contemplation", "quiet", "stillness"], expectedMood: "contemplation" },
  { id: "T20", input: "给我像书房一样专注的路线", expectedSignals: ["contemplation", "focus", "serenity"], expectedMood: "contemplation" },
  { id: "T21", input: "黑白、版画、线条，最好很克制", expectedSignals: ["black", "white", "contemplation"], expectedMood: "contemplation" },
  { id: "T22", input: "我想看蓝灰色、冷一点、很安静", expectedSignals: ["serenity", "blue", "charcoal"], expectedMood: "serenity" },
  { id: "T23", input: "暖金色的房间，适合慢慢停留", expectedSignals: ["gold", "warmth", "serenity"], expectedMood: "serenity" },
  {
    id: "T24",
    input: "像睡前，但不要悲伤",
    expectedSignals: ["serenity", "quiet", "restful"],
    expectedMood: "serenity",
    expectedRejectedArtworkIds: ["met-472301"],
    forbiddenVisibleSignals: ["melancholy", "sad", "sorrow", "grief", "despair"],
  },
  { id: "T25", input: "我想看人物肖像，像和陌生人对视", expectedSignals: ["portrait", "contemplation", "desire"], expectedMood: "contemplation" },
  { id: "T26", input: "有没有风景，最好像走到远处", expectedSignals: ["landscape", "yearning", "hope"], expectedMood: "hope" },
  { id: "T27", input: "给我一条适合睡前看的路线", expectedSignals: ["serenity", "quiet", "melancholy"], expectedMood: "serenity" },
  { id: "T28", input: "我今天不太想说话，只想看留白", expectedSignals: ["contemplation", "silence", "serenity"], expectedMood: "contemplation" },
  { id: "T29", input: "像老照片一样，有怀旧和一点灰", expectedSignals: ["nostalgia", "melancholy", "silver"], expectedMood: "melancholy" },
  { id: "T30", input: "想看东方感、纸本、墨色和安静", expectedSignals: ["asian", "ink", "serenity"], expectedMood: "serenity" },
  { id: "T31", input: "I need a quiet room after a difficult day", expectedSignals: ["serenity", "quiet", "melancholy"], expectedMood: "serenity" },
  { id: "T32", input: "show me hope, dawn light, and renewal", expectedSignals: ["hope", "dawn", "renewal"], expectedMood: "hope" },
  { id: "T33", input: "something mysterious, dark, almost occult", expectedSignals: ["mystery", "shadow", "black"], expectedMood: "mystery" },
  { id: "T34", input: "I want wonder and impossible skies", expectedSignals: ["wonder", "awe", "impossible"], expectedMood: "wonder" },
  { id: "T35", input: "a route about longing, desire, and distance", expectedSignals: ["desire", "longing", "yearning"], expectedMood: "desire" },
  { id: "T36", input: "I want joy but not cartoonish happiness", expectedSignals: ["joy", "delight", "bright"], expectedMood: "joy" },
  { id: "T37", input: "quiet contemplation with stone, paper, and soft gray", expectedSignals: ["contemplation", "stone", "gray"], expectedMood: "contemplation" },
  { id: "T38", input: "grief, but with a small path back to light", expectedSignals: ["melancholy", "hope", "light"], expectedMood: "melancholy" },
  { id: "T39", input: "serene, minimal, gallery interior, no drama", expectedSignals: ["serenity", "neutral", "gallery"], expectedMood: "serenity" },
  { id: "T40", input: "warm museum hall, gold, reverent, old-world", expectedSignals: ["gold", "reverence", "awe"], expectedMood: "wonder" },
  { id: "T41", input: "我想看 happiness but in a museum whisper", expectedSignals: ["joy", "quiet", "serenity"], expectedMood: "joy" },
  { id: "T42", input: "一点 mystery，但不要恐怖，像暗处有光", expectedSignals: ["mystery", "light", "shadow"], expectedMood: "mystery" },
  { id: "T43", input: "像把压力放下，calm and clear", expectedSignals: ["serenity", "clarity", "calm"], expectedMood: "serenity" },
  { id: "T44", input: "今天需要被鼓励，hope 但不要鸡汤", expectedSignals: ["hope", "optimism", "light"], expectedMood: "hope" },
  { id: "T45", input: "sad but beautiful, with red and black shadows", expectedSignals: ["melancholy", "red", "black"], expectedMood: "melancholy" },
  { id: "T46", input: "desire in a quiet room, not loud romance", expectedSignals: ["desire", "quiet", "intimate"], expectedMood: "desire" },
  { id: "T47", input: "给我一个从暗到亮的三段式展览", expectedSignals: ["melancholy", "hope", "light"], expectedMood: "hope" },
  { id: "T48", input: "开头孤独，中段有神秘，最后要有希望", expectedSignals: ["melancholy", "mystery", "hope"], expectedMood: "hope" },
  { id: "T49", input: "先安静，再惊叹，最后回到平静", expectedSignals: ["serenity", "wonder", "contemplation"], expectedMood: "serenity" },
  { id: "T50", input: "我想给朋友一个小型线上展览：温柔、好奇、有余韵", expectedSignals: ["serenity", "wonder", "hope"], expectedMood: "wonder" },
];

function round(value: number): number {
  return Number(value.toFixed(3));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function haystack(search: WebSearchResult, extraSignals: string[] = []): string {
  return normalize([
    search.normalizedQuery,
    ...extraSignals,
    ...search.results.slice(0, 6).flatMap((result) => [
      result.artwork.title,
      result.artwork.artistDisplayName ?? "",
      result.artwork.description ?? "",
      result.artwork.storySnippet ?? "",
      ...result.artwork.moodTags,
      ...result.artwork.colorTags,
      ...result.artwork.subjectTags,
      ...result.artwork.compositionTags,
      ...result.artwork.emotionLabels,
      ...result.artwork.keywordBoosts,
      ...result.matchedTokens,
      result.scene?.label ?? "",
      result.scene?.searchText ?? "",
      ...(result.scene?.moods ?? []),
      ...(result.scene?.palette ?? []),
      ...(result.scene?.emotionIds ?? []),
    ]),
  ].join(" "));
}

function signalMatches(search: WebSearchResult, signals: string[], extraSignals: string[] = []): string[] {
  const text = haystack(search, extraSignals);
  return signals.filter((signal) => {
    const normalized = normalize(signal);
    return text.includes(normalized) || text.includes(normalized.replace(/\s+/g, "-"));
  });
}

function scoreIntent(testCase: EvaluationCase, search: WebSearchResult, narrativeText: string, intentSignals: string[]): {
  score: number;
  matchedSignals: string[];
} {
  const matchedSignals = signalMatches(search, testCase.expectedSignals, intentSignals);
  const signalScore = testCase.expectedSignals.length > 0
    ? matchedSignals.length / testCase.expectedSignals.length
    : 0;
  const topFiveMoods = search.results.slice(0, 5).flatMap((result) => [
    ...result.artwork.moodTags,
    ...result.artwork.emotionLabels,
  ]).map(normalize);
  const expectedMoodHit = testCase.expectedMood
    ? topFiveMoods.includes(normalize(testCase.expectedMood))
    : true;
  const narrativeHit = matchedSignals.some((signal) => normalize(`${narrativeText} ${intentSignals.join(" ")}`).includes(normalize(signal)));

  return {
    score: round(Math.min(1, signalScore * 0.68 + (expectedMoodHit ? 0.22 : 0) + (narrativeHit ? 0.1 : 0))),
    matchedSignals,
  };
}

function scoreImmersion(input: {
  search: WebSearchResult;
  narrative: ReturnType<typeof buildCurationNarrative>;
  route: ReturnType<typeof buildGallerySceneRoute>;
}): number {
  const hasEnoughResults = input.search.results.length >= 9 ? 0.2 : input.search.results.length >= 3 ? 0.1 : 0;
  const hasNarrative = input.narrative.preface.includes("我把这句愿望理解成") && input.narrative.preface.includes("进入") ? 0.24 : 0;
  const hasCurve = input.narrative.curve.length >= 3 && input.narrative.curve.length <= 5 && input.narrative.curve.every((point) => point.intensity > 0) ? 0.16 : 0;
  const hasRoute = input.route.length >= 3 && input.route.length <= 5 ? 0.18 : input.route.length > 0 ? 0.08 : 0;
  const sceneVariety = new Set(input.route.map((stop) => stop.scene.id)).size >= 3 ? 0.1 : 0;
  const hasStageCopy = input.route.every((stop) => stop.reason.length > 10 && stop.whisper.length > 8) ? 0.12 : 0;

  return round(Math.min(1, hasEnoughResults + hasNarrative + hasCurve + hasRoute + sceneVariety + hasStageCopy));
}

function normalizeSignal(value: string): string {
  return value.toLowerCase().replace(/[_\s-]+/g, "-").trim();
}

function hardResistanceViolations(
  search: WebSearchResult,
  expectedRejectedArtworkIds: string[],
  observedRejectedArtworkIds: string[],
): number {
  const rejected = new Set(observedRejectedArtworkIds);
  const missingRequiredRejections = expectedRejectedArtworkIds.filter((artworkId) => !rejected.has(artworkId));
  return visibleHardResistanceViolationIds(search).length + missingRequiredRejections.length;
}

function independentVisibleSignalViolationIds(search: WebSearchResult, forbiddenSignals: string[]): string[] {
  const forbidden = new Set(forbiddenSignals.map(normalizeSignal));
  if (forbidden.size === 0) {
    return [];
  }

  return search.results.filter((result) => [
    ...result.artwork.moodTags,
    ...result.artwork.emotionLabels,
    ...result.artwork.subjectTags,
  ].map(normalizeSignal).some((signal) => forbidden.has(signal))).map((result) => result.artwork.id);
}

function countPeaks(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  if (values.length === 1) {
    return values[0]! > 0.55 ? 1 : 0;
  }

  return values.reduce((count, value, index) => {
    const previous = values[index - 1] ?? 0;
    const next = values[index + 1] ?? 0;
    return count + (value >= previous && value >= next && value > 0.5 ? 1 : 0);
  }, 0);
}

function stageSignalOverlap(left: string[], right: string[]): boolean {
  const rightSet = new Set(right.map(normalizeSignal));
  return left.map(normalizeSignal).some((value) => rightSet.has(value));
}

function buildCurveMetrics(input: {
  search: WebSearchResult;
  userAgent: ReturnType<typeof buildUserAffectAgent>;
  growthForm: ReturnType<typeof buildCurationNarrative>["growthForm"];
  expectedRejectedArtworkIds: string[];
  observedRejectedArtworkIds: string[];
  forbiddenVisibleSignals: string[];
}): EvaluationResult["output"]["curveMetrics"] {
  const firstRequested = input.userAgent.temporalShape.stages[0]?.signals.map((signal) => signal.value) ?? [];
  const lastRequested = input.userAgent.temporalShape.stages.at(-1)?.signals.map((signal) => signal.value) ?? [];
  const firstStage = input.growthForm.stages[0]?.signals.map((signal) => signal.value) ?? [];
  const lastStage = input.growthForm.stages.at(-1)?.signals.map((signal) => signal.value) ?? [];

  const contractViolations = hardResistanceViolations(
    input.search,
    input.expectedRejectedArtworkIds,
    input.observedRejectedArtworkIds,
  );
  const independentViolations = independentVisibleSignalViolationIds(input.search, input.forbiddenVisibleSignals);

  return {
    stageCount: input.growthForm.stages.length,
    peakCount: countPeaks(input.growthForm.stages.map((stage) => stage.intensity)),
    startsNearRequestedState: firstRequested.length === 0 || stageSignalOverlap(firstRequested, firstStage),
    endsNearRequestedState: lastRequested.length === 0 || stageSignalOverlap(lastRequested, lastStage),
    hardResistanceViolations: contractViolations + independentViolations.length,
  };
}

function scoreGrowthForm(input: {
  testCase: EvaluationCase;
  growthForm: ReturnType<typeof buildCurationNarrative>["growthForm"];
  route: ReturnType<typeof buildGallerySceneRoute>;
  curveMetrics: EvaluationResult["output"]["curveMetrics"];
}): number {
  const growthSignals = [
    ...input.growthForm.stages.flatMap((stage) => stage.signals.map((signal) => normalizeSignal(signal.value))),
    ...input.growthForm.rules.map((rule) => normalizeSignal(rule.signal)),
  ];
  const expectedMatches = input.testCase.expectedSignals.filter((signal) => growthSignals.includes(normalizeSignal(signal)));
  const orderedStageMatch = input.testCase.expectedSignals.length > 0
    ? Math.min(1, expectedMatches.length / input.testCase.expectedSignals.length) * 0.24
    : 0.24;
  const resistanceCompliance = input.curveMetrics.hardResistanceViolations === 0 ? 0.24 : 0;
  const continuity = input.growthForm.stages.every((stage, index, stages) => {
    const previous = stages[index - 1];
    return !previous || Math.abs(stage.intensity - previous.intensity) <= 0.55;
  }) ? 0.18 : 0.08;
  const evidenceCoverage = input.growthForm.trace.length >= input.growthForm.stages.length ? 0.18 : 0.08;
  const routeAgreement = input.route.length === input.growthForm.stages.length ? 0.16 : input.route.length > 0 ? 0.08 : 0;

  return round(Math.min(1, orderedStageMatch + resistanceCompliance + continuity + evidenceCoverage + routeAgreement));
}

function notesFor(input: {
  testCase: EvaluationCase;
  search: WebSearchResult;
  route: ReturnType<typeof buildGallerySceneRoute>;
  matchedSignals: string[];
  intentScore: number;
  immersionScore: number;
}): string[] {
  const notes: string[] = [];
  const topMoodValues = input.search.results.slice(0, 3).flatMap((result) => [
    ...result.artwork.moodTags,
    ...result.artwork.emotionLabels,
  ]).map(normalize);

  if (input.search.results.length < 9) {
    notes.push("结果数量不足，观展路线会显得薄。");
  }
  if (input.testCase.expectedMood && !topMoodValues.includes(normalize(input.testCase.expectedMood))) {
    notes.push(`Top 3 未命中预期主情绪 ${input.testCase.expectedMood}。`);
  }
  if (input.matchedSignals.length === 0) {
    notes.push("预期信号没有在前 6 个结果或场景中出现。");
  }
  if (input.intentScore < 0.5) {
    notes.push("意图理解偏弱，需要补 query alias 或语料标签。");
  }
  if (input.immersionScore < 0.8) {
    notes.push("沉浸结构不完整，需要检查叙事、情绪曲线或场景路线。");
  }
  if (input.route.length > 0 && input.route.every((stop) => stop.sourceLabel === "作品情绪带出")) {
    notes.push("场景主要由作品带出，用户输入对空间选择的直达感偏弱。");
  }

  return notes;
}

function evaluate(phase: string): EvaluationResult[] {
  const catalog = loadWebReleaseCatalog({ rootDir: process.cwd() });

  return EVALUATION_CASES.map((testCase) => {
    const candidateSearch = searchReleaseCatalog(catalog, testCase.input, { limit: catalog.artworkCount });
    const exhibition = buildHardFilteredExhibition(candidateSearch, { limit: 12 });
    const search = exhibition.search;
    const sceneSearch = searchBackgroundScenes(catalog, testCase.input, { limit: 12 });
    const userAgent = buildUserAffectAgent(testCase.input);
    const narrative = buildCurationNarrative(search);
    const route = buildGallerySceneRoute(search, catalog.backgroundScenes, {
      sceneResults: sceneSearch.results,
      growthForm: narrative.growthForm,
    });
    const curveMetrics = buildCurveMetrics({
      search,
      userAgent,
      growthForm: narrative.growthForm,
      expectedRejectedArtworkIds: testCase.expectedRejectedArtworkIds ?? [],
      observedRejectedArtworkIds: exhibition.rejectedArtworkIds,
      forbiddenVisibleSignals: testCase.forbiddenVisibleSignals ?? [],
    });
    const narrativeText = `${narrative.title} ${narrative.preface} ${narrative.closing}`;
    const intent = scoreIntent(testCase, search, narrativeText, narrative.intentSignals);
    const immersionScore = scoreImmersion({ search, narrative, route });
    const growthFormScore = scoreGrowthForm({
      testCase,
      growthForm: narrative.growthForm,
      route,
      curveMetrics,
    });
    const legacyTotalScore = round(intent.score * 0.58 + immersionScore * 0.42);
    const blendedGrowthScore = round(intent.score * 0.52 + immersionScore * 0.24 + growthFormScore * 0.24);
    const totalScore = Math.max(legacyTotalScore, blendedGrowthScore);

    return {
      id: testCase.id,
      input: testCase.input,
      expectedSignals: testCase.expectedSignals,
      expectedMood: testCase.expectedMood,
      normalizedQuery: search.normalizedQuery,
      output: {
        narrativeTitle: narrative.title,
        narrativePreface: narrative.preface,
        narrativeClosing: narrative.closing,
        intentSignals: narrative.intentSignals,
        curve: narrative.curve,
        userAgent,
        growthForm: narrative.growthForm,
        negotiationTrace: narrative.growthForm.trace,
        rejectedArtworkIds: exhibition.rejectedArtworkIds,
        curveMetrics,
        route: route.map((stop) => ({
          stage: stop.stageLabel,
          scene: stop.scene.label,
          source: stop.sourceLabel,
          reason: stop.reason,
          whisper: stop.whisper,
        })),
        topArtworks: search.results.slice(0, 5).map((result) => ({
          rank: result.rank,
          title: result.artwork.title,
          artist: result.artwork.artistDisplayName,
          year: result.artwork.yearLabel,
          moods: unique([...result.artwork.moodTags, ...result.artwork.emotionLabels]),
          colors: result.artwork.colorTags,
          subjects: result.artwork.subjectTags.slice(0, 8),
          matchedTokens: result.matchedTokens,
          score: result.combinedScore,
          scene: result.scene?.label,
        })),
      },
      scores: {
        intent: intent.score,
        immersion: immersionScore,
        growthForm: growthFormScore,
        total: totalScore,
      },
      notes: notesFor({
        testCase,
        search,
        route,
        matchedSignals: intent.matchedSignals,
        intentScore: intent.score,
        immersionScore,
      }),
    };
  });
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function renderMarkdown(phase: string, results: EvaluationResult[]): string {
  const weak = [...results].sort((left, right) => left.scores.total - right.scores.total).slice(0, 10);
  const strong = [...results].sort((left, right) => right.scores.total - left.scores.total).slice(0, 5);
  const lines: string[] = [];

  lines.push(`# Intent + Immersion Evaluation (${phase})`);
  lines.push("");
  lines.push(`- Cases: ${results.length}`);
  lines.push(`- Average intent score: ${average(results.map((result) => result.scores.intent))}`);
  lines.push(`- Average immersion score: ${average(results.map((result) => result.scores.immersion))}`);
  lines.push(`- Average growth-form score: ${average(results.map((result) => result.scores.growthForm))}`);
  lines.push(`- Average total score: ${average(results.map((result) => result.scores.total))}`);
  lines.push(`- Low intent cases (<0.5): ${results.filter((result) => result.scores.intent < 0.5).length}`);
  lines.push(`- Hard resistance violations: ${results.reduce((sum, result) => sum + result.output.curveMetrics.hardResistanceViolations, 0)}`);
  lines.push("");
  lines.push("## Strongest Cases");
  lines.push("");
  for (const result of strong) {
    lines.push(`- ${result.id} (${result.scores.total}) ${result.input}`);
  }
  lines.push("");
  lines.push("## Weakest Cases");
  lines.push("");
  for (const result of weak) {
    lines.push(`- ${result.id} (${result.scores.total}) ${result.input}`);
    lines.push(`  - Expected: ${result.expectedSignals.join(", ")}`);
    lines.push(`  - Top: ${result.output.topArtworks[0]?.title ?? "none"} / ${(result.output.topArtworks[0]?.moods ?? []).join(", ")}`);
    lines.push(`  - Note: ${result.notes.join(" ") || "OK"}`);
  }
  lines.push("");
  lines.push("## Full Output Log");
  lines.push("");
  lines.push("| ID | Input | Expected | Scores | Top output | Narrative output | Route output | Notes |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");

  for (const result of results) {
    const topOutput = result.output.topArtworks
      .slice(0, 3)
      .map((artwork) => `${artwork.rank}. ${artwork.title} [${artwork.moods.join("/")}] tokens=${artwork.matchedTokens.join("/") || "-"}`)
      .join("<br>");
    const routeOutput = result.output.route
      .map((stop) => `${stop.stage}: ${stop.scene} (${stop.source})`)
      .join("<br>");
    const narrativeOutput = [
      result.output.narrativePreface,
      `signals=${result.output.intentSignals.join("/") || "-"}`,
    ].join("<br>");
    const scoreOutput = `intent ${result.scores.intent}<br>immersive ${result.scores.immersion}<br>growth ${result.scores.growthForm}<br>total ${result.scores.total}`;
    const growthOutput = `stages=${result.output.curveMetrics.stageCount}; peaks=${result.output.curveMetrics.peakCount}; hardViolations=${result.output.curveMetrics.hardResistanceViolations}`;

    lines.push([
      result.id,
      result.input,
      result.expectedSignals.join(", "),
      scoreOutput,
      topOutput,
      `${narrativeOutput}<br>${growthOutput}`,
      routeOutput,
      result.notes.join("<br>") || "OK",
    ].map((cell) => String(cell).replace(/\|/g, "\\|").replace(/\n/g, "<br>")).join(" | "));
  }

  return `${lines.join("\n")}\n`;
}

function main(): void {
  let phase = "baseline";
  let outputDir = join(process.cwd(), "output", "intent-immersion-eval");
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--output-dir") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--output-dir requires a directory path.");
      }
      outputDir = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("--")) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    if (phase !== "baseline") {
      throw new Error("Only one positional phase argument is allowed.");
    }
    phase = argument;
  }
  const results = evaluate(phase);

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, `${phase}.json`), `${JSON.stringify(results, null, 2)}\n`);
  writeFileSync(join(outputDir, `${phase}.md`), renderMarkdown(phase, results));

  console.log(JSON.stringify({
    phase,
    cases: results.length,
    averageIntent: average(results.map((result) => result.scores.intent)),
    averageImmersion: average(results.map((result) => result.scores.immersion)),
    averageGrowthForm: average(results.map((result) => result.scores.growthForm)),
    averageTotal: average(results.map((result) => result.scores.total)),
    lowIntentCases: results.filter((result) => result.scores.intent < 0.5).length,
    hardResistanceViolations: results.reduce((sum, result) => sum + result.output.curveMetrics.hardResistanceViolations, 0),
    outputDir,
  }, null, 2));
}

main();
