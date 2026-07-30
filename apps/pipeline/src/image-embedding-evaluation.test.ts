import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import type { ImageEmbeddingShardRecord } from "@artduo/contracts";

import {
  buildImageEmbeddingReviewPack,
  calculateImageEmbeddingReviewPackChecksum,
  classifyImageEmbeddingArtworkWeakLabelPair,
  evaluateImageEmbeddingHumanReview,
  evaluateImageEmbeddingWeakLabels,
  renderImageEmbeddingReviewerView,
  scoreFrozenBackgroundSceneWeakLabel,
  validateImageEmbeddingMachineReviewPack,
} from "./image-embedding-evaluation";

function checksum(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function reviewComparison(mood: string, department: string, index: number) {
  return {
    artworkId: `quota-artwork-${String(index).padStart(2, "0")}`,
    stratum: `${mood}|${department}`,
    mood,
    department,
    artworkCaption: `${mood} ${department}`,
    artworkImageUrl: `https://images.example.test/quota-artwork-${index}.jpg`,
    baseline: {
      sceneId: `quota-baseline-${index}`,
      score: 0.4,
      fingerprint: checksum(`quota-baseline-${index}`),
      imageUrl: `https://images.example.test/quota-baseline-${index}.jpg`,
    },
    candidate: {
      sceneId: `quota-candidate-${index}`,
      score: 0.7,
      fingerprint: checksum(`quota-candidate-${index}`),
      imageUrl: `https://images.example.test/quota-candidate-${index}.jpg`,
    },
  };
}

function record(
  entityId: string,
  vector: number[],
  entityType: "artwork" | "background-scene" = "artwork",
): ImageEmbeddingShardRecord {
  return {
    id: `${entityType}:${entityId}`,
    entityType,
    entityId,
    releaseVersion: "image-evaluation-test",
    model: "test-image-model",
    modelRevision: "test-revision",
    modelVariant: "quantized",
    modelArtifactChecksum: checksum("model"),
    provider: "@xenova/transformers",
    providerVersion: "2.17.2",
    dimensions: vector.length,
    preprocessingVersion: "test-preprocessing.v1",
    preprocessingFingerprint: checksum("preprocessing"),
    vectorPrecision: 8,
    source: {
      shardId: "media-01",
      recordId: entityId,
      fieldPath: entityType === "artwork" ? "media.imageUrlPreview" : "asset.local_public_path",
      fingerprint: checksum(`source:${entityId}`),
    },
    vector,
  };
}

test("image weak-label evaluation keeps positive visual pairs above negatives on the deterministic holdout", () => {
  const artworks = Array.from({ length: 10 }, (_, groupIndex) => {
    const group = String(groupIndex + 1).padStart(2, "0");
    return [
      {
        id: `art-${group}-a`,
        department: "Paintings",
        moodTags: ["contemplation"],
        colorTags: [`color-${group}`],
        compositionTags: [`composition-${group}`],
        subjectTags: [`subject-${group}`],
        aspectRatioHint: "landscape",
      },
      {
        id: `art-${group}-b`,
        department: "Paintings",
        moodTags: ["contemplation"],
        colorTags: [`color-${group}`],
        compositionTags: [`composition-${group}`],
        subjectTags: [`subject-${group}`],
        aspectRatioHint: "landscape",
      },
      {
        id: `art-${group}-negative`,
        department: "Paintings",
        moodTags: ["contemplation"],
        colorTags: [`other-color-${group}`],
        compositionTags: [`other-composition-${group}`],
        subjectTags: [`other-subject-${group}`],
        aspectRatioHint: "portrait",
      },
    ];
  }).flat();
  const records = artworks.map((artwork) => {
    const groupIndex = Number(artwork.id.slice(4, 6)) - 1;
    const vector = Array.from({ length: 10 }, (_, index) => index === groupIndex ? 1 : 0);
    return record(artwork.id, artwork.id.endsWith("negative") ? vector.map((value) => -value) : vector);
  });

  const evaluation = evaluateImageEmbeddingWeakLabels({
    releaseVersion: "image-evaluation-test",
    evaluationVersion: "image-embedding-evaluation.v1",
    artworks,
    scenes: [],
    records,
  });

  assert.equal(evaluation.labelSource, "structured-weak-label-v1");
  assert.equal(evaluation.trainArtworkIds.length, 21);
  assert.equal(evaluation.holdoutArtworkIds.length, 9);
  assert.equal(evaluation.artworkPairwise.holdout.pairwiseAccuracy, 1);
  assert.ok(evaluation.artworkPairwise.holdout.positivePairCount > 0);
  assert.ok(evaluation.artworkPairwise.holdout.negativePairCount > 0);
});

test("frozen scene weak labels use the production metadata scorer and its weights", () => {
  const artwork = {
    id: "artwork-1",
    moodTags: ["contemplation"],
    colorTags: ["ochre"],
    compositionTags: [],
    subjectTags: [],
    emotionLabels: ["awe"],
    sceneAffinity: {
      paletteModes: ["warm-neutral"],
      sceneTypes: ["gallery_interior"],
    },
  };
  const matchingScene = {
    id: "scene-matching",
    emotionIds: ["contemplation", "awe"],
    artworkPaletteModes: ["warm-neutral"],
    sceneType: "gallery_interior",
    palette: ["ochre"],
  };

  assert.equal(scoreFrozenBackgroundSceneWeakLabel(artwork, matchingScene), 13);
  assert.equal(scoreFrozenBackgroundSceneWeakLabel(artwork, {
    id: "scene-zero",
    emotionIds: [],
    artworkPaletteModes: [],
    sceneType: "architectural_space",
    palette: [],
  }), 0);
});

test("frozen metadata scorer keeps valid 14 and 15 point matches distinct", () => {
  const artwork = {
    id: "high-score-artwork",
    moodTags: ["contemplation"],
    colorTags: ["ochre", "indigo", "ivory"],
    compositionTags: [],
    subjectTags: [],
    emotionLabels: ["awe"],
    sceneAffinity: {
      paletteModes: ["warm-neutral"],
      sceneTypes: ["gallery_interior"],
    },
  };
  const sharedScene = {
    id: "shared-scene",
    emotionIds: ["contemplation", "awe"],
    artworkPaletteModes: ["warm-neutral"],
    sceneType: "gallery_interior",
    palette: ["ochre", "indigo"],
  };

  assert.equal(scoreFrozenBackgroundSceneWeakLabel(artwork, sharedScene), 14);
  assert.equal(scoreFrozenBackgroundSceneWeakLabel(artwork, {
    ...sharedScene,
    id: "one-more-color-scene",
    palette: ["ochre", "indigo", "ivory"],
  }), 15);
});

test("artwork positives require two distinct shared weak-label fields rather than two tags from one field", () => {
  const sharedColorOnlyLeft = {
    id: "shared-color-left",
    moodTags: [],
    colorTags: ["ochre", "ultramarine"],
    compositionTags: ["centered"],
    subjectTags: ["portrait"],
    aspectRatioHint: "landscape",
  };
  const sharedColorOnlyRight = {
    ...sharedColorOnlyLeft,
    id: "shared-color-right",
    compositionTags: ["asymmetrical"],
    subjectTags: ["landscape"],
    aspectRatioHint: "portrait",
  };
  const sharedTwoFields = {
    ...sharedColorOnlyRight,
    id: "shared-two-fields",
    compositionTags: ["centered"],
    subjectTags: ["landscape"],
    aspectRatioHint: "landscape",
  };

  assert.equal(classifyImageEmbeddingArtworkWeakLabelPair(sharedColorOnlyLeft, sharedColorOnlyRight), undefined);
  assert.equal(classifyImageEmbeddingArtworkWeakLabelPair(sharedColorOnlyLeft, sharedTwoFields), "positive");
});

test("scene Top-3 evaluation reports missing vectors outside the metric denominator", () => {
  const artworks = ["artwork-with-vector", "artwork-missing-vector"].map((id) => ({
    id,
    department: "Paintings",
    moodTags: ["contemplation"],
    colorTags: ["ochre"],
    compositionTags: [],
    subjectTags: [],
    emotionLabels: ["awe"],
    sceneAffinity: { paletteModes: ["warm-neutral"], sceneTypes: ["gallery_interior"] },
  }));
  const scenes = [
    {
      id: "scene-positive",
      emotionIds: ["contemplation", "awe"],
      artworkPaletteModes: ["warm-neutral"],
      sceneType: "gallery_interior",
      palette: ["ochre"],
    },
    {
      id: "scene-distractor",
      emotionIds: [],
      artworkPaletteModes: [],
      sceneType: "architectural_space",
      palette: [],
    },
    {
      id: "scene-missing-vector",
      emotionIds: [],
      artworkPaletteModes: [],
      sceneType: "natural_landscape",
      palette: [],
    },
  ];

  const evaluation = evaluateImageEmbeddingWeakLabels({
    releaseVersion: "scene-evaluation-test",
    evaluationVersion: "image-embedding-evaluation.v1",
    artworks,
    scenes,
    records: [
      record("artwork-with-vector", [1, 0]),
      record("scene-positive", [1, 0], "background-scene"),
      record("scene-distractor", [0, 1], "background-scene"),
    ],
  });
  const splitMetrics = [evaluation.sceneTop3.train, evaluation.sceneTop3.holdout];

  assert.equal(evaluation.sceneTop3.coverage.eligibleSceneCount, 3);
  assert.equal(evaluation.sceneTop3.coverage.availableSceneVectorCount, 2);
  assert.equal(evaluation.sceneTop3.coverage.missingSceneVectorCount, 1);
  assert.equal(splitMetrics.reduce((total, metrics) => total + metrics.eligibleArtworkCount, 0), 2);
  assert.equal(splitMetrics.reduce((total, metrics) => total + metrics.evaluatedArtworkCount, 0), 1);
  assert.equal(splitMetrics.reduce((total, metrics) => total + metrics.missingArtworkVectorCount, 0), 1);
  assert.equal(splitMetrics.reduce((total, metrics) => total + metrics.hitCount, 0), 1);
});

test("scene Top-3 weak labels use only frozen-score-zero negatives", () => {
  const artwork = {
    id: "scene-anchor",
    department: "Paintings",
    moodTags: ["contemplation"],
    colorTags: ["ochre"],
    compositionTags: [],
    subjectTags: [],
    emotionLabels: ["awe"],
    sceneAffinity: { paletteModes: ["warm-neutral"], sceneTypes: ["gallery_interior"] },
  };
  const scenes = [
    {
      id: "scene-positive",
      emotionIds: ["contemplation", "awe"],
      artworkPaletteModes: ["warm-neutral"],
      sceneType: "gallery_interior",
      palette: ["ochre"],
    },
    ...["a", "b", "c"].map((suffix) => ({
      id: `scene-partial-${suffix}`,
      emotionIds: ["contemplation"],
      artworkPaletteModes: [],
      sceneType: "architectural_space",
      palette: [],
    })),
    {
      id: "scene-zero",
      emotionIds: [],
      artworkPaletteModes: [],
      sceneType: "architectural_space",
      palette: [],
    },
  ];

  const evaluation = evaluateImageEmbeddingWeakLabels({
    releaseVersion: "scene-negative-test",
    evaluationVersion: "image-embedding-evaluation.v1",
    artworks: [artwork],
    scenes,
    records: [
      record("scene-anchor", [1, 0]),
      record("scene-positive", [1, 0], "background-scene"),
      ...["a", "b", "c"].map((suffix) => record(`scene-partial-${suffix}`, [1, 0], "background-scene")),
      record("scene-zero", [0, 1], "background-scene"),
    ],
  });

  assert.equal(evaluation.sceneTop3.holdout.hitRate, 1);
});

test("artwork pairwise evaluation records missing vectors instead of treating them as failed comparisons", () => {
  const artworks = Array.from({ length: 10 }, (_, groupIndex) => {
    const group = String(groupIndex + 1).padStart(2, "0");
    return ["a", "b", "negative"].map((suffix) => ({
      id: `pair-${group}-${suffix}`,
      department: "Paintings",
      moodTags: ["contemplation"],
      colorTags: [suffix === "negative" ? `other-color-${group}` : `color-${group}`],
      compositionTags: [suffix === "negative" ? `other-composition-${group}` : `composition-${group}`],
      subjectTags: [suffix === "negative" ? `other-subject-${group}` : `subject-${group}`],
      aspectRatioHint: suffix === "negative" ? "portrait" : "landscape",
    }));
  }).flat();
  const records = artworks
    .filter((artwork) => artwork.id !== "pair-03-negative")
    .map((artwork) => {
      const groupIndex = Number(artwork.id.slice(5, 7)) - 1;
      const vector = Array.from({ length: 10 }, (_, index) => index === groupIndex ? 1 : 0);
      return record(artwork.id, artwork.id.endsWith("negative") ? vector.map((value) => -value) : vector);
    });

  const evaluation = evaluateImageEmbeddingWeakLabels({
    releaseVersion: "pairwise-missing-vector-test",
    evaluationVersion: "image-embedding-evaluation.v1",
    artworks,
    scenes: [],
    records,
  });
  const splitMetrics = [evaluation.artworkPairwise.train, evaluation.artworkPairwise.holdout];

  assert.equal(splitMetrics.reduce((total, metrics) => total + metrics.eligibleArtworkCount, 0), 30);
  assert.equal(splitMetrics.reduce((total, metrics) => total + metrics.missingArtworkVectorCount, 0), 1);
  assert.ok(splitMetrics.reduce((total, metrics) => total + metrics.unscoredComparisonCount, 0) > 0);
  assert.ok(splitMetrics.reduce((total, metrics) => total + metrics.comparisonCount, 0) > 0);
});

test("holdout readiness fails closed for small or unsatisfied strata and emits cluster-bootstrap evidence", () => {
  const artworks = ["a", "b", "negative"].map((suffix) => ({
    id: `small-${suffix}`,
    department: "Paintings",
    moodTags: ["contemplation"],
    colorTags: [suffix === "negative" ? "other-color" : "ochre"],
    compositionTags: [suffix === "negative" ? "other-composition" : "centered"],
    subjectTags: [suffix === "negative" ? "other-subject" : "portrait"],
    aspectRatioHint: suffix === "negative" ? "portrait" : "landscape",
  }));

  const evaluation = evaluateImageEmbeddingWeakLabels({
    releaseVersion: "small-holdout-test",
    evaluationVersion: "image-embedding-evaluation.v1",
    artworks,
    scenes: [],
    records: [
      record("small-a", [1, 0]),
      record("small-b", [1, 0]),
      record("small-negative", [-1, 0]),
    ],
  });

  assert.equal(evaluation.holdoutReadiness.artworkPairwise.minimumSampleMet, false);
  assert.equal(evaluation.artworkPairwise.holdout.perStrata[0]?.status, "insufficient-sample");
  assert.equal(evaluation.artworkPairwise.holdout.confidenceInterval.resampleCount, 1_000);
});

test("holdout gates major mood and department strata while retaining long-tail combinations as diagnostics", () => {
  const moods = Array.from({ length: 7 }, (_, index) => `mood-${index + 1}`);
  const departments = Array.from({ length: 9 }, (_, index) => `department-${index + 1}`);
  const artworks = moods.flatMap((mood) => departments.flatMap((department) =>
    Array.from({ length: 3 }, (_, duplicate) => ({
      id: `${mood}-${department}-${duplicate + 1}`,
      department,
      moodTags: [mood],
      colorTags: ["ochre"],
      compositionTags: ["centered"],
      subjectTags: ["portrait"],
      emotionLabels: [mood],
      sceneAffinity: { paletteModes: [], sceneTypes: [] },
    }))));
  const records = [
    ...artworks.map((artwork) => record(artwork.id, [1, 0])),
    record("scene-positive", [1, 0], "background-scene"),
    record("scene-zero", [0, 1], "background-scene"),
  ];
  const evaluation = evaluateImageEmbeddingWeakLabels({
    releaseVersion: "major-strata-test",
    evaluationVersion: "image-embedding-evaluation.v1",
    artworks,
    scenes: [
      {
        id: "scene-positive",
        emotionIds: moods,
        artworkPaletteModes: [],
        sceneType: "gallery_interior",
        palette: ["ochre"],
      },
      {
        id: "scene-zero",
        emotionIds: [],
        artworkPaletteModes: [],
        sceneType: "architectural_space",
        palette: [],
      },
    ],
    records,
  });

  assert.equal(evaluation.sceneTop3.holdout.perStrata.length, 63);
  assert.ok(evaluation.sceneTop3.holdout.perStrata.every((stratum) => stratum.status === "insufficient-sample"));
  assert.equal(evaluation.holdoutReadiness.sceneTop3.allStrataSufficient, false);
  assert.equal(evaluation.holdoutReadiness.sceneTop3.allMajorStrataSufficient, true);
  assert.equal(evaluation.sceneTop3.holdout.majorStrata.length, moods.length + departments.length);
  assert.ok(evaluation.sceneTop3.holdout.majorStrata.every((stratum) => stratum.status === "ready"));
});

test("review pack remains blind and only accepts a complete verdict sidecar bound to its checksum", () => {
  const generated = buildImageEmbeddingReviewPack({
    releaseVersion: "review-pack-test",
    evaluationVersion: "image-embedding-evaluation.v1",
    candidateShardChecksum: checksum("candidate-shard"),
    comparisons: Array.from({ length: 32 }, (_, index) => ({
      artworkId: `artwork-${String(index + 1).padStart(2, "0")}`,
      stratum: `${index % 2 === 0 ? "contemplation" : "wonder"}|paintings`,
      mood: index % 2 === 0 ? "contemplation" : "wonder",
      department: "paintings",
      artworkCaption: `Artwork ${index + 1}`,
      artworkImageUrl: `https://images.example.test/artwork-${index + 1}.jpg`,
      baseline: {
        sceneId: `baseline-scene-${index + 1}`,
        score: 0.4,
        fingerprint: checksum(`baseline-${index + 1}`),
        imageUrl: `https://images.example.test/left-${index + 1}.jpg`,
      },
      candidate: {
        sceneId: `candidate-scene-${index + 1}`,
        score: 0.7,
        fingerprint: checksum(`candidate-${index + 1}`),
        imageUrl: `https://images.example.test/right-${index + 1}.jpg`,
      },
    })),
  });

  assert.equal(generated.minimumSampleMet, true);
  assert.equal(generated.pack.comparisons.length, 30);
  const reviewerView = renderImageEmbeddingReviewerView(generated.pack);
  assert.equal(reviewerView.includes("candidate-scene"), false);
  assert.equal(reviewerView.includes("baseline-scene"), false);
  assert.equal(reviewerView.includes("score"), false);

  const verdicts = {
    reviewPackChecksum: generated.pack.reviewPackChecksum,
    verdicts: generated.pack.comparisons.map((comparison) => ({
      reviewId: comparison.reviewId,
      comparisonVerdict: "tie" as const,
      leftAcceptability: "acceptable" as const,
      rightAcceptability: "acceptable" as const,
      reason: "Both options support the artwork.",
    })),
  };
  const review = evaluateImageEmbeddingHumanReview(generated.pack, verdicts);

  assert.equal(review.valid, true);
  assert.equal(review.humanReviewComplete, true);
  assert.equal(review.candidateAcceptableRate, 1);
  assert.equal(review.uncertainRate, 0);

  assert.equal(evaluateImageEmbeddingHumanReview(generated.pack, undefined).humanReviewComplete, false);
  const mixedVerdicts = structuredClone(verdicts);
  const firstComparison = generated.pack.comparisons[0]!;
  const candidateOnLeft = Number.parseInt(
    createHash("sha256").update(firstComparison.randomizationSeed).digest("hex").slice(0, 2),
    16,
  ) % 2 === 0;
  mixedVerdicts.verdicts[0] = {
    ...mixedVerdicts.verdicts[0]!,
    comparisonVerdict: candidateOnLeft ? "right-better" : "left-better",
    leftAcceptability: candidateOnLeft ? "unacceptable" : "acceptable",
    rightAcceptability: candidateOnLeft ? "acceptable" : "unacceptable",
  };
  mixedVerdicts.verdicts[1] = {
    ...mixedVerdicts.verdicts[1]!,
    comparisonVerdict: "uncertain",
  };
  const mixedReview = evaluateImageEmbeddingHumanReview(generated.pack, mixedVerdicts);
  assert.equal(mixedReview.candidateAcceptableRate, 29 / 30);
  assert.equal(mixedReview.candidateRegressionRate, 1 / 30);
  assert.equal(mixedReview.uncertainRate, 1 / 30);

  const emptyReasonVerdicts = structuredClone(verdicts);
  emptyReasonVerdicts.verdicts[0]!.reason = "";
  assert.equal(evaluateImageEmbeddingHumanReview(generated.pack, emptyReasonVerdicts).valid, false);

  const tamperedPack = structuredClone(generated.pack);
  tamperedPack.comparisons[0]!.candidate.sceneId = "candidate-scene-tampered";
  assert.equal(evaluateImageEmbeddingHumanReview(tamperedPack, verdicts).valid, false);

  const malformedPack = { ...generated.pack, comparisons: [null] } as unknown as typeof generated.pack;
  assert.equal(evaluateImageEmbeddingHumanReview(malformedPack, verdicts).valid, false);
  assert.throws(() => renderImageEmbeddingReviewerView(malformedPack), /invalid|malformed/i);
});

test("review pack uses deterministic marginal quotas instead of stopping at lexicographically early compound strata", () => {
  const moods = Array.from({ length: 7 }, (_, index) => `mood-${String(index + 1).padStart(2, "0")}`);
  const departments = Array.from({ length: 9 }, (_, index) => `department-${String(index + 1).padStart(2, "0")}`);
  const generated = buildImageEmbeddingReviewPack({
    releaseVersion: "review-pack-strata-test",
    evaluationVersion: "image-embedding-evaluation.v1",
    candidateShardChecksum: checksum("candidate-shard"),
    comparisons: moods.flatMap((mood) => departments.map((department) => ({
      artworkId: `${mood}-${department}`,
      stratum: `${mood}|${department}`,
      mood,
      department,
      artworkCaption: `${mood} ${department}`,
      artworkImageUrl: `https://images.example.test/${mood}-${department}.jpg`,
      baseline: {
        sceneId: `baseline-${mood}-${department}`,
        score: 0.4,
        fingerprint: checksum(`baseline-${mood}-${department}`),
        imageUrl: `https://images.example.test/baseline-${mood}-${department}.jpg`,
      },
      candidate: {
        sceneId: `candidate-${mood}-${department}`,
        score: 0.7,
        fingerprint: checksum(`candidate-${mood}-${department}`),
        imageUrl: `https://images.example.test/candidate-${mood}-${department}.jpg`,
      },
    }))),
  });

  assert.equal(generated.pack.comparisons.length, 30);
  assert.equal(generated.pack.sampling.algorithm, "marginal-proportional-v1");
  assert.equal(generated.pack.sampling.moods.length, moods.length);
  assert.equal(generated.pack.sampling.departments.length, departments.length);
  assert.ok(generated.pack.sampling.moods.every((stratum) => stratum.selectedCount > 0));
  assert.ok(generated.pack.sampling.departments.every((stratum) => stratum.selectedCount > 0));
  assert.ok(generated.pack.comparisons.some((comparison) => comparison.mood === moods.at(-1)));
});

test("review pack exactly fills feasible coupled mood and department quotas", () => {
  const moods = [
    ...Array<string>(30).fill("m1"),
    ...Array<string>(9).fill("m2"),
    ...Array<string>(6).fill("m3"),
  ];
  const departments = [
    "d2", "d5", "d3", "d2", "d4", "d2", "d4", "d2", "d1", "d3",
    "d3", "d2", "d2", "d1", "d5", "d3", "d2", "d3", "d3", "d4",
    "d2", "d1", "d4", "d3", "d1", "d4", "d1", "d4", "d2", "d4",
    "d2", "d4", "d4", "d4", "d4", "d2", "d1", "d1", "d2",
    "d1", "d4", "d2", "d1", "d2", "d2",
  ];
  const generated = buildImageEmbeddingReviewPack({
    releaseVersion: "quota-search",
    evaluationVersion: "v1",
    candidateShardChecksum: checksum("candidate-shard"),
    comparisons: moods.map((mood, index) => reviewComparison(mood, departments[index]!, index)),
  });

  assert.equal(generated.minimumSampleMet, true);
  assert.ok(
    [...generated.pack.sampling.moods, ...generated.pack.sampling.departments]
      .every((stratum) => stratum.selectedCount === stratum.targetCount),
  );
  assert.equal(validateImageEmbeddingMachineReviewPack(generated.pack), undefined);
});

test("review pack fails closed when independently proportional marginals are infeasible", () => {
  const comparisons = [
    reviewComparison("m1", "d1", 1),
    reviewComparison("m2", "d1", 2),
    ...Array.from({ length: 43 }, (_, index) => reviewComparison("m3", "d2", index + 3)),
  ];
  const generated = buildImageEmbeddingReviewPack({
    releaseVersion: "review-pack-infeasible-quota-test",
    evaluationVersion: "image-embedding-evaluation.v1",
    candidateShardChecksum: checksum("candidate-shard"),
    comparisons,
  });

  assert.equal(generated.minimumSampleMet, false);
  assert.ok(generated.pack.comparisons.length < 30);
});

test("machine review pack rejects a full sample whose recorded quota diverges from selected comparisons", () => {
  const generated = buildImageEmbeddingReviewPack({
    releaseVersion: "review-pack-quota-integrity-test",
    evaluationVersion: "image-embedding-evaluation.v1",
    candidateShardChecksum: checksum("candidate-shard"),
    comparisons: Array.from({ length: 30 }, (_, index) => reviewComparison("m1", "d1", index + 1)),
  });
  const tampered = structuredClone(generated.pack);
  tampered.sampling.moods[0]!.targetCount = 29;
  tampered.reviewPackChecksum = calculateImageEmbeddingReviewPackChecksum(tampered);

  assert.match(validateImageEmbeddingMachineReviewPack(tampered) ?? "", /quota|target/i);
});
