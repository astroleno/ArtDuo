import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { extractOpenAIStreamDelta } from "./deepseek-emotion-prompt.mjs";
import {
  MULTITEXT_CASES,
  MULTITEXT_PROMPT_VARIANTS,
  buildMultitextPrompt,
  gradeMultitextOutput,
  parseMultitextOutput,
  summarizeMultitextRuns,
} from "./deepseek-multitext-prompt.mjs";

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

const repeatCount = Math.max(1, Number.parseInt(env.EVAL_REPEATS ?? "2", 10));
const concurrency = Math.max(1, Number.parseInt(env.EVAL_CONCURRENCY ?? "4", 10));
const timeoutMs = Math.max(30_000, Number.parseInt(env.EVAL_TIMEOUT_MS ?? "180000", 10));
const maxTokens = Math.max(512, Number.parseInt(env.EVAL_MAX_TOKENS ?? "2048", 10));
const requestedVariants = String(env.MULTITEXT_VARIANTS ?? MULTITEXT_PROMPT_VARIANTS.join(","))
  .split(",").map((value) => value.trim()).filter(Boolean);
const requestedIds = new Set(String(env.MULTITEXT_CASE_IDS ?? "").split(",").map((value) => value.trim()).filter(Boolean));
const cases = MULTITEXT_CASES.filter((item) => requestedIds.size === 0 || requestedIds.has(item.id));
for (const variant of requestedVariants) if (!MULTITEXT_PROMPT_VARIANTS.includes(variant)) throw new Error(`Unknown variant: ${variant}`);

const sol = JSON.parse(readFileSync(join(outputDir, "deepseek-multitext-golden-sol-max.json"), "utf8"));
const kimi = JSON.parse(readFileSync(join(outputDir, "deepseek-multitext-golden-kimi-k3-max.json"), "utf8"));
const solById = new Map(sol.cases.map((item) => [item.id, item.output]));
const kimiById = new Map(kimi.cases.map((item) => [item.id, item.output]));

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

async function runOne(job) {
  const prompt = buildMultitextPrompt(job.item, job.variant);
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const state = {
    text: "",
    firstEventMs: null,
    firstTextMs: null,
    firstThinkingMs: null,
    thinkingChars: 0,
    usage: {},
    responseModel: null,
    stopReason: null,
  };
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
          { role: "system", content: "只依据给定信息完成中文写作，严格遵守证据边界和 JSON 契约。" },
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
  const parsedResult = parseMultitextOutput(state.text);
  const grade = parsedResult.parsed ? gradeMultitextOutput(job.item, parsedResult.parsed) : null;
  return {
    id: job.item.id,
    category: job.item.category,
    variant: job.variant,
    repetition: job.repetition,
    statusCode,
    requestId,
    requestModel: model,
    responseModel: state.responseModel,
    firstEventMs: state.firstEventMs,
    firstThinkingMs: state.firstThinkingMs,
    firstTextMs: state.firstTextMs,
    totalMs: Date.now() - started,
    usage: state.usage,
    thinkingChars: state.thinkingChars,
    stopReason: state.stopReason,
    transportError,
    streamError,
    parseError: parsedResult.parseError,
    text: state.text,
    parsed: parsedResult.parsed,
    grade,
    references: { codexSolMax: solById.get(job.item.id), kimiK3Max: kimiById.get(job.item.id) },
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
for (const variant of requestedVariants) {
  for (let repetition = 1; repetition <= repeatCount; repetition += 1) {
    for (const item of cases) jobs.push({ variant, repetition, item });
  }
}
const runId = Date.now();
const report = {
  schemaVersion: "1.0",
  runId,
  objective: "Verify DeepSeek V4 Flash source-isolated prompt across emotion, artwork introductions, and framing text",
  startedAt: new Date().toISOString(),
  model,
  thinking: "disabled",
  maxTokens,
  repeatCount,
  concurrency,
  variants: requestedVariants,
  caseIds: cases.map((item) => item.id),
  runs: [],
};
const partialPath = join(outputDir, `deepseek-multitext-eval-${runId}.partial.json`);
await runPool(jobs, concurrency, (row) => {
  report.runs.push(row);
  report.runs.sort((a, b) => requestedVariants.indexOf(a.variant) - requestedVariants.indexOf(b.variant)
    || a.repetition - b.repetition || cases.findIndex((item) => item.id === a.id) - cases.findIndex((item) => item.id === b.id));
  writeFileSync(partialPath, JSON.stringify(report, null, 2));
  console.log(`${row.variant} rep=${row.repetition} ${row.id} status=${row.statusCode ?? "ERR"} ttft=${row.firstTextMs ?? "?"}ms total=${row.totalMs}ms tokens=${row.usage.input_tokens ?? "?"}/${row.usage.output_tokens ?? "?"} pass=${row.grade?.passed ?? false}`);
});
report.finishedAt = new Date().toISOString();
report.summary = summarizeMultitextRuns(report.runs);
const jsonPath = join(outputDir, `deepseek-multitext-eval-${runId}.json`);
writeFileSync(jsonPath, JSON.stringify(report, null, 2));

const lines = [
  "# DeepSeek V4 Flash 多文本类型流式 Eval",
  "",
  "| Variant | Samples | Usable | Hard pass | TTFT median | Total median | Input tokens | Output tokens |",
  "|---|---:|---:|---:|---:|---:|---:|---:|",
];
for (const item of report.summary) {
  lines.push(`| ${item.variant} | ${item.samples} | ${item.usable} | ${item.hardPasses} (${(item.hardPassRate * 100).toFixed(1)}%) | ${Math.round(item.firstTextMedianMs)} ms | ${Math.round(item.totalMedianMs)} ms | ${item.inputTokensAverage.toFixed(0)} | ${item.outputTokensAverage.toFixed(0)} |`);
}
const markdownPath = join(outputDir, `deepseek-multitext-eval-${runId}.md`);
writeFileSync(markdownPath, lines.join("\n"));
console.log(`RESULT_JSON=${jsonPath}`);
console.log(`RESULT_MD=${markdownPath}`);
