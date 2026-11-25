import assert from "node:assert/strict";
import { test } from "node:test";
import { applyStageRerank, requestStageRerank, stageRerankMessages, type StageCandidate } from "../../lib/stage-rerank";

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
    null,
    { stages: [null, { stage: 1, artworkIds: ["d"] }] },
    { stages: [{ stage: "0", artworkIds: ["a"] }, { stage: 1, artworkIds: ["d"] }] },
    { stages: [{ stage: 0, artworkIds: ["a"] }, { stage: 2, artworkIds: ["d"] }] },
    { stages: [{ stage: 0, artworkIds: ["a"] }, { stage: 0, artworkIds: ["b"] }] },
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
    stages: [{ index: 2, count: 1,
      intent: { label: "先停一会", role: "afterglow", transitionIntent: "hold", query: "quiet room", signals: ["quiet"], valence: .4, arousal: .15, tension: .1, wonder: .3, intimacy: .5 },
      works: [{ artworkId: "a", title: "Interior", artist: "Hammershøi", observed: "烛光照亮桌面", moods: ["quiet"] }] }],
  });
  const text = messages.map((message) => message.content).join("\n");
  assert.ok(text.includes("烛光照亮桌面") && text.includes("先停一会") && text.includes("quiet room"));
  assert.ok(/只能从该阶段的候选中选择/.test(text));
  assert.match(text, /stage 2 选 1 件.*"role":"afterglow".*"transitionIntent":"hold"/u);
  assert.doesNotMatch(text, /同阶段有多件/u);
});

test("multi-work stages request an intentional viewing order and preserve the validated response order", () => {
  const intent = { label: "留在这里", role: "afterglow", transitionIntent: "hold", query: "quiet room", signals: ["quiet"],
    valence: .4, arousal: .15, tension: .1, wonder: .3, intimacy: .5 } as const;
  const messages = stageRerankMessages({ desiredExperience: "比较门与窗",
    stages: [{ index: 2, count: 2, intent: { ...intent, signals: ["quiet"] }, works: [] }],
  });
  assert.match(messages[1]!.content, /首件引入.*末件留下余韵.*明确指定的比较重点和先后/u);
  const fixedStage = [{ ...candidate("a", .9), stageIndex: 0 }, { ...candidate("b", .8), stageIndex: 0 }];
  const response = JSON.stringify({ stages: [{ stage: 0, artworkIds: ["b", "a"] }] });
  assert.deepEqual(applyStageRerank(response, [pools[0]!], [fixedStage])?.map(work => work.artworkId), ["b", "a"]);
});

test("sparse answers preserve stage order and only accept empty rows for unfilled stages", () => {
  const sparsePools = [pools[0]!, [], pools[1]!];
  const sparseCurrent = [current[0]!, [], current[1]!.map(item => ({ ...item, stageIndex: 2 }))];
  const first = { stage: 0, artworkIds: ["b"] };
  const last = { stage: 2, artworkIds: ["d"] };
  for (const stages of [[last, first], [last, { stage: 1, artworkIds: [] }, first]]) {
    assert.deepEqual(applyStageRerank(JSON.stringify({ stages }), sparsePools, sparseCurrent)?.map(item => [item.stageIndex, item.artworkId]), [[0, "b"], [2, "d"]]);
  }
  for (const stages of [[first], [first, last, { stage: 1, artworkIds: ["e"] }], [first, last, { stage: 3, artworkIds: [] }]]) {
    assert.equal(applyStageRerank(JSON.stringify({ stages }), sparsePools, sparseCurrent), undefined);
  }
});

test("a candidate in an unfilled stage cannot trigger a model call when the occupied stages are fixed", async () => {
  const intent = { label: "路径", role: "threshold", transitionIntent: "hold", query: "quiet room", signals: ["quiet"], valence: .4, arousal: .15, tension: .1, wonder: .3, intimacy: .5 } as const;
  const first = { ...intent, signals: [...intent.signals] };
  const plan = { schemaVersion: 1, currentFeeling: "安静", desiredExperience: "看展", wantsRelief: false, pace: "still", artworkCount: 2,
    stages: [first, { ...first, role: "mirror" }, { ...first, role: "afterglow" }] } satisfies Parameters<typeof requestStageRerank>[0]["plan"];
  let calls = 0;
  assert.equal(await requestStageRerank({ plan, catalog: { artworkById: new Map() },
    assignments: current.flat().map(item => ({ ...item, stageIndex: item.stageIndex * 2 })),
    pools: [[pools[0]![0]!], pools[0]!, [pools[1]![0]!]],
    stream: async function* () { calls++; yield "{}"; } }), undefined);
  assert.equal(calls, 0);
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
