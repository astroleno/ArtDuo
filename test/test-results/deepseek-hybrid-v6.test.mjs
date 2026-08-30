import assert from "node:assert/strict";
import test from "node:test";

import { HOLDOUT_CASES } from "./deepseek-routing-holdout.mjs";
import {
  HYBRID_CONFIRMATION_CASES,
  HYBRID_NARRATION_PACKETS,
  buildHybridPrompt,
  buildRecommendedNarrationPrompts,
  decideHybridV6,
} from "./deepseek-hybrid-v6.mjs";
import {
  createStreamState,
  parseJsonText,
  processAnthropicEvent,
  processOpenAiEvent,
} from "./deepseek-hybrid-v6-stream.mjs";

test("confirmation matrix adds fresh evidence states across all five text tasks", () => {
  const counts = Object.groupBy(HYBRID_CONFIRMATION_CASES, (item) => item.taskType);
  assert.deepEqual(Object.fromEntries(Object.entries(counts).map(([key, items]) => [key, items.length])), {
    emotion_response: 4,
    artwork_intro: 4,
    exhibition_preface: 2,
    exhibition_closing: 2,
    curation_analysis: 4,
  });

  const oldIds = new Set(HOLDOUT_CASES.map((item) => item.id));
  const oldSources = new Set(HOLDOUT_CASES.map((item) => item.source));
  assert.equal(HYBRID_CONFIRMATION_CASES.some((item) => oldIds.has(item.id)), false);
  assert.equal(HYBRID_CONFIRMATION_CASES.some((item) => oldSources.has(item.source)), false);
  assert.equal(new Set(HYBRID_CONFIRMATION_CASES.map((item) => item.id)).size, 16);
});

test("recommended hybrid keeps the observable contract while routing risk-specific evidence rules", () => {
  for (const item of HYBRID_CONFIRMATION_CASES) {
    const baseline = buildHybridPrompt(item, "generic-task-routed-v5");
    const candidate = buildHybridPrompt(item, "recommended-hybrid-v6");
    for (const field of item.output.fields) {
      assert.match(baseline, new RegExp(field));
      assert.match(candidate, new RegExp(field));
    }
    assert.match(candidate, new RegExp(`task_type="${item.taskType}"`));
    assert.match(candidate, /silent_claim_audit/);
  }

  const accessibility = HYBRID_CONFIRMATION_CASES.find((item) => item.riskProfile === "accessibility_no_capability_inference");
  const accessibilityPrompt = buildHybridPrompt(accessibility, "recommended-hybrid-v6");
  assert.match(accessibilityPrompt, /能力推断/);
  assert.match(accessibilityPrompt, /环境要求/);

  const preface = HYBRID_CONFIRMATION_CASES.find((item) => item.taskType === "exhibition_preface");
  const prefacePrompt = buildHybridPrompt(preface, "recommended-hybrid-v6");
  assert.match(prefacePrompt, /immutable_fact_ledger/);
  assert.match(prefacePrompt, /未知状态/);
  assert.match(prefacePrompt, /不等于/);

  for (const staleFact of ["六把收拢的红伞", "五段声音", "毕业纪念用途", "七岁的孩子"] ) {
    assert.doesNotMatch(accessibilityPrompt, new RegExp(staleFact));
    assert.doesNotMatch(prefacePrompt, new RegExp(staleFact));
  }
});

test("recommended narration remains one combined contract with an immutable shared ledger", () => {
  assert.equal(HYBRID_NARRATION_PACKETS.length, 4);
  for (const packet of HYBRID_NARRATION_PACKETS) {
    const prompts = buildRecommendedNarrationPrompts(packet);
    for (const prompt of [prompts.baseline, prompts.candidate]) {
      assert.match(prompt, new RegExp(packet.id));
      assert.match(prompt, new RegExp(packet.source.slice(0, 12)));
      for (const field of ["preface", "closing", "preface_boundary", "closing_boundary"]) {
        assert.match(prompt, new RegExp(field));
      }
    }
    assert.match(prompts.candidate, /immutable_fact_ledger/);
    assert.match(prompts.candidate, /silent_claim_audit/);
    assert.match(prompts.candidate, /前言.*结语/s);
  }
});

test("hybrid freeze gate requires quality, K3 proximity, evidence safety, parsing, and bounded performance", () => {
  const confirmed = decideHybridV6({
    holdoutQuality: 18.4,
    holdoutQualityDelta: 0.6,
    holdoutSevereRate: 0.05,
    holdoutGapToK3: 0.7,
    holdoutParseRate: 1,
    holdoutInputIncrease: 0.18,
    holdoutTtftRegression: 0.12,
    narrationQuality: 18,
    narrationQualityDelta: 1.2,
    narrationSevereRate: 0.15,
    narrationSevereDelta: -0.2,
    narrationInputIncrease: 0.2,
    narrationTotalRegression: 0.1,
  });
  assert.deepEqual(confirmed, { framework: "confirm", blockers: [] });

  const held = decideHybridV6({
    holdoutQuality: 17.9,
    holdoutQualityDelta: -0.1,
    holdoutSevereRate: 0.12,
    holdoutGapToK3: 1.2,
    holdoutParseRate: 0.98,
    holdoutInputIncrease: 0.3,
    holdoutTtftRegression: 0.25,
    narrationQuality: 17,
    narrationQualityDelta: 0.2,
    narrationSevereRate: 0.25,
    narrationSevereDelta: 0.05,
    narrationInputIncrease: 0.3,
    narrationTotalRegression: 0.25,
  });
  assert.equal(held.framework, "hold");
  assert.deepEqual(held.blockers, [
    "holdout_quality",
    "holdout_quality_delta",
    "holdout_severe_rate",
    "holdout_k3_gap",
    "holdout_parse_rate",
    "holdout_input_cost",
    "holdout_ttft",
    "narration_quality",
    "narration_quality_delta",
    "narration_severe_rate",
    "narration_severe_delta",
    "narration_input_cost",
    "narration_total_time",
  ]);
});

test("stream event adapters preserve TTFT, thinking, text, usage, and stop state across providers", () => {
  const openAi = createStreamState();
  processOpenAiEvent(JSON.stringify({
    model: "deepseek-v4-flash",
    choices: [{ delta: { reasoning_content: "检查" } }],
  }), openAi, 120);
  processOpenAiEvent(JSON.stringify({
    model: "deepseek-v4-flash",
    choices: [{ delta: { content: "{\"ok\":true}" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 17, completion_tokens: 9 },
  }), openAi, 260);
  assert.equal(openAi.firstThinkingMs, 120);
  assert.equal(openAi.firstTextMs, 260);
  assert.equal(openAi.thinkingText, "检查");
  assert.equal(openAi.text, "{\"ok\":true}");
  assert.deepEqual(openAi.usage, { input_tokens: 17, output_tokens: 9 });
  assert.equal(openAi.stopReason, "stop");

  const anthropic = createStreamState();
  processAnthropicEvent(JSON.stringify({
    type: "message_start",
    message: { model: "k3-256k", usage: { input_tokens: 21, output_tokens: 1 } },
  }), anthropic, 90);
  processAnthropicEvent(JSON.stringify({
    type: "content_block_delta",
    delta: { type: "thinking_delta", thinking: "核对" },
  }), anthropic, 180);
  processAnthropicEvent(JSON.stringify({
    type: "content_block_delta",
    delta: { type: "text_delta", text: "{\"ok\":true}" },
  }), anthropic, 320);
  processAnthropicEvent(JSON.stringify({
    type: "message_delta",
    delta: { stop_reason: "end_turn" },
    usage: { output_tokens: 12 },
  }), anthropic, 400);
  assert.equal(anthropic.firstThinkingMs, 180);
  assert.equal(anthropic.firstTextMs, 320);
  assert.equal(anthropic.thinkingText, "核对");
  assert.equal(anthropic.text, "{\"ok\":true}");
  assert.deepEqual(anthropic.usage, { input_tokens: 21, output_tokens: 12 });
  assert.equal(anthropic.stopReason, "end_turn");
});

test("JSON parser accepts strict and fenced provider text without changing the payload", () => {
  assert.deepEqual(parseJsonText('{"text":"严格"}'), { parsed: { text: "严格" }, parseError: null });
  assert.deepEqual(parseJsonText('说明\n```json\n{"text":"围栏"}\n```'), { parsed: { text: "围栏" }, parseError: null });
  assert.equal(parseJsonText("not-json").parsed, null);
});
