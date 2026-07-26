import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  parseArtworkAgentCapsule,
  parseGrowthForm,
  parseUserAffectAgent,
} from "../../packages/contracts/src/affective-agent";
import * as contractsIndex from "../../packages/contracts/src/index";
import { buildArtworkAgentCapsule } from "../../packages/corpus/src/artwork-agent-capsule";
import { buildUserAffectAgent } from "../../packages/corpus/src/affective-intent";
import { buildAffectiveGrowthForm } from "../../apps/web/lib/affective-negotiation";
import { buildGallerySceneRoute } from "../../apps/web/lib/gallery-route";
import { buildCurationNarrative } from "../../apps/web/lib/curation-narrative";
import { ImmersiveGallery } from "../../packages/ui/src/immersive/immersive-gallery";
import { buildImmersiveScenes, getInitialImmersiveScene } from "../../packages/ui/src/immersive/scene-orchestrator";

(globalThis as any).React = React;

type Status = "pass" | "fail" | "blocked";
interface CaseResult {
  id: string;
  status: Status;
  message: string;
}

interface HarnessArguments {
  replayPath: string;
  replayRepeatPath: string;
  replayReportPath: string;
  outputDir: string;
}

function parseHarnessArguments(argv: string[]): HarnessArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag || !value || !["--replay", "--replay-repeat", "--replay-report", "--output-dir"].includes(flag)) {
      throw new Error(
        "Usage: tsx output/a2a-framework-test-20260616-142013/run-a2a-spec-harness.ts --replay <json> --replay-repeat <json> --replay-report <md> --output-dir <dir>",
      );
    }
    values.set(flag, value);
  }

  const replayPath = values.get("--replay");
  const replayRepeatPath = values.get("--replay-repeat");
  const replayReportPath = values.get("--replay-report");
  const outputDir = values.get("--output-dir");
  if (!replayPath || !replayRepeatPath || !replayReportPath || !outputDir) {
    throw new Error(
      "A2A harness requires --replay, --replay-repeat, --replay-report, and --output-dir so replay inputs are explicit and reproducible.",
    );
  }
  return {
    replayPath: resolve(replayPath),
    replayRepeatPath: resolve(replayRepeatPath),
    replayReportPath: resolve(replayReportPath),
    outputDir: resolve(outputDir),
  };
}

const harnessArguments = parseHarnessArguments(process.argv.slice(2));
const outDir = harnessArguments.outputDir;
const replay = JSON.parse(readFileSync(harnessArguments.replayPath, "utf8"));
const replayRepeat = JSON.parse(readFileSync(harnessArguments.replayRepeatPath, "utf8"));
const replayMarkdown = readFileSync(harnessArguments.replayReportPath, "utf8");
const results: CaseResult[] = [];

function values(entries: Array<{ value: string }> | undefined): string[] {
  return (entries ?? []).map((entry) => entry.value);
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[_\s-]+/g, "-");
}

function has(entries: Array<{ value: string }> | undefined, expected: string): boolean {
  const expectedNorm = norm(expected);
  return values(entries).map(norm).includes(expectedNorm);
}

function hasAny(entries: Array<{ value: string }> | undefined, expected: string[]): boolean {
  return expected.some((value) => has(entries, value));
}

function stageSignals(agent: ReturnType<typeof buildUserAffectAgent>): string[][] {
  return agent.temporalShape.stages.map((stage) => values(stage.signals).map(norm));
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function expectThrows(fn: () => unknown, message: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  expect(threw, message);
}

function run(id: string, fn: () => void): void {
  try {
    fn();
    results.push({ id, status: "pass", message: "OK" });
  } catch (error) {
    results.push({ id, status: "fail", message: error instanceof Error ? error.message : String(error) });
  }
}

function blocked(id: string, message: string): void {
  results.push({ id, status: "blocked", message });
}

const quietScene: any = {
  id: "bg-quiet",
  label: "Quiet Room",
  imageUrl: "/quiet.jpg",
  sceneType: "gallery_interior",
  moods: ["quiet", "serenity", "calm"],
  palette: ["charcoal", "blue", "muted-blue", "mist-white"],
  emotionIds: ["quiet", "calm", "serenity"],
  artworkPaletteModes: ["muted", "cool_neutral", "negative-space"],
  searchText: "quiet calm gallery interior mist white muted blue",
};

const dramaScene: any = {
  id: "bg-drama",
  label: "Drama Hall",
  imageUrl: "/drama.jpg",
  sceneType: "museum_hall",
  moods: ["dramatic", "awe"],
  palette: ["burgundy", "gold", "walnut"],
  emotionIds: ["drama", "awe", "desire"],
  artworkPaletteModes: ["dark-rich", "warm-rich"],
  searchText: "dramatic burgundy gold museum hall",
};

const hopeScene: any = {
  id: "bg-hope",
  label: "Hope Court",
  imageUrl: "/hope.jpg",
  sceneType: "courtyard",
  moods: ["hope", "alive"],
  palette: ["light-green", "warm-gold"],
  emotionIds: ["hope", "renewal"],
  artworkPaletteModes: ["dominant", "accent", "light"],
  searchText: "hope renewal light green warm gold courtyard",
};

function webResult(id: string, tags: {
  mood?: string[];
  emotion?: string[];
  color?: string[];
  subject?: string[];
  composition?: string[];
  sceneTypes?: string[];
  paletteModes?: string[];
  spatialModes?: string[];
  motionProfile?: string;
  tokens?: string[];
}, rank = 1, score = 0.8, scene = quietScene): any {
  const moodTags = tags.mood ?? [];
  const emotionLabels = tags.emotion ?? moodTags;
  const colorTags = tags.color ?? [];
  const subjectTags = tags.subject ?? [];
  const compositionTags = tags.composition ?? [];
  const tokens = tags.tokens ?? [...moodTags, ...emotionLabels, ...colorTags, ...subjectTags, ...compositionTags];
  return {
    rank,
    vectorScore: score,
    lexicalScore: score,
    combinedScore: score,
    matchedTokens: tokens,
    artwork: {
      id,
      title: `Work ${id}`,
      artistDisplayName: "Example Artist",
      yearLabel: "1901",
      moodTags,
      colorTags,
      subjectTags,
      compositionTags,
      emotionLabels,
      keywordBoosts: tokens,
      searchText: tokens.join(" "),
      grade: "A",
      gradeLabel: "director-focus",
      motionProfile: tags.motionProfile ?? "static",
      sceneAffinity: {
        sceneTypes: tags.sceneTypes ?? ["gallery_interior"],
        paletteModes: tags.paletteModes ?? colorTags,
        spatialModes: tags.spatialModes ?? [],
        transitionTags: [],
      },
      imageUrl: `https://example.test/${id}.jpg`,
      detailHref: `/artwork/${id}`,
    },
    scene,
  };
}

function artwork(overrides: any = {}): any {
  return {
    id: overrides.id ?? "art-1",
    source: "met",
    sourceArtworkId: "1",
    version: "2026-04-25-curation-b",
    metadata: {
      title: "Spec Artwork",
      artistDisplayName: "Spec Artist",
      yearLabel: "1900",
      moodTags: [],
      colorTags: [],
      subjectTags: [],
      compositionTags: [],
      ...(overrides.metadata ?? {}),
    },
    retrieval: {
      searchText: "",
      emotionLabels: [],
      keywordBoosts: [],
      energyLevel: "medium",
      valence: "mixed",
      pace: "still",
      spaceSense: "open",
      ...(overrides.retrieval ?? {}),
    },
    media: {
      baseImageUrl: "https://example.test/art.jpg",
      hasMotionAsset: false,
      mediaVersion: "2026-04-25T00:00:00.000Z",
      ...(overrides.media ?? {}),
    },
    presentation: {
      grade: "B",
      gradeLabel: "emotional-pillar",
      motionProfile: "static",
      sceneAffinity: {
        sceneTypes: [],
        paletteModes: [],
        spatialModes: [],
        transitionTags: [],
      },
      ...(overrides.presentation ?? {}),
    },
    ...(overrides.root ?? {}),
  };
}

function affectSignal(value: string, kind = "emotion"): any {
  return { kind, value, confidence: 0.8 };
}

function growthFixture(stageCount = 3): any {
  const roles = stageCount === 3
    ? ["threshold", "turn", "afterglow"]
    : stageCount === 4
      ? ["threshold", "mirror", "turn", "afterglow"]
      : ["threshold", "mirror", "turn", "release", "afterglow"];
  return {
    id: `growth-${stageCount}`,
    sourceText: "fixture",
    stages: Array.from({ length: stageCount }, (_, index) => ({
      id: `stage-${index + 1}`,
      label: ["Opening", "Mirror", "Turn", "Release", "Return"][index] ?? `Stage ${index + 1}`,
      role: roles[index],
      signals: [affectSignal(index === stageCount - 1 ? "calm" : index === 2 ? "wonder" : "quiet")],
      valence: index === 0 ? 0 : index === stageCount - 1 ? 1 : 0.5,
      arousal: 0.2 + index * 0.1,
      tension: 0.2,
      wonder: 0.3,
      intimacy: 0.5,
      intensity: 0.4,
      sceneIntent: "quiet scene",
      transitionIntent: index === stageCount - 1 ? "return" : "drift",
      artworkIds: [`art-${index + 1}`],
    })),
    rules: [{ id: "rule-trace", signal: "trace", severity: "diagnostic", action: "diagnose", reason: "trace" }],
    supportingArtworkIds: Array.from({ length: stageCount }, (_, index) => `art-${index + 1}`),
    rejectedArtworkIds: [],
    trace: [{ id: "trace-1", step: "user-agent", message: "trace" }],
  };
}

function search(results: any[], query = "quiet room"): any {
  return { query, normalizedQuery: query.toLowerCase(), model: "local", dimensions: 4, results };
}

// Agent 1
run("A1-01", () => {
  const agent = buildUserAffectAgent("我今天很疲惫，想先安静下来，然后慢慢变亮，最后有一点被接住的感觉。");
  expect(agent.languageHints.includes("zh"), "missing zh language hint");
  expect(stageSignals(agent).length >= 3, "expected at least 3 temporal stages");
  expect(stageSignals(agent).some((stage) => stage.includes("quiet")), "missing quiet stage");
  expect(has(agent.desires, "held"), "missing held/caught desired state");
});
run("A1-02", () => {
  const agent = buildUserAffectAgent("I want something calm, but I do not want anything chaotic, violent, or flashing red.");
  expect(agent.languageHints.includes("en"), "missing en language hint");
  expect(hasAny(agent.desires, ["calm", "serenity", "quiet"]), "missing calm desire");
  expect(has(agent.resistances, "chaotic"), "missing chaotic resistance");
  expect(has(agent.resistances, "violent"), "missing violent resistance");
  expect(has(agent.resistances, "flashing-red"), "missing flashing-red resistance");
});
run("A1-03", () => {
  const agent = buildUserAffectAgent("我现在有点 numb，想要 something soft and spacious，不要太甜腻。");
  expect(agent.languageHints.includes("zh") && agent.languageHints.includes("en"), "missing bilingual hints");
  expect(hasAny(agent.desires, ["soft", "spacious"]), "missing soft/spacious desire");
  expect(has(agent.spatialNeeds, "spacious"), "missing spacious spatial need");
  expect(has(agent.resistances, "overly-sweet"), "missing overly-sweet resistance");
});
run("A1-04", () => {
  const agent = buildUserAffectAgent("我不是不想要一点黑暗，但我不想要绝望感。");
  expect(hasAny(agent.desires, ["low-light", "dark"]) || values(agent.visualConstraints).some((value) => /dark|low-light/.test(value)), "dark nuance was not preserved");
  expect(hasAny(agent.resistances, ["despair", "heavy-grief"]), "missing despair resistance");
});
run("A1-05", () => {
  const agent = buildUserAffectAgent("希望像小时候暑假外婆家，风扇声、午后光、旧木桌，但不要怀旧到伤感。");
  for (const expected of ["childhood", "summer", "grandmother-home", "fan", "afternoon-light", "old-wood-table"]) {
    expect(has(agent.memoryHints, expected), `missing memory hint ${expected}`);
  }
  expect(hasAny(agent.resistances, ["sentimental-sadness", "heavy-grief"]), "missing nostalgia sadness boundary");
});
run("A1-06", () => {
  const agent = buildUserAffectAgent("胸口很紧，想要雾白和浅绿，大面积留白，空间像能呼吸一样。");
  expect(agent.currentState.tension > 0.45, "tension was not elevated");
  for (const expected of ["mist-white", "light-green", "negative-space"]) {
    expect(values(agent.visualConstraints).map(norm).includes(expected), `missing visual constraint ${expected}`);
  }
  expect(hasAny(agent.spatialNeeds, ["breathable", "open", "spacious"]), "missing breathable/open spatial need");
});
run("A1-07", () => {
  const agent = buildUserAffectAgent("起初压低一点，中段出现微光，随后有一次明显转折，再慢慢展开，最后停在平静里。");
  expect(agent.temporalShape.stages.length === 5, `expected 5 stages, got ${agent.temporalShape.stages.length}`);
  expect(agent.temporalShape.peakCount === 1, `expected one peak, got ${agent.temporalShape.peakCount}`);
});
run("A1-08", () => {
  const agent = buildUserAffectAgent("我想被鼓励，但不要鸡血，不要口号，不要胜利感。");
  expect(hasAny(agent.desires, ["encouragement", "support"]), "missing encouragement/support desire");
  for (const expected of ["hype", "slogan", "victory"]) {
    expect(has(agent.resistances, expected), `missing resistance ${expected}`);
  }
});
run("A1-09", () => {
  const agent = buildUserAffectAgent("嗯……可能想要一点蓝色？或者不是。反正别太吵。");
  expect(has(agent.resistances, "loud"), "missing loud hard boundary");
  expect(agent.confidence < 0.7, "ambiguous input did not lower confidence");
});
run("A1-10", () => {
  const agent = buildUserAffectAgent("现在脑子很乱，但我不是要被治愈，只想有一个冷静、清楚、可退出的空间。");
  expect(hasAny(agent.resistances, ["healing-narrative"]), "missing healing narrative resistance");
  expect(hasAny(agent.spatialNeeds, ["exit", "withdrawable-space"]), "missing exit/withdrawable spatial need");
});

// Agent 2
run("A2-01", () => {
  const capsule = buildArtworkAgentCapsule(artwork({ metadata: { title: "Only Color", artistDisplayName: "A", yearLabel: "1900", colorTags: ["blue"] } }));
  expect(capsule.identity.title === "Only Color", "title was not preserved");
  expect(capsule.canOffer.length === 0, "mood/subject/motion was hallucinated");
  expect(capsule.aesthetics.some((entry) => entry.value === "blue"), "color evidence missing");
  expect(capsule.evidence.length > 0, "evidence missing");
});
run("A2-02", () => {
  const capsule = buildArtworkAgentCapsule(artwork({
    metadata: { description: "somber evening" },
    retrieval: { searchText: "melancholic atmosphere", emotionLabels: [] },
  }));
  expect(hasAny(capsule.canOffer, ["somber", "melancholy"]), "description/retrieval mood was not derived");
});
run("A2-03", () => {
  const capsule = buildArtworkAgentCapsule(artwork({
    metadata: { colorTags: ["blue", "gold"] },
    presentation: { sceneAffinity: { sceneTypes: [], paletteModes: ["navy", "#D8A21B", "blue"], spatialModes: [], transitionTags: [] } },
  }));
  const paletteValues = capsule.aesthetics.map((entry) => entry.value);
  expect(paletteValues.filter((value) => /blue|navy/.test(value)).length <= 1, "blue/navy equivalent colors were duplicated");
  expect(paletteValues.filter((value) => /gold|d8a21b/i.test(value)).length <= 1, "gold equivalent colors were duplicated");
});
run("A2-04", () => {
  const capsule = buildArtworkAgentCapsule(artwork({
    metadata: { subjectTags: ["river", "bridge"] },
    retrieval: { searchText: "urban landscape", emotionLabels: [] },
    presentation: { sceneAffinity: { sceneTypes: ["water", "architecture"], paletteModes: [], spatialModes: [], transitionTags: [] } },
  }));
  const allSignals = [...values(capsule.sceneAffinity), ...values(capsule.aesthetics), ...values(capsule.canOffer)];
  for (const expected of ["river", "bridge", "urban", "water", "architecture"]) {
    expect(allSignals.map(norm).includes(expected), `missing derived scene/subject signal ${expected}`);
  }
});
run("A2-05", () => {
  const capsule = buildArtworkAgentCapsule(artwork({ metadata: { compositionTags: ["central", "diagonal", "negative-space"] } }));
  for (const expected of ["central", "diagonal", "negative-space"]) {
    expect(capsule.aesthetics.some((entry) => entry.kind === "composition" && entry.value === expected), `missing composition ${expected}`);
  }
});
run("A2-06", () => {
  const capsule = buildArtworkAgentCapsule(artwork({
    retrieval: { pace: "fast-flow" },
    presentation: { motionProfile: "kinetic", sceneAffinity: { sceneTypes: [], paletteModes: [], spatialModes: [], transitionTags: ["repeated-forms"] } },
  }));
  expect(capsule.motionAffinity.length > 0, "motion affinity missing");
  expect(capsule.motionAffinity.every((entry) => entry.evidenceIds.length > 0), "motion evidence missing");
});
run("A2-07", () => {
  const capsule = buildArtworkAgentCapsule(artwork({ root: { restrictions: ["display-only", "no-cropping", "no-color-alteration"] } }));
  for (const expected of ["display-only", "no-cropping", "no-recolor"]) {
    expect(has(capsule.boundaries, expected), `missing restriction boundary ${expected}`);
  }
});
run("A2-08", () => {
  const capsule = buildArtworkAgentCapsule(artwork({ metadata: { title: "Minimal" } }));
  expect(capsule.identity.title === "Minimal", "minimal title missing");
  expect(capsule.confidence < 0.6, "minimal capsule confidence should be low");
  parseArtworkAgentCapsule(capsule);
});
run("A2-09", () => {
  const capsule = buildArtworkAgentCapsule(artwork({
    metadata: { moodTags: ["beautiful", "nice", "good"], colorTags: ["blue"], compositionTags: ["central"] },
  }));
  expect(!hasAny(capsule.canOffer, ["beautiful", "nice", "good"]), "generic text became concrete mood");
  expect(capsule.aesthetics.length > 0, "reliable color/composition was not retained");
});
run("A2-10", () => {
  const capsule = buildArtworkAgentCapsule(artwork({
    metadata: { colorTags: ["red", "orange"] },
    retrieval: { emotionLabels: ["cool"], valence: "mixed" },
    presentation: { sceneAffinity: { sceneTypes: [], paletteModes: ["blue", "gray", "cool-tonality"], spatialModes: [], transitionTags: [] } },
  }));
  expect(capsule.confidence < 0.86, "conflicting color sources did not lower confidence");
  expect(!has(capsule.canOffer, "energetic"), "warm metadata forced energetic mood");
});

// Agent 3
run("A3-01", () => {
  const form = buildAffectiveGrowthForm({
    query: "不要太明亮",
    results: [webResult("bright", { mood: ["joy"], color: ["gold"] }, 1), webResult("safe", { mood: ["quiet"] }, 2)],
    backgroundScenes: [quietScene],
  });
  expect(form.rejectedArtworkIds.includes("bright"), "bright alias candidate was not rejected");
  expect(!form.stages.flatMap((stage) => stage.artworkIds).includes("bright"), "rejected bright candidate was assigned");
});
run("A3-02", () => {
  const form = buildAffectiveGrowthForm({
    query: "不要吵",
    results: [webResult("loud", { mood: ["festival"], tokens: ["active"] }, 1), webResult("calm", { mood: ["calm"] }, 2)],
    backgroundScenes: [quietScene],
  });
  expect(form.rejectedArtworkIds.includes("loud"), "loud alias candidate was not rejected");
  expect(form.supportingArtworkIds.includes("calm"), "calm candidate was not retained");
});
run("A3-03", () => {
  const form = buildAffectiveGrowthForm({
    query: "不要沉重悲伤",
    results: [webResult("grief", { mood: ["grief", "despair"] }, 1), webResult("safe", { mood: ["quiet"] }, 2)],
    backgroundScenes: [quietScene],
  });
  expect(form.rejectedArtworkIds.includes("grief"), "grief candidate was not rejected");
  expect(form.trace.some((trace) => trace.artworkId === "grief" && trace.signal === "heavy-grief"), "reject trace did not mark grief boundary");
});
run("A3-04", () => {
  const form = buildAffectiveGrowthForm({
    query: "不要剧情太满 / no heavy drama",
    results: [webResult("drama", { mood: ["drama", "high-contrast"] }, 1), webResult("tension", { mood: ["tension"] }, 2)],
    backgroundScenes: [quietScene],
  });
  expect(form.rejectedArtworkIds.includes("drama"), "heavy-drama candidate was not rejected");
  expect(!form.rejectedArtworkIds.includes("tension"), "light tension candidate was over-rejected");
});
run("A3-05", () => {
  const form = buildAffectiveGrowthForm({
    query: "喜欢 muted",
    results: [webResult("saturated", { color: ["saturated"], mood: ["wonder"] }, 1), webResult("muted", { color: ["muted"], mood: ["quiet"] }, 2)],
    backgroundScenes: [quietScene],
  });
  expect(!form.rejectedArtworkIds.includes("saturated"), "soft muted preference became hard saturated rejection");
});
run("A3-06", () => {
  const form = buildAffectiveGrowthForm({
    query: "不要太明亮 不要吵 不要沉重悲伤",
    results: [webResult("bright", { color: ["bright"] }, 1), webResult("loud", { mood: ["festival"] }, 2), webResult("grief", { mood: ["grief"] }, 3)],
    backgroundScenes: [quietScene],
  });
  expect(form.stages.length >= 3 && form.stages.length <= 5, "fallback growth form did not keep 3-5 stages");
  expect(form.trace.some((trace) => /all|fallback/i.test(trace.message)), "fallback/all-rejected trace reason missing");
});
run("A3-07", () => {
  const form = buildAffectiveGrowthForm({
    query: "不要明亮，不要吵，不要悲伤",
    results: [webResult("bright", { color: ["bright"] }, 1), webResult("loud", { mood: ["festival"] }, 2), webResult("grief", { mood: ["grief"] }, 3), webResult("safe", { mood: ["quiet"] }, 4)],
    backgroundScenes: [quietScene],
  });
  for (const id of ["bright", "loud", "grief"]) {
    expect(form.trace.some((trace) => trace.artworkId === id && trace.step === "reject" && trace.signal), `missing reject trace for ${id}`);
  }
  expect(!form.trace.some((trace) => trace.artworkId === "safe" && trace.step === "reject"), "safe candidate has reject trace");
});
run("A3-08", () => {
  const input = {
    query: "先安静，再惊叹，最后回到平静",
    results: [webResult("quiet", { mood: ["quiet"] }, 1), webResult("wonder", { mood: ["wonder"] }, 2), webResult("calm", { mood: ["calm"] }, 3)],
    backgroundScenes: [quietScene, hopeScene],
  };
  const runs = [buildAffectiveGrowthForm(input), buildAffectiveGrowthForm(input), buildAffectiveGrowthForm(input)].map((form) => JSON.stringify(form));
  expect(runs[0] === runs[1] && runs[1] === runs[2], "growth form was not deterministic");
});
run("A3-09", () => {
  const input = {
    query: "安静",
    results: [webResult("b", { mood: ["quiet"] }, 2, 0.8), webResult("a", { mood: ["quiet"] }, 1, 0.8)],
    backgroundScenes: [quietScene],
  };
  const first = buildAffectiveGrowthForm(input).supportingArtworkIds.join(",");
  const second = buildAffectiveGrowthForm(input).supportingArtworkIds.join(",");
  expect(first === second, "tie-break was not stable");
});
run("A3-10", () => {
  const form = buildAffectiveGrowthForm({
    query: "不要明亮",
    results: [webResult("bright-top", { color: ["bright"] }, 1, 0.99), webResult("safe-low", { mood: ["quiet"] }, 2, 0.1)],
    backgroundScenes: [quietScene],
  });
  expect(form.rejectedArtworkIds.includes("bright-top"), "top hard-boundary candidate was not rejected");
  expect(!form.stages.flatMap((stage) => stage.artworkIds).includes("bright-top"), "top rejected candidate was assigned");
});

// Agent 4
run("A4-01", () => { parseGrowthForm(growthFixture(3)); });
run("A4-02", () => {
  const parsed = parseGrowthForm(growthFixture(4));
  expect(new Set(parsed.stages.map((stage) => stage.id)).size === 4, "stage ids are not unique");
  expect(parsed.stages.map((stage) => stage.role).join(",") === "threshold,mirror,turn,afterglow", "4-stage role sequence mismatch");
});
run("A4-03", () => {
  const parsed = parseGrowthForm(growthFixture(5));
  expect(parsed.stages.every((stage) => stage.transitionIntent), "missing transition intent");
  expect(parsed.stages.at(-1)?.transitionIntent === "return", "last transition should return");
});
run("A4-04", () => {
  expectThrows(() => parseGrowthForm(growthFixture(2)), "2-stage fixture was accepted");
  expectThrows(() => parseGrowthForm(growthFixture(6)), "6-stage fixture was accepted");
});
run("A4-05", () => {
  const fixture = growthFixture(3);
  fixture.stages[0].valence = -0.1;
  expectThrows(() => parseGrowthForm(fixture), "invalid normalized values were accepted");
});
run("A4-06", () => {
  const input = { query: "安静", results: [webResult("a", { mood: ["quiet"] }, 1)], backgroundScenes: [quietScene] };
  expect(buildAffectiveGrowthForm(input).id === buildAffectiveGrowthForm(input).id, "GrowthForm id not deterministic");
});
run("A4-07", () => {
  const one = buildAffectiveGrowthForm({ query: "安静", results: [webResult("a", { mood: ["quiet"] }, 1)], backgroundScenes: [quietScene] });
  const two = buildAffectiveGrowthForm({ query: "安静", results: [webResult("b", { mood: ["quiet"] }, 1)], backgroundScenes: [quietScene] });
  expect(one.id !== two.id, "GrowthForm id did not change with selected artwork");
});
run("A4-08", () => {
  const form = buildAffectiveGrowthForm({
    query: "不要明亮",
    results: [webResult("dup", { color: ["bright"] }, 1), webResult("dup", { mood: ["quiet"] }, 2), webResult("safe", { mood: ["quiet"] }, 3)],
    backgroundScenes: [quietScene],
  });
  const supporting = new Set(form.supportingArtworkIds);
  const rejected = new Set(form.rejectedArtworkIds);
  expect(form.supportingArtworkIds.length === supporting.size, "supporting ids not deduped");
  expect(![...supporting].some((id) => rejected.has(id)), "same id appears in supporting and rejected");
});
run("A4-09", () => {
  const form = buildAffectiveGrowthForm({ query: "不要明亮", results: [webResult("a", { color: ["bright"] }, 1), webResult("b", { mood: ["quiet"] }, 2)], backgroundScenes: [quietScene] });
  expect(form.trace.length > 0, "trace is empty");
  expect(form.trace.some((trace) => trace.step === "user-agent") && form.trace.some((trace) => trace.step === "stage"), "trace lacks user-agent or stage step");
});
run("A4-10", () => {
  const form = buildAffectiveGrowthForm({ query: "先 再 最后", results: [webResult("a", { mood: ["quiet"] }, 1), webResult("b", { mood: ["wonder"] }, 2), webResult("c", { mood: ["calm"] }, 3)], backgroundScenes: [quietScene] });
  parseGrowthForm(form);
  expect(form.stages.every((stage) => stage.label.trim().length > 1), "empty/polluted stage label");
});

// Agent 5
run("A5-01", () => {
  const growth = growthFixture(3);
  growth.stages[0].sceneIntent = "gallery_interior";
  growth.stages[0].signals = [affectSignal("gallery_interior", "spatial")];
  const route = buildGallerySceneRoute(search([webResult("a", { mood: ["quiet"] }, 1)]), [dramaScene, quietScene], { growthForm: parseGrowthForm(growth) });
  expect(route[0]?.scene.id === "bg-quiet", "sceneType matching did not select unique background");
});
run("A5-02", () => {
  const route1 = buildGallerySceneRoute(search([webResult("a", { mood: ["calm"] }, 1)]), [dramaScene, quietScene]);
  const route2 = buildGallerySceneRoute(search([webResult("a", { mood: ["calm"] }, 1)]), [dramaScene, quietScene]);
  expect(route1[0]?.scene.id === "bg-quiet", "mood matching did not select calm background");
  expect(JSON.stringify(route1) === JSON.stringify(route2), "background selection not stable");
});
run("A5-03", () => {
  const route = buildGallerySceneRoute(search([webResult("a", { color: ["muted-blue"] }, 1)]), [dramaScene, quietScene]);
  expect(route[0]?.scene.id === "bg-quiet", "palette matching failed");
});
run("A5-04", () => {
  const weak = { ...quietScene, id: "bg-weak", moods: ["calm"], emotionIds: [] };
  const strong = { ...hopeScene, id: "bg-strong", moods: [], emotionIds: ["calm"] };
  const route = buildGallerySceneRoute(search([webResult("a", { mood: ["calm"] }, 1)]), [weak, strong]);
  expect(route[0]?.scene.id === "bg-strong", "emotionIds strong match did not beat weak mood match");
});
run("A5-05", () => {
  const route = buildGallerySceneRoute(search([webResult("a", { paletteModes: ["dominant", "accent"] }, 1)]), [quietScene, hopeScene]);
  expect(route[0]?.scene.id === "bg-hope", "artworkPaletteModes matching failed");
});
run("A5-06", () => {
  const route = buildGallerySceneRoute(search([webResult("a", { mood: ["unknown"] }, 1)]), [quietScene, dramaScene, hopeScene]);
  expect(route.length > 0, "legacy fallback produced blank route");
});
run("A5-07", () => {
  const a = { ...quietScene, id: "a-scene" };
  const b = { ...quietScene, id: "b-scene" };
  const route = buildGallerySceneRoute(search([webResult("a", { mood: ["quiet"] }, 1)]), [b, a]);
  expect(route[0]?.scene.id === "a-scene", "equal score tie-break was not id-stable");
});
run("A5-08", () => {
  const growth = buildAffectiveGrowthForm({
    query: "先安静，再神秘，再惊叹，最后希望",
    results: [webResult("a", { mood: ["quiet"] }, 1), webResult("b", { mood: ["mystery"] }, 2), webResult("c", { mood: ["wonder"] }, 3), webResult("d", { mood: ["hope"] }, 4)],
    backgroundScenes: [quietScene, dramaScene, hopeScene],
  });
  const route = buildGallerySceneRoute(search([webResult("a", { mood: ["quiet"] }, 1), webResult("b", { mood: ["mystery"] }, 2), webResult("c", { mood: ["wonder"] }, 3), webResult("d", { mood: ["hope"] }, 4)]), [quietScene, dramaScene, hopeScene], { growthForm: growth });
  expect(route.length === 4, `expected 4 route stops, got ${route.length}`);
});
run("A5-09", () => {
  const route = buildGallerySceneRoute(search([webResult("a", { mood: ["quiet"] }, 1), webResult("b", { mood: ["wonder"] }, 5), webResult("c", { mood: ["calm"] }, 9)]), [quietScene, dramaScene, hopeScene]);
  expect(route.length > 0 && route.every((stop) => !stop.growthStageId), "legacy route fallback failed");
});
run("A5-10", () => {
  const route = buildGallerySceneRoute(search([webResult("a", { mood: ["quiet"] }, 1)]), []);
  expect(Array.isArray(route), "empty background scenes did not return a safe route shape");
});

// Agent 6
run("A6-01", () => {
  const scenes = buildImmersiveScenes([{ id: "a", title: "A", imageUrl: "a.jpg", stageLabel: "Opening", stageTone: "quiet", emotionalIntensity: 0.4 }]);
  expect(scenes[0]?.unit.stageLabel === "Opening" && scenes[0]?.unit.stageTone === "quiet" && scenes[0]?.unit.emotionalIntensity === 0.4, "growth stage metadata not preserved");
});
run("A6-02", () => {
  const markup = renderToStaticMarkup(React.createElement(ImmersiveGallery, { galleryHref: "/gallery", units: [{ id: "a", title: "A", imageUrl: "a.jpg", emotionalIntensity: 0 }] }));
  expect(markup.includes("A"), "artwork missing at intensity=0");
  expect(!/NaN/.test(markup), "NaN appeared at intensity=0");
});
run("A6-03", () => {
  const scenes = buildImmersiveScenes([{ id: "a", title: "A", imageUrl: "a.jpg", stageTone: "high tension", emotionalIntensity: 1.4 }]);
  expect((scenes[0]?.unit.emotionalIntensity ?? 0) <= 1, "high intensity was not clamped");
});
run("A6-04", () => {
  const scenes = buildImmersiveScenes([
    { id: "a", title: "A", imageUrl: "a.jpg", transitionIntent: "drift", transitionFamily: "fade" },
    { id: "b", title: "B", imageUrl: "b.jpg", transitionIntent: "return", transitionFamily: "dissolve" },
  ]);
  expect(scenes[0]?.unit.transitionIntent === "drift" && scenes[1]?.unit.transitionIntent === "return", "transition intent not preserved");
  expect(getInitialImmersiveScene(scenes.map((scene) => scene.unit), { selectedUnitId: "b" })?.unit.id === "b", "stage selection was unstable");
});
run("A6-05", () => {
  const markup = renderToStaticMarkup(React.createElement(ImmersiveGallery, { galleryHref: "/gallery", units: [] }));
  expect(markup.includes("展厅尚未就绪"), "empty immersive state missing");
});
run("A6-06", () => {
  const markup = renderToStaticMarkup(React.createElement(ImmersiveGallery, { galleryHref: "/gallery", units: [{ id: "a1", title: "A1", imageUrl: "a.jpg" }, { id: "a1", title: "A1 again", imageUrl: "a2.jpg" }, { id: "a2", title: "A2", imageUrl: "a3.jpg" }] }));
  expect(markup.includes("A1"), "duplicate ids broke render");
});
blocked("A6-07", "Requires browser layout-shift measurement or hydration timing; skipped under no-Playwright constraint.");
run("A6-08", () => {
  const markup = renderToStaticMarkup(React.createElement(ImmersiveGallery, { galleryHref: "/gallery", units: [{ id: "legacy", title: "Legacy", imageUrl: "legacy.jpg" }] }));
  expect(markup.includes("Legacy"), "legacy unit rendering failed without growthForm");
});
run("A6-09", () => {
  const longTitle = "超长中文标题".repeat(50);
  const markup = renderToStaticMarkup(React.createElement(ImmersiveGallery, { galleryHref: "/gallery", units: [{ id: "long", title: longTitle, imageUrl: "long.jpg" }] }));
  expect(markup.includes("超长中文标题"), "long label did not render");
  expect(/overflow|text-overflow|line-clamp|word-break|wrap/.test(markup), "no visible markup-level overflow control for long label");
});
blocked("A6-10", "Viewport coverage and online LLM timeout fallback require browser/network scenario control; skipped under no-Playwright constraint.");

// Agent 7
run("A7-01", () => {
  const sample = replay[0];
  expect(sample.id && sample.output.userAgent && sample.output.growthForm && sample.output.negotiationTrace && sample.output.curveMetrics, "core replay fields missing");
  expect(sample.output.artworkCapsules, "artwork capsules missing");
  expect(sample.timestamp && sample.version && sample.runId, "timestamp/version/runId missing");
});
run("A7-02", () => {
  expect(JSON.stringify(replay) === JSON.stringify(replayRepeat), "same replay phase inputs are not deterministic");
});
run("A7-03", () => {
  const hasViolationGroups = replay.some((entry: any) => entry.output?.violationSummary || entry.output?.violationsByReason);
  expect(hasViolationGroups, "violation count/rate grouped statistics missing");
});
run("A7-04", () => {
  expect(replay.every((entry: any) => Array.isArray(entry.output?.stageMetrics)), "per-stage curve metrics missing");
});
run("A7-05", () => {
  expect(replay.some((entry: any) => entry.reviewerVerdict || entry.reviewerNotes || entry.severity), "reviewer fields missing");
});
run("A7-06", () => {
  expect(/failed caseId|failed cases|失败/i.test(replayMarkdown), "failed-case reproduction section missing");
});
run("A7-07", () => {
  expect(/baseline|candidate|delta|regression|improvement/i.test(replayMarkdown), "baseline/candidate diff output missing");
});
run("A7-08", () => {
  expect(/Cases: 50/.test(replayMarkdown), "total cases missing");
  expect(/pass|fail/i.test(replayMarkdown), "pass/fail summary missing");
  expect(/rejection|resistance violation/i.test(replayMarkdown), "rejection/resistance summary missing");
});
run("A7-09", () => {
  expect(!replay.some((entry: any) => typeof entry.input === "string" && entry.input.length > 0), "raw user prompts are copied into replay JSON");
});
blocked("A7-10", "Script has hardcoded cases and no injectable malformed-case fixture interface to continue after invalid inputs.");

// Agent 8
run("A8-01", () => {
  const agent = buildUserAffectAgent("   ");
  const form = buildAffectiveGrowthForm({ query: "   ", results: [], backgroundScenes: [quietScene] });
  expect(agent.confidence <= 0.2, "empty query did not lower confidence");
  expect(form.stages.length >= 3, "empty query growth form crashed");
});
run("A8-02", () => {
  const long = "安静".repeat(5000);
  const agent = buildUserAffectAgent(long);
  expect(agent.sourceText.length < long.length, "10k+ query was not truncated or rejected");
});
run("A8-03", () => {
  const agent = buildUserAffectAgent("🙂 <script>alert(1)</script> SELECT * FROM art WHERE url='https://x.test'");
  parseUserAffectAgent(agent);
});
run("A8-04", () => {
  const form = buildAffectiveGrowthForm({ query: "安静", results: [], backgroundScenes: [quietScene] });
  expect(form.stages.length >= 3, "empty results crashed growth form");
});
run("A8-05", () => {
  expectThrows(() => buildArtworkAgentCapsule({ id: "bad" } as any), "malformed artwork was not rejected or isolated");
});
run("A8-06", () => {
  const fixture = growthFixture(3);
  fixture.stages[0].arousal = 1.2;
  expectThrows(() => parseGrowthForm(fixture), "out-of-range normalized field accepted");
});
run("A8-07", () => {
  const fixture = growthFixture(3);
  fixture.stages[0].role = "opening";
  expectThrows(() => parseGrowthForm(fixture), "unknown GrowthStage.role accepted");
});
run("A8-08", () => {
  const form = buildAffectiveGrowthForm({ query: "安静", results: [webResult("dup", { mood: ["quiet"] }, 1), webResult("dup", { mood: ["calm"] }, 2), webResult("other", { mood: ["quiet"] }, 3)], backgroundScenes: [quietScene] });
  expect(form.supportingArtworkIds.length === new Set(form.supportingArtworkIds).size, "duplicate artwork ids leaked into supporting ids");
});
run("A8-09", () => {
  const form = buildAffectiveGrowthForm({ query: "安静", results: [webResult("nan", { mood: ["quiet"] }, 1, Number.NaN), webResult("inf", { mood: ["quiet"] }, 2, Infinity), webResult("neg", { mood: ["quiet"] }, 3, -1)], backgroundScenes: [quietScene] });
  parseGrowthForm(form);
});
run("A8-10", () => {
  const route = buildGallerySceneRoute(search([webResult("a", { mood: ["quiet"] }, 1)]), []);
  expect(Array.isArray(route), "missing backgroundScenes crashed route");
});

// Agent 9
run("A9-01", () => {
  const agent = buildUserAffectAgent("睡前想平静一点，但不要空灵鸡汤");
  expect(has(agent.desires, "restful"), "bedtime/restful not recognized");
  expect(hasAny(agent.resistances, ["empty-cliche", "slogan"]), "empty-cliche/chicken-soup boundary missing");
});
run("A9-02", () => {
  const agent = buildUserAffectAgent("刚分手，但我不想看悲伤的东西");
  expect(hasAny(agent.resistances, ["heavy-grief", "sad"]), "no-sad boundary missing");
  expect(hasAny(agent.memoryHints, ["breakup"]), "breakup context missing");
});
run("A9-03", () => {
  const agent = buildUserAffectAgent("今天拿到 offer，想庆祝，但要高级克制");
  expect(hasAny(agent.desires, ["celebration", "joy"]), "celebration desire missing");
  expect(hasAny(agent.resistances, ["cliche-fireworks", "party"]), "cliche celebration boundary missing");
});
run("A9-04", () => {
  const agent = buildUserAffectAgent("想和很亲近的人一起看点温柔的，但不要太恋爱脑");
  expect(hasAny(agent.desires, ["companionship", "intimate"]), "companionship/intimacy missing");
  expect(hasAny(agent.resistances, ["romance-overload"]), "romance-overload boundary missing");
});
run("A9-05", () => {
  const agent = buildUserAffectAgent("和 7 岁孩子睡前一起看，有趣但别吓人");
  expect(hasAny(agent.memoryHints, ["child", "family"]), "child/family context missing");
  expect(hasAny(agent.resistances, ["scary", "adult", "heavy-drama"]), "child-safe scary/adult boundary missing");
});
run("A9-06", () => {
  const agent = buildUserAffectAgent("我想看让我消失的画");
  expect(hasAny(agent.resistances, ["self-harm", "disappear-risk"]), "crisis/safety risk not detected");
});
run("A9-07", () => {
  const agent = buildUserAffectAgent("有点 overwhelmed，想看 something quiet but alive");
  expect(agent.languageHints.includes("zh") && agent.languageHints.includes("en"), "bilingual hints missing");
  expect(has(agent.desires, "quiet") && has(agent.desires, "alive"), "quiet/alive desires missing");
});
blocked("A9-08", "Rapid rewrite cancellation/race behavior requires UI request concurrency instrumentation.");
blocked("A9-09", "Share-link privacy and return-to-gallery state requires routed browser/session validation.");
run("A9-10", () => {
  const narrative = buildCurationNarrative(search([webResult("a", { mood: ["quiet"] }, 1), webResult("b", { mood: ["calm"] }, 2), webResult("c", { mood: ["serenity"] }, 3)], "网络断开，想要安静"));
  expect(narrative.growthForm.stages.length >= 3, "local/offline narrative fallback failed");
});

// Agent 10
run("A10-01", () => {
  parseUserAffectAgent(buildUserAffectAgent("安静"));
  parseArtworkAgentCapsule(buildArtworkAgentCapsule(artwork({ metadata: { moodTags: ["quiet"] } })));
  parseGrowthForm(growthFixture(3));
});
run("A10-02", () => {
  const user = buildUserAffectAgent("安静") as any;
  delete user.sourceText;
  expectThrows(() => parseUserAffectAgent(user), "missing root field accepted");
  const growth = growthFixture(3);
  delete growth.stages[0].id;
  expectThrows(() => parseGrowthForm(growth), "missing nested field accepted");
});
run("A10-03", () => {
  const user = buildUserAffectAgent("安静") as any;
  user.desires[0].kind = "__future__";
  expectThrows(() => parseUserAffectAgent(user), "unknown enum accepted");
});
run("A10-04", () => {
  const user = buildUserAffectAgent("安静") as any;
  user.visualConstraints.push({ value: "x", polarity: "mixedish", severity: "criticalish" });
  expectThrows(() => parseUserAffectAgent(user), "invalid constraint enum accepted");
});
run("A10-05", () => {
  const growth = growthFixture(3);
  growth.rules[0].action = "teleport";
  expectThrows(() => parseGrowthForm(growth), "invalid rule action accepted");
  const growth2 = growthFixture(3);
  growth2.stages[0].role = "super_admin";
  expectThrows(() => parseGrowthForm(growth2), "invalid growth role accepted");
});
run("A10-06", () => {
  const growth = growthFixture(3);
  growth.stages[0].transitionIntent = "warp";
  expectThrows(() => parseGrowthForm(growth), "invalid transition accepted");
});
run("A10-07", () => {
  expectThrows(() => parseArtworkAgentCapsule({ ...buildArtworkAgentCapsule(artwork({ metadata: { moodTags: ["quiet"] } })), evidence: [] }), "empty evidence accepted");
  const capsule = buildArtworkAgentCapsule(artwork({ metadata: { moodTags: ["quiet"] } })) as any;
  capsule.canOffer[0].evidenceIds = ["missing-evidence"];
  expectThrows(() => parseArtworkAgentCapsule(capsule), "dangling evidenceIds accepted");
});
run("A10-08", () => {
  for (const bad of [-0.01, 1.01, Number.NaN, "0.5"]) {
    const growth = growthFixture(3);
    growth.stages[0].valence = bad;
    expectThrows(() => parseGrowthForm(growth), `bad normalized value ${String(bad)} accepted`);
  }
});
run("A10-09", () => {
  const user = buildUserAffectAgent("安静") as any;
  user.extraField = "leak";
  user.temporalShape.extraField = "nested";
  const parsed = parseUserAffectAgent(user) as any;
  expect(parsed.extraField === undefined && parsed.temporalShape.extraField === undefined, "extra fields leaked through parser");
});
run("A10-10", () => {
  expect(typeof contractsIndex.parseUserAffectAgent === "function" && typeof contractsIndex.parseArtworkAgentCapsule === "function" && typeof contractsIndex.parseGrowthForm === "function", "public parser exports missing");
  const route = buildGallerySceneRoute(search([webResult("a", { mood: ["quiet"] }, 1)]), [quietScene]);
  expect(route.length > 0, "legacy gallery fallback without GrowthForm failed");
});

const counts = results.reduce<Record<Status, number>>((acc, result) => {
  acc[result.status] += 1;
  return acc;
}, { pass: 0, fail: 0, blocked: 0 });

const byAgent = results.reduce<Record<string, Record<Status | "total", number>>>((acc, result) => {
  const agent = result.id.split("-")[0];
  acc[agent] ??= { total: 0, pass: 0, fail: 0, blocked: 0 };
  acc[agent].total += 1;
  acc[agent][result.status] += 1;
  return acc;
}, {});

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "spec-harness-results.json"), `${JSON.stringify({ counts, byAgent, results }, null, 2)}\n`);

const lines = [
  "# A2A Spec Harness Results",
  "",
  `- Total: ${results.length}`,
  `- Pass: ${counts.pass}`,
  `- Fail: ${counts.fail}`,
  `- Blocked: ${counts.blocked}`,
  "",
  "## By Agent",
  "",
  "| Agent | Total | Pass | Fail | Blocked |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...Object.keys(byAgent).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))).map((agent) => {
    const entry = byAgent[agent];
    return `| ${agent} | ${entry.total} | ${entry.pass} | ${entry.fail} | ${entry.blocked} |`;
  }),
  "",
  "## Cases",
  "",
  "| ID | Status | Message |",
  "| --- | --- | --- |",
  ...results.map((result) => `| ${result.id} | ${result.status} | ${result.message.replace(/\|/g, "\\|")} |`),
  "",
];
writeFileSync(join(outDir, "spec-harness-results.md"), `${lines.join("\n")}\n`);

console.log(JSON.stringify({
  counts,
  byAgent,
  outputJson: join(outDir, "spec-harness-results.json"),
  outputMd: join(outDir, "spec-harness-results.md"),
}, null, 2));
