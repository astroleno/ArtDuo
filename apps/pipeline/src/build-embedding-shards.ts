import { readEmbeddingBuildOptions, readEmbeddingRuntimeCliOptions } from "./cli";
import { buildEmbeddingShardsWithProvider } from "./embedding-shards";
import { resolveEmbeddingRuntime } from "./embedding-runtime";

async function main(): Promise<void> {
  const buildOptions = readEmbeddingBuildOptions();
  const runtime = resolveEmbeddingRuntime({
    ...readEmbeddingRuntimeCliOptions(),
    rootDir: buildOptions.rootDir,
  });
  const result = await buildEmbeddingShardsWithProvider({
    ...buildOptions,
    requestedProviderMode: runtime.requestedProviderMode,
    embeddingProvider: runtime.provider,
  });

  console.log(`embeddings shard: ${result.embeddingsPath}`);
  console.log(`report: ${result.reportPath}`);
  console.log(`records: ${result.records.length}`);
  console.log(`provider: ${result.report.providerMode}`);
  console.log(`model: ${result.report.model}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
