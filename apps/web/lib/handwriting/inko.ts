import { keepsakeWritingText, type ExhibitionKeepsakeDraft, type HandwritingStyle } from "@artduo/contracts";
import { HandwritingError } from "./config";

type JsonObject = Record<string, any>;
export class InkoClient {
  constructor(private readonly config: { base: string; key: string }, private readonly fetcher: typeof fetch = fetch) {}
  async call(method: string, route: string, body?: unknown, idempotencyKey?: string): Promise<JsonObject> {
    const response = await this.fetcher(`${this.config.base}${route}`, { method, cache: "no-store", redirect: "error",
      headers: { Authorization: `Bearer ${this.config.key}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25_000) });
    const raw = await response.text();
    if (raw.length > (route.startsWith("/styles") ? 12_000_000 : 2_000_000)) throw new HandwritingError("upstream-invalid", "手写服务返回了无法读取的结果。", 502);
    let value: JsonObject;
    try { value = raw ? JSON.parse(raw) : {}; } catch { throw new HandwritingError("upstream-invalid", "手写服务暂时无法响应。", 502); }
    if (!response.ok) {
      const code = String(value.error?.code ?? "upstream-error");
      throw new HandwritingError(code, response.status === 429 ? "手写服务正在处理其他任务，请稍候。" : "手写服务暂时不可用，可以稍后重试。",
        response.status, Math.max(3, Math.min(60, Number(response.headers.get("Retry-After")) || 5)));
    }
    return value;
  }
  async styles(allowed?: string[]): Promise<HandwritingStyle[]> {
    const result = await this.call("GET", "/styles?model=lyric-1");
    if (!Array.isArray(result.data)) throw new HandwritingError("styles-invalid", "字迹列表暂时无法读取。", 502);
    const styles = result.data.filter((s: JsonObject) => !allowed || allowed.includes(String(s.code ?? s.id)))
      .sort((a: JsonObject, b: JsonObject) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || Number(Boolean(b.default)) - Number(Boolean(a.default)));
    // A small deliberate selection, all verified against this account/model.
    return styles.slice(0, 6).map((s: JsonObject) => ({ code: String(s.code ?? s.id), name: String(s.label ?? s.name ?? `No.${s.code ?? s.id}`),
      ...(typeof s.preview?.["lyric-1"]?.card === "string" && /^https:\/\/inkotype\.com\/previews\//u.test(s.preview["lyric-1"].card) ? { previewUrl: s.preview["lyric-1"].card } : {}) }))
      .filter((s: HandwritingStyle) => /^[\w-]{1,80}$/u.test(s.code));
  }
  layout(draft: ExhibitionKeepsakeDraft) {
    const text = keepsakeWritingText(draft);
    return { text, paperId: "blank", d: { size: 7, line: 1.65, indent: 0, margins: [20, 20, 28, 20], style: draft.styleCode },
      ...(draft.viewerSignature ? { marks: [{ id: "signature", start: draft.closingText.length + 1, end: text.length, f: { align: "right", indent: 0 } }] } : {}) };
  }
  async validate(draft: ExhibitionKeepsakeDraft) {
    const text = keepsakeWritingText(draft), layout = this.layout(draft);
    const quote = await this.call("POST", "/quote", { text, model: "lyric-1", size: "medium", style: draft.styleCode });
    const price = quote.price;
    if (!price || price.list_cents !== 0 || price.cost_cents !== undefined && price.cost_cents !== 0
      || quote.cost_cents !== undefined && quote.cost_cents !== 0) throw new HandwritingError("nonzero-or-missing-quote", "手写服务未返回有效的零费用报价，本次没有提交。", 409);
    if (quote.ok !== true || quote.errors?.length) {
      const symbol = quote.errors?.[0]?.symbol;
      throw new HandwritingError("unsupported-text", `这份字迹暂时无法完整书写${typeof symbol === "string" ? `「${symbol.slice(0, 20)}」` : "所选文字"}，请修改寄语或切换字迹。`, 422);
    }
    const plan = await this.call("POST", "/layout", { model: "lyric-1", layout });
    if (!plan.price || plan.price.list_cents !== 0 || plan.price.cost_cents !== undefined && plan.price.cost_cents !== 0) throw new HandwritingError("nonzero-or-missing-quote", "排版未返回有效的零费用报价，本次没有提交。", 409);
    if (typeof plan.unplaced !== "number" || plan.unplaced !== 0 || !Number.isInteger(plan.pages) || plan.pages < 1 || plan.pages > 4) throw new HandwritingError("layout-overflow", "这些文字无法完整放入纪念卡，请调整段落或缩短文字。", 422);
    return { quote, layout, plan };
  }
  submit(draft: ExhibitionKeepsakeDraft, layout: unknown, id: string) {
    return this.call("POST", "/generations", { model: "lyric-1", style: draft.styleCode, label: "visible", scene: true, layout }, `artduo-${id}`);
  }
  status(id: string) { return this.call("GET", `/generations/${encodeURIComponent(id)}`); }
  cancel(id: string) { return this.call("POST", `/generations/${encodeURIComponent(id)}/cancel`); }
  delivered(id: string) { return this.call("POST", `/generations/${encodeURIComponent(id)}/delivery-complete`); }
  async download(url: string): Promise<Buffer> {
    const parsed = new URL(url);
    const trustedHost = parsed.hostname === new URL(this.config.base).hostname || parsed.hostname === "inkotype.com" || parsed.hostname.endsWith(".inkotype.com");
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || !trustedHost) throw new HandwritingError("asset-url-invalid", "手写素材地址无效。", 502);
    const response = await this.fetcher(url, { signal: AbortSignal.timeout(40_000), redirect: "error", cache: "no-store" });
    if (!response.ok) throw new HandwritingError("link-expired", "手写素材链接已过期，正在重新获取。", response.status);
    const maximum = 50 * 1024 * 1024;
    if (Number(response.headers.get("Content-Length")) > maximum) throw new HandwritingError("asset-too-large", "手写素材过大，请缩短寄语后重试。", 422);
    const reader = response.body?.getReader(); if (!reader) throw new HandwritingError("asset-empty", "手写素材未能下载。", 502);
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length;
        if (size > maximum) throw new HandwritingError("asset-too-large", "手写素材过大，请缩短寄语后重试。", 422); chunks.push(part.value); }
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    return Buffer.concat(chunks);
  }
}
