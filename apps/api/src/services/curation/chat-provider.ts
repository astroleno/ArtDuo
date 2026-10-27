import { readProjectModelEnvironment } from "../../runtime/environment";
import { acquireProviderPermit } from "../../runtime/request-policy";
export { readProjectModelEnvironment } from "../../runtime/environment";

export interface CurationChatConfig { endpoint: string; model: string; apiKey: string; rootDir?: string }
export interface ChatMessage { role: "system" | "user"; content: string }
export type ChatStream = (messages: ChatMessage[], options: { json?: boolean; signal?: AbortSignal; timeoutMs?: number; maxTokens?: number }) => AsyncIterable<string>;

/** Server-only configuration. Loading a config never performs a provider request. */
export function readCurationChatConfig(rootDir: string, environment: NodeJS.ProcessEnv = process.env): CurationChatConfig | undefined {
  if (environment.ARTDUO_CURATION_PROVIDER === "disabled" || environment.NODE_ENV === "test") return undefined;
  const config = readProjectModelEnvironment(rootDir, environment);
  if (config.ARTDUO_CURATION_PROVIDER === "disabled") return undefined;
  const model = config.ARTDUO_CURATION_MODEL?.trim() || config.DEEPSEEK_MODEL?.trim();
  const base = config.ARTDUO_CURATION_ENDPOINT?.trim() || config.DEEPSEEK_BASE_URL?.trim();
  const apiKey = config.ARTDUO_CURATION_API_KEY?.trim() || config.DEEPSEEK_API_KEY?.trim();
  if (!model || !base || !apiKey) return undefined;
  const normalized = base.replace(/\/+$/u, "");
  const endpoint = normalized.endsWith("/chat/completions") ? normalized : `${normalized}/chat/completions`;
  const url = new URL(endpoint);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new TypeError("Curation provider requires HTTPS or a local endpoint");
  return { endpoint, model, apiKey, rootDir };
}

/** Decode provider SSE without confusing transport chunks with JSON or text lines. */
export async function* readChatSse(response: Response): AsyncGenerator<string> {
  if (!response.ok) throw new Error(`Curation provider failed (${response.status})`);
  if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) throw new Error("Curation provider did not return an SSE stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let received = 0;
  let finished = false;
  function parseFrame(frame: string): string | undefined {
    const data = frame.split(/\r?\n/u).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
    if (!data) return undefined;
    if (data === "[DONE]") { finished = true; return undefined; }
    const item = JSON.parse(data) as { error?: unknown; choices?: Array<{ delta?: { content?: unknown }; finish_reason?: unknown }> };
    if (item.error) throw new Error("Curation provider returned a stream error");
    const choice = item.choices?.[0];
    if (choice?.finish_reason === "length") throw new Error("Curation provider output was truncated");
    const content = choice?.delta?.content;
    return typeof content === "string" ? content : undefined;
  }
  try {
    while (!finished) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > 256_000) throw new Error("Curation provider response exceeds its size limit");
      buffer += decoder.decode(value, { stream: true });
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/u.exec(buffer))) {
        const frame = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const delta = parseFrame(frame);
        if (delta) yield delta;
        if (finished) break;
      }
    }
    buffer += decoder.decode();
    if (!finished && buffer.trim()) { const delta = parseFrame(buffer); if (delta) yield delta; }
    if (!finished) throw new Error("Curation provider stream ended before completion");
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

export function createCurationChatStream(config: CurationChatConfig, fetchImpl: typeof fetch = fetch): ChatStream {
  return async function* (messages, options) {
    const timeout = AbortSignal.timeout(options.timeoutMs ?? 25_000);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const body = JSON.stringify({
        model: config.model, stream: true, temperature: 0.2, max_tokens: options.maxTokens ?? 2200,
        ...(options.json ? { response_format: { type: "json_object" } } : {}),
        ...(config.endpoint.includes("deepseek") || config.model.startsWith("deepseek") ? { thinking: { type: "disabled" } } : {}),
        messages,
      });
    const started = Date.now();
    const permit = config.rootDir ? await acquireProviderPermit(config.rootDir, { requestBytes: Buffer.byteLength(body), maxOutputTokens: options.maxTokens ?? 2200, kind: options.json ? "intent" : "narrative", model: config.model }) : undefined;
    let status: "ok" | "error" = "error", firstTokenMs: number | undefined;
    try {
      const response = await fetchImpl(config.endpoint, { method: "POST", signal,
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" }, body });
      for await (const delta of readChatSse(response)) { firstTokenMs ??= Date.now() - started; yield delta; }
      status = "ok";
    } finally { await permit?.finish({ status, firstTokenMs }); }
  };
}
