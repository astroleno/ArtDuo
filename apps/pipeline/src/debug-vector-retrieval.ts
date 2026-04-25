import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { loadEmbeddingShards, runRetrievalDebug } from "@artduo/corpus";

import { readVectorRetrievalDebugOptions } from "./cli";

export interface VectorRetrievalDebugCliOptions {
  rootDir?: string;
  releasesRoot?: string;
  releaseVersion?: string;
  manifestPath?: string;
  query?: string;
  outputPath?: string;
  limit?: number;
}

function resolveDefaultOutputPath(rootDir: string, releaseVersion: string): string {
  return path.join(rootDir, "data", "curation", "reports", `vector-debug-${releaseVersion}.json`);
}

function writeJsonFile(filePath: string, data: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function main(): void {
  const options = readVectorRetrievalDebugOptions();
  const query = options.query?.trim();

  if (!query) {
    throw new Error("Missing required --query for vector retrieval debug.");
  }

  const loaded = loadEmbeddingShards({
    rootDir: options.rootDir,
    releasesRoot: options.releasesRoot,
    releaseVersion: options.releaseVersion,
    manifestPath: options.manifestPath,
  });
  const result = runRetrievalDebug(query, loaded.records, {
    limit: options.limit,
  });
  const rootDir = options.rootDir ?? path.resolve(process.cwd(), "../..");
  const outputPath = options.outputPath ?? resolveDefaultOutputPath(rootDir, loaded.releaseVersion);
  const payload = {
    releaseVersion: loaded.releaseVersion,
    manifestPath: loaded.manifestPath,
    shardPaths: loaded.shardPaths,
    ...result,
  };

  writeJsonFile(outputPath, payload);
  console.log(JSON.stringify(payload, null, 2));
  console.log(`report: ${outputPath}`);
}

main();
