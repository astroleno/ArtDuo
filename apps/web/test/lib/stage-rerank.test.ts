import assert from "node:assert/strict";
import { test } from "node:test";
import { applyStageRerank, stageRerankMessages, type StageCandidate } from "../../lib/stage-rerank";

const candidate = (artworkId: string, score: number): StageCandidate => ({ artworkId, score, vectorScore: score, evidence: ["vector"] });
const pools = [
  [candidate("a", .9), candidate("b", .8), candidate("c", .7)],
  [candidate("b", .85), candidate("d", .8), candidate("e", .6)],
];
const current = [[candidate("a", .9)], [candidate("b", .85)]].map((stage, stageIndex) => stage.map((item) => ({ ...item, stageIndex })));

test("a valid model choice replaces each stage with works from that stage's own pool", () => {
  const result = applyStageRerank(JSON.stringify({ stages: [{ stage: 0, artworkIds: ["b"] }, { stage: 1, artworkIds: ["d"] }] }), pools, current);
  assert.deepEqual(result?.map((item) => [item.stageIndex, item.artworkId]), [[0, "b"], [1, "d"]]);
  assert.ok(result?.every((item) => item.evidence.includes("model:stage-fit")));
  assert.equal(result?.[1]!.score, .8, "scores stay the deterministic stage scores");
});

test("invented, duplicated, misplaced or miscounted choices are rejected as a whole", () => {
  for (const answer of [
    { stages: [{ stage: 0, artworkIds: ["zzz"] }, { stage: 1, artworkIds: ["d"] }] },
    { stages: [{ stage: 0, artworkIds: ["b"] }, { stage: 1, artworkIds: ["b"] }] },
    { stages: [{ stage: 0, artworkIds: ["e"] }, { stage: 1, artworkIds: ["d"] }] },
    { stages: [{ stage: 0, artworkIds: ["a", "b"] }, { stage: 1, artworkIds: ["d"] }] },
    { stages: [{ stage: 0, artworkIds: ["a"] }] },
  ]) assert.equal(applyStageRerank(JSON.stringify(answer), pools, current), undefined, JSON.stringify(answer));
  assert.equal(applyStageRerank("not json", pools, current), undefined);
});

test("the request carries stage intent and observed image facts but no visitor history", () => {
  const messages = stageRerankMessages({
    desiredExperience: "先安静，再看远处",
    stages: [{ label: "先停一会", query: "quiet room", signals: ["quiet"], valence: .4, arousal: .15, tension: .1, wonder: .3, intimacy: .5 }],
    pools: [[{ artworkId: "a", title: "Interior", artist: "Hammershøi", observed: "烛光照亮桌面", moods: ["quiet"] }]],
    counts: [1],
  });
  const text = messages.map((message) => message.content).join("\n");
  assert.ok(text.includes("烛光照亮桌面") && text.includes("先停一会") && text.includes("quiet room"));
  assert.ok(/只能从该阶段的候选中选择/.test(text));
});

test("a model choice that crowds one department of unknown hands is rejected", () => {
  const pools = [[candidate("m1", .9), candidate("o1", .8)], [candidate("m2", .9), candidate("o2", .8)], [candidate("m3", .9), candidate("o3", .8)]];
  const current = [[{ ...candidate("m1", .9), stageIndex: 0 }], [{ ...candidate("o2", .8), stageIndex: 1 }], [{ ...candidate("o3", .8), stageIndex: 2 }]];
  const hand = (id: string) => id.startsWith("m") ? "department:Indian and Southeast Asian Art" : `artist:${id}`;
  const crowded = JSON.stringify({ stages: [{ stage: 0, artworkIds: ["m1"] }, { stage: 1, artworkIds: ["m2"] }, { stage: 2, artworkIds: ["m3"] }] });
  assert.equal(applyStageRerank(crowded, pools, current, hand), undefined);
  const fine = JSON.stringify({ stages: [{ stage: 0, artworkIds: ["m1"] }, { stage: 1, artworkIds: ["m2"] }, { stage: 2, artworkIds: ["o3"] }] });
  assert.equal(applyStageRerank(fine, pools, current, hand)?.length, 3);
});
