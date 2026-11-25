export type StageVectorVariant = "bounded" | "observation";

export interface StageVectorExperiment {
  variant: StageVectorVariant;
  observationVectors?: ReadonlyMap<string, readonly number[]>;
}

// Locked before the offline comparisons. The retrieval contribution remains
// bounded even when similarities span a large range.
export const STAGE_VECTOR_PARAMETERS = {
  minimumPopulation: 4,
  minimumRange: .015,
  boostScale: 3,
  boostLimit: .12,
  observationWeight: .5,
} as const;
export const MUSEUM_VECTOR_WEIGHT = .78;

export function stageVectorContributions(
  items: readonly { artworkId: string; museumCosine: number }[],
  query: readonly number[],
  experiment: StageVectorExperiment,
) {
  const { minimumPopulation, minimumRange, boostScale, boostLimit, observationWeight } = STAGE_VECTOR_PARAMETERS;
  const observations = experiment.variant === "observation" ? experiment.observationVectors : undefined;
  const scores = items.map(({ artworkId, museumCosine }) => {
    const vector = observations?.get(artworkId);
    if (!vector) return museumCosine;
    const cosine = query.reduce((sum, value, index) => sum + value * vector[index]!, 0);
    return (1 - observationWeight) * museumCosine + observationWeight * cosine;
  });
  const weighted = scores.map(score => score * MUSEUM_VECTOR_WEIGHT);
  if (scores.length < minimumPopulation) return weighted;
  const ordered = [...scores].sort((a, b) => a - b);
  if (ordered.at(-1)! - ordered[0]! < minimumRange - Number.EPSILON) return weighted;
  const middle = Math.floor(ordered.length / 2);
  const median = ordered.length % 2 ? ordered[middle]! : (ordered[middle - 1]! + ordered[middle]!) / 2;
  return scores.map((score, index) => weighted[index]! + Math.max(-boostLimit, Math.min(boostLimit, boostScale * (score - median))));
}
