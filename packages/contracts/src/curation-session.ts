import {
  expectObject,
  parseArray,
  readLiteral,
  readNumber,
  readOptionalString,
  readString,
  readStringArray,
} from "./internal/validation";

export const SESSION_STATUSES = ["pending", "partial", "ready", "failed"] as const;

export type CurationSessionStatus = (typeof SESSION_STATUSES)[number];

export interface SourceVersions {
  corpusVersion: string;
  backgroundCatalogVersion: string;
  contractsVersion: string;
}

export interface ExhibitionSnapshotUnit {
  unitId: string;
  artworkId: string;
  backgroundSceneId?: string;
  rank: number;
  score: number;
}

export interface CreateCurationRequest {
  userText: string;
  releaseVersion: string;
  sourceVersions: SourceVersions;
  exhibitionSnapshot: ExhibitionSnapshotUnit[];
}

export interface OwnershipToken {
  token: string;
  expiresAt: string;
}

export interface CurationSession {
  id: string;
  status: CurationSessionStatus;
  releaseVersion: string;
  sourceVersions: SourceVersions;
  unitIds: string[];
  ownership: OwnershipToken;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export function parseSourceVersions(value: unknown, path: string): SourceVersions {
  const sourceVersions = expectObject(value, path);

  return {
    corpusVersion: readString(sourceVersions, "corpusVersion", path),
    backgroundCatalogVersion: readString(sourceVersions, "backgroundCatalogVersion", path),
    contractsVersion: readString(sourceVersions, "contractsVersion", path),
  };
}

function parseExhibitionSnapshotUnit(value: unknown, path: string): ExhibitionSnapshotUnit {
  const unit = expectObject(value, path);

  return {
    unitId: readString(unit, "unitId", path),
    artworkId: readString(unit, "artworkId", path),
    backgroundSceneId: readOptionalString(unit, "backgroundSceneId", path),
    rank: readNumber(unit, "rank", path),
    score: readNumber(unit, "score", path),
  };
}

function parseOwnershipToken(value: unknown, path: string): OwnershipToken {
  const ownership = expectObject(value, path);

  return {
    token: readString(ownership, "token", path),
    expiresAt: readString(ownership, "expiresAt", path),
  };
}

export function parseCreateCurationRequest(value: unknown, path = "CreateCurationRequest"): CreateCurationRequest {
  const request = expectObject(value, path);

  return {
    userText: readString(request, "userText", path),
    releaseVersion: readString(request, "releaseVersion", path),
    sourceVersions: parseSourceVersions(request.sourceVersions, `${path}.sourceVersions`),
    exhibitionSnapshot: parseArray(
      request.exhibitionSnapshot,
      (entry, entryPath) => parseExhibitionSnapshotUnit(entry, entryPath),
      `${path}.exhibitionSnapshot`,
    ),
  };
}

export function parseCurationSession(value: unknown, path = "CurationSession"): CurationSession {
  const session = expectObject(value, path);

  return {
    id: readString(session, "id", path),
    status: readLiteral(session, "status", SESSION_STATUSES, path),
    releaseVersion: readString(session, "releaseVersion", path),
    sourceVersions: parseSourceVersions(session.sourceVersions, `${path}.sourceVersions`),
    unitIds: readStringArray(session, "unitIds", path),
    ownership: parseOwnershipToken(session.ownership, `${path}.ownership`),
    createdAt: readString(session, "createdAt", path),
    updatedAt: readString(session, "updatedAt", path),
    error: readOptionalString(session, "error", path),
  };
}
