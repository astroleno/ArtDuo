import { projectRootFromCwd } from "../../api/src/runtime/environment";
import { enforceVisitorLimit, RuntimeLimitError } from "../../api/src/runtime/request-policy";

export { RuntimeLimitError };
export const enforcePublicRequest = (headers: Pick<Headers, "get">, scope: "curation" | "narrative" | "explanation" | "handwriting") => enforceVisitorLimit(projectRootFromCwd(), headers, scope);

export function publicRequestError(error: unknown): Response {
  const limited = error instanceof RuntimeLimitError;
  return Response.json({ message: limited && error.status === 429 ? "现在请求较多，请稍后再试。" : "服务暂时不可用，请稍后再试。" },
    { status: limited ? error.status : 503, headers: { "Retry-After": String(limited ? error.retryAfter : 60), "Cache-Control": "no-store" } });
}

export async function readBoundedRequestJson(request: Request, maximumBytes = 16_384): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maximumBytes) throw new RuntimeLimitError("request-too-large", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("Missing body");
  let bytes = 0, text = ""; const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBytes) throw new RuntimeLimitError("request-too-large", 413);
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
