import type { SemanticIndex, SemanticModelIdentity } from "@artduo/contracts";
import { sameSemanticSpace, semanticFingerprint } from "./semantic-index";

export const SEMANTIC_OBSERVATION_TEXT_VERSION = "local-image-observation-v1";

export interface SemanticObservationSource {
  artworkId: string;
  imageSha256: string;
  observation: string;
}

export interface SemanticObservationProvenance {
  releaseVersion: string;
  releaseManifestSha256: string;
  museumIndexChecksum: string;
  visualLedgerSha256: string;
  visualEvidenceVersion: string;
}

interface ObservationRecord {
  artworkId: string;
  imageSha256: string;
  textSha256: string;
  vector: number[];
}

interface ObservationPayload {
  schemaVersion: 1;
  textVersion: typeof SEMANTIC_OBSERVATION_TEXT_VERSION;
  provenance: SemanticObservationProvenance;
  model: SemanticModelIdentity;
  records: ObservationRecord[];
}

interface ObservationFile {
  checksum: string;
  payload: ObservationPayload;
}

function fingerprintRows(sources: SemanticObservationSource[], museumIndex: SemanticIndex) {
  const byId = new Map(sources.map(source => [source.artworkId, source]));
  if (byId.size !== sources.length || new Set(museumIndex.records.map(row => row.artworkId)).size !== museumIndex.records.length) {
    throw new TypeError("Observation index requires unique artwork IDs");
  }
  const ordered = museumIndex.records.flatMap(({ artworkId }) => {
    const source = byId.get(artworkId);
    if (!source) return [];
    if (!/^sha256:[a-f0-9]{64}$/u.test(source.imageSha256) || !source.observation.trim()) throw new TypeError("Invalid reviewed observation source");
    return [{ artworkId, imageSha256: source.imageSha256, textSha256: semanticFingerprint(source.observation), observation: source.observation }];
  });
  if (ordered.length !== byId.size) throw new TypeError("Observation artwork is outside the museum index");
  return ordered;
}

interface ObservationIndexInput {
  sources: SemanticObservationSource[];
  museumIndex: SemanticIndex;
  provenance: SemanticObservationProvenance;
}

export async function buildSemanticObservationIndex(input: ObservationIndexInput, encoder: {
  model: SemanticModelIdentity;
  embedDocuments: (texts: string[]) => Promise<number[][]>;
}): Promise<ObservationFile> {
  if (!sameSemanticSpace(input.museumIndex.model, encoder.model)) throw new TypeError("Observation and museum encoders differ");
  const source = fingerprintRows(input.sources, input.museumIndex);
  const records: ObservationRecord[] = [];
  // Small batches retain the original observation, including any qualifying
  // or negative language, without assembling a release-sized second index.
  for (let offset = 0; offset < source.length; offset += 8) {
    const batch = source.slice(offset, offset + 8);
    const vectors = await encoder.embedDocuments(batch.map(row => row.observation));
    if (vectors.length !== batch.length) throw new TypeError("Observation encoder count mismatch");
    records.push(...batch.map(({ observation: _, ...row }, index) => ({ ...row, vector: vectors[index]! })));
  }
  const payload: ObservationPayload = { schemaVersion: 1, textVersion: SEMANTIC_OBSERVATION_TEXT_VERSION,
    provenance: input.provenance, model: { ...encoder.model }, records };
  const file = { checksum: semanticFingerprint(JSON.stringify(payload)), payload };
  validateSemanticObservationIndex(file, input);
  return file;
}

export function validateSemanticObservationIndex(value: unknown, input: ObservationIndexInput): {
  checksum: string;
  vectors: ReadonlyMap<string, readonly number[]>;
} {
  const { checksum, payload } = (value ?? {}) as Partial<ObservationFile>;
  if (!payload || payload.schemaVersion !== 1 || payload.textVersion !== SEMANTIC_OBSERVATION_TEXT_VERSION
    || !payload.model || !sameSemanticSpace(payload.model, input.museumIndex.model) || !Array.isArray(payload.records)
    || (!checksum || checksum !== semanticFingerprint(JSON.stringify(payload)))) throw new TypeError("Invalid observation index checksum or identity");
  if (!payload.provenance || input.museumIndex.releaseVersion !== input.provenance.releaseVersion
    || (Object.keys(input.provenance) as (keyof SemanticObservationProvenance)[]).some(key => payload.provenance[key] !== input.provenance[key])) {
    throw new TypeError("Observation index is from another release or evidence version");
  }
  const source = fingerprintRows(input.sources, input.museumIndex);
  if (source.length !== payload.records.length) throw new TypeError("Observation index coverage mismatch");
  const vectors = new Map<string, readonly number[]>();
  source.forEach((expected, index) => {
    const row = payload.records[index];
    if (!row || row.artworkId !== expected.artworkId || row.imageSha256 !== expected.imageSha256 || row.textSha256 !== expected.textSha256
      || !Array.isArray(row.vector) || row.vector.length !== payload.model.dimensions
      || row.vector.some(value => !Number.isFinite(value)) || Math.abs(Math.hypot(...row.vector) - 1) > 1e-5) {
      throw new TypeError(`Invalid observation index row for ${expected.artworkId}`);
    }
    vectors.set(row.artworkId, row.vector);
  });
  return { checksum, vectors };
}
