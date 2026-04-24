import path from "node:path";

import type { ReleaseBuildOptions } from "./release-artifact";

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

export function readReleaseBuildOptions(): ReleaseBuildOptions {
  const rootDir = readFlag("--root-dir");
  const outputRoot = readFlag("--output-root");
  const corpusVersion = readFlag("--release-version");
  const backgroundCatalogVersion = readFlag("--background-version");
  const contractsVersion = readFlag("--contracts-version");
  const limitValue = readFlag("--limit");
  const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;

  return {
    rootDir: rootDir ? path.resolve(rootDir) : undefined,
    outputRoot: outputRoot ? path.resolve(outputRoot) : undefined,
    corpusVersion,
    backgroundCatalogVersion,
    contractsVersion,
    limit: Number.isFinite(limit) ? limit : undefined,
  };
}
