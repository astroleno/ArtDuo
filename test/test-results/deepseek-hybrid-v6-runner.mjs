import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  HYBRID_CONFIRMATION_CASES,
  HYBRID_NARRATION_PACKETS,
  buildHybridPrompt,
  buildRecommendedNarrationPrompts,
} from "./deepseek-hybrid-v6.mjs";
import { createStreamState, parseJsonText, processOpenAiEvent } from "./deepseek-hybrid-v6-stream.mjs";
import { gradeMultitextOutput, summarizeMultitextRuns } from "./deepseek-multitext-prompt.mjs";

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

const holdoutRepeats = Math.max(1, Number.parseInt(env.EVAL_REPEATS ?? "4", 10));
const narrationRepeats = Math.max(1, Number.parseInt(env.NARRATION_REPEATS ?? "5", 10));
const concurrency = Math.max(1, Number.parseInt(env.EVAL_CONCURRENCY ?? "4", 10));
const timeoutMs = Math.max(30_000, Number.parseInt(env.EVAL_TIMEOUT_MS ?? "180000", 10));
const maxTokens = Math.max(512, Number.parseInt(env.EVAL_MAX_TOKENS ?? "2048", 10));
const holdoutVariants = ["generic-task-routed-v5", "recommended-hybrid-v6"];
const narrationVariants = ["combined-baseline-v5", "combined-guarded-v6"];

const k3ReferencePath = env.K3_REFERENCE_PATH;
const k3Reference = k3ReferencePath && existsSync(k3ReferencePath)
  ? JSON.parse(readFileSync(k3ReferencePath, "utf8"))
  : null;
const k3ById = new Map((k3Reference?.results ?? []).map((row) => [row.id, row.parsed]));

function validateNarration(parsed) {
  const fields = ["preface", "closing", "preface_boundary", "closing_boundary"];
  const keys = parsed && typeof parsed === "object" ? Object.keys(parsed).sort() : [];
  const exactFields = JSON.stringify(keys) === JSON.stringify([...fields].sort());
  const stringFields = fields.every((field) => typeof parsed?.[field] === "string" && parsed[field].trim());
  const lengths = Object.fromEntries(fields.map((field) => [field, [...String(parsed?.[field] ?? "")].length]));
  const lengthPassed = lengths.preface >= 100 && lengths.preface <= 180
    && lengths.closing >= 90 && lengths.closing <= 160
    && lengths.preface_boundary >= 10 && lengths.preface_boundary <= 65
    && lengths.closing_boundary >= 10 && lengths.closing_boundary <= 65;
  return { passed: exactFields && stringFields && lengthPassed, exactFields, stringFields, lengthPassed, lengths };
}

async function streamPrompt(prompt) {
  const startedAtMs = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const state = createStreamState();
  let statusCode = null;
  let contentType = null;
  let requestId = null;
  let transportError = null;
  let rawNonSse = "";
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
          { role: "system", content: "只依据给定封闭证据完成当前中文任务；严格遵守JSON契约，不使用外部知识。" },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    statusCode = response.status;
    contentType = response.headers.get("content-type");
    requestId = response.headers.get("request-id") ?? response.headers.get("x-request-id");
    if (!response.body) throw new Error("Response body is empty");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const elapsedMs = Date.now() - startedAtMs;
      const chunk = decoder.decode(value, { stream: true });
      if (!String(contentType).includes("text/event-stream")) {
        rawNonSse += chunk;
        continue;
      }
      buffer += chunk.replaceAll("\r\n", "\n");
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const data = frame.split("\n").filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart()).join("\n");
        if (data) processOpenAiEvent(data, state, elapsedMs);
      }
    }
    if (rawNonSse) {
      const payload = JSON.parse(rawNonSse);
      state.streamError = payload.error?.message ?? JSON.stringify(payload);
    }
  } catch (error) {
    transportError = String(error?.name === "AbortError" ? `Timeout after ${timeoutMs}ms` : error?.message ?? error);
  } finally {
    clearTimeout(timeout);
  }
  return {
    statusCode,
    contentType,
    requestId,
    responseModel: state.responseModel,
    firstEventMs: state.firstEventMs,
    firstThinkingMs: state.firstThinkingMs,
    firstTextMs: state.firstTextMs,
    totalMs: Date.now() - startedAtMs,
    usage: state.usage,
    thinkingChars: state.thinkingChars,
    stopReason: state.stopReason,
    eventCount: state.eventCount,
    malformedEventCount: state.malformedEventCount,
    transportError,
    streamError: state.streamError,
    text: state.text,
  };
}

async function runJob(job) {
  const streamed = await streamPrompt(job.prompt);
  const parsedResult = parseJsonText(streamed.text);
  const grade = parsedResult.parsed
    ? (job.kind === "holdout" ? gradeMultitextOutput(job.item, parsedResult.parsed) : validateNarration(parsedResult.parsed))
    : null;
  return {
    kind: job.kind,
    id: job.item.id,
    taskType: job.item.taskType ?? "combined_narration",
    category: job.item.category ?? "narration",
    variant: job.variant,
    repetition: job.repetition,
    requestModel: model,
    ...streamed,
    parseError: parsedResult.parseError,
    parsed: parsedResult.parsed,
    grade,
    reference: k3ById.get(job.item.id) ?? null,
  };
}

async function runPool(jobs, workerCount, onResult) {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < jobs.length) {
      const index = nextIndex++;
      onResult(await runJob(jobs[index]));
    }
  }
  await Promise.all(Array.from({ length: Math.min(workerCount, jobs.length) }, () => worker()));
}

function median(values) {
  const sorted = values.filter(Number.isFinite).toSorted((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function average(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function summarizeNarration(rows) {
  return narrationVariants.map((variant) => {
    const group = rows.filter((row) => row.variant === variant);
    return {
      variant,
      samples: group.length,
      usable: group.filter((row) => row.statusCode === 200 && row.parsed).length,
      hardPasses: group.filter((row) => row.grade?.passed).length,
      parseRate: group.filter((row) => row.statusCode === 200 && row.parsed).length / Math.max(group.length, 1),
      firstTextMedianMs: median(group.map((row) => row.firstTextMs)),
      totalMedianMs: median(group.map((row) => row.totalMs)),
      inputTokensAverage: average(group.map((row) => row.usage.input_tokens)),
      outputTokensAverage: average(group.map((row) => row.usage.output_tokens)),
    };
  });
}

const jobs = [];
for (const variant of holdoutVariants) {
  for (let repetition = 1; repetition <= holdoutRepeats; repetition += 1) {
    for (const item of HYBRID_CONFIRMATION_CASES) {
      jobs.push({ kind: "holdout", item, variant, repetition, prompt: buildHybridPrompt(item, variant) });
    }
  }
}
for (const variant of narrationVariants) {
  for (let repetition = 1; repetition <= narrationRepeats; repetition += 1) {
    for (const item of HYBRID_NARRATION_PACKETS) {
      const prompts = buildRecommendedNarrationPrompts(item);
      jobs.push({
        kind: "narration",
        item,
        variant,
        repetition,
        prompt: variant === "combined-baseline-v5" ? prompts.baseline : prompts.candidate,
      });
    }
  }
}

const runId = Date.now();
const report = {
  schemaVersion: "1.0",
  runId,
  objective: "DeepSeek V4 Flash confirmation A/B for generic v5 versus recommended hybrid-v6",
  startedAt: new Date().toISOString(),
  model,
  stream: true,
  thinking: "disabled",
  concurrency,
  holdoutRepeats,
  narrationRepeats,
  holdoutVariants,
  narrationVariants,
  k3ReferencePath: k3ReferencePath ?? null,
  runs: [],
};
const partialPath = join(outputDir, `deepseek-hybrid-v6-${runId}.partial.json`);
await runPool(jobs, concurrency, (row) => {
  report.runs.push(row);
  report.runs.sort((a, b) => jobs.findIndex((job) => job.kind === a.kind && job.variant === a.variant && job.repetition === a.repetition && job.item.id === a.id)
    - jobs.findIndex((job) => job.kind === b.kind && job.variant === b.variant && job.repetition === b.repetition && job.item.id === b.id));
  writeFileSync(partialPath, JSON.stringify(report, null, 2));
  console.log(`${row.kind} ${row.variant} rep=${row.repetition} ${row.id} status=${row.statusCode ?? "ERR"} ttft=${row.firstTextMs ?? "?"}ms total=${row.totalMs}ms tokens=${row.usage.input_tokens ?? "?"}/${row.usage.output_tokens ?? "?"} thinking=${row.thinkingChars} pass=${row.grade?.passed ?? false}`);
});
report.finishedAt = new Date().toISOString();
report.summary = {
  holdout: summarizeMultitextRuns(report.runs.filter((row) => row.kind === "holdout")),
  narration: summarizeNarration(report.runs.filter((row) => row.kind === "narration")),
};
const jsonPath = join(outputDir, `deepseek-hybrid-v6-${runId}.json`);
writeFileSync(jsonPath, JSON.stringify(report, null, 2));
if (existsSync(partialPath)) unlinkSync(partialPath);

const lines = [
  "# DeepSeek V4 Flash Hybrid-v6 Confirmation A/B",
  "",
  "## Holdout",
  "",
  "| Variant | Samples | Usable | Hard pass | TTFT median | Total median | Input tokens | Output tokens |",
  "|---|---:|---:|---:|---:|---:|---:|---:|",
];
for (const item of report.summary.holdout) {
  lines.push(`| ${item.variant} | ${item.samples} | ${item.usable} | ${item.hardPasses} (${(item.hardPassRate * 100).toFixed(1)}%) | ${Math.round(item.firstTextMedianMs ?? 0)} ms | ${Math.round(item.totalMedianMs ?? 0)} ms | ${(item.inputTokensAverage ?? 0).toFixed(1)} | ${(item.outputTokensAverage ?? 0).toFixed(1)} |`);
}
lines.push("", "## Combined narration", "", "| Variant | Samples | Usable | Hard pass | TTFT median | Total median | Input tokens | Output tokens |", "|---|---:|---:|---:|---:|---:|---:|---:|");
for (const item of report.summary.narration) {
  lines.push(`| ${item.variant} | ${item.samples} | ${item.usable} | ${item.hardPasses} | ${Math.round(item.firstTextMedianMs ?? 0)} ms | ${Math.round(item.totalMedianMs ?? 0)} ms | ${(item.inputTokensAverage ?? 0).toFixed(1)} | ${(item.outputTokensAverage ?? 0).toFixed(1)} |`);
}
const markdownPath = join(outputDir, `deepseek-hybrid-v6-${runId}.md`);
writeFileSync(markdownPath, lines.join("\n"));
console.log(`RESULT_JSON=${jsonPath}`);
console.log(`RESULT_MD=${markdownPath}`);
