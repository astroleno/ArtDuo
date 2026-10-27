import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { ExhibitionKeepsakeDraft, HandwritingJob, HandwritingLayer, HandwritingStyle } from "@artduo/contracts";
import { appPath, keepsakeDraftIdentity } from "@artduo/contracts";
import { HandwritingError, HANDWRITING_INK, HANDWRITING_RENDER_VERSION } from "./config";

export const digest = (text: string) => createHash("sha256").update(text).digest("hex");
export const handwritingCacheKey = (owner: string, draft: ExhibitionKeepsakeDraft) => digest(JSON.stringify([owner, keepsakeDraftIdentity(draft), "lyric-1", HANDWRITING_INK, "blank-7mm-v1", HANDWRITING_RENDER_VERSION, "visible"]));
export const terminal = (s: HandwritingJob["state"]) => ["ready", "failed", "canceled", "expired"].includes(s);
export interface SavedHandwritingJob extends Omit<HandwritingJob, "layer"> {
  owner: string;
  cacheKey: string;
  requestIds: string[];
  draft: ExhibitionKeepsakeDraft;
  upstreamId?: string;
  layer?: Omit<HandwritingLayer, "url">;
  nextAttemptAt: number;
  attempts: number;
  lease?: { token: string; expiresAt: number };
  cancelRequested?: boolean;
  delivered?: boolean;
  deliveryError?: { code: string; status: number; at: string };
  deliveryResult?: unknown;
  quote?: unknown;
  layout?: unknown;
}

export function atomicJson(filename: string, value: unknown): void {
  mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try { writeFileSync(temporary, JSON.stringify(value), { flag: "wx", mode: 0o600 }); renameSync(temporary, filename); }
  finally { if (existsSync(temporary)) unlinkSync(temporary); }
}

/** One lock on the shared persistent volume; never held across a network call. */
export async function withFileLock<T>(directory: string, operation: () => T): Promise<T> {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(directory, "transaction.lock"), token = randomUUID();
  let fd: number | undefined;
  for (let i = 0; i < 100; i++) {
    try { fd = openSync(filename, "wx", 0o600); writeFileSync(fd, JSON.stringify({ pid: process.pid, token })); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const before = statSync(filename), owner = JSON.parse(readFileSync(filename, "utf8"));
        if (Date.now() - before.mtimeMs > 30_000 && Number.isInteger(owner.pid)) {
          let alive = true;
          try { process.kill(owner.pid, 0); } catch (e) { alive = (e as NodeJS.ErrnoException).code !== "ESRCH"; }
          if (!alive && statSync(filename).ino === before.ino) unlinkSync(filename);
        }
      } catch { /* Leave live, replaced, or unreadable locks alone. */ }
      await delay(20);
    }
  }
  if (fd === undefined) throw new HandwritingError("state-busy", "任务服务正忙，请稍后重试。", 503);
  try { return operation(); }
  finally { closeSync(fd); try { if (JSON.parse(readFileSync(filename, "utf8")).token === token) unlinkSync(filename); } catch { /* Not our lock. */ } }
}

export class HandwritingStore {
  constructor(readonly state: string, readonly basePath = "") {}
  private file(id: string) {
    if (!/^[a-f0-9]{64}$/u.test(id)) throw new HandwritingError("not-found", "这张纪念卡不存在或已失效。", 404);
    return path.join(this.state, "jobs", `${id}.json`);
  }
  read(id: string): SavedHandwritingJob | undefined {
    const file = this.file(id);
    if (!existsSync(file)) return;
    const raw = readFileSync(file, "utf8");
    if (raw.length > 100_000) throw new HandwritingError("state-invalid", "任务记录暂时无法读取。", 503);
    const job = JSON.parse(raw) as SavedHandwritingJob;
    if (job.id !== id || !/^[a-f0-9]{64}$/u.test(job.owner)) throw new HandwritingError("state-invalid", "任务记录暂时无法读取。", 503);
    return job;
  }
  owned(id: string, owner: string) {
    const job = this.read(id);
    if (!job || job.owner !== owner) throw new HandwritingError("not-found", "这张纪念卡不存在或不属于当前会话。", 404);
    return job;
  }
  all(): SavedHandwritingJob[] {
    const directory = path.join(this.state, "jobs");
    if (!existsSync(directory)) return [];
    return readdirSync(directory).filter(name => /^[a-f0-9]{64}\.json$/u.test(name)).flatMap(name => {
      const job = this.read(name.slice(0, -5)); return job ? [job] : [];
    });
  }
  write(job: SavedHandwritingJob) { atomicJson(this.file(job.id), job); }
  async create(owner: string, draft: ExhibitionKeepsakeDraft, requestId: string, now = Date.now(), authorizeNew?: () => void) {
    if (digest(keepsakeDraftIdentity(draft)) !== draft.contentDigest) throw new HandwritingError("draft-changed", "寄语内容已变化，请重新确认后制作。", 409);
    const cacheKey = handwritingCacheKey(owner, draft);
    return withFileLock(this.state, () => {
      const jobs = this.all(), index = path.join(this.state, "requests", `${digest(`${owner}:${requestId}`)}.json`);
      const previous = existsSync(index) ? JSON.parse(readFileSync(index, "utf8")) as { id: string; cacheKey: string } : undefined;
      const request = previous ? jobs.find(job => job.id === previous.id && job.owner === owner) : jobs.find(job => job.owner === owner && job.requestIds.includes(requestId));
      if (request && request.contentDigest !== draft.contentDigest) throw new HandwritingError("request-conflict", "这次制作请求对应另一份寄语，请重新确认。", 409);
      if (previous && !request) throw new HandwritingError("request-unavailable", "原制作记录暂时不可用，请稍后再试。", 503);
      if (request) return request;
      const cached = jobs.find(job => job.cacheKey === cacheKey && !["failed", "canceled", "expired"].includes(job.state));
      if (cached) { cached.requestIds = [...cached.requestIds.slice(-19), requestId]; this.write(cached); atomicJson(index, { id: cached.id, cacheKey }); return cached; }
      authorizeNew?.();
      if (jobs.filter(job => job.owner === owner && !terminal(job.state)).length >= 1) throw new HandwritingError("owner-busy", "已有一张纪念卡正在制作，可以先取消它。", 429);
      if (jobs.filter(job => !terminal(job.state)).length >= 20 || jobs.filter(job => job.createdAt.slice(0, 10) === new Date(now).toISOString().slice(0, 10)).length >= 100) throw new HandwritingError("queue-full", "今天制作的纪念卡较多，请稍后再试。", 429, 60);
      const stamp = new Date(now).toISOString();
      const job: SavedHandwritingJob = { id: digest(randomUUID()), owner, draft, cacheKey, requestIds: [requestId],
        contentDigest: draft.contentDigest, state: "queued", createdAt: stamp, updatedAt: stamp, retryAfterMs: 3000, nextAttemptAt: now, attempts: 0 };
      this.write(job); atomicJson(index, { id: job.id, cacheKey }); return job;
    });
  }
  async update(id: string, change: (job: SavedHandwritingJob) => void) {
    return withFileLock(this.state, () => {
      const job = this.read(id); if (!job) return;
      change(job); job.updatedAt = new Date().toISOString(); this.write(job); return job;
    });
  }
  async cancel(id: string, owner: string) {
    this.owned(id, owner);
    return this.update(id, job => {
      if (job.owner !== owner || ["failed", "canceled", "expired"].includes(job.state)) return;
      job.state = "canceled"; job.cancelRequested = Boolean(job.upstreamId); job.nextAttemptAt = 0; delete job.layer;
    });
  }
  async claim(now = Date.now()) {
    return withFileLock(this.state, () => {
      const job = this.all().find(job => ((!terminal(job.state) || job.cancelRequested || job.state === "ready" && !job.delivered)
        && job.nextAttemptAt <= now && (!job.lease || job.lease.expiresAt <= now)));
      if (!job) return;
      job.lease = { token: randomUUID(), expiresAt: now + 120_000 }; this.write(job); return job;
    });
  }
  assetPath(id: string) { return path.join(this.state, "assets", `${this.file(id).split(path.sep).at(-1)!.slice(0, -5)}.png`); }
  scenePath(id: string) { return this.assetPath(id).replace(/\.png$/u, ".scene.zip"); }
  public(job: SavedHandwritingJob): HandwritingJob {
    return { id: job.id, contentDigest: job.contentDigest, state: job.state, createdAt: job.createdAt, updatedAt: job.updatedAt,
      retryAfterMs: job.retryAfterMs, ...(job.message ? { message: job.message } : {}), ...(job.errorCode ? { errorCode: job.errorCode } : {}),
      ...(job.state === "ready" && job.layer ? { layer: { ...job.layer, url: appPath(`/api/handwriting/jobs/${job.id}/assets/layer`, this.basePath) } } : {}) };
  }
  options(): { at: number; styles: HandwritingStyle[]; available: boolean; message?: string } | undefined {
    const file = path.join(this.state, "worker.json"); if (!existsSync(file)) return;
    return JSON.parse(readFileSync(file, "utf8"));
  }
}
