import { createHash } from "node:crypto";

import type { ImageEmbeddingEntityType } from "@artduo/contracts";

export const IMAGE_MODEL_ID = "Xenova/clip-vit-base-patch32";
export const IMAGE_MODEL_REVISION = "d15189d7028b43f1d3e65039190477f6af591c2a";
export const IMAGE_MODEL_VARIANT = "quantized";
export const IMAGE_MODEL_ARTIFACT = "onnx/vision_model_quantized.onnx";
export const IMAGE_MODEL_ARTIFACT_SHA256 = "sha256:583fd1110a514667812fee7d684952aaf82a99b959760c8d7dca7e0ab9839299";
export const IMAGE_PROVIDER_VERSION = "2.17.2";
export const IMAGE_EMBEDDING_DIMENSIONS = 512;
export const IMAGE_VECTOR_PRECISION = 8;
export const IMAGE_PREPROCESSING_VERSION = "clip-vit-base-patch32-image-preprocess.v1";
export const IMAGE_PREPROCESSING_FINGERPRINT = `sha256:${createHash("sha256")
  .update(JSON.stringify({
    model: IMAGE_MODEL_ID,
    revision: IMAGE_MODEL_REVISION,
    variant: IMAGE_MODEL_VARIANT,
    artifact: IMAGE_MODEL_ARTIFACT,
    vectorPrecision: IMAGE_VECTOR_PRECISION,
    preprocessingVersion: IMAGE_PREPROCESSING_VERSION,
  }))
  .digest("hex")}`;

export interface ImageEmbeddingInput {
  entityType: ImageEmbeddingEntityType;
  entityId: string;
  bytes: Uint8Array;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}

export interface EmbeddedImageVector {
  model: string;
  modelRevision: string;
  modelVariant: string;
  modelArtifactChecksum: string;
  providerVersion: string;
  dimensions: number;
  preprocessingVersion: string;
  preprocessingFingerprint: string;
  vector: number[];
}

export interface ImageEmbeddingProvider {
  readonly mode: "local-transformers";
  readonly model: string;
  readonly modelRevision: string;
  readonly modelVariant: string;
  readonly modelArtifactChecksum: string;
  embedImages(inputs: ImageEmbeddingInput[]): Promise<EmbeddedImageVector[]>;
}

export interface ImageEmbeddingRuntime {
  rawImageFromBlob(blob: Blob): Promise<unknown>;
  createImageFeatureExtractor(): Promise<(images: unknown[]) => Promise<{ data: ArrayLike<number> }>>;
}

export interface CreateImageEmbeddingProviderOptions {
  runtimeLoader?: () => Promise<ImageEmbeddingRuntime>;
}

function normalizeVector(values: ArrayLike<number>): number[] {
  if (values.length !== IMAGE_EMBEDDING_DIMENSIONS) {
    throw new Error(`Image embedding provider returned ${values.length} dimensions; expected ${IMAGE_EMBEDDING_DIMENSIONS}.`);
  }
  const raw = Array.from(values, Number);
  if (raw.some((entry) => !Number.isFinite(entry))) {
    throw new Error("Image embedding provider returned a non-finite vector.");
  }
  const norm = Math.hypot(...raw);
  if (!Number.isFinite(norm) || norm === 0) {
    throw new Error("Image embedding provider returned a zero-norm vector.");
  }
  const vector = raw.map((entry) => Number((entry / norm).toFixed(IMAGE_VECTOR_PRECISION)));
  const normalizedNorm = Math.hypot(...vector);
  if (!Number.isFinite(normalizedNorm) || Math.abs(normalizedNorm - 1) > 1e-4) {
    throw new Error("Image embedding provider normalization check failed.");
  }
  return vector;
}

async function loadTransformersRuntime(): Promise<ImageEmbeddingRuntime> {
  const transformers = await import("@xenova/transformers");
  return {
    rawImageFromBlob: (blob) => transformers.RawImage.fromBlob(blob),
    async createImageFeatureExtractor() {
      const extractor = await transformers.pipeline("image-feature-extraction", IMAGE_MODEL_ID, {
        revision: IMAGE_MODEL_REVISION,
        quantized: true,
        model_file_name: "vision_model",
      });
      return async (images) => extractor(images as never) as Promise<{ data: ArrayLike<number> }>;
    },
  };
}

export function createTransformersImageEmbeddingProvider(
  options: CreateImageEmbeddingProviderOptions = {},
): ImageEmbeddingProvider {
  let runtimePromise: Promise<ImageEmbeddingRuntime> | undefined;
  let extractorPromise: Promise<(images: unknown[]) => Promise<{ data: ArrayLike<number> }>> | undefined;
  const runtimeLoader = options.runtimeLoader ?? loadTransformersRuntime;

  async function getRuntime(): Promise<ImageEmbeddingRuntime> {
    runtimePromise ??= runtimeLoader();
    return runtimePromise;
  }

  async function getExtractor(): Promise<(images: unknown[]) => Promise<{ data: ArrayLike<number> }>> {
    if (!extractorPromise) {
      extractorPromise = getRuntime().then((runtime) => runtime.createImageFeatureExtractor());
    }
    return extractorPromise;
  }

  return {
    mode: "local-transformers",
    model: IMAGE_MODEL_ID,
    modelRevision: IMAGE_MODEL_REVISION,
    modelVariant: IMAGE_MODEL_VARIANT,
    modelArtifactChecksum: IMAGE_MODEL_ARTIFACT_SHA256,
    async embedImages(inputs: ImageEmbeddingInput[]): Promise<EmbeddedImageVector[]> {
      if (inputs.length === 0) {
        return [];
      }
      const runtime = await getRuntime();
      const images = await Promise.all(inputs.map((input) =>
        runtime.rawImageFromBlob(new Blob([input.bytes], { type: input.mediaType })),
      ));
      const output = await (await getExtractor())(images);
      if (output.data.length % IMAGE_EMBEDDING_DIMENSIONS !== 0) {
        throw new Error("Image embedding provider returned an invalid tensor shape.");
      }
      const vectorCount = output.data.length / IMAGE_EMBEDDING_DIMENSIONS;
      if (vectorCount !== inputs.length) {
        throw new Error(`Image embedding provider returned ${vectorCount} vectors for ${inputs.length} inputs.`);
      }

      const values = Array.from(output.data, Number);
      return inputs.map((_, index) => ({
        model: IMAGE_MODEL_ID,
        modelRevision: IMAGE_MODEL_REVISION,
        modelVariant: IMAGE_MODEL_VARIANT,
        modelArtifactChecksum: IMAGE_MODEL_ARTIFACT_SHA256,
        providerVersion: IMAGE_PROVIDER_VERSION,
        dimensions: IMAGE_EMBEDDING_DIMENSIONS,
        preprocessingVersion: IMAGE_PREPROCESSING_VERSION,
        preprocessingFingerprint: IMAGE_PREPROCESSING_FINGERPRINT,
        vector: normalizeVector(values.slice(index * IMAGE_EMBEDDING_DIMENSIONS, (index + 1) * IMAGE_EMBEDDING_DIMENSIONS)),
      }));
    },
  };
}
