import path from "node:path";

import type { ReleaseBuildOptions } from "./release-artifact";
import type { ReleaseReadyBuildOptions } from "./release-ready-corpus";

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
  const corpusPath = readFlag("--corpus-path");
  const corpusVersion = readFlag("--release-version");
  const backgroundCatalogVersion = readFlag("--background-version");
  const contractsVersion = readFlag("--contracts-version");
  const limitValue = readFlag("--limit");
  const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;

  return {
    rootDir: rootDir ? path.resolve(rootDir) : undefined,
    outputRoot: outputRoot ? path.resolve(outputRoot) : undefined,
    corpusPath: corpusPath ? path.resolve(corpusPath) : undefined,
    corpusVersion,
    backgroundCatalogVersion,
    contractsVersion,
    limit: Number.isFinite(limit) ? limit : undefined,
  };
}

export function readReleaseReadyBuildOptions(): ReleaseReadyBuildOptions {
  const rootDir = readFlag("--root-dir");
  const confirmedRoot = readFlag("--confirmed-root");
  const outputRoot = readFlag("--output-root");
  const reportRoot = readFlag("--report-root");
  const inputPath = readFlag("--input");
  const corpusVersion = readFlag("--corpus-version");

  return {
    rootDir: rootDir ? path.resolve(rootDir) : undefined,
    confirmedRoot: confirmedRoot ? path.resolve(confirmedRoot) : undefined,
    outputRoot: outputRoot ? path.resolve(outputRoot) : undefined,
    reportRoot: reportRoot ? path.resolve(reportRoot) : undefined,
    inputPath: inputPath ? path.resolve(inputPath) : undefined,
    corpusVersion,
  };
}
