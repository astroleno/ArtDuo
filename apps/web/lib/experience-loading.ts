export type ExperienceLoadingTier = "normal" | "long-wait" | "retry";
export const EXPERIENCE_LOADING_LONG_WAIT_MS = 10_000;
export const EXPERIENCE_LOADING_RETRY_MS = 20_000;

export function experienceLoadingTier(elapsedMs: number): ExperienceLoadingTier {
  if (elapsedMs >= EXPERIENCE_LOADING_RETRY_MS) return "retry";
  if (elapsedMs >= EXPERIENCE_LOADING_LONG_WAIT_MS) return "long-wait";
  return "normal";
}
