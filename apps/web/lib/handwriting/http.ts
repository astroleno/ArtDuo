import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { appPath, parseKeepsakeDraft } from "@artduo/contracts";
import { projectRootFromCwd, publicOrigins, readProjectModelEnvironment } from "../../../api/src/runtime/environment";
import { enforcePublicRequest, readBoundedRequestJson, RuntimeLimitError } from "../public-runtime";
import { loadWebReleaseCatalog } from "../release-catalog";
import { readSavedCuration } from "../semantic-curator";
import { handwritingConfig, HandwritingError } from "./config";
import { digest, HandwritingStore } from "./store";

const COOKIE = "artduo_handwriting";
function session(request: Request, create = false, config = handwritingConfig(projectRootFromCwd())) {
  let token = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  let cookie: string | undefined;
  if (!token || !/^[a-f0-9]{64}$/u.test(token)) {
    if (!create) throw new HandwritingError("not-found", "这张纪念卡不存在或不属于当前会话。", 404);
    token = randomBytes(32).toString("hex");
    cookie = `${COOKIE}=${token}; Path=${appPath("/api/handwriting", config.basePath)}; HttpOnly; SameSite=Lax; Max-Age=2592000${config.publicMode || new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
  }
  return { owner: digest(token), cookie };
}
const json = (body: unknown, status = 200, cookie?: string) => Response.json(body, { status, headers: { "Cache-Control": "no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) } });
function context() { const root = projectRootFromCwd(), config = handwritingConfig(root); return { root, config, store: new HandwritingStore(config.state, config.basePath) }; }
function healthy(store: HandwritingStore) { const options = store.options(); return Boolean(options?.available && Date.now() - options.at < 20_000); }
export function assertHandwritingOrigin(request: Request, environment = readProjectModelEnvironment(projectRootFromCwd())) {
  const origin = request.headers.get("Origin");
  let allowed = false;
  try {
    if (environment.ARTDUO_PUBLIC_MODE === "1" && origin) {
      const page = new URL(origin);
      allowed = publicOrigins(environment).includes(origin)
        && page.host === request.headers.get("host")?.toLowerCase();
    }
    else if (origin) {
      const page = new URL(origin), internal = new URL(request.url);
      // Next reconstructs a localhost Request URL even when the incoming Host
      // is 127.0.0.1. Only literal loopback hosts are accepted in local mode.
      allowed = origin === page.origin && ["127.0.0.1", "localhost", "[::1]"].includes(page.hostname)
        && page.protocol === internal.protocol && page.host === (request.headers.get("host") ?? internal.host).toLowerCase();
    }
  } catch { /* Invalid or opaque origins remain rejected. */ }
  if (!allowed) throw new HandwritingError("origin-required", "请从当前 ArtDuo 页面发起制作。", 403);
}
export function handwritingResponseError(error: unknown) {
  if (error instanceof HandwritingError) return json({ message: error.message, code: error.code, retryAfterMs: error.retryAfter * 1000 }, error.status);
  if (error instanceof RuntimeLimitError) return json({ message: error.status === 429 ? "现在制作请求较多，请稍后再试。" : "任务服务暂时不可用。", code: error.code }, error.status);
  if (error instanceof TypeError || error instanceof SyntaxError) return json({ message: "这份寄语卡的内容无效，请重新确认。", code: "invalid-draft" }, 400);
  return json({ message: "任务服务暂时不可用，输入已保留。", code: "service-unavailable" }, 503);
}

export async function handwritingOptions(request: Request) {
  try {
    const { store, config } = context(), auth = session(request, true, config), options = store.options();
    return json({ available: healthy(store), styles: options?.styles ?? [],
      ...(!healthy(store) ? { message: options?.message ?? "手写服务尚未就绪，仍可保存普通文字版本。" } : {}) }, 200, auth.cookie);
  } catch (error) { return handwritingResponseError(error); }
}
export async function createHandwritingJob(request: Request) {
  try {
    assertHandwritingOrigin(request); await enforcePublicRequest(request.headers, "handwriting");
    const body = await readBoundedRequestJson(request) as Record<string, unknown>;
    if (!body || body.confirmed !== true || typeof body.requestId !== "string" || !/^[\w-]{16,80}$/u.test(body.requestId)) throw new TypeError("Invalid handwriting request");
    const draft = parseKeepsakeDraft(body.draft), { store, config } = context(), auth = session(request, true, config);
    const catalog = loadWebReleaseCatalog({ releaseVersion: draft.releaseVersion });
    if (!catalog.artworkById.has(draft.artworkId)) throw new HandwritingError("artwork-unavailable", "这件作品的资料已不可用，请回到展览重新确认。", 404);
    if (body.curationId !== undefined) {
      if (typeof body.curationId !== "string") throw new TypeError("Invalid curation");
      const saved = readSavedCuration(catalog, body.curationId);
      if (!saved.assignments.some(item => item.artworkId === draft.artworkId)) throw new TypeError("Artwork is not in this exhibition");
    }
    const job = await store.create(auth.owner, draft, body.requestId, Date.now(), () => {
      if (!healthy(store)) throw new HandwritingError("worker-unavailable", "手写服务暂时不可用，仍可保存普通文字版本。", 503);
      if (!store.options()?.styles.some(style => style.code === draft.styleCode)) throw new HandwritingError("style-unavailable", "这份字迹暂时不可用，请重新选择。", 422);
    });
    return json(store.public(job), job.state === "ready" ? 200 : 202, auth.cookie);
  } catch (error) { return handwritingResponseError(error); }
}
export async function getHandwritingJob(request: Request, id: string) {
  try {
    const { store, config } = context(), { owner } = session(request, false, config), job = store.owned(id, owner);
    if (job.state === "ready" && (!existsSync(store.assetPath(id)) || Date.now() - Date.parse(job.createdAt) > 30 * 86400_000)) {
      const expired = await store.update(id, current => { current.state = "expired"; delete current.layer; current.message = "这张纪念卡的素材已过期，原文仍可重新制作。"; });
      return json(store.public(expired!));
    }
    return json(store.public(job));
  } catch (error) { return handwritingResponseError(error); }
}
export async function cancelHandwritingJob(request: Request, id: string) {
  try { assertHandwritingOrigin(request); const { store, config } = context(), { owner } = session(request, false, config);
    const job = await store.cancel(id, owner); return json(store.public(job!));
  } catch (error) { return handwritingResponseError(error); }
}
export async function getHandwritingAsset(request: Request, id: string, asset: string) {
  try {
    const { store, config } = context(), { owner } = session(request, false, config), job = store.owned(id, owner), file = store.assetPath(id);
    if (asset !== "layer" || job.state !== "ready" || !existsSync(file) || Date.now() - Date.parse(job.createdAt) > 30 * 86400_000) throw new HandwritingError("asset-expired", "这张纪念卡的素材已过期，请重新制作。", 410);
    return new Response(new Uint8Array(readFileSync(file)), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return handwritingResponseError(error); }
}
