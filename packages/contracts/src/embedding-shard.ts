import { ARTWORK_SOURCES, GRADE_VALUES, type ArtworkGrade, type ArtworkSource } from "./artwork";
import { expectObject, parseArray, readLiteral, readNumber, readOptionalString, readString, readStringArray } from "./internal/validation";

export interface EmbeddingShardRecord {
  id: string;
  source: ArtworkSource;
  sourceArtworkId: string;
  version: string;
  theme: string;
  model: string;
  dimensions: number;
  title: string;
  artistDisplayName?: string;
  grade: ArtworkGrade;
  moodTags: string[];
  text: string;
  tokenCount: number;
  vector: number[];
}

export function parseEmbeddingShardRecord(value: unknown, path = "EmbeddingShardRecord"): EmbeddingShardRecord {
  const record = expectObject(value, path);

  return {
    id: readString(record, "id", path),
    source: readLiteral(record, "source", ARTWORK_SOURCES, path),
    sourceArtworkId: readString(record, "sourceArtworkId", path),
    version: readString(record, "version", path),
    theme: readString(record, "theme", path),
    model: readString(record, "model", path),
    dimensions: readNumber(record, "dimensions", path),
    title: readString(record, "title", path),
    artistDisplayName: readOptionalString(record, "artistDisplayName", path),
    grade: readLiteral(record, "grade", GRADE_VALUES, path),
    moodTags: readStringArray(record, "moodTags", path),
    text: readString(record, "text", path),
    tokenCount: readNumber(record, "tokenCount", path),
    vector: parseArray(record.vector, (entry, entryPath) => readNumber({ value: entry }, "value", entryPath), `${path}.vector`),
  };
}

export function parseEmbeddingShardRecords(value: unknown, path = "EmbeddingShardRecord[]"): EmbeddingShardRecord[] {
  return parseArray(value, (entry, entryPath) => parseEmbeddingShardRecord(entry, entryPath), path);
}
