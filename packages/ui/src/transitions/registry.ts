import { depthPushTransition } from "./depth-push-transition";
import { dissolveTransition } from "./dissolve-transition";
import { fadeTransition } from "./fade-transition";
import { lightSwellTransition } from "./light-swell-transition";
import { lateralPanTransition } from "./lateral-pan-transition";
import { matchCutTransition } from "./match-cut-transition";
import { scaleFocusTransition } from "./scale-focus-transition";

export type TransitionFamily = "fade" | "dissolve" | "match-cut" | "depth-push" | "lateral-pan" | "light-swell" | "scale-focus";

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
  "match-cut": matchCutTransition,
  "lateral-pan": lateralPanTransition,
  "scale-focus": scaleFocusTransition,
};

export function resolveTransitionModule(
  family: TransitionFamily | undefined,
  registry: TransitionRegistry = DEFAULT_TRANSITION_REGISTRY,
): TransitionModule {
  return registry[family ?? "fade"] ?? registry.fade ?? fadeTransition;
}
