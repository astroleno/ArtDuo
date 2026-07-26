import type {
  AffectSignal,
  AestheticSignal,
  ArtworkAgentCapsule,
  ArtworkRecord,
  CapsuleEvidence,
  MotionSignal,
  SceneSignal,
} from "@artduo/contracts";

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s-]+/g, "-");
}

function evidenceId(fieldPath: string, value: string): string {
  return `${fieldPath}:${normalize(value)}`.replace(/[^a-z0-9:.-]+/g, "-");
}

function makeEvidence(artwork: ArtworkRecord, fieldPath: string, value: string): CapsuleEvidence {
  return {
    id: evidenceId(fieldPath, value),
    sourceRef: artwork.id,
    fieldPath,
    value,
    confidence: 0.86,
  };
}

function signal(kind: AffectSignal["kind"], value: string, evidenceIds: string[], confidence = 0.82): AffectSignal {
  return {
    kind,
    value: normalize(value),
    confidence,
    evidenceIds,
  };
}

function pushEvidence(
  evidence: CapsuleEvidence[],
  artwork: ArtworkRecord,
  fieldPath: string,
  value: string | undefined,
): string | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  const entry = makeEvidence(artwork, fieldPath, value);
  if (!evidence.some((candidate) => candidate.id === entry.id)) {
    evidence.push(entry);
  }

  return entry.id;
}

function dedupeSignals<T extends { value: string; kind?: string }>(signals: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const entry of signals) {
    const key = `${entry.kind ?? ""}:${entry.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(entry);
    }
  }

  return result;
}

export function buildArtworkAgentCapsule(artwork: ArtworkRecord): ArtworkAgentCapsule {
  const evidence: CapsuleEvidence[] = [];
  const canOffer: AffectSignal[] = [];
  const boundaries: AffectSignal[] = [];
  const aesthetics: AestheticSignal[] = [];
  const sceneAffinity: SceneSignal[] = [];
  const motionAffinity: MotionSignal[] = [];

  for (const value of unique([...artwork.metadata.moodTags, ...artwork.retrieval.emotionLabels])) {
    const id = pushEvidence(
      evidence,
      artwork,
      artwork.metadata.moodTags.includes(value) ? "metadata.moodTags" : "retrieval.emotionLabels",
      value,
    );
    if (id) {
      canOffer.push(signal("emotion", value, [id]));
    }
  }

  for (const value of artwork.metadata.colorTags) {
    const id = pushEvidence(evidence, artwork, "metadata.colorTags", value);
    if (id) {
      aesthetics.push({ value: normalize(value), kind: "color", evidenceIds: [id], confidence: 0.84 });
    }
  }

  for (const value of artwork.metadata.compositionTags) {
    const id = pushEvidence(evidence, artwork, "metadata.compositionTags", value);
    if (id) {
      aesthetics.push({ value: normalize(value), kind: "composition", evidenceIds: [id], confidence: 0.78 });
    }
  }

  for (const value of artwork.presentation.sceneAffinity?.paletteModes ?? []) {
    const id = pushEvidence(evidence, artwork, "presentation.sceneAffinity.paletteModes", value);
    if (id) {
      aesthetics.push({ value: normalize(value), kind: "palette", evidenceIds: [id], confidence: 0.8 });
      sceneAffinity.push({ value: normalize(value), kind: "palette", evidenceIds: [id], confidence: 0.8 });
    }
  }

  for (const value of artwork.presentation.sceneAffinity?.sceneTypes ?? []) {
    const id = pushEvidence(evidence, artwork, "presentation.sceneAffinity.sceneTypes", value);
    if (id) {
      sceneAffinity.push({ value: normalize(value), kind: "scene", evidenceIds: [id], confidence: 0.82 });
    }
  }

  for (const value of artwork.presentation.sceneAffinity?.spatialModes ?? []) {
    const id = pushEvidence(evidence, artwork, "presentation.sceneAffinity.spatialModes", value);
    if (id) {
      sceneAffinity.push({ value: normalize(value), kind: "spatial", evidenceIds: [id], confidence: 0.82 });
    }
  }

  for (const value of artwork.presentation.sceneAffinity?.transitionTags ?? []) {
    const id = pushEvidence(evidence, artwork, "presentation.sceneAffinity.transitionTags", value);
    if (id) {
      sceneAffinity.push({ value: normalize(value), kind: "transition", evidenceIds: [id], confidence: 0.76 });
    }
  }

  const motionId = pushEvidence(evidence, artwork, "presentation.motionProfile", artwork.presentation.motionProfile);
  if (motionId) {
    motionAffinity.push({
      value: normalize(artwork.presentation.motionProfile),
      kind: "motion",
      evidenceIds: [motionId],
      confidence: 0.8,
    });
  }

  if (artwork.retrieval.pace) {
    const paceId = pushEvidence(evidence, artwork, "retrieval.pace", artwork.retrieval.pace);
    if (paceId) {
      motionAffinity.push({ value: normalize(artwork.retrieval.pace), kind: "pace", evidenceIds: [paceId], confidence: 0.74 });
    }
  }

  if (artwork.retrieval.energyLevel === "high") {
    const id = pushEvidence(evidence, artwork, "retrieval.energyLevel", artwork.retrieval.energyLevel);
    if (id) {
      boundaries.push(signal("resistance", "high-arousal", [id], 0.86));
    }
  }

  const affectTags = [
    ...artwork.metadata.moodTags,
    ...artwork.retrieval.emotionLabels,
    ...artwork.retrieval.keywordBoosts ?? [],
  ].map(normalize);

  if (affectTags.some((value) => ["drama", "despair", "grief"].includes(value))) {
    const sourceValue = affectTags.find((value) => ["drama", "despair", "grief"].includes(value)) ?? "drama";
    const id = pushEvidence(evidence, artwork, "metadata/retrieval.affectTags", sourceValue);
    if (id) {
      boundaries.push(signal("resistance", "heavy-drama", [id], 0.84));
    }
  }

  if (artwork.retrieval.valence === "bright" || affectTags.includes("bright")) {
    const id = pushEvidence(evidence, artwork, "retrieval.valence", artwork.retrieval.valence ?? "bright");
    if (id) {
      boundaries.push(signal("resistance", "bright", [id], 0.82));
    }
  }

  return {
    artworkId: artwork.id,
    identity: {
      title: artwork.metadata.title,
      artistDisplayName: artwork.metadata.artistDisplayName,
      yearLabel: artwork.metadata.yearLabel,
    },
    canOffer: dedupeSignals(canOffer),
    boundaries: dedupeSignals(boundaries),
    aesthetics: dedupeSignals(aesthetics),
    sceneAffinity: dedupeSignals(sceneAffinity),
    motionAffinity: dedupeSignals(motionAffinity),
    evidence,
    confidence: evidence.length > 0 ? 0.86 : 0.4,
  };
}
