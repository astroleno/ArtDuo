import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeAppBasePath } from "@artduo/contracts";

const appDirectory = dirname(fileURLToPath(import.meta.url));
const basePath = normalizeAppBasePath(process.env.ARTDUO_BASE_PATH ?? process.env.NEXT_PUBLIC_ARTDUO_BASE_PATH ?? "");

const nextConfig: NextConfig = {
  devIndicators: false,
  basePath,
  env: { NEXT_PUBLIC_ARTDUO_BASE_PATH: basePath },
  distDir: process.env.ARTDUO_DIST_DIR || ".next",
  outputFileTracingRoot: resolve(appDirectory, "../.."),
  transpilePackages: ["@artduo/contracts", "@artduo/corpus"],
  serverExternalPackages: ["@xenova/transformers", "onnxruntime-node", "sharp"],
  webpack(config) {
    if (process.env.ARTDUO_DISABLE_BUILD_CACHE === "1") config.cache = false;
    return config;
  },
};

export default nextConfig;
