import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { extractOpenAIStreamDelta } from "./deepseek-emotion-prompt.mjs";
import { HOLDOUT_CASES, buildHoldoutPrompt } from "./deepseek-routing-holdout.mjs";
import { gradeMultitextOutput, parseMultitextOutput, summarizeMultitextRuns } from "./deepseek-multitext-prompt.mjs";

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

const repeatCount = Math.max(1, Number.parseInt(env.EVAL_REPEATS ?? "4", 10));
const concurrency = Math.max(1, Number.parseInt(env.EVAL_CONCURRENCY ?? "4", 10));
const timeoutMs = Math.max(30_000, Number.parseInt(env.EVAL_TIMEOUT_MS ?? "180000", 10));
const maxTokens = Math.max(512, Number.parseInt(env.EVAL_MAX_TOKENS ?? "2048", 10));
const variants = ["source-isolated-v3", "generic-task-routed-v5"];

const goldenPath = join(outputDir, "deepseek-routing-holdout-golden-sol-max.json");
const goldenById = existsSync(goldenPath)
  ? new Map(JSON.parse(readFileSync(goldenPath, "utf8")).cases.map((item) => [item.id, item.output]))
  : new Map();

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
  let streamError = null;
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
          { role: "system", content: "只依据给定信息完成当前中文任务，严格遵守证据边界与JSON契约。" },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    statusCode = response.status;
    requestId = response.headers.get("request-id") ?? response.headers.get("x-request-id");
    if (!response.body) throw new Error("Response body is empty");
    const contentType = response.headers.get("content-type") ?? "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let rawNonSse = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (!contentType.includes("text/event-stream")) {
        rawNonSse += chunk;
        continue;
      }
      buffer += chunk.replaceAll("\r\n", "\n");
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const data = frame.split("\n").filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart()).join("\n");
        if (data) processEvent(data, state, Date.now() - started);
      }
    }
    if (rawNonSse) {
      const payload = JSON.parse(rawNonSse);
      streamError = payload.error?.message ?? JSON.stringify(payload);
    }
  } catch (error) {
    transportError = String(error?.name === "AbortError" ? `Timeout after ${timeoutMs}ms` : error?.message ?? error);
  } finally {
    clearTimeout(timeout);
  }
  return { ...state, statusCode, requestId, transportError, streamError, totalMs: Date.now() - started };
}

async function runOne(job) {
  const streamed = await streamPrompt(buildHoldoutPrompt(job.item, job.variant));
  const parsedResult = parseMultitextOutput(streamed.text);
  const grade = parsedResult.parsed ? gradeMultitextOutput(job.item, parsedResult.parsed) : null;
  return {
    id: job.item.id,
    taskType: job.item.taskType,
    category: job.item.category,
    variant: job.variant,
    repetition: job.repetition,
    statusCode: streamed.statusCode,
    requestId: streamed.requestId,
    requestModel: model,
    responseModel: streamed.responseModel,
    firstEventMs: streamed.firstEventMs,
    firstThinkingMs: streamed.firstThinkingMs,
    firstTextMs: streamed.firstTextMs,
    totalMs: streamed.totalMs,
    usage: streamed.usage,
    thinkingChars: streamed.thinkingChars,
    stopReason: streamed.stopReason,
    transportError: streamed.transportError,
    streamError: streamed.streamError,
    parseError: parsedResult.parseError,
    text: streamed.text,
    parsed: parsedResult.parsed,
    grade,
    reference: goldenById.get(job.item.id) ?? null,
  };
}

async function runPool(jobs, workerCount, onResult) {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < jobs.length) {
      const index = nextIndex++;
      onResult(await runOne(jobs[index]));
    }
  }
  await Promise.all(Array.from({ length: Math.min(workerCount, jobs.length) }, () => worker()));
}

const jobs = [];
for (const variant of variants) {
  for (let repetition = 1; repetition <= repeatCount; repetition += 1) {
    for (const item of HOLDOUT_CASES) jobs.push({ variant, repetition, item });
  }
}
const runId = Date.now();
const report = {
  schemaVersion: "1.0",
  runId,
  objective: "Unseen holdout comparison for source-isolated-v3 and generic task-routed-v5",
  startedAt: new Date().toISOString(),
  model,
  thinking: "disabled",
  repeatCount,
  concurrency,
  variants,
  goldenReference: goldenById.size ? "Codex Sol max" : null,
  caseIds: HOLDOUT_CASES.map((item) => item.id),
  runs: [],
};
const partialPath = join(outputDir, `deepseek-routing-holdout-${runId}.partial.json`);
await runPool(jobs, concurrency, (row) => {
  report.runs.push(row);
  report.runs.sort((a, b) => variants.indexOf(a.variant) - variants.indexOf(b.variant)
    || a.repetition - b.repetition || HOLDOUT_CASES.findIndex((item) => item.id === a.id) - HOLDOUT_CASES.findIndex((item) => item.id === b.id));
  writeFileSync(partialPath, JSON.stringify(report, null, 2));
  console.log(`${row.variant} rep=${row.repetition} ${row.id} status=${row.statusCode ?? "ERR"} ttft=${row.firstTextMs ?? "?"}ms total=${row.totalMs}ms tokens=${row.usage.input_tokens ?? "?"}/${row.usage.output_tokens ?? "?"} pass=${row.grade?.passed ?? false}`);
});
report.finishedAt = new Date().toISOString();
report.summary = summarizeMultitextRuns(report.runs);
const jsonPath = join(outputDir, `deepseek-routing-holdout-${runId}.json`);
writeFileSync(jsonPath, JSON.stringify(report, null, 2));
if (existsSync(partialPath)) unlinkSync(partialPath);

const lines = [
  "# DeepSeek V4 Flash 未见 Holdout 流式 Eval",
  "",
  "| Variant | Samples | Usable | Hard pass | TTFT median | Total median | Input tokens | Output tokens |",
  "|---|---:|---:|---:|---:|---:|---:|---:|",
];
for (const item of report.summary) {
  lines.push(`| ${item.variant} | ${item.samples} | ${item.usable} | ${item.hardPasses} (${(item.hardPassRate * 100).toFixed(1)}%) | ${Math.round(item.firstTextMedianMs)} ms | ${Math.round(item.totalMedianMs)} ms | ${item.inputTokensAverage.toFixed(0)} | ${item.outputTokensAverage.toFixed(0)} |`);
}
const markdownPath = join(outputDir, `deepseek-routing-holdout-${runId}.md`);
writeFileSync(markdownPath, lines.join("\n"));
console.log(`RESULT_JSON=${jsonPath}`);
console.log(`RESULT_MD=${markdownPath}`);
