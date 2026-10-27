import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parseArtworkRecords } from "@artduo/contracts";
import { LOCAL_SEMANTIC_MODEL } from "@artduo/corpus/src/semantic-index";
import type { SemanticEncoder } from "@artduo/corpus/src/local-semantic-provider";
import { buildReleaseArtifact } from "./release-artifact";
import { buildEmbeddingRecordsWithProvider, buildEmbeddingShards } from "./embedding-shards";
import { activateSemanticRelease, buildSemanticRelease } from "./semantic-release";

const repository = path.resolve(__dirname, "../../..");
const corpusPath = path.join(repository, "packages/contracts/fixtures/artworks.json");
function fixture() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-semantic-release-"));
  const outputRoot = path.join(rootDir, "data/releases");
  buildReleaseArtifact({ rootDir: repository, outputRoot, corpusPath, corpusVersion: "base" });
  buildEmbeddingShards({ rootDir: repository, outputRoot, corpusPath, releaseVersion: "base" });
  return { rootDir, outputRoot };
}
const encoder: SemanticEncoder = { model: LOCAL_SEMANTIC_MODEL,
  async embedDocuments(texts) { return texts.map(() => [1, ...Array.from({ length: 383 }, () => 0)]); },
  async embedQueries() { return []; }, async dispose() {} };
test("semantic releases preserve the hash index, validate checksums and refuse replacement", async () => {
  const { rootDir, outputRoot } = fixture();
  try {
    const baseFile = path.join(outputRoot, "base", "manifest.json");
    const baseBytes = readFileSync(baseFile, "utf8");
    const result = await buildSemanticRelease({ rootDir, baseVersion: "base", version: "semantic", encoder });
    assert.equal(result.index.records.length, 3);
    assert.equal(readFileSync(baseFile, "utf8"), baseBytes);
    const hashRows = JSON.parse(readFileSync(path.join(result.directory, "embeddings-01.json"), "utf8"));
    assert.ok(hashRows.every((row: { model: string }) => row.model === "local-hash-embedding-v1"));
    const semanticFile = path.join(result.directory, "semantic-index.json");
    const original = readFileSync(semanticFile, "utf8");
    writeFileSync(semanticFile, original.replace('"schemaVersion": 1', '"schemaVersion": 2'));
    assert.throws(() => activateSemanticRelease(result.directory, outputRoot), /integrity/);
    writeFileSync(semanticFile, original);
    assert.equal(activateSemanticRelease(result.directory, outputRoot), path.join(outputRoot, "semantic"));
    await assert.rejects(buildSemanticRelease({ rootDir, baseVersion: "base", version: "semantic", outputRoot, encoder }), /already exists/);
  } finally { rmSync(rootDir, { recursive: true, force: true }); }
});
test("invalid semantic vectors fail before a candidate release is written", async () => {
  const { rootDir } = fixture();
  try {
    await assert.rejects(buildSemanticRelease({ rootDir, baseVersion: "base", version: "invalid", encoder: { ...encoder,
      async embedDocuments(texts) { return texts.map(() => [0, 0]); } } }), /normalized vector/);
    assert.equal(existsSync(path.join(rootDir, "data/curation/preview/invalid")), false);
  } finally { rmSync(rootDir, { recursive: true, force: true }); }
});
test("a per-batch provider fallback cannot mix semantic and hash spaces into one index", async () => {
  let batch = 0;
  const artworks = parseArtworkRecords(JSON.parse(readFileSync(corpusPath, "utf8")));
  const record = (text: string, model: string) => ({ normalizedText: text, tokens: [text], dimensions: 2, vector: [1, 0], provider: "remote-openai-compatible" as const, model });
  await assert.rejects(buildEmbeddingRecordsWithProvider(artworks, { batchSize: 1, embeddingProvider: {
    mode: "remote-openai-compatible", model: "semantic", async embedText(text) { return record(text, "semantic"); },
    async embedTexts(texts) { batch++; return texts.map((text) => record(text, batch === 1 ? "semantic" : "local-hash-embedding-v1")); },
  } }), /mixed fallback indices/);
});
