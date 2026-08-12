import path from "node:path";

import { verifyImageEmbeddingReproducibility } from "./image-embedding-reproducibility";

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requiredPath(name: string, rootDir: string, fallback?: string): string {
  const value = readFlag(name) ?? fallback;
  if (!value) {
    throw new TypeError(`Missing required ${name}.`);
  }
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(rootDir, value);
}

async function main(): Promise<void> {
  const rootDir = path.resolve(readFlag("--root-dir") ?? path.resolve(process.cwd(), "../.."));
  const releaseVersion = readFlag("--release-version");
  if (!releaseVersion) {
    throw new TypeError("Missing required --release-version.");
  }
  const reportDir = path.join("data", "curation", "reports", "image-embeddings", releaseVersion);
  const modelArtifactPath = requiredPath("--model-artifact", rootDir);
  const sourceCacheRoot = requiredPath("--source-cache-root", rootDir, ".cache/artduo/image-sources");
  const bundlePath = requiredPath("--bundle", rootDir, path.join(reportDir, "reproducibility", "bundle.v1.json"));
  const candidatePath = requiredPath("--candidate-shard", rootDir, path.join(reportDir, "candidates", "image-embeddings-01.json"));
  const result = await verifyImageEmbeddingReproducibility({
    rootDir,
    bundlePath,
    modelArtifactPath,
    sourceCacheRoot,
    candidatePath,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
