import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCurationIntentPlan, parseCurationNarrativePiece, parseSemanticIndex } from "./semantic-curation";

const stage = { label: "先停一会", query: "quiet, restful paintings", signals: ["quiet"], valence: 0.5, arousal: 0.2, tension: 0.1, wonder: 0.3, intimacy: 0.7, transitionIntent: "hold" };
const plan = { schemaVersion: 1, currentFeeling: "在硬撑", desiredExperience: "希望暂时放松", wantsRelief: true, pace: "slow", artworkCount: 6,
  stages: [ { ...stage, role: "threshold" }, { ...stage, role: "turn" }, { ...stage, role: "afterglow" } ] };
test("curatorial intent rejects invalid state, duplicate stages, and unbounded counts", () => {
  assert.equal(parseCurationIntentPlan(plan).stages.length, 3);
  assert.throws(() => parseCurationIntentPlan({ ...plan, artworkCount: 100 }));
  assert.throws(() => parseCurationIntentPlan({ ...plan, stages: plan.stages.map((s) => ({ ...s, arousal: Infinity })) }));
  assert.throws(() => parseCurationIntentPlan({ ...plan, stages: [plan.stages[0], plan.stages[0], plan.stages[2]] }));
  assert.throws(() => parseCurationIntentPlan({ ...plan, stages: [...plan.stages].reverse() }));
});
test("semantic index rejects duplicate identities, dimension mismatch, and non-normalized vectors", () => {
  const index = { schemaVersion: 1, releaseVersion: "test", sourceFingerprint: "source", model: { id: "model", revision: "fixed", dimensions: 2, quantized: true, pooling: "mean", normalization: "l2", queryPrefix: "query: ", documentPrefix: "passage: ", textVersion: "v1" }, records: [{ artworkId: "one", textFingerprint: "text", vector: [1, 0] }] };
  assert.equal(parseSemanticIndex(index).records.length, 1);
  assert.throws(() => parseSemanticIndex({ ...index, records: [...index.records, ...index.records] }));
  for (const vector of [[1], [0, 0], [1, Infinity], [1, 1]]) assert.throws(() => parseSemanticIndex({ ...index, records: [{ ...index.records[0], vector }] }));
});
test("narrative pieces bound content and require an artwork identity for notes", () => {
  assert.equal(parseCurationNarrativePiece({ kind: "preface", text: "先在这里停一会。", evidenceIds: [] }).kind, "preface");
  assert.throws(() => parseCurationNarrativePiece({ kind: "note", text: "邀请你看看水面。", evidenceIds: [] }));
  assert.throws(() => parseCurationNarrativePiece({ kind: "preface", text: "<script>test</script>", evidenceIds: [] }));
  assert.throws(() => parseCurationNarrativePiece({ kind: "note", artworkId: "one", text: "字".repeat(71), evidenceIds: [] }));
});
