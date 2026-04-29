import { expectObject, readLiteral, readOptionalString, readString } from "./internal/validation";

export const EXPLANATION_STATUSES = ["pending", "ready", "failed"] as const;

export type ArtworkExplanationStatus = (typeof EXPLANATION_STATUSES)[number];

export interface ArtworkExplanationContent {
  title: string;
  shortText: string;
  detailText: string;
  generatedAt: string;
  model?: string;
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

function parseArtworkExplanationContent(value: unknown, path: string): ArtworkExplanationContent {
  const content = expectObject(value, path);

  return {
    title: readString(content, "title", path),
    shortText: readString(content, "shortText", path),
    detailText: readString(content, "detailText", path),
    generatedAt: readString(content, "generatedAt", path),
    model: readOptionalString(content, "model", path),
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
