import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { extractOpenAIStreamDelta } from "./deepseek-emotion-prompt.mjs";
import { NARRATION_PACKETS, buildNarrationPrompts } from "./deepseek-routing-holdout.mjs";
import { parseMultitextOutput } from "./deepseek-multitext-prompt.mjs";

const outputDir = new URL("./", import.meta.url).pathname;

function loadDotEnv(path) {
  const values = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

const env = { ...loadDotEnv(join(process.cwd(), ".env")), ...process.env };
const baseUrl = String(env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
const apiKey = env.DEEPSEEK_API_KEY;
const model = env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured");

const repeatCount = Math.max(1, Number.parseInt(env.EVAL_REPEATS ?? "5", 10));
const timeoutMs = Math.max(30_000, Number.parseInt(env.EVAL_TIMEOUT_MS ?? "180000", 10));
const maxTokens = Math.max(512, Number.parseInt(env.EVAL_MAX_TOKENS ?? "2048", 10));

function applyUsage(target, usage) {
  if (!usage || typeof usage !== "object") return;
  for (const [key, value] of Object.entries(usage)) if (typeof value === "number") target[key] = value;
}

function processEvent(data, state, elapsedMs) {
  if (!data || data === "[DONE]") return;
  const event = JSON.parse(data);
  state.firstEventMs ??= elapsedMs;
  const delta = extractOpenAIStreamDelta(event);
  state.responseModel = delta.model ?? state.responseModel;
  applyUsage(state.usage, delta.usage);
  if (delta.thinking) {
    state.firstThinkingMs ??= elapsedMs;
    state.thinkingChars += [...delta.thinking].length;
  }
  if (delta.text) {
    state.firstTextMs ??= elapsedMs;
    state.text += delta.text;
  }
  state.stopReason = delta.finishReason ?? state.stopReason;
}

async function streamPrompt(prompt) {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const state = { text: "", firstEventMs: null, firstTextMs: null, firstThinkingMs: null, thinkingChars: 0, usage: {}, responseModel: null, stopReason: null };
  let statusCode = null;
  let requestId = null;
  let transportError = null;
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        stream: true,
        stream_options: { include_usage: true },
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "只依据给定展览资料写作，严格遵守证据边界与JSON契约。" },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    statusCode = response.status;
    requestId = response.headers.get("request-id") ?? response.headers.get("x-request-id");
    if (!response.body) throw new Error("Response body is empty");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replaceAll("\r\n", "\n");
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const data = frame.split("\n").filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart()).join("\n");
        if (data) processEvent(data, state, Date.now() - started);
      }
    }
  } catch (error) {
    transportError = String(error?.name === "AbortError" ? `Timeout after ${timeoutMs}ms` : error?.message ?? error);
  } finally {
    clearTimeout(timeout);
  }
  const parsed = parseMultitextOutput(state.text);
  return { ...state, parsed: parsed.parsed, parseError: parsed.parseError, statusCode, requestId, transportError, totalMs: Date.now() - started };
}

function normalizeCombined(row) {
  if (!row.parsed) return null;
  return {
    preface: row.parsed.preface,
    closing: row.parsed.closing,
    preface_boundary: row.parsed.preface_boundary,
    closing_boundary: row.parsed.closing_boundary,
  };
}

function normalizeSplit(preface, closing) {
  if (!preface.parsed || !closing.parsed) return null;
  return {
    preface: preface.parsed.text,
    closing: closing.parsed.text,
    preface_boundary: preface.parsed.evidence_boundary,
    closing_boundary: closing.parsed.evidence_boundary,
  };
}

async function runJob(packet, repetition, packetIndex) {
  const prompts = buildNarrationPrompts(packet);
  let combined;
  let preface;
  let closing;
  const runCombined = async () => { combined = await streamPrompt(prompts.combined); };
  const runSplit = async () => { [preface, closing] = await Promise.all([streamPrompt(prompts.preface), streamPrompt(prompts.closing)]); };
  if ((repetition + packetIndex) % 2 === 0) {
    await runCombined();
    await runSplit();
  } else {
    await runSplit();
    await runCombined();
  }
  return {
    packetId: packet.id,
    repetition,
    order: (repetition + packetIndex) % 2 === 0 ? "combined_first" : "split_first",
    combined: {
      ...combined,
      normalized: normalizeCombined(combined),
      inputTokens: combined.usage.input_tokens ?? null,
      outputTokens: combined.usage.output_tokens ?? null,
    },
    split: {
      firstTextMs: Math.min(preface.firstTextMs ?? Infinity, closing.firstTextMs ?? Infinity),
      allCompleteMs: Math.max(preface.totalMs, closing.totalMs),
      inputTokens: (preface.usage.input_tokens ?? 0) + (closing.usage.input_tokens ?? 0),
      outputTokens: (preface.usage.output_tokens ?? 0) + (closing.usage.output_tokens ?? 0),
      thinkingChars: preface.thinkingChars + closing.thinkingChars,
      normalized: normalizeSplit(preface, closing),
      preface,
      closing,
    },
  };
}

function median(values) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function average(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

const runId = Date.now();
const report = {
  schemaVersion: "1.0",
  runId,
  objective: "Compare combined narration with parallel split preface and closing requests",
  startedAt: new Date().toISOString(),
  model,
  thinking: "disabled",
  repeatCount,
  runs: [],
};
const partialPath = join(outputDir, `deepseek-narration-architecture-${runId}.partial.json`);
for (let repetition = 1; repetition <= repeatCount; repetition += 1) {
  for (let packetIndex = 0; packetIndex < NARRATION_PACKETS.length; packetIndex += 1) {
    const row = await runJob(NARRATION_PACKETS[packetIndex], repetition, packetIndex);
    report.runs.push(row);
    writeFileSync(partialPath, JSON.stringify(report, null, 2));
    console.log(`${row.packetId} rep=${repetition} combined=${row.combined.firstTextMs}/${row.combined.totalMs}ms split=${row.split.firstTextMs}/${row.split.allCompleteMs}ms tokens=${row.combined.inputTokens}/${row.split.inputTokens}`);
  }
}
report.finishedAt = new Date().toISOString();
report.summary = {
  samples: report.runs.length,
  combined: {
    firstTextMedianMs: median(report.runs.map((row) => row.combined.firstTextMs)),
    allCompleteMedianMs: median(report.runs.map((row) => row.combined.totalMs)),
    inputTokensAverage: average(report.runs.map((row) => row.combined.inputTokens)),
    outputTokensAverage: average(report.runs.map((row) => row.combined.outputTokens)),
    parseRate: report.runs.filter((row) => row.combined.normalized).length / report.runs.length,
  },
  split: {
    firstTextMedianMs: median(report.runs.map((row) => row.split.firstTextMs)),
    allCompleteMedianMs: median(report.runs.map((row) => row.split.allCompleteMs)),
    inputTokensAverage: average(report.runs.map((row) => row.split.inputTokens)),
    outputTokensAverage: average(report.runs.map((row) => row.split.outputTokens)),
    parseRate: report.runs.filter((row) => row.split.normalized).length / report.runs.length,
  },
};
const jsonPath = join(outputDir, `deepseek-narration-architecture-${runId}.json`);
writeFileSync(jsonPath, JSON.stringify(report, null, 2));
if (existsSync(partialPath)) unlinkSync(partialPath);
const markdownPath = join(outputDir, `deepseek-narration-architecture-${runId}.md`);
const lines = [
  "# DeepSeek 前言/结语合并与并行拆分流式基准",
  "",
  "| Strategy | Samples | First text median | All complete median | Input tokens | Output tokens | Parse rate |",
  "|---|---:|---:|---:|---:|---:|---:|",
  `| combined | ${report.summary.samples} | ${report.summary.combined.firstTextMedianMs} ms | ${report.summary.combined.allCompleteMedianMs} ms | ${report.summary.combined.inputTokensAverage.toFixed(1)} | ${report.summary.combined.outputTokensAverage.toFixed(1)} | ${(report.summary.combined.parseRate * 100).toFixed(1)}% |`,
  `| split-parallel | ${report.summary.samples} | ${report.summary.split.firstTextMedianMs} ms | ${report.summary.split.allCompleteMedianMs} ms | ${report.summary.split.inputTokensAverage.toFixed(1)} | ${report.summary.split.outputTokensAverage.toFixed(1)} | ${(report.summary.split.parseRate * 100).toFixed(1)}% |`,
];
writeFileSync(markdownPath, lines.join("\n"));
console.log(`RESULT_JSON=${jsonPath}`);
console.log(`RESULT_MD=${markdownPath}`);
