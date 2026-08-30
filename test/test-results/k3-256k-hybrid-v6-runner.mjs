import { spawnSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  HYBRID_CONFIRMATION_CASES,
  HYBRID_NARRATION_PACKETS,
  buildHybridPrompt,
  buildRecommendedNarrationPrompts,
} from "./deepseek-hybrid-v6.mjs";
import { createStreamState, parseJsonText, processAnthropicEvent } from "./deepseek-hybrid-v6-stream.mjs";
import { gradeMultitextOutput } from "./deepseek-multitext-prompt.mjs";

const outputDir = new URL("./", import.meta.url).pathname;
const ccSwitchDb = process.env.CC_SWITCH_DB ?? join(process.env.HOME ?? "", ".cc-switch", "cc-switch.db");
const providerId = process.env.K3_PROVIDER_ID ?? "88fad08c-0440-4728-b69c-a073ce194c3a";
const model = process.env.K3_MODEL ?? "k3-256k";
const concurrency = Math.max(1, Number.parseInt(process.env.K3_EVAL_CONCURRENCY ?? "2", 10));
const timeoutMs = Math.max(30_000, Number.parseInt(process.env.K3_EVAL_TIMEOUT_MS ?? "600000", 10));
const maxTokens = Math.max(8192, Number.parseInt(process.env.K3_EVAL_MAX_TOKENS ?? "8192", 10));
const thinkingBudget = Math.max(1024, Number.parseInt(process.env.K3_THINKING_BUDGET ?? "4096", 10));
const maxAttempts = Math.max(1, Number.parseInt(process.env.K3_EVAL_MAX_ATTEMPTS ?? "2", 10));

function sqliteScalar(sql) {
  const result = spawnSync("sqlite3", [ccSwitchDb, sql], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Unable to read CC Switch configuration: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function loadProvider(id) {
  const escapedId = id.replaceAll("'", "''");
  const row = sqliteScalar(`SELECT json_object('name',name,'settings',json(settings_config)) FROM providers WHERE id='${escapedId}' LIMIT 1;`);
  if (!row) throw new Error(`CC Switch provider not found: ${id}`);
  const parsed = JSON.parse(row);
  const env = parsed.settings?.env ?? {};
  if (!env.ANTHROPIC_BASE_URL || !env.ANTHROPIC_AUTH_TOKEN) throw new Error(`CC Switch provider is incomplete: ${parsed.name}`);
  return {
    name: parsed.name,
    baseUrl: String(env.ANTHROPIC_BASE_URL).replace(/\/$/, ""),
    token: String(env.ANTHROPIC_AUTH_TOKEN),
  };
}

const provider = loadProvider(providerId);

function validateNarration(parsed) {
  const fields = ["preface", "closing", "preface_boundary", "closing_boundary"];
  const keys = parsed && typeof parsed === "object" ? Object.keys(parsed).sort() : [];
  const exactFields = JSON.stringify(keys) === JSON.stringify([...fields].sort());
  const stringFields = fields.every((field) => typeof parsed?.[field] === "string" && parsed[field].trim());
  const lengths = Object.fromEntries(fields.map((field) => [field, [...String(parsed?.[field] ?? "")].length]));
  return { passed: exactFields && stringFields, exactFields, stringFields, lengths };
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
    const response = await fetch(`${provider.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": provider.token,
        authorization: `Bearer ${provider.token}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        stream: true,
        thinking: { type: "enabled", budget_tokens: thinkingBudget },
        system: "只依据用户消息中的封闭证据完成中文任务。严格遵守JSON契约，不调用工具，不使用外部知识。",
        messages: [{ role: "user", content: prompt }],
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
    streamLoop: while (true) {
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
        if (!data) continue;
        processAnthropicEvent(data, state, elapsedMs);
        if (state.messageStopped) {
          await reader.cancel();
          break streamLoop;
        }
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
    thinkingSample: [...state.thinkingText].slice(0, 2000).join(""),
    stopReason: state.stopReason,
    eventCount: state.eventCount,
    malformedEventCount: state.malformedEventCount,
    transportError,
    streamError: state.streamError,
    text: state.text,
  };
}

async function runJob(job, attempt) {
  const streamed = await streamPrompt(job.prompt);
  const parsedResult = parseJsonText(streamed.text);
  const validation = parsedResult.parsed
    ? (job.kind === "holdout" ? gradeMultitextOutput(job.item, parsedResult.parsed) : validateNarration(parsedResult.parsed))
    : null;
  return {
    kind: job.kind,
    id: job.item.id,
    taskType: job.item.taskType ?? "combined_narration",
    attempt,
    requestModel: model,
    ...streamed,
    parseError: parsedResult.parseError,
    parsed: parsedResult.parsed,
    validation,
  };
}

async function runWithRetry(job) {
  const attempts = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const row = await runJob(job, attempt);
    attempts.push(row);
    if (row.statusCode === 200 && row.parsed) break;
  }
  return { ...attempts.at(-1), attempts: attempts.length };
}

async function runPool(jobs, workerCount, onResult) {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < jobs.length) {
      const index = nextIndex++;
      onResult(await runWithRetry(jobs[index]));
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

function summarize(rows) {
  const usable = rows.filter((row) => row.statusCode === 200 && row.parsed);
  const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  return {
    samples: rows.length,
    usable: usable.length,
    parseRate: usable.length / Math.max(rows.length, 1),
    hardPasses: usable.filter((row) => row.validation?.passed).length,
    firstTextMedianMs: median(usable.map((row) => row.firstTextMs)),
    totalMedianMs: median(usable.map((row) => row.totalMs)),
    inputTokensAverage: average(usable.map((row) => row.usage.input_tokens).filter(Number.isFinite)),
    outputTokensAverage: average(usable.map((row) => row.usage.output_tokens).filter(Number.isFinite)),
    thinkingCharsAverage: average(usable.map((row) => row.thinkingChars).filter(Number.isFinite)),
  };
}

const jobs = [
  ...HYBRID_CONFIRMATION_CASES.map((item) => ({
    kind: "holdout",
    item,
    prompt: buildHybridPrompt(item, "recommended-hybrid-v6"),
  })),
  ...HYBRID_NARRATION_PACKETS.map((item) => ({
    kind: "narration",
    item,
    prompt: buildRecommendedNarrationPrompts(item).candidate,
  })),
];
const runId = Date.now();
const report = {
  schemaVersion: "1.0",
  runId,
  objective: "K3-256k golden/comparator for the recommended hybrid-v6 prompt framework",
  startedAt: new Date().toISOString(),
  harness: "anthropic-compatible-direct-sse",
  provider: provider.name,
  model,
  thinking: { type: "enabled", budgetTokens: thinkingBudget },
  maxTokens,
  concurrency,
  results: [],
};
const partialPath = join(outputDir, `k3-256k-hybrid-v6-${runId}.partial.json`);
await runPool(jobs, concurrency, (row) => {
  report.results.push(row);
  report.results.sort((a, b) => jobs.findIndex((job) => job.item.id === a.id) - jobs.findIndex((job) => job.item.id === b.id));
  writeFileSync(partialPath, JSON.stringify(report, null, 2));
  console.log(`${row.kind} ${row.id} status=${row.statusCode ?? "ERR"} ttft=${row.firstTextMs ?? "?"}ms total=${row.totalMs}ms tokens=${row.usage.input_tokens ?? "?"}/${row.usage.output_tokens ?? "?"} thinking=${row.thinkingChars} pass=${row.validation?.passed ?? false} attempts=${row.attempts}`);
});
report.finishedAt = new Date().toISOString();
report.summary = {
  holdout: summarize(report.results.filter((row) => row.kind === "holdout")),
  narration: summarize(report.results.filter((row) => row.kind === "narration")),
};
const jsonPath = join(outputDir, `k3-256k-hybrid-v6-${runId}.json`);
writeFileSync(jsonPath, JSON.stringify(report, null, 2));
if (existsSync(partialPath)) unlinkSync(partialPath);

const lines = [
  "# K3-256k Hybrid-v6 Golden / Comparator",
  "",
  "| Group | Samples | Usable | Hard pass | TTFT median | Total median | Input tokens | Output tokens | Thinking chars |",
  "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
];
for (const [group, item] of Object.entries(report.summary)) {
  lines.push(`| ${group} | ${item.samples} | ${item.usable} | ${item.hardPasses} | ${Math.round(item.firstTextMedianMs ?? 0)} ms | ${Math.round(item.totalMedianMs ?? 0)} ms | ${(item.inputTokensAverage ?? 0).toFixed(1)} | ${(item.outputTokensAverage ?? 0).toFixed(1)} | ${(item.thinkingCharsAverage ?? 0).toFixed(1)} |`);
}
const markdownPath = join(outputDir, `k3-256k-hybrid-v6-${runId}.md`);
writeFileSync(markdownPath, lines.join("\n"));
console.log(`RESULT_JSON=${jsonPath}`);
console.log(`RESULT_MD=${markdownPath}`);
