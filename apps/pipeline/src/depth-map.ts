import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import type { ArtworkDepthMapRef } from "@artduo/contracts";

export interface EstimateDepthMapOptions {
  inputImagePath: string;
  outputDepthMapPath: string;
  url: string;
  version: string;
  sourceAssetFingerprint: string;
}

export interface EstimateDepthMapResult {
  depthMap: ArtworkDepthMapRef;
  outputSha256: string;
  width: number;
  height: number;
}

function validateOptions(options: EstimateDepthMapOptions): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(options.version) || options.version === "." || options.version === "..") {
    throw new TypeError("Depth map version must be a safe release identifier");
  }
  if (!options.sourceAssetFingerprint.trim()) {
    throw new TypeError("A source artwork fingerprint is required");
  }
  const segments = options.url.replaceAll("\\", "/").split("/");
  if (options.url.startsWith("/") || options.url.includes("\\") || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new TypeError("Depth map URL must be a safe relative release path");
  }
  if (!options.inputImagePath || !options.outputDepthMapPath) {
    throw new TypeError("Input and output paths are required");
  }
}

function autocontrast(pixels: Buffer, cutoffRatio = 0.02): { pixels: Buffer; low: number; high: number } {
  const histogram = new Uint32Array(256);
  for (const value of pixels) histogram[value] = (histogram[value] ?? 0) + 1;
  const cutoff = Math.floor(pixels.length * cutoffRatio);
  let seen = 0;
  let low = 0;
  let high = 255;
  for (; low < 255; low += 1) {
    seen += histogram[low] ?? 0;
    if (seen > cutoff) break;
  }
  seen = 0;
  for (; high > 0; high -= 1) {
    seen += histogram[high] ?? 0;
    if (seen > cutoff) break;
  }
  const range = Math.max(1, high - low);
  const stretched = Buffer.allocUnsafe(pixels.length);
  for (let index = 0; index < pixels.length; index += 1) {
    stretched[index] = Math.max(0, Math.min(255, Math.round((((pixels[index] ?? 0) - low) / range) * 255)));
  }
  return { pixels: stretched, low, high };
}

/**
 * Produces an explicitly approximate depth field from an authorized source image.
 * The result is a presentation hint; it does not measure scene depth or replace
 * a model-generated depth map.
 */
export async function estimateDepthMapAsset(options: EstimateDepthMapOptions): Promise<EstimateDepthMapResult> {
  validateOptions(options);
  const inputPath = realpathSync(path.resolve(options.inputImagePath));
  if (!statSync(inputPath).isFile()) throw new TypeError("Input image path must point to a file");
  const outputPath = path.resolve(options.outputDepthMapPath);
  if (inputPath === outputPath) throw new TypeError("Depth map output must not overwrite the source image");

  const { data: grayscale, info } = await sharp(inputPath).rotate().greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  if (width < 2 || height < 2) throw new TypeError("Source image must be at least 2 by 2 pixels");

  const contrast = autocontrast(grayscale);
  const smallWidth = Math.min(width, 256);
  const smallHeight = Math.max(1, Math.round(height * (smallWidth / width)));
  const { data: small, info: smallInfo } = await sharp(contrast.pixels, {
    raw: { width, height, channels: 1 },
  }).resize(smallWidth, smallHeight, { kernel: "lanczos3" }).raw().toBuffer({ resolveWithObject: true });
  const depth = Buffer.allocUnsafe(small.length);
  const centerX = smallInfo.width / 2;
  const centerY = smallInfo.height / 2;
  const maximumRadius = Math.hypot(centerX, centerY) || 1;
  for (let y = 0; y < smallInfo.height; y += 1) {
    for (let x = 0; x < smallInfo.width; x += 1) {
      const index = y * smallInfo.width + x;
      const radius = Math.hypot(x - centerX, y - centerY) / maximumRadius;
      const centerBias = 255 * (1 - Math.min(1, radius));
      depth[index] = Math.round((small[index] ?? 0) * 0.75 + centerBias * 0.25);
    }
  }

  mkdirSync(path.dirname(outputPath), { recursive: true });
  await sharp(depth, { raw: { width: smallInfo.width, height: smallInfo.height, channels: 1 } })
    .resize(width, height, { kernel: "cubic" })
    .blur(Math.max(0.3, Math.max(width, height) / 40))
    .png()
    .toFile(outputPath);

  const outputBytes = readFileSync(outputPath);
  return {
    depthMap: {
      url: options.url,
      version: options.version,
      sourceAssetFingerprint: options.sourceAssetFingerprint,
      method: "estimated",
    },
    outputSha256: createHash("sha256").update(outputBytes).digest("hex"),
    width,
    height,
  };
}
