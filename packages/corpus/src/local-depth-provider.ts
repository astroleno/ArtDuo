// Offline-only model adapter. Never imported by the browser or request path.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

export const LOCAL_DEPTH_MODEL = {
  id: "Xenova/depth-anything-small-hf",
  revision: "2e942621ab9f2371c1df9eb223291b5ac31475e6",
  weightsSha256: "e4e2ffe9b0396ebd4a0c09b855762b186aab338e79f76531b09777aafc91db84",
  license: "Apache-2.0",
  source: "https://huggingface.co/LiheYoung/depth-anything-small-hf",
  representation: "relative-inverse-depth; lighter is nearer; no metric units",
} as const;

export interface DepthPrediction { values: Float32Array; width: number; height: number }
export interface DepthEstimator { predict(imagePath: string): Promise<DepthPrediction>; dispose(): Promise<void> }

export async function createLocalDepthEstimator(rootDir: string): Promise<DepthEstimator> {
  const { env, AutoConfig, AutoProcessor, DepthAnythingForDepthEstimation, RawImage } = await import("@xenova/transformers");
  const { InferenceSession } = await import("onnxruntime-node");
  env.cacheDir = path.join(rootDir, ".cache/artduo-models");
  const modelFile = path.join(env.cacheDir, LOCAL_DEPTH_MODEL.id, LOCAL_DEPTH_MODEL.revision, "onnx/model_quantized.onnx");
  if (createHash("sha256").update(readFileSync(modelFile)).digest("hex") !== LOCAL_DEPTH_MODEL.weightsSha256) throw new TypeError("Depth model weights failed integrity verification");
  const options = { revision: LOCAL_DEPTH_MODEL.revision, local_files_only: true };
  const [config, processor] = await Promise.all([
    AutoConfig.from_pretrained(LOCAL_DEPTH_MODEL.id, options), AutoProcessor.from_pretrained(LOCAL_DEPTH_MODEL.id, options),
  ]);
  // Museum images have many different aspect ratios. Retaining allocation patterns
  // for every dynamic input shape can grow the batch working set without bound.
  const session = await InferenceSession.create(modelFile, { executionProviders: ["cpu"], intraOpNumThreads: 2, interOpNumThreads: 1,
    enableMemPattern: false, enableCpuMemArena: false });
  const model = new DepthAnythingForDepthEstimation(config, session);
  return {
    async predict(imagePath) {
      let image = await RawImage.read(imagePath);
      // Preserve the complete image while bounding attention memory for panoramas.
      const scale = Math.min(1, 768 / Math.max(image.width, image.height));
      if (scale < 1) image = await image.resize(Math.max(2, Math.round(image.width * scale)), Math.max(2, Math.round(image.height * scale)));
      const inputs = await processor(image);
      const output = await model(inputs);
      const prediction = output.predicted_depth;
      const [height, width] = prediction.dims.slice(-2);
      const values = Float32Array.from(prediction.data as Float32Array);
      if (values.length !== width * height || values.some((value) => !Number.isFinite(value))) throw new TypeError("Depth model returned invalid pixels");
      return { values, width, height };
    },
    async dispose() { await model.dispose(); },
  };
}
