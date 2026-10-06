import { defaultAnalyticsSink, trackAnalyticsEvent, type AnalyticsSink } from "./analytics";

export type ExperienceTimingPhase =
  | "release-load"
  | "retrieval"
  | "scene-match"
  | "snapshot-adapter"
  | "snapshot-ready"
  | "first-artwork-visible"
  | "first-artwork-actionable"
  | "explanation";

const SUBMIT_MARK = "artduo.experience.submit";

function markName(phase: ExperienceTimingPhase): string {
  return `artduo.experience.${phase}`;
}

export function recordExperienceTiming(
  phase: ExperienceTimingPhase,
  durationMs: number,
  releaseVersion: string,
  sink: AnalyticsSink = defaultAnalyticsSink,
): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  void trackAnalyticsEvent(sink, "experience.performance", {
    phase,
    durationMs: String(Math.round(durationMs)),
    releaseVersion,
  });
}

export function recordExperienceDegradation(
  reason: string,
  releaseVersion: string,
  artworkId?: string,
  sink: AnalyticsSink = defaultAnalyticsSink,
): void {
  void trackAnalyticsEvent(sink, "experience.degraded", { reason, releaseVersion, artworkId });
}

export function beginExperienceTiming(): void {
  if (typeof performance === "undefined") return;
  for (const phase of ["snapshot-ready", "first-artwork-visible", "first-artwork-actionable"] as const) {
    performance.clearMarks(markName(phase));
    performance.clearMeasures(`artduo.experience.submit-to-${phase}`);
  }
  performance.clearMarks(SUBMIT_MARK);
  performance.mark(SUBMIT_MARK);
}

export function beginExperienceTimingIfMissing(): void {
  if (typeof performance === "undefined" || performance.getEntriesByName(SUBMIT_MARK, "mark").length > 0) return;
  performance.mark(SUBMIT_MARK);
}

export function recordExperienceMilestone(phase: "snapshot-ready" | "first-artwork-visible" | "first-artwork-actionable", releaseVersion: string): void {
  if (typeof performance === "undefined") return;
  const endMark = markName(phase);
  performance.mark(endMark);
  const start = performance.getEntriesByName(SUBMIT_MARK, "mark").at(-1);
  const end = performance.getEntriesByName(endMark, "mark").at(-1);
  if (!start || !end) return;
  const measureName = `artduo.experience.submit-to-${phase}`;
  performance.measure(measureName, { start: start.startTime, end: end.startTime });
  recordExperienceTiming(phase, end.startTime - start.startTime, releaseVersion);
}

export function notifyExperienceDegradation(input: { reason: string; artworkId?: string }): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("artduo:experience-degraded", { detail: input }));
}
