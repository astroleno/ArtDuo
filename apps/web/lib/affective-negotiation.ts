import {
  buildUserAffectAgent,
  findAffectResistanceConflict,
  hardResistanceSignals,
  normalizeAffectSignal,
} from "@artduo/corpus";
import type {
  AffectSignal,
  AffectState,
  AestheticRule,
  GrowthForm,
  GrowthStage,
  GrowthStageRole,
  NegotiationTrace,
  TransitionIntent,
  UserAffectAgent,
} from "@artduo/contracts";
import { parseGrowthForm } from "@artduo/contracts";

import type { WebBackgroundScene, WebSearchResult } from "./release-catalog";

const ROLE_SEQUENCE: GrowthStageRole[] = ["threshold", "mirror", "turn", "release", "afterglow"];
const TRANSITION_SEQUENCE: TransitionIntent[] = ["fade", "drift", "push", "hold", "return"];

const SIGNAL_STATE: Record<string, AffectState> = {
  awe: { valence: 0.62, arousal: 0.62, tension: 0.32, wonder: 0.88, intimacy: 0.38 },
  bright: { valence: 0.78, arousal: 0.68, tension: 0.2, wonder: 0.46, intimacy: 0.24 },
  calm: { valence: 0.56, arousal: 0.18, tension: 0.12, wonder: 0.26, intimacy: 0.52 },
  contemplation: { valence: 0.48, arousal: 0.24, tension: 0.22, wonder: 0.42, intimacy: 0.5 },
  desire: { valence: 0.56, arousal: 0.58, tension: 0.42, wonder: 0.48, intimacy: 0.82 },
  held: { valence: 0.55, arousal: 0.2, tension: 0.12, wonder: 0.28, intimacy: 0.84 },
  hope: { valence: 0.72, arousal: 0.38, tension: 0.16, wonder: 0.58, intimacy: 0.48 },
  intimate: { valence: 0.52, arousal: 0.28, tension: 0.22, wonder: 0.34, intimacy: 0.86 },
  joy: { valence: 0.86, arousal: 0.66, tension: 0.08, wonder: 0.46, intimacy: 0.36 },
  "low-light": { valence: 0.4, arousal: 0.18, tension: 0.3, wonder: 0.46, intimacy: 0.7 },
  melancholy: { valence: 0.32, arousal: 0.28, tension: 0.48, wonder: 0.28, intimacy: 0.58 },
  mystery: { valence: 0.44, arousal: 0.48, tension: 0.48, wonder: 0.7, intimacy: 0.44 },
  quiet: { valence: 0.52, arousal: 0.18, tension: 0.12, wonder: 0.28, intimacy: 0.62 },
  restful: { valence: 0.55, arousal: 0.16, tension: 0.1, wonder: 0.2, intimacy: 0.62 },
  serenity: { valence: 0.58, arousal: 0.18, tension: 0.1, wonder: 0.28, intimacy: 0.54 },
  wonder: { valence: 0.68, arousal: 0.66, tension: 0.28, wonder: 0.9, intimacy: 0.36 },
};

const DEFAULT_STATE: AffectState = {
  valence: 0.5,
  arousal: 0.34,
  tension: 0.24,
  wonder: 0.36,
  intimacy: 0.5,
};

type Candidate = WebSearchResult["results"][number];

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalize(value: string | undefined): string {
  return normalizeAffectSignal(value ?? "");
}

function hash(value: string): string {
  let hashValue = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hashValue ^= value.charCodeAt(index);
    hashValue = Math.imul(hashValue, 16777619);
  }

  return (hashValue >>> 0).toString(36);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function candidateSignals(candidate: Candidate): string[] {
  const artwork = candidate.artwork;

  return unique([
    ...artwork.moodTags,
    ...artwork.emotionLabels,
    ...artwork.keywordBoosts,
    ...artwork.colorTags,
    ...artwork.subjectTags,
    ...artwork.compositionTags,
    ...artwork.sceneAffinity.paletteModes,
    ...artwork.sceneAffinity.sceneTypes,
    ...artwork.sceneAffinity.spatialModes,
    artwork.motionProfile,
  ].map(normalize).filter(Boolean));
}

function conflictsWithHardRule(candidate: Candidate, hardSignals: string[]): string | undefined {
  return findAffectResistanceConflict(hardSignals, candidateSignals(candidate));
}

function buildRules(agent: UserAffectAgent): AestheticRule[] {
  const hard = hardResistanceSignals(agent);
  const soft = unique([
    ...agent.desires.map((entry) => entry.value),
    ...agent.visualConstraints.filter((entry) => entry.polarity === "prefer").map((entry) => entry.value),
  ]).filter((value) => !hard.includes(value));

  return [
    ...hard.map((value) => ({
      id: `rule-hard-${normalize(value)}`,
      signal: normalize(value),
      severity: "hard" as const,
      action: "reject" as const,
      reason: `User explicitly resisted ${value}.`,
    })),
    ...soft.slice(0, 8).map((value) => ({
      id: `rule-soft-${normalize(value)}`,
      signal: normalize(value),
      severity: "soft" as const,
      action: "prefer" as const,
      reason: `User asked for or implied ${value}.`,
    })),
    {
      id: "rule-diagnostic-trace",
      signal: "trace",
      severity: "diagnostic",
      action: "diagnose",
      reason: "Keep affective negotiation inspectable.",
    } satisfies AestheticRule,
  ];
}

function averageState(signals: AffectSignal[]): AffectState {
  const states = signals.map((entry) => SIGNAL_STATE[normalize(entry.value)] ?? DEFAULT_STATE);
  if (states.length === 0) {
    return DEFAULT_STATE;
  }

  return {
    valence: clamp01(states.reduce((sum, entry) => sum + entry.valence, 0) / states.length),
    arousal: clamp01(states.reduce((sum, entry) => sum + entry.arousal, 0) / states.length),
    tension: clamp01(states.reduce((sum, entry) => sum + entry.tension, 0) / states.length),
    wonder: clamp01(states.reduce((sum, entry) => sum + entry.wonder, 0) / states.length),
    intimacy: clamp01(states.reduce((sum, entry) => sum + entry.intimacy, 0) / states.length),
  };
}

function intensityFromState(state: AffectState): number {
  return clamp01(0.2 + state.arousal * 0.28 + state.tension * 0.2 + state.wonder * 0.2 + state.intimacy * 0.12);
}

function scoreCandidateForStage(candidate: Candidate, signals: AffectSignal[]): number {
  const candidateSignalSet = new Set(candidateSignals(candidate));
  const stageSignals = signals.map((entry) => normalize(entry.value));
  const overlap = stageSignals.reduce((score, value) => score + (candidateSignalSet.has(value) ? 1 : 0), 0);
  const visualOverlap = candidate.artwork.colorTags.some((tag) => stageSignals.includes(normalize(tag))) ? 0.5 : 0;

  return overlap * 2 + visualOverlap + Math.max(0, 1 - candidate.rank / 100);
}

function assignArtworkIds(stages: Array<{ signals: AffectSignal[] }>, candidates: Candidate[]): string[][] {
  if (candidates.length === 0) {
    return stages.map(() => []);
  }

  const assigned = new Set<string>();

  return stages.map((stage, index) => {
    const ranked = candidates
      .filter((candidate) => !assigned.has(candidate.artwork.id))
      .map((candidate) => ({ candidate, score: scoreCandidateForStage(candidate, stage.signals) }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.candidate.rank - right.candidate.rank;
      });
    const selected = ranked[0]?.candidate ?? candidates[index % candidates.length];
    assigned.add(selected.artwork.id);

    return [selected.artwork.id];
  });
}

function stageRole(index: number, total: number): GrowthStageRole {
  if (total === 3) {
    return (["threshold", "turn", "afterglow"] as const)[index] ?? "afterglow";
  }

  return ROLE_SEQUENCE[Math.min(index, ROLE_SEQUENCE.length - 1)] ?? "afterglow";
}

function stageLabel(index: number, total: number): string {
  if (total === 3) {
    return (["Opening", "Turn", "Return"] as const)[index] ?? `Stage ${index + 1}`;
  }

  return `Stage ${index + 1}`;
}

function sceneIntent(signals: AffectSignal[], backgroundScenes: WebBackgroundScene[]): string {
  const values = signals.map((entry) => normalize(entry.value));
  const matchedScene = backgroundScenes.find((scene) => {
    const sceneValues = [
      scene.sceneType,
      ...scene.moods,
      ...scene.palette,
      ...scene.emotionIds,
      ...scene.artworkPaletteModes,
    ].map(normalize);

    return values.some((value) => sceneValues.includes(value));
  });

  if (matchedScene) {
    return `use ${matchedScene.label} for ${values.join(", ") || "affective"} support`;
  }

  return `shape space around ${values.join(", ") || "quiet attention"}`;
}

function buildStages(
  agent: UserAffectAgent,
  candidates: Candidate[],
  backgroundScenes: WebBackgroundScene[],
): GrowthStage[] {
  const hints = agent.temporalShape.stages.slice(0, 5);
  const stageCount = Math.max(3, Math.min(5, hints.length));
  const normalizedHints = hints.length >= 3
    ? hints.slice(0, stageCount)
    : agent.temporalShape.stages.concat(agent.temporalShape.stages).slice(0, stageCount);
  const artworkIdsByStage = assignArtworkIds(normalizedHints, candidates);

  return normalizedHints.map((hint, index) => {
    const state = averageState(hint.signals);
    const total = normalizedHints.length;

    return {
      id: `stage-${index + 1}`,
      label: hint.label && !/^(先|再|最后|from|then|finally)$/iu.test(hint.label)
        ? hint.label
        : stageLabel(index, total),
      role: stageRole(index, total),
      signals: hint.signals.length > 0 ? hint.signals : [agent.desires[index] ?? agent.desires[0]].filter(Boolean),
      valence: state.valence,
      arousal: state.arousal,
      tension: state.tension,
      wonder: state.wonder,
      intimacy: state.intimacy,
      intensity: intensityFromState(state),
      sceneIntent: sceneIntent(hint.signals, backgroundScenes),
      transitionIntent: index === 0
        ? "fade"
        : index === total - 1
          ? "return"
          : TRANSITION_SEQUENCE[Math.min(index, TRANSITION_SEQUENCE.length - 2)] ?? "drift",
      artworkIds: artworkIdsByStage[index] ?? [],
    };
  });
}

export function buildAffectiveGrowthForm(input: {
  query: string;
  results: WebSearchResult["results"];
  backgroundScenes: WebBackgroundScene[];
}): GrowthForm {
  const userAgent = buildUserAffectAgent(input.query);
  const rules = buildRules(userAgent);
  const hardSignals = rules.filter((rule) => rule.severity === "hard").map((rule) => rule.signal);
  const trace: NegotiationTrace[] = [{
    id: "trace-user-agent",
    step: "user-agent",
    message: `Parsed ${userAgent.desires.length} desires and ${userAgent.resistances.length} hard resistances.`,
  }];
  const rejectedArtworkIds: string[] = [];
  const accepted: Candidate[] = [];

  for (const candidate of input.results) {
    const conflict = conflictsWithHardRule(candidate, hardSignals);
    if (conflict) {
      rejectedArtworkIds.push(candidate.artwork.id);
      trace.push({
        id: `trace-reject-${candidate.artwork.id}`,
        step: "reject",
        artworkId: candidate.artwork.id,
        signal: conflict,
        message: `Rejected ${candidate.artwork.title} because it matched hard resistance ${conflict}.`,
      });
    } else {
      accepted.push(candidate);
      trace.push({
        id: `trace-capsule-${candidate.artwork.id}`,
        step: "capsule",
        artworkId: candidate.artwork.id,
        score: clamp01(candidate.combinedScore),
        message: `Accepted ${candidate.artwork.title} for affective role assignment.`,
      });
    }
  }

  const stageCandidates = accepted;
  const stages = buildStages(userAgent, stageCandidates, input.backgroundScenes);
  for (const stage of stages) {
    trace.push({
      id: `trace-stage-${stage.id}`,
      step: "stage",
      stageId: stage.id,
      signal: stage.signals[0]?.value,
      message: `Built ${stage.role} stage with ${stage.artworkIds.length} artwork(s).`,
    });
  }

  const supportingArtworkIds = unique(stages.flatMap((stage) => stage.artworkIds));
  const form: GrowthForm = {
    id: `growth-${hash(`${input.query}:${supportingArtworkIds.join(",")}:${rejectedArtworkIds.join(",")}`)}`,
    sourceText: input.query,
    stages,
    rules,
    supportingArtworkIds,
    rejectedArtworkIds: unique(rejectedArtworkIds),
    trace,
  };

  return parseGrowthForm(form);
}
