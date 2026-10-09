import type { ExhibitionUnit, TransitionFamily, TransitionIntent } from "@artduo/contracts";
import type { ExhibitionSnapshot, ExperienceStage, ExperienceUnit, NarrativeBlock } from "@artduo/ui";
import { sequenceExhibition } from "@artduo/ui";
import { parseViewingIntent } from "./viewing-intent";

import type { CurationNarrative } from "./curation-narrative";
import { isGalleryArtwork } from "./artwork-eligibility";
import { artworkImageUrl } from "./artwork-image-url";
import { sceneRouteStopForIndex, type GallerySceneRouteStop } from "./gallery-route";
import type { ExperienceArtworkRecord, WebReleaseCatalog, WebSearchResult } from "./release-catalog";

const INTENT_FAMILY: Record<TransitionIntent, TransitionFamily> = {
  fade: "fade",
  drift: "lateral-pan",
  push: "depth-push",
  hold: "match-cut",
  return: "dissolve",
};

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function stageLabel(label: string, role: string): string {
  const known: Record<string, string> = {
    threshold: "入场",
    mirror: "映照",
    turn: "转折",
    release: "舒展",
    afterglow: "余韵",
  };
  return known[role] ?? label;
}

function inferDisplayMode(result: WebSearchResult["results"][number]): ExhibitionUnit["displayMode"] {
  const source = [
    result.artwork.title,
    result.artwork.medium,
    result.artwork.department,
    ...result.artwork.subjectTags,
    ...result.artwork.compositionTags,
  ].filter(Boolean).join(" ").toLowerCase();

  if (/\b(architecture|architectural|building|church|cathedral|interior|portal|cloister)\b/.test(source)) {
    return "static-frame";
  }
  if (/\b(video|film|animation|motion)\b/.test(source)) {
    return "motion-frame";
  }
  if (result.artwork.grade === "A" || result.artwork.gradeLabel === "director-focus") {
    return "director-focus";
  }
  return "static-frame";
}

function inferDisplayCategory(result: WebSearchResult["results"][number]): ExperienceUnit["displayCategory"] {
  if (isGalleryArtwork(result.artwork)) return "wall-painting";
  const source = [result.artwork.title, result.artwork.medium, result.artwork.department, ...result.artwork.subjectTags].filter(Boolean).join(" ").toLowerCase();
  if (/\b(architecture|architectural|building|church|cathedral|interior|portal|cloister)\b/.test(source)) return "architecture-flat";
  if (/\b(ceramic|porcelain|glass|vase|bowl|cup|jar|bronze|silver|gold|wood|ivory|sculpture|statue|figurine|terracotta|stoneware|earthenware|textile)\b/.test(source)) return "object-case";
  return "wall-painting";
}

function buildCaption(record: ExperienceArtworkRecord): NarrativeBlock {
  const { metadata } = record;
  const detail = metadata.descriptionClean?.trim() || metadata.storySnippet?.trim();
  // Release summaries sometimes contain collection/scoring notes, not public descriptions.
  if (detail && !/\bStrong\s+.+\s+fit with usable image and title signal\b/i.test(detail)) {
    const characters = Array.from(detail);
    return { text: characters.length > 180 ? `${characters.slice(0, 180).join("")}…` : detail, source: "grounded" };
  }
  const facts = [metadata.yearLabel && `年代：${metadata.yearLabel}`, metadata.medium && `媒材：${metadata.medium}`].filter(Boolean);
  return facts.length > 0
    ? { text: `${facts.join("；")}。可以从材料与画面细节开始观看。`, source: "grounded" }
    : { text: "先从这件作品的画面与材质开始观看。", source: "fallback" };
}

function buildRationale(tokens: string[], sceneLabel?: string): NarrativeBlock {
  const evidence = tokens.filter(Boolean).slice(0, 4);
  if (evidence.length > 0) {
    return { text: `检索线索：${evidence.join("、")}${sceneLabel ? `；所在展厅：${sceneLabel}` : ""}。`, source: "grounded" };
  }
  return { text: sceneLabel ? `这件作品安排在「${sceneLabel}」，可从画面本身开始停留。` : "可从作品本身开始停留，再决定观看的方向。", source: "fallback" };
}

function stageForArtwork(
  artworkId: string,
  stages: ExperienceStage[],
  artworkIdsByStage: Map<string, string[]>,
): string | null {
  return stages.find((stage) => artworkIdsByStage.get(stage.id)?.includes(artworkId))?.id ?? null;
}

export function buildExperienceSnapshot(input: {
  query: string;
  catalog: WebReleaseCatalog;
  search: WebSearchResult;
  narrative: CurationNarrative;
  route: GallerySceneRouteStop[];
}): ExhibitionSnapshot {
  const { catalog, search, narrative, query } = input;
  const quietJourney = parseViewingIntent(query).rest;
  const stages: ExperienceStage[] = narrative.growthForm.stages.map((stage) => ({
    id: stage.id,
    role: stage.role,
    label: quietJourney ? (stage.role === "threshold" ? "入场" : stage.role === "afterglow" ? "余韵" : "停留") : stageLabel(stage.label, stage.role),
    valence: stage.valence,
    arousal: stage.arousal,
    tension: stage.tension,
    wonder: stage.wonder,
    intimacy: stage.intimacy,
    intensity: quietJourney ? Math.min(stage.intensity, 0.35) : stage.intensity,
    transitionIntent: quietJourney ? "hold" : stage.transitionIntent,
  }));
  const artworkIdsByStage = new Map(narrative.growthForm.stages.map((stage) => [stage.id, stage.artworkIds]));
  const unitIds = new Set<string>();
  const artworkIds = new Set<string>();
  let omittedUnitCount = 0;

  const units: ExperienceUnit[] = search.results.flatMap((result, index) => {
    const record = catalog.artworkRecordById.get(result.artwork.id);
    if (!record) {
      omittedUnitCount += 1;
      return [];
    }

    const unitId = `unit-${record.id}`;
    if (unitIds.has(unitId) || artworkIds.has(record.id)) {
      throw new TypeError(`Duplicate experience unit reference: ${unitId}`);
    }
    unitIds.add(unitId);
    artworkIds.add(record.id);

    const stop = sceneRouteStopForIndex(input.route, index);
    const scene = (stop && catalog.backgroundSceneRecordById.get(stop.scene.id))
      ?? (result.scene && catalog.backgroundSceneRecordById.get(result.scene.id))
      ?? null;
    const sceneId = scene?.id ?? stop?.scene.id ?? result.scene?.id ?? "unavailable-scene";
    const last = index === search.results.length - 1;
    const exhibition: ExhibitionUnit = {
      unitId,
      artworkId: record.id,
      backgroundSceneId: sceneId,
      order: index,
      role: index === 0 ? "opening" : last ? "closing" : index % 3 === 0 ? "bridge" : "focus",
      displayMode: inferDisplayMode(result),
      transitionIn: {
        family: quietJourney ? "dissolve" : INTENT_FAMILY[stop?.transitionIntent ?? "fade"],
        durationMs: 1400,
        intensity: "moderate",
        implementationHint: "auto",
      },
    };
    const media = record.media;
    const caption = buildCaption(record);
    const rationale = buildRationale(result.matchedTokens, scene?.asset.label_cn ?? stop?.scene.label);

    return [{
      exhibition,
      artwork: record,
      scene,
      stageId: stageForArtwork(record.id, stages, artworkIdsByStage),
      caption,
      rationale,
      media: {
        previewUrl: artworkImageUrl(record.id, "preview", catalog.releaseVersion),
        fullUrl: artworkImageUrl(record.id, "full", catalog.releaseVersion),
        backgroundUrl: scene ? stop?.scene.imageUrl ?? result.scene?.imageUrl : undefined,
        depthMapUrl: media.depthMap?.version === catalog.releaseVersion
          && media.depthMap.sourceAssetFingerprint === media.sourceAssetFingerprint
          ? artworkImageUrl(record.id, "depth", catalog.releaseVersion)
          : undefined,
      },
      transitionFamily: quietJourney ? "dissolve" : INTENT_FAMILY[stop?.transitionIntent ?? "fade"],
      displayCategory: inferDisplayCategory(result),
      retrievalEvidence: { score: result.combinedScore, matchedTokens: result.matchedTokens },
    }];
  });

  for (const unit of units) {
    if (unit.exhibition.artworkId !== unit.artwork.id || unit.stageId && !stages.some((stage) => stage.id === unit.stageId)) {
      throw new TypeError(`Experience snapshot reference mismatch: ${unit.exhibition.unitId}`);
    }
  }

  const snapshotKey = `${catalog.releaseVersion}\nexperience-v1\n${query.trim()}`;
  const grounded = units.length > 0;
  const preface: NarrativeBlock = grounded
    ? { text: `${units.length} 件作品，点击画作可放大。`, source: "grounded" }
    : { text: "这次展览暂时没有可展示的作品。可以换一种说法，再重新策展。", source: "fallback" };
  const closing: NarrativeBlock = grounded
    ? { text: `${units.length} 件作品，看到这里。`, source: "grounded" }
    : { text: "这次没有可回看的作品。调整观看方向后，可以从新的展览重新开始。", source: "fallback" };

  return {
    schemaVersion: 1,
    recipeVersion: "experience-v1",
    releaseVersion: catalog.releaseVersion,
    exhibitionId: `ex-${stableHash(snapshotKey)}`,
    query,
    title: narrative.title,
    preface,
    closing,
    stages,
    units: sequenceExhibition(units),
    omittedUnitCount,
  };
}
