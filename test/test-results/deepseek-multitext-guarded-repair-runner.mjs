import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";

import { extractOpenAIStreamDelta } from "./deepseek-emotion-prompt.mjs";
import {
  MULTITEXT_CASES,
  buildMultitextRepairPrompt,
  collectV31GuardIssues,
  gradeMultitextOutput,
  parseMultitextOutput,
  summarizeMultitextRuns,
} from "./deepseek-multitext-prompt.mjs";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Usage: node deepseek-multitext-guarded-repair-runner.mjs <v3.1-eval.json>");

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
const concurrency = Math.max(1, Number.parseInt(env.EVAL_CONCURRENCY ?? "4", 10));
const timeoutMs = Math.max(30_000, Number.parseInt(env.EVAL_TIMEOUT_MS ?? "180000", 10));
const maxTokens = Math.max(512, Number.parseInt(env.EVAL_MAX_TOKENS ?? "2048", 10));
if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured");

const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const caseById = new Map(MULTITEXT_CASES.map((item) => [item.id, item]));

function applyUsage(target, usage) {
  if (!usage || typeof usage !== "object") return;
  for (const [key, value] of Object.entries(usage)) if (typeof value === "number") target[key] = value;
}

function addUsage(left = {}, right = {}) {
  const result = {};
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const values = [left[key], right[key]].filter(Number.isFinite);
    if (values.length) result[key] = values.reduce((sum, value) => sum + value, 0);
  }
  return result;
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

async function streamRequest(prompt) {
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
          { role: "system", content: "只依据给定信息重写中文文本，严格遵守证据边界、长度与 JSON 契约。" },
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
  return {
    statusCode,
    requestId,
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
  };
}

function compactAttempt(row, issues) {
  return {
    statusCode: row.statusCode,
    requestId: row.requestId,
    firstEventMs: row.firstEventMs,
    firstTextMs: row.firstTextMs,
    totalMs: row.totalMs,
    usage: row.usage,
    thinkingChars: row.thinkingChars,
    parseError: row.parseError,
    issues,
    text: row.text,
    parsed: row.parsed,
  };
}

async function repairRow(row) {
  const item = caseById.get(row.id);
  if (!item) throw new Error(`Unknown case id: ${row.id}`);
  const initialIssues = row.parsed ? collectV31GuardIssues(item, row.parsed) : [{ type: "parse_error" }];
  const attempts = [compactAttempt(row, initialIssues)];
  if (!initialIssues.length) return { ...row, variant: "source-isolated-v3.1+repair1", attemptCount: 1, repaired: false, guardIssues: [], attempts };

  const repair = await streamRequest(buildMultitextRepairPrompt(item, initialIssues));
  const repairIssues = repair.parsed ? collectV31GuardIssues(item, repair.parsed) : [{ type: "parse_error" }];
  attempts.push(compactAttempt(repair, repairIssues));
  const useRepair = repair.parsed && repairIssues.length < initialIssues.length;
  const selected = useRepair ? repair : row;
  const selectedIssues = useRepair ? repairIssues : initialIssues;
  const endToEndMs = row.totalMs + repair.totalMs;
  return {
    ...row,
    ...selected,
    id: row.id,
    category: row.category,
    variant: "source-isolated-v3.1+repair1",
    repetition: row.repetition,
    requestModel: row.requestModel,
    references: row.references,
    grade: selected.parsed ? gradeMultitextOutput(item, selected.parsed) : null,
    firstTextMs: useRepair && Number.isFinite(repair.firstTextMs) ? row.totalMs + repair.firstTextMs : row.firstTextMs,
    totalMs: endToEndMs,
    usage: addUsage(row.usage, repair.usage),
    thinkingChars: (row.thinkingChars ?? 0) + (repair.thinkingChars ?? 0),
    attemptCount: 2,
    repaired: useRepair,
    guardIssues: selectedIssues,
    attempts,
  };
}

async function runPool(rows, workerCount) {
  const results = new Array(rows.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < rows.length) {
      const index = nextIndex++;
      results[index] = await repairRow(rows[index]);
      const row = results[index];
      console.log(`${row.id} rep=${row.repetition} attempts=${row.attemptCount} repaired=${row.repaired} issues=${row.guardIssues.length} total=${row.totalMs}ms`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(workerCount, rows.length) }, () => worker()));
  return results;
}

const report = {
  ...source,
  schemaVersion: "1.1",
  sourceRunId: source.runId,
  runId: Date.now(),
  objective: "Evaluate conditional one-repair v3.1 path for neutral emotion and framing text",
  startedAt: new Date().toISOString(),
  variants: ["source-isolated-v3.1+repair1"],
};
report.runs = await runPool(source.runs, concurrency);
report.finishedAt = new Date().toISOString();
report.summary = summarizeMultitextRuns(report.runs);
report.repairSummary = {
  samples: report.runs.length,
  attempted: report.runs.filter((row) => row.attemptCount === 2).length,
  selectedRepair: report.runs.filter((row) => row.repaired).length,
  finalGuardPasses: report.runs.filter((row) => row.guardIssues.length === 0).length,
  finalHardPasses: report.runs.filter((row) => row.grade?.passed).length,
};

const extension = extname(sourcePath);
const stem = basename(sourcePath, extension);
const outputPath = join(dirname(sourcePath), `${stem}-guarded${extension}`);
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
const markdownPath = join(dirname(sourcePath), `${stem}-guarded.md`);
const summary = report.summary[0];
writeFileSync(markdownPath, `# DeepSeek V4 Flash v3.1 条件修订 Eval\n\n| Samples | Repair attempted | Repair selected | Guard pass | Hard pass | TTFT median | Total median | Input tokens | Output tokens |\n|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n| ${report.repairSummary.samples} | ${report.repairSummary.attempted} | ${report.repairSummary.selectedRepair} | ${report.repairSummary.finalGuardPasses} | ${report.repairSummary.finalHardPasses} | ${Math.round(summary.firstTextMedianMs)} ms | ${Math.round(summary.totalMedianMs)} ms | ${summary.inputTokensAverage.toFixed(0)} | ${summary.outputTokensAverage.toFixed(0)} |\n`);
console.log(`RESULT_JSON=${outputPath}`);
console.log(`RESULT_MD=${markdownPath}`);
