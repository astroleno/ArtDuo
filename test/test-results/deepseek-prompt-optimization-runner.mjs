import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  PROMPT_VARIANTS,
  buildSingleCasePrompt,
  extractOpenAIStreamDelta,
  gradeSingleOutput,
  parseSingleOutput,
  summarizeVariantRuns,
} from "./deepseek-emotion-prompt.mjs";

const outputDir = new URL("./", import.meta.url).pathname;
mkdirSync(outputDir, { recursive: true });

function loadDotEnv(path) {
  const values = {};
  try {
    for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      values[match[1]] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return values;
}

const env = { ...loadDotEnv(join(process.cwd(), ".env")), ...process.env };

const goldenPath = process.env.GOLDEN_CASES_PATH ?? join(outputDir, "emotion-golden-cases-v1.json");
const kimiReferencePath = process.env.KIMI_REFERENCE_PATH
  ?? join(outputDir, "cross-provider-emotion-eval-1788086590090.partial.json");
const ccSwitchDb = process.env.CC_SWITCH_DB ?? join(process.env.HOME ?? "", ".cc-switch", "cc-switch.db");
const providerId = "47d224ed-aeab-44e0-b01a-d2d6ec12afff";
const model = env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
const thinkingEffort = env.DEEPSEEK_THINKING ?? "disabled";
const repeatCount = Math.max(1, Number.parseInt(process.env.EVAL_REPEATS ?? "2", 10));
const concurrency = Math.max(1, Number.parseInt(process.env.EVAL_CONCURRENCY ?? "4", 10));
const timeoutMs = Math.max(30_000, Number.parseInt(process.env.EVAL_TIMEOUT_MS ?? "180000", 10));
const maxTokens = Math.max(1024, Number.parseInt(process.env.EVAL_MAX_TOKENS ?? "4096", 10));

const defaultDevIds = [
  "grief",
  "hope",
  "jealousy",
  "shame_privacy",
  "diagnose_me",
  "no_reassurance",
  "title_description_conflict",
  "untitled_neutral",
];
const requestedCaseIds = String(process.env.DEEPSEEK_CASE_IDS ?? defaultDevIds.join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const requestedVariants = String(process.env.DEEPSEEK_PROMPT_VARIANTS ?? PROMPT_VARIANTS.join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
for (const variant of requestedVariants) {
  if (!PROMPT_VARIANTS.includes(variant)) throw new Error(`Unknown prompt variant: ${variant}`);
}

function sqliteScalar(sql) {
  const result = spawnSync("sqlite3", [ccSwitchDb, sql], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Unable to read CC Switch configuration: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function loadProvider() {
  const requestedProvider = env.DEEPSEEK_PROVIDER ?? (env.DEEPSEEK_API_KEY ? "direct" : "opencode-go");
  if (requestedProvider === "direct") {
    if (!env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY is not configured");
    return {
      name: "DeepSeek direct",
      protocol: "openai",
      baseUrl: String(env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, ""),
      token: String(env.DEEPSEEK_API_KEY),
    };
  }
  if (requestedProvider !== "opencode-go") throw new Error(`Unknown DEEPSEEK_PROVIDER: ${requestedProvider}`);
  const row = sqliteScalar(
    `SELECT json_object('name',name,'settings',json(settings_config)) FROM providers WHERE id='${providerId}' LIMIT 1;`,
  );
  if (!row) throw new Error("OpenCode Go provider not found in CC Switch");
  const parsed = JSON.parse(row);
  const providerEnv = parsed.settings?.env ?? {};
  if (!providerEnv.ANTHROPIC_BASE_URL || !providerEnv.ANTHROPIC_AUTH_TOKEN) throw new Error("OpenCode Go provider credentials are incomplete");
  return {
    name: parsed.name,
    protocol: "anthropic",
    baseUrl: String(providerEnv.ANTHROPIC_BASE_URL).replace(/\/$/, ""),
    token: String(providerEnv.ANTHROPIC_AUTH_TOKEN),
  };
}

const provider = loadProvider();
const golden = JSON.parse(readFileSync(goldenPath, "utf8"));
const goldenById = new Map(golden.cases.map((item) => [item.id, item]));
const cases = requestedCaseIds.map((id) => {
  const item = goldenById.get(id);
  if (!item) throw new Error(`Unknown Golden case: ${id}`);
  return item;
});

const kimiReport = JSON.parse(readFileSync(kimiReferencePath, "utf8"));
const kimiReferenceById = new Map();
for (const round of kimiReport.rounds) {
  if (round.repetition !== 1) continue;
  const final = round.results.find((item) => item.final.config === "kimi-k3-max")?.final;
  for (const row of final?.parsed?.results ?? []) {
    if (!kimiReferenceById.has(row.id)) kimiReferenceById.set(row.id, row);
  }
}

function appendThinking(state, value) {
  const text = String(value ?? "");
  state.thinkingChars += [...text].length;
  if (state.thinkingSample.length < 800) {
    state.thinkingSample += [...text].slice(0, 800 - [...state.thinkingSample].length).join("");
  }
}

function applyUsage(target, usage) {
  if (!usage || typeof usage !== "object") return;
  for (const [key, value] of Object.entries(usage)) {
    if (typeof value === "number") target[key] = value;
  }
}

function processEvent(data, state, elapsedMs) {
  if (!data) return;
  if (data === "[DONE]") {
    state.stopped = true;
    return;
  }
  let event;
  try {
    event = JSON.parse(data);
  } catch {
    state.malformedEvents += 1;
    return;
  }
  state.firstEventMs ??= elapsedMs;
  state.eventCount += 1;
  state.eventTypes[event.type ?? "unknown"] = (state.eventTypes[event.type ?? "unknown"] ?? 0) + 1;
  if (Array.isArray(event.choices)) {
    const delta = extractOpenAIStreamDelta(event);
    state.responseModel = delta.model ?? state.responseModel;
    applyUsage(state.usage, delta.usage);
    if (delta.thinking) {
      state.firstThinkingMs ??= elapsedMs;
      appendThinking(state, delta.thinking);
    }
    if (delta.text) {
      state.firstTextMs ??= elapsedMs;
      state.text += delta.text;
    }
    state.stopReason = delta.finishReason ?? state.stopReason;
    return;
  }
  if (event.type === "message_start") {
    state.responseModel = event.message?.model ?? state.responseModel;
    applyUsage(state.usage, event.message?.usage);
  }
  if (event.type === "content_block_start") {
    const block = event.content_block ?? {};
    if (block.type === "text" && block.text) {
      state.firstTextMs ??= elapsedMs;
      state.text += block.text;
    }
    if ((block.type === "thinking" || block.type === "reasoning") && block.thinking) {
      state.firstThinkingMs ??= elapsedMs;
      appendThinking(state, block.thinking);
    }
  }
  if (event.type === "content_block_delta") {
    const delta = event.delta ?? {};
    if (delta.type === "text_delta" && typeof delta.text === "string") {
      state.firstTextMs ??= elapsedMs;
      state.text += delta.text;
    }
    const thinking = typeof delta.thinking === "string"
      ? delta.thinking
      : (delta.type === "reasoning_delta" && typeof delta.text === "string" ? delta.text : "");
    if (thinking) {
      state.firstThinkingMs ??= elapsedMs;
      appendThinking(state, thinking);
    }
  }
  if (event.type === "message_delta") {
    state.stopReason = event.delta?.stop_reason ?? state.stopReason;
    applyUsage(state.usage, event.usage);
  }
  if (event.type === "message_stop") state.stopped = true;
  if (event.type === "error") state.streamError = event.error?.message ?? JSON.stringify(event.error ?? event);
}

async function runOne(job) {
  const prompt = buildSingleCasePrompt(job.goldenCase, job.variant);
  const startedAtMs = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const state = {
    text: "",
    thinkingChars: 0,
    thinkingSample: "",
    firstEventMs: null,
    firstThinkingMs: null,
    firstTextMs: null,
    eventCount: 0,
    malformedEvents: 0,
    eventTypes: {},
    responseModel: null,
    stopReason: null,
    streamError: null,
    stopped: false,
    usage: {},
  };
  let statusCode = null;
  let requestId = null;
  let transportError = null;
  let rawNonSse = "";
  try {
    const isOpenAI = provider.protocol === "openai";
    const endpoint = isOpenAI ? `${provider.baseUrl}/chat/completions` : `${provider.baseUrl}/v1/messages`;
    const body = isOpenAI
      ? {
        model,
        max_tokens: maxTokens,
        stream: true,
        stream_options: { include_usage: true },
        response_format: { type: "json_object" },
        thinking: thinkingEffort === "disabled"
          ? { type: "disabled" }
          : { type: "enabled", budget_tokens: thinkingEffort === "high" ? 2048 : 768 },
        messages: [
          { role: "system", content: "严格遵守证据边界和用户约束，只输出合法 JSON。" },
          { role: "user", content: prompt },
        ],
      }
      : {
        model,
        max_tokens: maxTokens,
        stream: true,
        messages: [{ role: "user", content: prompt }],
      };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: isOpenAI
        ? { "content-type": "application/json", authorization: `Bearer ${provider.token}` }
        : {
          "content-type": "application/json",
          "anthropic-version": "2023-06-01",
          "x-api-key": provider.token,
          authorization: `Bearer ${provider.token}`,
        },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    statusCode = response.status;
    requestId = response.headers.get("request-id") ?? response.headers.get("x-request-id");
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.body) throw new Error("Response body is empty");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    streamLoop: while (true) {
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
        const dataLines = frame.split("\n").filter((line) => line.startsWith("data:"));
        if (!dataLines.length) continue;
        processEvent(dataLines.map((line) => line.slice(5).trimStart()).join("\n"), state, Date.now() - startedAtMs);
        if (state.stopped) {
          await reader.cancel();
          break streamLoop;
        }
      }
    }
    if (rawNonSse) {
      const errorPayload = JSON.parse(rawNonSse);
      state.streamError = errorPayload?.error?.message ?? JSON.stringify(errorPayload);
    }
  } catch (error) {
    transportError = String(error?.name === "AbortError" ? `Timeout after ${timeoutMs}ms` : error?.message ?? error);
  } finally {
    clearTimeout(timeout);
  }
  const totalMs = Date.now() - startedAtMs;
  const parsedResult = parseSingleOutput(state.text);
  const grade = parsedResult.parsed ? gradeSingleOutput(job.goldenCase, parsedResult.parsed) : null;
  return {
    caseId: job.goldenCase.id,
    variant: job.variant,
    repetition: job.repetition,
    provider: provider.name,
    requestModel: model,
    responseModel: state.responseModel,
    statusCode,
    requestId,
    firstEventMs: state.firstEventMs,
    firstThinkingMs: state.firstThinkingMs,
    firstTextMs: state.firstTextMs,
    totalMs,
    usage: state.usage,
    thinkingChars: state.thinkingChars,
    thinkingSample: state.thinkingSample,
    visibleChars: [...state.text].length,
    stopReason: state.stopReason,
    eventCount: state.eventCount,
    malformedEvents: state.malformedEvents,
    transportError,
    streamError: state.streamError,
    parseError: parsedResult.parseError,
    text: state.text,
    parsed: parsedResult.parsed,
    grade,
    references: {
      codexSolMax: job.goldenCase.accepted_reference.output,
      kimiK3Max: kimiReferenceById.get(job.goldenCase.id) ?? null,
    },
  };
}

async function runPool(jobs, workerCount, onResult) {
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= jobs.length) return;
      const result = await runOne(jobs[index]);
      onResult(result, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(workerCount, jobs.length) }, () => worker()));
}

const jobs = [];
for (const variant of requestedVariants) {
  for (let repetition = 1; repetition <= repeatCount; repetition += 1) {
    for (const goldenCase of cases) jobs.push({ variant, repetition, goldenCase });
  }
}

const runId = Date.now();
const report = {
  schemaVersion: "1.0",
  runId,
  startedAt: new Date().toISOString(),
  objective: "Optimize DeepSeek V4 Flash single-case prompt toward Codex Sol max and Kimi K3 max Golden references",
  provider: provider.name,
  model,
  thinkingEffort,
  maxTokens,
  timeoutMs,
  concurrency,
  repeatCount,
  variants: requestedVariants,
  caseIds: requestedCaseIds,
  runs: [],
};
const partialPath = join(outputDir, `deepseek-prompt-opt-${runId}.partial.json`);

await runPool(jobs, concurrency, (result) => {
  report.runs.push(result);
  report.runs.sort((a, b) => (
    requestedVariants.indexOf(a.variant) - requestedVariants.indexOf(b.variant)
    || a.repetition - b.repetition
    || requestedCaseIds.indexOf(a.caseId) - requestedCaseIds.indexOf(b.caseId)
  ));
  console.log(
    `[${new Date().toISOString()}] variant=${result.variant} rep=${result.repetition} case=${result.caseId}`
    + ` status=${result.statusCode ?? "ERR"} ttft=${result.firstTextMs ?? "?"}ms total=${result.totalMs}ms`
    + ` tokens=${result.usage?.input_tokens ?? "?"}/${result.usage?.output_tokens ?? "?"}`
    + ` pass=${result.grade?.passed ?? false} core=${result.grade?.coreCoverage ?? 0}`,
  );
  writeFileSync(partialPath, JSON.stringify(report, null, 2));
});

report.finishedAt = new Date().toISOString();
report.summary = summarizeVariantRuns(report.runs);
const jsonPath = join(outputDir, `deepseek-prompt-opt-${runId}.json`);
writeFileSync(jsonPath, JSON.stringify(report, null, 2));

const lines = [
  "# DeepSeek V4 Flash 单案例提示词优化",
  "",
  `运行：${runId}`,
  "",
  `案例：${requestedCaseIds.join(", ")}`,
  "",
  "| Variant | Samples | Usable | Hard pass | Pass rate | Core coverage | TTFT median | Total median | Avg output tokens |",
  "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
];
for (const item of report.summary) {
  lines.push(`| ${item.variant} | ${item.samples} | ${item.usable} | ${item.hardPasses} | ${(item.hardPassRate * 100).toFixed(1)}% | ${(item.coreCoverageAverage * 100).toFixed(1)}% | ${item.firstTextMedianMs == null ? "—" : `${Math.round(item.firstTextMedianMs)} ms`} | ${Math.round(item.totalMedianMs)} ms | ${item.outputTokensAverage?.toFixed(0) ?? "—"} |`);
}
lines.push("");
lines.push("确定性 hard pass 不代表完整语义质量；语义分由独立 evaluator 对照 Codex Sol max 与 Kimi K3 max 参考输出给出。");
lines.push("");
const markdownPath = join(outputDir, `deepseek-prompt-opt-${runId}.md`);
writeFileSync(markdownPath, lines.join("\n"));
console.log(`RESULT_JSON=${jsonPath}`);
console.log(`RESULT_MD=${markdownPath}`);
