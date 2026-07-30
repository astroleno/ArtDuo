export const IMAGE_SCENE_SCORE_CARDINALITY_LIMITS = {
  artworkMoodTags: 3,
  artworkEmotionLabels: 3,
  artworkPaletteModes: 4,
  artworkSceneTypes: 3,
  artworkColorTags: 3,
  sceneEmotionIds: 3,
  sceneArtworkPaletteModes: 3,
  scenePalette: 4,
} as const;

/**
 * The frozen production scorer counts matching artwork-side entries. It does
 * not deduplicate legacy tag arrays, so this upper bound intentionally uses
 * the artwork-side caps rather than an intersection minimum.
 */
export const IMAGE_SCENE_SCORE_UPPER_BOUND =
  IMAGE_SCENE_SCORE_CARDINALITY_LIMITS.artworkMoodTags * 4
  + IMAGE_SCENE_SCORE_CARDINALITY_LIMITS.artworkEmotionLabels * 4
  + IMAGE_SCENE_SCORE_CARDINALITY_LIMITS.artworkPaletteModes * 2
  + 2
  + IMAGE_SCENE_SCORE_CARDINALITY_LIMITS.artworkColorTags;

export function assertImageSceneScoreCardinality(
  values: readonly unknown[],
  maximum: number,
  path: string,
): void {
  if (values.length > maximum) {
    throw new TypeError(`${path}: expected at most ${maximum} values for the frozen image-scene score contract`);
  }
}

/**
 * Release producers use this stable prefix cap before serializing score-bearing
 * arrays. Parsers remain strict so externally supplied shards cannot bypass the
 * frozen contract.
 */
export function capImageSceneScoreValues<T>(values: readonly T[], maximum: number): T[] {
  if (!Number.isInteger(maximum) || maximum < 0) {
    throw new TypeError("Image-scene score cardinality cap must be a non-negative integer.");
  }
  return values.slice(0, maximum);
}
