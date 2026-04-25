import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { loadEmbeddingShards, runVectorBenchmark, type VectorBenchmarkPrompt } from "@artduo/corpus";

import { readVectorBenchmarkOptions } from "./cli";

export interface VectorBenchmarkCliOptions {
  rootDir?: string;
  releasesRoot?: string;
  releaseVersion?: string;
  manifestPath?: string;
  promptsPath?: string;
  outputPath?: string;
  limit?: number;
}

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function resolveDefaultPromptsPath(rootDir: string): string {
  return path.join(rootDir, "benchmarks", "vector-smoke-prompts.json");
}

function resolveDefaultOutputPath(rootDir: string, releaseVersion: string): string {
  return path.join(rootDir, "data", "curation", "reports", `vector-benchmark-${releaseVersion}.json`);
}

function readPrompts(filePath: string): VectorBenchmarkPrompt[] {
  return JSON.parse(readFileSync(filePath, "utf8")) as VectorBenchmarkPrompt[];
}

function writeJsonFile(filePath: string, data: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function main(): void {
  const options = readVectorBenchmarkOptions();
  const rootDir = resolveRootDir(options.rootDir);
  const loaded = loadEmbeddingShards({
    rootDir,
    releasesRoot: options.releasesRoot,
    releaseVersion: options.releaseVersion,
    manifestPath: options.manifestPath,
  });
  const promptsPath = options.promptsPath ?? resolveDefaultPromptsPath(rootDir);
  const outputPath = options.outputPath ?? resolveDefaultOutputPath(rootDir, loaded.releaseVersion);
  const prompts = readPrompts(promptsPath);
  const benchmark = runVectorBenchmark(prompts, loaded.records, {
    limit: options.limit,
  });
  const payload = {
    releaseVersion: loaded.releaseVersion,
    manifestPath: loaded.manifestPath,
    promptsPath,
    generatedAt: new Date().toISOString(),
    ...benchmark,
  };

  writeJsonFile(outputPath, payload);
  console.log(JSON.stringify(payload, null, 2));
  console.log(`report: ${outputPath}`);
}

main();
