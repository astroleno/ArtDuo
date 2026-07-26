import {
  JsonObject,
  expectObject,
  parseArray,
  readLiteral,
  readNumber,
  readObject,
  readOptionalNumber,
  readOptionalObject,
  readOptionalString,
  readOptionalStringArray,
  readString,
  readStringArray,
} from "./internal/validation";

export const AFFECT_SIGNAL_KINDS = ["emotion", "resistance", "memory", "visual", "spatial", "tempo"] as const;
export const GROWTH_STAGE_ROLES = ["threshold", "mirror", "turn", "release", "afterglow"] as const;
export const AESTHETIC_RULE_SEVERITIES = ["hard", "soft", "diagnostic"] as const;
export const TRANSITION_INTENTS = ["fade", "drift", "push", "hold", "return"] as const;

export type AffectSignalKind = (typeof AFFECT_SIGNAL_KINDS)[number];
export type GrowthStageRole = (typeof GROWTH_STAGE_ROLES)[number];
export type AestheticRuleSeverity = (typeof AESTHETIC_RULE_SEVERITIES)[number];
export type TransitionIntent = (typeof TRANSITION_INTENTS)[number];

export interface AffectState {
  valence: number;
  arousal: number;
  tension: number;
  wonder: number;
  intimacy: number;
}

export interface AffectSignal {
  kind: AffectSignalKind;
  value: string;
  weight?: number;
  confidence?: number;
  evidenceIds?: string[];
}

export interface MemoryHint {
  value: string;
  sourceText?: string;
  confidence?: number;
}

export interface AestheticConstraint {
  value: string;
  polarity: "prefer" | "avoid";
  severity: AestheticRuleSeverity;
  confidence?: number;
}

export interface SpatialNeed {
  value: string;
  confidence?: number;
}

export interface TemporalStageHint {
  label: string;
  signals: AffectSignal[];
}

export interface TemporalShape {
  arc: string;
  pace: "still" | "slow" | "medium" | "active";
  stages: TemporalStageHint[];
  peakCount: number;
}

export interface UserAffectAgent {
  sourceText: string;
  languageHints: string[];
  desires: AffectSignal[];
  resistances: AffectSignal[];
  memoryHints: MemoryHint[];
  visualConstraints: AestheticConstraint[];
  spatialNeeds: SpatialNeed[];
  temporalShape: TemporalShape;
  currentState: AffectState;
  desiredState?: AffectState;
  confidence: number;
}

export interface CapsuleEvidence {
  id: string;
  sourceRef: string;
  fieldPath: string;
  value?: string;
  confidence?: number;
}

export interface AestheticSignal {
  value: string;
  kind: "color" | "composition" | "palette" | "texture" | "light";
  evidenceIds: string[];
  confidence?: number;
}

export interface SceneSignal {
  value: string;
  kind: "scene" | "spatial" | "palette" | "transition";
  evidenceIds: string[];
  confidence?: number;
}

export interface MotionSignal {
  value: string;
  kind: "motion" | "pace" | "gesture";
  evidenceIds: string[];
  confidence?: number;
}

export interface ArtworkAgentCapsule {
  artworkId: string;
  identity: {
    title: string;
    artistDisplayName?: string;
    yearLabel?: string;
  };
  canOffer: AffectSignal[];
  boundaries: AffectSignal[];
  aesthetics: AestheticSignal[];
  sceneAffinity: SceneSignal[];
  motionAffinity: MotionSignal[];
  evidence: CapsuleEvidence[];
  confidence: number;
}

export interface AestheticRule {
  id: string;
  signal: string;
  severity: AestheticRuleSeverity;
  action: "prefer" | "avoid" | "reject" | "diagnose";
  reason: string;
}

export interface NegotiationTrace {
  id: string;
  step: "user-agent" | "capsule" | "rule" | "reject" | "assign" | "stage";
  message: string;
  artworkId?: string;
  stageId?: string;
  signal?: string;
  score?: number;
}

export interface GrowthStage {
  id: string;
  label: string;
  role: GrowthStageRole;
  signals: AffectSignal[];
  valence: number;
  arousal: number;
  tension: number;
  wonder: number;
  intimacy: number;
  intensity: number;
  sceneIntent: string;
  transitionIntent: TransitionIntent;
  artworkIds: string[];
}

export interface GrowthForm {
  id: string;
  sourceText: string;
  stages: GrowthStage[];
  rules: AestheticRule[];
  supportingArtworkIds: string[];
  rejectedArtworkIds: string[];
  trace: NegotiationTrace[];
}

function readNormalizedNumber(source: JsonObject, key: string, path: string): number {
  const value = readNumber(source, key, path);
  if (value < 0 || value > 1) {
    throw new TypeError(`${path}.${key}: expected number between 0 and 1`);
  }

  return value;
}

function readOptionalNormalizedNumber(source: JsonObject, key: string, path: string): number | undefined {
  const value = readOptionalNumber(source, key, path);
  if (value === undefined) {
    return undefined;
  }
  if (value < 0 || value > 1) {
    throw new TypeError(`${path}.${key}: expected number between 0 and 1`);
  }

  return value;
}

function parseAffectState(value: unknown, path: string): AffectState {
  const state = expectObject(value, path);

  return {
    valence: readNormalizedNumber(state, "valence", path),
    arousal: readNormalizedNumber(state, "arousal", path),
    tension: readNormalizedNumber(state, "tension", path),
    wonder: readNormalizedNumber(state, "wonder", path),
    intimacy: readNormalizedNumber(state, "intimacy", path),
  };
}

function parseAffectSignal(value: unknown, path: string): AffectSignal {
  const signal = expectObject(value, path);

  return {
    kind: readLiteral(signal, "kind", AFFECT_SIGNAL_KINDS, path),
    value: readString(signal, "value", path),
    weight: readOptionalNormalizedNumber(signal, "weight", path),
    confidence: readOptionalNormalizedNumber(signal, "confidence", path),
    evidenceIds: readOptionalStringArray(signal, "evidenceIds", path),
  };
}

function parseMemoryHint(value: unknown, path: string): MemoryHint {
  const hint = expectObject(value, path);

  return {
    value: readString(hint, "value", path),
    sourceText: readOptionalString(hint, "sourceText", path),
    confidence: readOptionalNormalizedNumber(hint, "confidence", path),
  };
}

function parseAestheticConstraint(value: unknown, path: string): AestheticConstraint {
  const constraint = expectObject(value, path);

  return {
    value: readString(constraint, "value", path),
    polarity: readLiteral(constraint, "polarity", ["prefer", "avoid"] as const, path),
    severity: readLiteral(constraint, "severity", AESTHETIC_RULE_SEVERITIES, path),
    confidence: readOptionalNormalizedNumber(constraint, "confidence", path),
  };
}

function parseSpatialNeed(value: unknown, path: string): SpatialNeed {
  const need = expectObject(value, path);

  return {
    value: readString(need, "value", path),
    confidence: readOptionalNormalizedNumber(need, "confidence", path),
  };
}

function parseTemporalStageHint(value: unknown, path: string): TemporalStageHint {
  const stage = expectObject(value, path);

  return {
    label: readString(stage, "label", path),
    signals: parseArray(stage.signals, (entry, entryPath) => parseAffectSignal(entry, entryPath), `${path}.signals`),
  };
}

function parseTemporalShape(value: unknown, path: string): TemporalShape {
  const shape = expectObject(value, path);

  return {
    arc: readString(shape, "arc", path),
    pace: readLiteral(shape, "pace", ["still", "slow", "medium", "active"] as const, path),
    stages: parseArray(
      shape.stages,
      (entry, entryPath) => parseTemporalStageHint(entry, entryPath),
      `${path}.stages`,
    ),
    peakCount: readNumber(shape, "peakCount", path),
  };
}

function parseCapsuleEvidence(value: unknown, path: string): CapsuleEvidence {
  const evidence = expectObject(value, path);

  return {
    id: readString(evidence, "id", path),
    sourceRef: readString(evidence, "sourceRef", path),
    fieldPath: readString(evidence, "fieldPath", path),
    value: readOptionalString(evidence, "value", path),
    confidence: readOptionalNormalizedNumber(evidence, "confidence", path),
  };
}

function parseAestheticSignal(value: unknown, path: string): AestheticSignal {
  const signal = expectObject(value, path);

  return {
    value: readString(signal, "value", path),
    kind: readLiteral(signal, "kind", ["color", "composition", "palette", "texture", "light"] as const, path),
    evidenceIds: readStringArray(signal, "evidenceIds", path),
    confidence: readOptionalNormalizedNumber(signal, "confidence", path),
  };
}

function parseSceneSignal(value: unknown, path: string): SceneSignal {
  const signal = expectObject(value, path);

  return {
    value: readString(signal, "value", path),
    kind: readLiteral(signal, "kind", ["scene", "spatial", "palette", "transition"] as const, path),
    evidenceIds: readStringArray(signal, "evidenceIds", path),
    confidence: readOptionalNormalizedNumber(signal, "confidence", path),
  };
}

function parseMotionSignal(value: unknown, path: string): MotionSignal {
  const signal = expectObject(value, path);

  return {
    value: readString(signal, "value", path),
    kind: readLiteral(signal, "kind", ["motion", "pace", "gesture"] as const, path),
    evidenceIds: readStringArray(signal, "evidenceIds", path),
    confidence: readOptionalNormalizedNumber(signal, "confidence", path),
  };
}

function parseAestheticRule(value: unknown, path: string): AestheticRule {
  const rule = expectObject(value, path);

  return {
    id: readString(rule, "id", path),
    signal: readString(rule, "signal", path),
    severity: readLiteral(rule, "severity", AESTHETIC_RULE_SEVERITIES, path),
    action: readLiteral(rule, "action", ["prefer", "avoid", "reject", "diagnose"] as const, path),
    reason: readString(rule, "reason", path),
  };
}

function parseNegotiationTrace(value: unknown, path: string): NegotiationTrace {
  const trace = expectObject(value, path);

  return {
    id: readString(trace, "id", path),
    step: readLiteral(trace, "step", ["user-agent", "capsule", "rule", "reject", "assign", "stage"] as const, path),
    message: readString(trace, "message", path),
    artworkId: readOptionalString(trace, "artworkId", path),
    stageId: readOptionalString(trace, "stageId", path),
    signal: readOptionalString(trace, "signal", path),
    score: readOptionalNormalizedNumber(trace, "score", path),
  };
}

function parseGrowthStage(value: unknown, path: string): GrowthStage {
  const stage = expectObject(value, path);

  return {
    id: readString(stage, "id", path),
    label: readString(stage, "label", path),
    role: readLiteral(stage, "role", GROWTH_STAGE_ROLES, path),
    signals: parseArray(stage.signals, (entry, entryPath) => parseAffectSignal(entry, entryPath), `${path}.signals`),
    valence: readNormalizedNumber(stage, "valence", path),
    arousal: readNormalizedNumber(stage, "arousal", path),
    tension: readNormalizedNumber(stage, "tension", path),
    wonder: readNormalizedNumber(stage, "wonder", path),
    intimacy: readNormalizedNumber(stage, "intimacy", path),
    intensity: readNormalizedNumber(stage, "intensity", path),
    sceneIntent: readString(stage, "sceneIntent", path),
    transitionIntent: readLiteral(stage, "transitionIntent", TRANSITION_INTENTS, path),
    artworkIds: readStringArray(stage, "artworkIds", path),
  };
}

export function parseUserAffectAgent(value: unknown, path = "UserAffectAgent"): UserAffectAgent {
  const agent = expectObject(value, path);
  const desiredState = readOptionalObject(agent, "desiredState", path);

  return {
    sourceText: readString(agent, "sourceText", path),
    languageHints: readStringArray(agent, "languageHints", path),
    desires: parseArray(agent.desires, (entry, entryPath) => parseAffectSignal(entry, entryPath), `${path}.desires`),
    resistances: parseArray(
      agent.resistances,
      (entry, entryPath) => parseAffectSignal(entry, entryPath),
      `${path}.resistances`,
    ),
    memoryHints: parseArray(
      agent.memoryHints,
      (entry, entryPath) => parseMemoryHint(entry, entryPath),
      `${path}.memoryHints`,
    ),
    visualConstraints: parseArray(
      agent.visualConstraints,
      (entry, entryPath) => parseAestheticConstraint(entry, entryPath),
      `${path}.visualConstraints`,
    ),
    spatialNeeds: parseArray(
      agent.spatialNeeds,
      (entry, entryPath) => parseSpatialNeed(entry, entryPath),
      `${path}.spatialNeeds`,
    ),
    temporalShape: parseTemporalShape(readObject(agent, "temporalShape", path), `${path}.temporalShape`),
    currentState: parseAffectState(readObject(agent, "currentState", path), `${path}.currentState`),
    desiredState: desiredState ? parseAffectState(desiredState, `${path}.desiredState`) : undefined,
    confidence: readNormalizedNumber(agent, "confidence", path),
  };
}

export function parseArtworkAgentCapsule(value: unknown, path = "ArtworkAgentCapsule"): ArtworkAgentCapsule {
  const capsule = expectObject(value, path);
  const identity = readObject(capsule, "identity", path);
  const evidence = parseArray(
    capsule.evidence,
    (entry, entryPath) => parseCapsuleEvidence(entry, entryPath),
    `${path}.evidence`,
  );

  if (evidence.length === 0) {
    throw new TypeError(`${path}.evidence: expected at least one source ref`);
  }

  return {
    artworkId: readString(capsule, "artworkId", path),
    identity: {
      title: readString(identity, "title", `${path}.identity`),
      artistDisplayName: readOptionalString(identity, "artistDisplayName", `${path}.identity`),
      yearLabel: readOptionalString(identity, "yearLabel", `${path}.identity`),
    },
    canOffer: parseArray(capsule.canOffer, (entry, entryPath) => parseAffectSignal(entry, entryPath), `${path}.canOffer`),
    boundaries: parseArray(
      capsule.boundaries,
      (entry, entryPath) => parseAffectSignal(entry, entryPath),
      `${path}.boundaries`,
    ),
    aesthetics: parseArray(
      capsule.aesthetics,
      (entry, entryPath) => parseAestheticSignal(entry, entryPath),
      `${path}.aesthetics`,
    ),
    sceneAffinity: parseArray(
      capsule.sceneAffinity,
      (entry, entryPath) => parseSceneSignal(entry, entryPath),
      `${path}.sceneAffinity`,
    ),
    motionAffinity: parseArray(
      capsule.motionAffinity,
      (entry, entryPath) => parseMotionSignal(entry, entryPath),
      `${path}.motionAffinity`,
    ),
    evidence,
    confidence: readNormalizedNumber(capsule, "confidence", path),
  };
}

export function parseGrowthForm(value: unknown, path = "GrowthForm"): GrowthForm {
  const form = expectObject(value, path);
  const stages = parseArray(form.stages, (entry, entryPath) => parseGrowthStage(entry, entryPath), `${path}.stages`);

  if (stages.length < 3 || stages.length > 5) {
    throw new TypeError(`${path}.stages: expected 3 to 5 stages`);
  }

  return {
    id: readString(form, "id", path),
    sourceText: readString(form, "sourceText", path),
    stages,
    rules: parseArray(form.rules, (entry, entryPath) => parseAestheticRule(entry, entryPath), `${path}.rules`),
    supportingArtworkIds: readStringArray(form, "supportingArtworkIds", path),
    rejectedArtworkIds: readStringArray(form, "rejectedArtworkIds", path),
    trace: parseArray(form.trace, (entry, entryPath) => parseNegotiationTrace(entry, entryPath), `${path}.trace`),
  };
}
