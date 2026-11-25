import type { CurationIntentPlan } from "@artduo/contracts";
import type { SemanticEncoder } from "@artduo/corpus/src/local-semantic-provider";
import type { StageVectorExperiment } from "../lib/stage-vector-experiment";
import type { SemanticIndex } from "@artduo/contracts";
import type { WebReleaseCatalog } from "../lib/release-catalog";
import { loadObservationSidecar } from "./semantic-observation-release";

export const VECTOR_COMPARISON_ROUNDS = 3;
export type VectorEvaluationName = "baseline" | StageVectorExperiment["variant"];

export function rankingExperiment(name: VectorEvaluationName, sidecar: string | undefined, catalog: WebReleaseCatalog, index: SemanticIndex) {
  if (name === "baseline") return {};
  if (name === "bounded") return { experiment: { variant: "bounded" } as const };
  const started = performance.now();
  try {
    if (!sidecar) throw new Error("Observation sidecar was not supplied");
    const loaded = loadObservationSidecar(sidecar, catalog, index);
    if (!loaded.vectors.size) throw new Error("Observation index has no usable vectors");
    return { experiment: { variant: "observation", observationVectors: loaded.vectors } as const,
      observation: { checksum: loaded.checksum, coverage: loaded.vectors.size, loadMs: performance.now() - started } };
  } catch (error) {
    return { fallback: error instanceof Error ? error.message : String(error) };
  }
}

/** Each prepare pass encodes the same immutable queries exactly once. */
export async function prepareStageVectors<T extends { plan: CurationIntentPlan }>(
  entries: readonly T[],
  encoder: Pick<SemanticEncoder, "embedQueries">,
) {
  const result: Array<{ entry: T; queries: number[][] }> = [];
  for (const entry of entries) result.push({ entry, queries: await encoder.embedQueries(entry.plan.stages.map(stage => stage.query)) });
  return result;
}

/** Timing excludes release loading and encoder inference. Rotate run order each round. */
export function timeStageVariants<T>(names: readonly VectorEvaluationName[], run: (name: VectorEvaluationName) => T) {
  const results = new Map<VectorEvaluationName, { result: T; warmMs: number[]; medianMs: number }>();
  for (const name of names) results.set(name, { result: run(name), warmMs: [], medianMs: 0 });
  for (let round = 0; round < VECTOR_COMPARISON_ROUNDS; round++) {
    for (let index = 0; index < names.length; index++) {
      const name = names[(round + index) % names.length]!;
      const startedAt = performance.now();
      run(name);
      results.get(name)!.warmMs.push(performance.now() - startedAt);
    }
  }
  for (const entry of results.values()) entry.medianMs = [...entry.warmMs].sort((a, b) => a - b)[1]!;
  return results;
}
