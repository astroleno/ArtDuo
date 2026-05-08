import {
  expectObject,
  parseArray,
  readNumber,
  readLiteral,
  readOptionalObject,
  readOptionalString,
  readString,
  readStringArray,
} from "./internal/validation";
import { parseSourceVersions, type SourceVersions } from "./curation-session";

export const EXPLANATION_STATUSES = ["pending", "ready", "failed"] as const;
export const EXPLANATION_CITATION_KINDS = ["user-intent", "artwork", "scene", "release", "retrieval"] as const;

export type ArtworkExplanationStatus = (typeof EXPLANATION_STATUSES)[number];
export type ArtworkExplanationCitationKind = (typeof EXPLANATION_CITATION_KINDS)[number];

export interface GroundingArtwork {
  id: string;
  title: string;
  artistDisplayName?: string;
  yearLabel?: string;
  objectUrl?: string;
  sourceApiUrl?: string;
}

export interface GroundingScene {
  id: string;
  label: string;
  imageUrl?: string;
}

export interface GroundingContext {
  userText: string;
  releaseVersion: string;
  artwork: GroundingArtwork;
  scene?: GroundingScene;
  retrievalScore: number;
  matchedTokens: string[];
  sourceVersions: SourceVersions;
}

export interface ArtworkExplanationCitation {
  kind: ArtworkExplanationCitationKind;
  sourceId: string;
  label: string;
  text?: string;
  url?: string;
}

export interface ArtworkExplanationEvidence {
  grounding: GroundingContext;
  citations: ArtworkExplanationCitation[];
}

export interface ArtworkExplanationContent {
  title: string;
  shortText: string;
  detailText: string;
  generatedAt: string;
  model?: string;
  evidence: ArtworkExplanationEvidence;
}

export interface ArtworkExplanation {
  artworkId: string;
  releaseVersion: string;
  status: ArtworkExplanationStatus;
  content?: ArtworkExplanationContent;
  error?: string;
  cacheKey: string;
  updatedAt: string;
}

function parseGroundingArtwork(value: unknown, path: string): GroundingArtwork {
  const artwork = expectObject(value, path);

  return {
    id: readString(artwork, "id", path),
    title: readString(artwork, "title", path),
    artistDisplayName: readOptionalString(artwork, "artistDisplayName", path),
    yearLabel: readOptionalString(artwork, "yearLabel", path),
    objectUrl: readOptionalString(artwork, "objectUrl", path),
    sourceApiUrl: readOptionalString(artwork, "sourceApiUrl", path),
  };
}

function parseGroundingScene(value: unknown, path: string): GroundingScene {
  const scene = expectObject(value, path);

  return {
    id: readString(scene, "id", path),
    label: readString(scene, "label", path),
    imageUrl: readOptionalString(scene, "imageUrl", path),
  };
}

export function parseGroundingContext(value: unknown, path = "GroundingContext"): GroundingContext {
  const grounding = expectObject(value, path);
  const scene = readOptionalObject(grounding, "scene", path);

  return {
    userText: readString(grounding, "userText", path),
    releaseVersion: readString(grounding, "releaseVersion", path),
    artwork: parseGroundingArtwork(grounding.artwork, `${path}.artwork`),
    scene: scene ? parseGroundingScene(scene, `${path}.scene`) : undefined,
    retrievalScore: readNumber(grounding, "retrievalScore", path),
    matchedTokens: readStringArray(grounding, "matchedTokens", path),
    sourceVersions: parseSourceVersions(grounding.sourceVersions, `${path}.sourceVersions`),
  };
}

function parseArtworkExplanationCitation(value: unknown, path: string): ArtworkExplanationCitation {
  const citation = expectObject(value, path);

  return {
    kind: readLiteral(citation, "kind", EXPLANATION_CITATION_KINDS, path),
    sourceId: readString(citation, "sourceId", path),
    label: readString(citation, "label", path),
    text: readOptionalString(citation, "text", path),
    url: readOptionalString(citation, "url", path),
  };
}

function parseArtworkExplanationEvidence(value: unknown, path: string): ArtworkExplanationEvidence {
  const evidence = expectObject(value, path);
  const citations = parseArray(
    evidence.citations,
    (entry, entryPath) => parseArtworkExplanationCitation(entry, entryPath),
    `${path}.citations`,
  );

  if (citations.length === 0) {
    throw new TypeError(`${path}.citations: expected at least one citation`);
  }

  return {
    grounding: parseGroundingContext(evidence.grounding, `${path}.grounding`),
    citations,
  };
}

function parseArtworkExplanationContent(value: unknown, path: string): ArtworkExplanationContent {
  const content = expectObject(value, path);

  return {
    title: readString(content, "title", path),
    shortText: readString(content, "shortText", path),
    detailText: readString(content, "detailText", path),
    generatedAt: readString(content, "generatedAt", path),
    model: readOptionalString(content, "model", path),
    evidence: parseArtworkExplanationEvidence(content.evidence, `${path}.evidence`),
  };
}

export function parseArtworkExplanation(value: unknown, path = "ArtworkExplanation"): ArtworkExplanation {
  const explanation = expectObject(value, path);

  const status = readLiteral(explanation, "status", EXPLANATION_STATUSES, path);
  const parsed: ArtworkExplanation = {
    artworkId: readString(explanation, "artworkId", path),
    releaseVersion: readString(explanation, "releaseVersion", path),
    status,
    cacheKey: readString(explanation, "cacheKey", path),
    updatedAt: readString(explanation, "updatedAt", path),
    error: readOptionalString(explanation, "error", path),
  };

  if (explanation.content !== undefined) {
    parsed.content = parseArtworkExplanationContent(explanation.content, `${path}.content`);
  }

  return parsed;
}
