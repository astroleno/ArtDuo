import assert from "node:assert/strict";
import { test } from "node:test";
import type { SemanticIndex } from "@artduo/contracts";
import { LOCAL_SEMANTIC_MODEL, semanticFingerprint } from "@artduo/corpus/src/semantic-index";
import { buildSemanticObservationIndex, validateSemanticObservationIndex } from "@artduo/corpus/src/semantic-observation-index";
import { stageVectorContributions } from "../../lib/stage-vector-experiment";

const model = { ...LOCAL_SEMANTIC_MODEL, dimensions: 2 };
const museumIndex: SemanticIndex = { schemaVersion: 1, releaseVersion: "fixture", sourceFingerprint: "museum", model,
  records: ["a", "b", "c"].map(artworkId => ({ artworkId, textFingerprint: artworkId, vector: [1, 0] })) };
const imageSha256 = "sha256:" + "d".repeat(64);
const input = {
  museumIndex,
  provenance: { releaseVersion: "fixture", releaseManifestSha256: "manifest", museumIndexChecksum: "museum",
    visualLedgerSha256: "ledger", visualEvidenceVersion: "visual" },
  sources: [
    { artworkId: "c", imageSha256, observation: "右侧有人，背景未见帆船。" },
    { artworkId: "a", imageSha256, observation: "左侧可能是树，不确定。" },
  ],
};

test("observation vectors preserve complete visual context and bind the ordered release inputs", async () => {
  const documentBatches: string[][] = [];
  const artifact = await buildSemanticObservationIndex(input, { model, embedDocuments: async texts => {
    documentBatches.push(texts);
    return texts.map(() => [0, 1]);
  } });
  assert.deepEqual(documentBatches, [["左侧可能是树，不确定。", "右侧有人，背景未见帆船。"]]);
  assert.deepEqual([...validateSemanticObservationIndex(artifact, input).vectors], [["a", [0, 1]], ["c", [0, 1]]]);
  const altered = structuredClone(artifact);
  altered.payload.records[0]!.vector = [2, 0];
  assert.throws(() => validateSemanticObservationIndex(altered, input), /checksum/u);
  altered.checksum = semanticFingerprint(JSON.stringify(altered.payload));
  assert.throws(() => validateSemanticObservationIndex(altered, input), /row for a/u);
  assert.throws(() => validateSemanticObservationIndex(artifact, { ...input, provenance: { ...input.provenance, visualLedgerSha256: "other" } }), /another release/u);
  for (const change of [{ imageSha256: "sha256:" + "c".repeat(64) }, { observation: "删去了原文中的否定上下文。" }]) {
    assert.throws(() => validateSemanticObservationIndex(artifact, { ...input,
      sources: [{ ...input.sources[0]!, ...change }, input.sources[1]!] }), /row for c/u);
  }
  assert.throws(() => validateSemanticObservationIndex(artifact, { ...input, museumIndex: { ...museumIndex,
    records: [...museumIndex.records].reverse() } }), /row for c/u);
  assert.throws(() => validateSemanticObservationIndex(artifact, { ...input, museumIndex: { ...museumIndex,
    model: { ...model, revision: "other" } } }), /identity/u);
});

test("the stage experiment bounds movement, preserves narrow and short populations, and falls back to museum vectors per work", () => {
  const score = (values: number[]) => values.map((museumCosine, index) => ({ artworkId: String(index), museumCosine }));
  assert.deepEqual(stageVectorContributions(score([.1, .2, .3]), [1, 0], { variant: "bounded" }), [.1, .2, .3].map(value => .78 * value));
  assert.deepEqual(stageVectorContributions(score([.2, .201, .202, .21]), [1, 0], { variant: "bounded" }), [.2, .201, .202, .21].map(value => .78 * value));
  const wide = stageVectorContributions(score([.2, .4, .6, .8]), [1, 0], { variant: "bounded" });
  assert.deepEqual(wide.map(value => Number(value.toFixed(3))), [.036, .192, .588, .744]);
  assert.deepEqual(stageVectorContributions(score([.2, .3]), [1, 0], { variant: "observation",
    observationVectors: new Map([["0", [.8, .6]]]) }), [.5, .3].map(value => .78 * value));
});
