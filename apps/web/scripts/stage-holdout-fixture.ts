import { createHash } from "node:crypto";
import { parseCurationIntentPlan } from "@artduo/contracts";
import type { Clause } from "./stage-holdout-design";
import type { HoldoutLabel } from "./stage-holdout-metrics";

export const HOLDOUT_FIXTURE = "stage-holdout-739-v1.json";
export const HOLDOUT_SHA256 = "ccd43dc2bc320ecefa8f18b84bff5bf0bf7edc9c74b98a9c3d5fae7a7ea77ac8";
export const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
type Sample = { artworkId: string; imageSha256: string; stageIndexes: number[]; label: HoldoutLabel; reason: string };
type HoldoutFile = {
  schemaVersion: number; releaseVersion: string; seed: string; releaseManifestSha256: string; visualLedgerSha256: string; visualEvidenceVersion: string;
  tunedPlansSha256: string; maximumOldQueryBigramJaccard: number; method: Record<string, string>;
  cases: Array<{ id: string; stratum: string; query: string; criteria: Clause[]; plan: unknown; samples: Sample[] }>;
};
const labels = new Set<HoldoutLabel>(["positive", "negative", "unknown"]);
const fingerprint = /^[a-f0-9]{64}$/u;
const strata = new Set(["subject", "medium-exclusion", "visual-detail", "arousal", "mixed", "boundary"]);

export function readHoldoutFixture(bytes: Uint8Array) {
  const sha256 = hash(bytes);
  if (sha256 !== HOLDOUT_SHA256) throw new Error("The holdout differs from its preregistered fingerprint");
  const { cases, ...provenance } = JSON.parse(Buffer.from(bytes).toString()) as HoldoutFile;
  if (provenance.schemaVersion !== 1 || !provenance.releaseVersion || !provenance.seed || !provenance.visualEvidenceVersion
    || ![provenance.releaseManifestSha256, provenance.visualLedgerSha256, provenance.tunedPlansSha256].every(value => fingerprint.test(value))
    || !Number.isFinite(provenance.maximumOldQueryBigramJaccard) || provenance.maximumOldQueryBigramJaccard >= .5 || cases.length !== 30
    || new Set(cases.map(item => item.id)).size !== cases.length || new Set(cases.map(item => item.query.normalize("NFKC"))).size !== cases.length) {
    throw new Error("Invalid preregistered holdout fixture");
  }
  const items = cases.map(item => {
    const plan = parseCurationIntentPlan(item.plan);
    if (!strata.has(item.stratum) || !item.id.startsWith(item.stratum.replace("medium-exclusion", "media").replace("visual-detail", "detail").replace("boundary", "edge"))
      || !item.query.trim() || plan.desiredExperience !== item.query || item.samples.length !== 8
      || new Set(item.samples.map(sample => sample.artworkId)).size !== item.samples.length) throw new Error(`Invalid holdout case ${item.id}`);
    for (const sample of item.samples) {
      if (!sample.artworkId || !sample.reason.trim() || !labels.has(sample.label) || !/^sha256:[a-f0-9]{64}$/u.test(sample.imageSha256)
        || sample.stageIndexes.length !== plan.stages.length || sample.stageIndexes.some((value, index) => value !== index)) {
        throw new Error(`Invalid reference in holdout case ${item.id}`);
      }
    }
    return { ...item, plan };
  });
  return { sha256, provenance, cases: items };
}
