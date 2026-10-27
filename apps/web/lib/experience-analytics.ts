import { defaultAnalyticsSink, trackAnalyticsEvent, type AnalyticsSink } from "./analytics";

export type ExperienceTimingPhase =
  | "release-load"
  | "intent"
  | "semantic-model"
  | "semantic-retrieval"
  | "retrieval"
  | "scene-match"
  | "snapshot-adapter"
  | "snapshot-ready"
  | "first-artwork-visible"
  | "first-artwork-actionable"
  | "first-narrative"
  | "narrative-complete"
  | "explanation";

const SUBMIT_MARK = "artduo.experience.submit";
const PENDING_NAVIGATION = "artduo.experience.pending-navigation";

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
  if (typeof window === "undefined" && process.env.ARTDUO_TIMING_DIAGNOSTICS === "1") {
    console.info("[artduo:timing]", JSON.stringify({ phase, durationMs: Math.round(durationMs), releaseVersion }));
  }
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

export function beginExperienceTiming(query?: string): void {
  if (typeof performance === "undefined") return;
  for (const phase of ["snapshot-ready", "first-artwork-visible", "first-artwork-actionable", "first-narrative", "narrative-complete"] as const) {
    performance.clearMarks(markName(phase));
    performance.clearMeasures(`artduo.experience.submit-to-${phase}`);
  }
  performance.clearMarks(SUBMIT_MARK);
  performance.mark(SUBMIT_MARK);
  if (query && typeof sessionStorage !== "undefined") {
    try { sessionStorage.setItem(PENDING_NAVIGATION, JSON.stringify({ startedAt: performance.timeOrigin + performance.now(), query: query.normalize("NFKC").trim() })); } catch { /* Timing cannot block a submission. */ }
  }
}

export function beginExperienceTimingIfMissing(): void {
  if (typeof performance === "undefined" || performance.getEntriesByName(SUBMIT_MARK, "mark").length > 0) return;
  const navigation = performance.getEntriesByType("navigation").at(-1);
  const documentEntry = typeof window !== "undefined" && navigation?.name === window.location.href;
  let priorDocumentMs = 0;
  if (typeof window !== "undefined" && typeof sessionStorage !== "undefined") {
    try {
      const raw = sessionStorage.getItem(PENDING_NAVIGATION);
      sessionStorage.removeItem(PENDING_NAVIGATION);
      const pending = raw ? JSON.parse(raw) : undefined;
      const query = new URL(window.location.href).searchParams.get("query")?.normalize("NFKC").trim();
      const elapsed = Date.now() - pending?.startedAt;
      if (pending?.query === query && Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 90_000) priorDocumentMs = Math.max(0, performance.timeOrigin - pending.startedAt);
    } catch { /* Storage is optional and untrusted. */ }
  }
  performance.mark(SUBMIT_MARK, { startTime: priorDocumentMs || documentEntry ? 0 : performance.now(), detail: { priorDocumentMs } });
}

export function recordExperienceMilestone(phase: "snapshot-ready" | "first-artwork-visible" | "first-artwork-actionable" | "first-narrative" | "narrative-complete", releaseVersion: string): void {
  if (typeof performance === "undefined") return;
  beginExperienceTimingIfMissing();
  const endMark = markName(phase);
  if (performance.getEntriesByName(endMark, "mark").length) return;
  performance.mark(endMark);
  const start = performance.getEntriesByName(SUBMIT_MARK, "mark").at(-1);
  const end = performance.getEntriesByName(endMark, "mark").at(-1);
  if (!start || !end) return;
  const measureName = `artduo.experience.submit-to-${phase}`;
  const priorDocumentMs = Number((start as PerformanceMark).detail?.priorDocumentMs) || 0;
  const durationMs = end.startTime - start.startTime + priorDocumentMs;
  performance.measure(measureName, { start: start.startTime, duration: durationMs });
  recordExperienceTiming(phase, durationMs, releaseVersion);
}

export function notifyExperienceDegradation(input: { reason: string; artworkId?: string }): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("artduo:experience-degraded", { detail: input }));
}
