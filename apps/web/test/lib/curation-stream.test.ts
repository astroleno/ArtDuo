import assert from "node:assert/strict";
import { test } from "node:test";
import { readCurationNarrativeStream } from "../../lib/curation-stream";

function response(body: string) {
  const bytes = new TextEncoder().encode(body);
  return new Response(new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 5) controller.enqueue(bytes.slice(i, i + 5)); controller.close(); } }), { headers: { "content-type": "text/event-stream" } });
}
const pieces = [
  { kind: "preface", text: "先停一会，慢慢看。", evidenceIds: ["a"], source: "grounded" },
  { kind: "note", artworkId: "a", text: "让这幅画留一点时间。", evidenceIds: ["a"], source: "grounded" },
  { kind: "closing", text: "这段路可以先停在这里。", evidenceIds: ["a"], source: "fallback" },
];
const event = (kind: string, sequence: number, piece?: unknown, curationId = "saved") => `event: ${kind}\r\ndata: ${JSON.stringify({ schemaVersion: 1, curationId, sequence, piece })}\r\n\r\n`;
test("browser narrative parser handles split UTF-8 and verifies the complete exhibit", async () => {
  const text = pieces.map((piece, index) => event("piece", index, piece)).join("") + event("complete", 3);
  const received = [];
  for await (const piece of readCurationNarrativeStream(response(text), "saved", ["a"])) received.push(piece);
  assert.equal(received.length, 3);
  assert.equal(received[0].text, pieces[0].text);
});
test("stale identities, repeated frames and premature completion are rejected", async () => {
  for (const source of [event("piece", 0, pieces[0], "other"), event("piece", 0, pieces[0]) + event("piece", 0, pieces[0]), event("complete", 0), event("piece", 0, pieces[0])]) {
    await assert.rejects(async () => { for await (const _ of readCurationNarrativeStream(response(source), "saved", ["a"])) { /* drain */ } });
  }
});
