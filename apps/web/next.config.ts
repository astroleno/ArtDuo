import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingRoot: resolve(appDirectory, "../.."),
  transpilePackages: ["@artduo/contracts", "@artduo/corpus"],
  webpack(config) {
    if (process.env.ARTDUO_DISABLE_BUILD_CACHE === "1") config.cache = false;
    return config;
  },
};

export default nextConfig;
