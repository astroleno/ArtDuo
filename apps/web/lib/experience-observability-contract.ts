export const CLIENT_EXPERIENCE_PHASES = ["submit-to-preface-actionable", "enter-to-first-artwork-actionable", "submit-to-empty-actionable"] as const;
export const SERVER_EXPERIENCE_PHASES = ["release-load", "intent", "semantic-model", "semantic-retrieval", "stage-choice", "fresh-curation", "retrieval", "scene-match", "snapshot-adapter"] as const;
export const EXPERIENCE_PHASES = [...CLIENT_EXPERIENCE_PHASES, ...SERVER_EXPERIENCE_PHASES] as const;
export const EXPERIENCE_OUTCOMES = ["lookup-hit", "lookup-damaged", "pending-join", "restore-success", "restore-failure",
  "fresh-started", "fresh-succeeded", "fresh-failed", "fresh-degraded", "fresh-empty", "rerank-skipped", "rerank-accepted", "rerank-accepted-original",
  "rerank-accepted-changed", "rerank-rejected", "rerank-unavailable", "lookup-rerank-backoff", "rerank-suppressed"] as const;
export const CURATION_DEGRADATIONS = ["intent-unavailable", "semantic-unavailable", "stage-choice-unavailable", "stage-choice-invalid"] as const;
export const EXPERIENCE_BUCKETS_MS = [50, 100, 200, 350, 500, 750, 1000, 1500, 2000, 3000, 5000, 8000, 12000, 20000, 30000, 60000, 90000] as const;

export type ClientExperiencePhase = typeof CLIENT_EXPERIENCE_PHASES[number];
export type ExperiencePhase = typeof EXPERIENCE_PHASES[number];
export type ExperienceOutcome = typeof EXPERIENCE_OUTCOMES[number];
export type CurationDegradation = typeof CURATION_DEGRADATIONS[number];

export function experienceDurationBucket(durationMs: number): number | undefined {
  if (!Number.isFinite(durationMs) || durationMs < 0) return undefined;
  const bucket = EXPERIENCE_BUCKETS_MS.findIndex(limit => durationMs <= limit);
  return bucket >= 0 ? bucket : undefined;
}

export function parseClientExperienceSample(value: unknown): { phase: ClientExperiencePhase; bucket: number } | undefined {
  if (!value || typeof value !== "object" || Object.keys(value).length !== 2 || !("phase" in value) || !("bucket" in value)) return undefined;
  if (!CLIENT_EXPERIENCE_PHASES.includes(value.phase as ClientExperiencePhase) || typeof value.bucket !== "number"
    || !Number.isInteger(value.bucket) || value.bucket < 0 || value.bucket >= EXPERIENCE_BUCKETS_MS.length) return undefined;
  return { phase: value.phase as ClientExperiencePhase, bucket: value.bucket };
}
