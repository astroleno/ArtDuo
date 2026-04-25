import { readEmbeddingBuildOptions } from "./cli";
import { buildEmbeddingShards } from "./embedding-shards";

const result = buildEmbeddingShards(readEmbeddingBuildOptions());

console.log(`embeddings shard: ${result.embeddingsPath}`);
console.log(`report: ${result.reportPath}`);
console.log(`records: ${result.records.length}`);
