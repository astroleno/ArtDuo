import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: ["@artduo/contracts", "@artduo/corpus"],
};

export default nextConfig;
