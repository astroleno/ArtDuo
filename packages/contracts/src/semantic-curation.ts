import { GROWTH_STAGE_ROLES, TRANSITION_INTENTS, type AffectState, type GrowthStageRole, type TransitionIntent } from "./affective-agent";
import { expectObject, parseArray, readBoolean, readLiteral, readNumber, readString, readStringArray } from "./internal/validation";

export const CURATION_RECIPE_VERSION = "curator-v1" as const;
export interface CurationIntentStage extends AffectState {
  label: string;
  role: GrowthStageRole;
  query: string;
  signals: string[];
  transitionIntent: TransitionIntent;
}
export interface CurationIntentPlan {
  schemaVersion: 1;
  currentFeeling: string;
  desiredExperience: string;
  wantsRelief: boolean;
  pace: "still" | "slow" | "medium" | "active";
  artworkCount: number;
  stages: CurationIntentStage[];
}

function boundedText(value: Record<string, unknown>, key: string, path: string, maximum: number): string {
  const result = readString(value, key, path).trim();
  if (Array.from(result).length > maximum) throw new TypeError(`${path}.${key}: text too long`);
  return result;
}
function finiteNumber(value: Record<string, unknown>, key: string, path: string, minimum: number, maximum: number): number {
  const result = readNumber(value, key, path);
  if (!Number.isFinite(result) || result < minimum || result > maximum) throw new TypeError(`${path}.${key}: number out of bounds`);
  return result;
}
export function parseCurationIntentPlan(value: unknown, path = "CurationIntentPlan"): CurationIntentPlan {
  const raw = expectObject(value, path);
  if (raw.schemaVersion !== 1) throw new TypeError(`${path}.schemaVersion: expected 1`);
  const artworkCount = finiteNumber(raw, "artworkCount", path, 1, 12);
  if (!Number.isInteger(artworkCount)) throw new TypeError(`${path}.artworkCount: expected integer`);
  const stages = parseArray(raw.stages, (entry, stagePath): CurationIntentStage => {
    const stage = expectObject(entry, stagePath);
    const signals = readStringArray(stage, "signals", stagePath);
    if (signals.length < 1 || signals.length > 8 || signals.some((signal) => signal.length > 40)) throw new TypeError(`${stagePath}.signals: invalid size`);
    return {
      label: boundedText(stage, "label", stagePath, 24),
      role: readLiteral(stage, "role", GROWTH_STAGE_ROLES, stagePath),
      query: boundedText(stage, "query", stagePath, 240),
      signals: [...new Set(signals.map((signal) => signal.trim().toLowerCase()))],
      transitionIntent: readLiteral(stage, "transitionIntent", TRANSITION_INTENTS, stagePath),
      valence: finiteNumber(stage, "valence", stagePath, 0, 1),
      arousal: finiteNumber(stage, "arousal", stagePath, 0, 1),
      tension: finiteNumber(stage, "tension", stagePath, 0, 1),
      wonder: finiteNumber(stage, "wonder", stagePath, 0, 1),
      intimacy: finiteNumber(stage, "intimacy", stagePath, 0, 1),
    };
  }, `${path}.stages`);
  const roles = stages.map((stage) => stage.role);
  if (stages.length < 3 || stages.length > 5 || roles[0] !== "threshold" || roles.at(-1) !== "afterglow"
    || new Set(roles).size !== roles.length || roles.some((role, index) => index > 0 && GROWTH_STAGE_ROLES.indexOf(role) <= GROWTH_STAGE_ROLES.indexOf(roles[index - 1]))) {
    throw new TypeError(`${path}.stages: expected 3–5 ordered, unique stages from threshold to afterglow`);
  }
  return {
    schemaVersion: 1,
    currentFeeling: boundedText(raw, "currentFeeling", path, 100),
    desiredExperience: boundedText(raw, "desiredExperience", path, 160),
    wantsRelief: readBoolean(raw, "wantsRelief", path),
    pace: readLiteral(raw, "pace", ["still", "slow", "medium", "active"] as const, path),
    artworkCount,
    stages,
  };
}

export interface SemanticModelIdentity {
  id: string;
  revision: string;
  dimensions: number;
  quantized: boolean;
  pooling: "mean";
  normalization: "l2";
  queryPrefix: string;
  documentPrefix: string;
  textVersion: string;
}
export interface SemanticIndex {
  schemaVersion: 1;
  releaseVersion: string;
  sourceFingerprint: string;
  model: SemanticModelIdentity;
  records: Array<{ artworkId: string; textFingerprint: string; vector: number[] }>;
}
export function parseSemanticModelIdentity(value: unknown, path = "SemanticModelIdentity"): SemanticModelIdentity {
  const raw = expectObject(value, path);
  const dimensions = finiteNumber(raw, "dimensions", path, 1, 8192);
  if (!Number.isInteger(dimensions)) throw new TypeError(`${path}.dimensions: expected integer`);
  return {
    id: readString(raw, "id", path), revision: readString(raw, "revision", path), dimensions,
    quantized: readBoolean(raw, "quantized", path),
    pooling: readLiteral(raw, "pooling", ["mean"] as const, path),
    normalization: readLiteral(raw, "normalization", ["l2"] as const, path),
    queryPrefix: readString(raw, "queryPrefix", path), documentPrefix: readString(raw, "documentPrefix", path),
    textVersion: readString(raw, "textVersion", path),
  };
}
export function parseSemanticIndex(value: unknown, path = "SemanticIndex"): SemanticIndex {
  const raw = expectObject(value, path);
  if (raw.schemaVersion !== 1) throw new TypeError(`${path}.schemaVersion: expected 1`);
  const model = parseSemanticModelIdentity(raw.model, `${path}.model`);
  const ids = new Set<string>();
  const records = parseArray(raw.records, (value, itemPath) => {
    const item = expectObject(value, itemPath);
    const artworkId = readString(item, "artworkId", itemPath);
    if (ids.has(artworkId)) throw new TypeError(`${itemPath}: duplicate artworkId`);
    ids.add(artworkId);
    const vector = parseArray(item.vector, (entry, numberPath) => {
      if (typeof entry !== "number" || !Number.isFinite(entry)) throw new TypeError(`${numberPath}: expected finite number`);
      return entry;
    }, `${itemPath}.vector`);
    const norm = Math.sqrt(vector.reduce((sum, number) => sum + number * number, 0));
    if (vector.length !== model.dimensions || Math.abs(norm - 1) > 0.005) throw new TypeError(`${itemPath}.vector: expected normalized vector in the declared space`);
    return { artworkId, textFingerprint: readString(item, "textFingerprint", itemPath), vector };
  }, `${path}.records`);
  return { schemaVersion: 1, releaseVersion: readString(raw, "releaseVersion", path), sourceFingerprint: readString(raw, "sourceFingerprint", path), model, records };
}

export interface CurationNarrativePiece {
  kind: "preface" | "note" | "closing";
  artworkId?: string;
  text: string;
  evidenceIds: string[];
}
export function parseCurationNarrativePiece(value: unknown, path = "CurationNarrativePiece"): CurationNarrativePiece {
  const raw = expectObject(value, path);
  const kind = readLiteral(raw, "kind", ["preface", "note", "closing"] as const, path);
  const text = boundedText(raw, "text", path, kind === "note" ? 70 : 220);
  if (/[<>]|https?:\/\//iu.test(text)) throw new TypeError(`${path}.text: expected plain narrative text`);
  const evidenceIds = readStringArray(raw, "evidenceIds", path);
  if (evidenceIds.length > 12) throw new TypeError(`${path}.evidenceIds: too many references`);
  const artworkId = kind === "note" ? readString(raw, "artworkId", path) : undefined;
  return { kind, artworkId, text, evidenceIds };
}
