import { extractOpenAIStreamDelta } from "./deepseek-emotion-prompt.mjs";

export function createStreamState() {
  return {
    text: "",
    thinkingText: "",
    thinkingChars: 0,
    firstEventMs: null,
    firstThinkingMs: null,
    firstTextMs: null,
    responseModel: null,
    stopReason: null,
    messageStopped: false,
    streamError: null,
    usage: {},
    eventCount: 0,
    malformedEventCount: 0,
  };
}

function applyUsage(state, usage) {
  if (!usage || typeof usage !== "object") return;
  for (const [key, value] of Object.entries(usage)) {
    if (Number.isFinite(value)) state.usage[key] = value;
  }
}

function appendThinking(state, value, elapsedMs) {
  const text = String(value ?? "");
  if (!text) return;
  state.firstThinkingMs ??= elapsedMs;
  state.thinkingText += text;
  state.thinkingChars += [...text].length;
}

function appendText(state, value, elapsedMs) {
  const text = String(value ?? "");
  if (!text) return;
  state.firstTextMs ??= elapsedMs;
  state.text += text;
}

export function processOpenAiEvent(data, state, elapsedMs) {
  if (!data || data === "[DONE]") return;
  const event = JSON.parse(data);
  state.firstEventMs ??= elapsedMs;
  state.eventCount += 1;
  const delta = extractOpenAIStreamDelta(event);
  state.responseModel = delta.model ?? state.responseModel;
  applyUsage(state, delta.usage);
  appendThinking(state, delta.thinking, elapsedMs);
  appendText(state, delta.text, elapsedMs);
  state.stopReason = delta.finishReason ?? state.stopReason;
}

export function processAnthropicEvent(data, state, elapsedMs) {
  if (!data) return;
  if (data === "[DONE]") {
    state.messageStopped = true;
    return;
  }
  let event;
  try {
    event = JSON.parse(data);
  } catch {
    state.malformedEventCount += 1;
    return;
  }
  state.firstEventMs ??= elapsedMs;
  state.eventCount += 1;
  if (event.type === "message_start") {
    state.responseModel = event.message?.model ?? state.responseModel;
    applyUsage(state, event.message?.usage);
  }
  if (event.type === "content_block_start") {
    const block = event.content_block ?? {};
    if (block.type === "text") appendText(state, block.text, elapsedMs);
    if (block.type === "thinking" || block.type === "reasoning") {
      appendThinking(state, block.thinking ?? block.text, elapsedMs);
    }
  }
  if (event.type === "content_block_delta") {
    const delta = event.delta ?? {};
    if (delta.type === "text_delta") appendText(state, delta.text, elapsedMs);
    if (delta.type === "thinking_delta" || delta.type === "reasoning_delta") {
      appendThinking(state, delta.thinking ?? delta.text, elapsedMs);
    }
  }
  if (event.type === "message_delta") {
    state.stopReason = event.delta?.stop_reason ?? state.stopReason;
    applyUsage(state, event.usage);
  }
  if (event.type === "message_stop") state.messageStopped = true;
  if (event.type === "error") state.streamError = event.error?.message ?? JSON.stringify(event.error ?? event);
}

export function parseJsonText(text) {
  const trimmed = String(text ?? "").trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) candidates.push(fenced);
  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) candidates.push(trimmed.slice(objectStart, objectEnd + 1));
  let lastError = null;
  for (const candidate of candidates) {
    try {
      return { parsed: JSON.parse(candidate), parseError: null };
    } catch (error) {
      lastError = error;
    }
  }
  return { parsed: null, parseError: String(lastError?.message ?? "No JSON object found") };
}
