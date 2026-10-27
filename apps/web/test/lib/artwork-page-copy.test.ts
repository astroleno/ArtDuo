import assert from "node:assert/strict";
import { test } from "node:test";
import type { ArtworkExplanation } from "@artduo/contracts";
import { buildRecommendationReason } from "../../lib/artwork-page-copy";

test("recommendation copy translates evidence without exposing scores or internal tags", () => {
  const input = { status: "ready", content: { evidence: { grounding: { matchedTokens: ["subject:interior", "primary-subject:interior", "stage:quiet", "unknown:opaque"], retrievalScore: .82 } } } } as ArtworkExplanation;
  const text = buildRecommendationReason(input);
  assert.ok(text.includes("室内空间"));
  assert.ok(!/subject:|primary-subject:|stage:|opaque|82|匹配度|检索/.test(text));
});
