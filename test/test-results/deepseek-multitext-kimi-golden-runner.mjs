import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { MULTITEXT_CASES, gradeMultitextOutput, parseMultitextOutput } from "./deepseek-multitext-prompt.mjs";

const outputDir = new URL("./", import.meta.url).pathname;
const dbPath = process.env.CC_SWITCH_DB ?? join(process.env.HOME ?? "", ".cc-switch", "cc-switch.db");
const providerId = "88fad08c-0440-4728-b69c-a073ce194c3a";
const model = "k3";

const query = `SELECT json_object('name',name,'settings',json(settings_config)) FROM providers WHERE id='${providerId}' LIMIT 1;`;
const result = spawnSync("sqlite3", [dbPath, query], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
if (result.status !== 0) throw new Error(result.stderr.trim());
const providerRow = JSON.parse(result.stdout.trim());
const providerEnv = providerRow.settings?.env ?? {};
if (!providerEnv.ANTHROPIC_BASE_URL || !providerEnv.ANTHROPIC_AUTH_TOKEN) throw new Error("Kimi provider is incomplete");
const provider = {
  name: providerRow.name,
  baseUrl: String(providerEnv.ANTHROPIC_BASE_URL).replace(/\/$/, ""),
  token: String(providerEnv.ANTHROPIC_AUTH_TOKEN),
};

function buildPrompt(item) {
  return `你是中文文本质量 golden reference 生成器。只依据给定 case 写作，不使用外部知识，不解释思考过程。\n`
    + `严格满足 task、source、constraints、output fields 和字符范围。不得为了写得生动而补事实。只返回该 case 的 JSON 对象。\n\n`
    + JSON.stringify(item);
}

function applyUsage(target, usage) {
  if (!usage || typeof usage !== "object") return;
  for (const [key, value] of Object.entries(usage)) if (typeof value === "number") target[key] = value;
}

function parseEvent(data, state, elapsedMs) {
  if (!data || data === "[DONE]") return;
  const event = JSON.parse(data);
  state.firstEventMs ??= elapsedMs;
  if (event.type === "message_start") applyUsage(state.usage, event.message?.usage);
  if (event.type === "content_block_start") {
    if (event.content_block?.type === "text" && event.content_block.text) {
      state.firstTextMs ??= elapsedMs;
      state.text += event.content_block.text;
    }
    if (event.content_block?.type === "thinking" && event.content_block.thinking) {
      state.thinkingChars += [...event.content_block.thinking].length;
    }
  }
  if (event.type === "content_block_delta") {
    const delta = event.delta ?? {};
    if (delta.type === "text_delta" && typeof delta.text === "string") {
      state.firstTextMs ??= elapsedMs;
      state.text += delta.text;
    }
    if (typeof delta.thinking === "string") state.thinkingChars += [...delta.thinking].length;
  }
  if (event.type === "message_delta") applyUsage(state.usage, event.usage);
  if (event.type === "error") state.error = event.error?.message ?? JSON.stringify(event.error ?? event);
}

async function runOne(item) {
  const started = Date.now();
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
      max_tokens: 8192,
      stream: true,
      thinking: { type: "enabled", budget_tokens: 4096 },
      messages: [{ role: "user", content: buildPrompt(item) }],
    }),
  });
  const state = { text: "", firstEventMs: null, firstTextMs: null, thinkingChars: 0, usage: {}, error: null };
  if (!response.body) throw new Error(`Kimi ${item.id}: empty response`);
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
      if (data) parseEvent(data, state, Date.now() - started);
    }
  }
  const parsedResult = parseMultitextOutput(state.text);
  const grade = parsedResult.parsed ? gradeMultitextOutput(item, parsedResult.parsed) : null;
  return {
    id: item.id,
    statusCode: response.status,
    firstEventMs: state.firstEventMs,
    firstTextMs: state.firstTextMs,
    totalMs: Date.now() - started,
    usage: state.usage,
    thinkingChars: state.thinkingChars,
    error: state.error,
    parseError: parsedResult.parseError,
    output: parsedResult.parsed,
    grade,
  };
}

const report = {
  generator: "Kimi K3",
  reasoningEffort: "max-budget-4096",
  provider: provider.name,
  model,
  startedAt: new Date().toISOString(),
  cases: [],
};

let nextIndex = 0;
async function worker() {
  while (nextIndex < MULTITEXT_CASES.length) {
    const index = nextIndex++;
    const item = MULTITEXT_CASES[index];
    const row = await runOne(item);
    report.cases.push(row);
    console.log(`${item.id} status=${row.statusCode} ttft=${row.firstTextMs ?? "?"}ms total=${row.totalMs}ms pass=${row.grade?.passed ?? false}`);
  }
}
await Promise.all([worker(), worker()]);
report.cases.sort((a, b) => MULTITEXT_CASES.findIndex((item) => item.id === a.id) - MULTITEXT_CASES.findIndex((item) => item.id === b.id));
report.finishedAt = new Date().toISOString();
const outputPath = join(outputDir, "deepseek-multitext-golden-kimi-k3-max.json");
writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(`RESULT_JSON=${outputPath}`);
