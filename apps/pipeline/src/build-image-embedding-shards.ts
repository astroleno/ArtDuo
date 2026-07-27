import { readImageEmbeddingBuildOptions } from "./cli";
import { buildImageEmbeddingShards } from "./image-embedding-shards";

async function main(): Promise<void> {
  const result = await buildImageEmbeddingShards(readImageEmbeddingBuildOptions());

  console.log(`image embedding candidate: ${result.candidatePath}`);
  console.log(`image embedding report: ${result.reportPath}`);
  console.log(`records: ${result.records.length}`);
  console.log(`coverage ready: ${result.report.gates.coverageReady}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
