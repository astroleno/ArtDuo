import { expectObject, parseArray, readNumber, readObject, readString } from "./internal/validation";

export interface SourceVersions {
  corpusVersion: string;
  backgroundCatalogVersion: string;
  contractsVersion: string;
}

export interface ShardInfo {
  id: string;
  url: string;
  checksum: string;
  sizeBytes: number;
  recordCount: number;
}

export interface ImageEmbeddingManifestBinding {
  schemaVersion: "image-embedding-v1";
  baseManifestChecksum: string;
  promotionReportChecksum: string;
  promotionBindingChecksum: string;
  imageShardChecksum: string;
  model: string;
  modelRevision: string;
  modelVariant: string;
  modelArtifactChecksum: string;
  providerVersion: string;
  preprocessingFingerprint: string;
  visualPolicy: {
    candidateCount: number;
    weight: number;
    lowerCosine: number;
    upperCosine: number;
  };
}

export interface ReleaseManifest {
  release: SourceVersions & {
    createdAt: string;
  };
  shards: {
    metadata: ShardInfo[];
    search: ShardInfo[];
    mediaIndex: ShardInfo[];
    backgroundScenes: ShardInfo[];
    embeddings?: ShardInfo[];
    relationshipGraph?: ShardInfo[];
    imageEmbeddings?: ShardInfo[];
  };
  imageEmbeddingSidecar?: ImageEmbeddingManifestBinding;
}

const SHA256_CHECKSUM = /^sha256:[a-f0-9]{64}$/iu;

function fail(path: string, message: string): never {
  throw new TypeError(`${path}: ${message}`);
}

function parseChecksum(value: unknown, path: string): string {
  if (typeof value !== "string" || !SHA256_CHECKSUM.test(value)) {
    fail(path, "expected sha256 checksum");
  }

  return value;
}

function parseShardInfo(value: unknown, path: string): ShardInfo {
  const shard = expectObject(value, path);

  return {
    id: readString(shard, "id", path),
    url: readString(shard, "url", path),
    checksum: readString(shard, "checksum", path),
    sizeBytes: readNumber(shard, "sizeBytes", path),
    recordCount: readNumber(shard, "recordCount", path),
  };
}

function parseSourceVersions(value: unknown, path: string): ReleaseManifest["release"] {
  const release = expectObject(value, path);

  return {
    corpusVersion: readString(release, "corpusVersion", path),
    backgroundCatalogVersion: readString(release, "backgroundCatalogVersion", path),
    contractsVersion: readString(release, "contractsVersion", path),
    createdAt: readString(release, "createdAt", path),
  };
}

function parseImageEmbeddingManifestBinding(
  value: unknown,
  path: string,
  backgroundSceneRecordCount: number,
  imageEmbeddings: ShardInfo[],
): ImageEmbeddingManifestBinding {
  const binding = expectObject(value, path);
  const schemaVersion = readString(binding, "schemaVersion", path);
  if (schemaVersion !== "image-embedding-v1") {
    fail(`${path}.schemaVersion`, "must equal image-embedding-v1");
  }

  const visualPolicy = readObject(binding, "visualPolicy", path);
  const candidateCount = readNumber(visualPolicy, "candidateCount", `${path}.visualPolicy`);
  const weight = readNumber(visualPolicy, "weight", `${path}.visualPolicy`);
  const lowerCosine = readNumber(visualPolicy, "lowerCosine", `${path}.visualPolicy`);
  const upperCosine = readNumber(visualPolicy, "upperCosine", `${path}.visualPolicy`);

  if (!Number.isInteger(candidateCount) || candidateCount <= 0 || candidateCount > backgroundSceneRecordCount) {
    fail(
      `${path}.visualPolicy.candidateCount`,
      `candidateCount must be a positive integer no greater than ${backgroundSceneRecordCount}`,
    );
  }
  if (!Number.isFinite(weight) || weight < 0 || weight > 0.3) {
    fail(`${path}.visualPolicy.weight`, "weight must be between 0 and 0.3");
  }
  if (!Number.isFinite(lowerCosine) || !Number.isFinite(upperCosine) || upperCosine <= lowerCosine) {
    fail(`${path}.visualPolicy.upperCosine`, "upperCosine must be greater than lowerCosine");
  }

  const imageShardChecksum = parseChecksum(binding.imageShardChecksum, `${path}.imageShardChecksum`);
  if (!imageEmbeddings.some((shard) => shard.checksum === imageShardChecksum)) {
    fail(`${path}.imageShardChecksum`, "must match an imageEmbeddings shard checksum");
  }

  return {
    schemaVersion: "image-embedding-v1",
    baseManifestChecksum: parseChecksum(binding.baseManifestChecksum, `${path}.baseManifestChecksum`),
    promotionReportChecksum: parseChecksum(binding.promotionReportChecksum, `${path}.promotionReportChecksum`),
    promotionBindingChecksum: parseChecksum(binding.promotionBindingChecksum, `${path}.promotionBindingChecksum`),
    imageShardChecksum,
    model: readString(binding, "model", path),
    modelRevision: readString(binding, "modelRevision", path),
    modelVariant: readString(binding, "modelVariant", path),
    modelArtifactChecksum: parseChecksum(binding.modelArtifactChecksum, `${path}.modelArtifactChecksum`),
    providerVersion: readString(binding, "providerVersion", path),
    preprocessingFingerprint: parseChecksum(binding.preprocessingFingerprint, `${path}.preprocessingFingerprint`),
    visualPolicy: {
      candidateCount,
      weight,
      lowerCosine,
      upperCosine,
    },
  };
}

export function parseReleaseManifest(value: unknown, path = "ReleaseManifest"): ReleaseManifest {
  const manifest = expectObject(value, path);
  const shards = readObject(manifest, "shards", path);
  const embeddings = (shards as { embeddings?: unknown }).embeddings;
  const relationshipGraph = (shards as { relationshipGraph?: unknown }).relationshipGraph;
  const imageEmbeddingsValue = (shards as { imageEmbeddings?: unknown }).imageEmbeddings;
  const imageEmbeddingSidecarValue = manifest.imageEmbeddingSidecar;
  const backgroundScenes = parseArray(
    shards.backgroundScenes,
    (entry, entryPath) => parseShardInfo(entry, entryPath),
    `${path}.shards.backgroundScenes`,
  );
  const imageEmbeddings = imageEmbeddingsValue === undefined
    ? undefined
    : parseArray(
      imageEmbeddingsValue,
      (entry, entryPath) => parseShardInfo(entry, entryPath),
      `${path}.shards.imageEmbeddings`,
    );

  if ((imageEmbeddings === undefined) !== (imageEmbeddingSidecarValue === undefined)) {
    fail(path, "imageEmbeddings and imageEmbeddingSidecar must appear together");
  }

  const imageEmbeddingSidecar = imageEmbeddings && imageEmbeddingSidecarValue !== undefined
    ? parseImageEmbeddingManifestBinding(
      imageEmbeddingSidecarValue,
      `${path}.imageEmbeddingSidecar`,
      backgroundScenes.reduce((count, shard) => count + shard.recordCount, 0),
      imageEmbeddings,
    )
    : undefined;

  return {
    release: parseSourceVersions(readObject(manifest, "release", path), `${path}.release`),
    shards: {
      metadata: parseArray(shards.metadata, (entry, entryPath) => parseShardInfo(entry, entryPath), `${path}.shards.metadata`),
      search: parseArray(shards.search, (entry, entryPath) => parseShardInfo(entry, entryPath), `${path}.shards.search`),
      mediaIndex: parseArray(shards.mediaIndex, (entry, entryPath) => parseShardInfo(entry, entryPath), `${path}.shards.mediaIndex`),
      backgroundScenes,
      embeddings: embeddings
        ? parseArray(embeddings, (entry, entryPath) => parseShardInfo(entry, entryPath), `${path}.shards.embeddings`)
        : undefined,
      relationshipGraph: relationshipGraph
        ? parseArray(
            relationshipGraph,
            (entry, entryPath) => parseShardInfo(entry, entryPath),
            `${path}.shards.relationshipGraph`,
        )
        : undefined,
      imageEmbeddings,
    },
    imageEmbeddingSidecar,
  };
}
