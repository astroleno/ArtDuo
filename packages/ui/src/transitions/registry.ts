import { depthPushTransition } from "./depth-push-transition";
import { dissolveTransition } from "./dissolve-transition";
import { fadeTransition } from "./fade-transition";
import { lightSwellTransition } from "./light-swell-transition";

export type TransitionFamily = "fade" | "dissolve" | "light-swell" | "depth-push";

export interface TransitionModule {
  family: TransitionFamily;
  className: string;
  durationMs: number;
}

export type TransitionRegistry = Partial<Record<TransitionFamily, TransitionModule>>;

export const DEFAULT_TRANSITION_REGISTRY: Record<TransitionFamily, TransitionModule> = {
  fade: fadeTransition,
  dissolve: dissolveTransition,
  "light-swell": lightSwellTransition,
  "depth-push": depthPushTransition,
};

export function resolveTransitionModule(
  family: TransitionFamily | undefined,
  registry: TransitionRegistry = DEFAULT_TRANSITION_REGISTRY,
): TransitionModule {
  return registry[family ?? "fade"] ?? registry.fade ?? fadeTransition;
}
