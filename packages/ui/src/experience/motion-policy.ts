export interface MotionPolicy {
  reducedMotion: boolean;
  pointerFine: boolean;
  webglAvailable: boolean;
}

export function createMotionPolicy(input: Partial<MotionPolicy> = {}): MotionPolicy {
  return {
    reducedMotion: input.reducedMotion ?? false,
    pointerFine: input.pointerFine ?? false,
    webglAvailable: input.webglAvailable ?? false,
  };
}

export function motionDuration(durationMs: number, policy: MotionPolicy): number {
  return policy.reducedMotion ? 0 : Math.max(0, durationMs);
}

export function resolvedTransitionFamily(
  requested: string | undefined,
  policy: MotionPolicy,
): "fade" | "dissolve" | "match-cut" | "depth-push" | "lateral-pan" | "light-swell" | "scale-focus" {
  if (policy.reducedMotion || !requested) return "fade";
  if (requested === "depth-push" && !policy.webglAvailable) return "fade";
  const supported = new Set(["fade", "dissolve", "match-cut", "depth-push", "lateral-pan", "light-swell", "scale-focus"]);
  return supported.has(requested) ? requested as ReturnType<typeof resolvedTransitionFamily> : "fade";
}
