import assert from "node:assert/strict";
import { test } from "node:test";
import { generateCurationIntent, requestedArtworkCount } from "../../src/services/curation/intent-planner";
import { readChatSse, type ChatStream } from "../../src/services/curation/chat-provider";

function response(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(encoder.encode(chunk)); controller.close(); } }), { headers: { "content-type": "text/event-stream" } });
}
test("provider SSE survives frame boundaries and rejects missing termination and truncated generation", async () => {
  const pieces: string[] = [];
  for await (const part of readChatSse(response(['data: {"choices":[{"delta":{"content":"先停"}}]}\r', '\n\r\n', 'data: {"choices":[{"delta":{"content":"一会"}}]}\n\ndata: [DONE]\n\n']))) pieces.push(part);
  assert.equal(pieces.join(""), "先停一会");
  for (const text of ['data: {"choices":[{"delta":{"content":"partial"}}]}\n\n', 'data: {"choices":[{"finish_reason":"length"}]}\n\ndata: [DONE]\n\n']) {
    await assert.rejects(async () => { for await (const _ of readChatSse(response([text]))) { /* drain */ } });
  }
});

test("English word counts are explicit, including when the visitor declines another count", () => {
  assert.equal(requestedArtworkCount("Give me two paintings of water, but no boats, people, or flowers."), 2);
  assert.equal(requestedArtworkCount("Not three paintings, give me one artwork."), 1);
  assert.equal(requestedArtworkCount("Show me twelve works."), 12);
});
test("intent planning validates provider output and honors explicit artwork counts", async () => {
  const common = { label: "停留", query: "quiet restful paintings", signals: ["quiet"], valence: 0.5, arousal: 0.2, tension: 0.1, wonder: 0.3, intimacy: 0.6, transitionIntent: "hold" };
  const plan = { schemaVersion: 1, currentFeeling: "疲惫", desiredExperience: "缓口气", wantsRelief: true, pace: "slow", artworkCount: 12,
    stages: [ { ...common, role: "threshold" }, { ...common, role: "turn" }, { ...common, role: "afterglow" } ] };
  const stream: ChatStream = async function* (messages) { assert.match(messages[1].content, /user_request=/); yield JSON.stringify(plan); };
  assert.equal((await generateCurationIntent("最近在硬撑", stream)).artworkCount, 7);
  assert.equal((await generateCurationIntent("我想看3幅安静的画", stream)).artworkCount, 3);
  await assert.rejects(generateCurationIntent("休息一下", async function* () { yield '{"stages":[]}'; }));
});
test("one explicitly named work stays one without needing a numeric instruction", () => {
  assert.equal(requestedArtworkCount("只看《Paris Street; Rainy Day》，不需要情绪引导。"), 1);
  assert.equal(requestedArtworkCount("只看《A》和《B》。"), 2);
  assert.equal(requestedArtworkCount("给我三幅画，排除《A》。"), 3);
});
