import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 设置工作区根目录，解决多lockfiles警告
  outputFileTracingRoot: __dirname,
  /* config options here */
};

export default nextConfig;
