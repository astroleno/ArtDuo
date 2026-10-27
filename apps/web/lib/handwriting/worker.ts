import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { HandwritingStyle } from "@artduo/contracts";
import { handwritingConfig, HandwritingError } from "./config";
import { InkoClient } from "./inko";
import { HandwritingStore, atomicJson, withFileLock, type SavedHandwritingJob } from "./store";
import { prepareSceneLayer } from "./scene-layer";

export class HandwritingWorker {
  readonly store: HandwritingStore;
  private readonly config;
  private styles: HandwritingStyle[] = [];
  constructor(root: string, private readonly client?: InkoClient, private readonly prepare = prepareSceneLayer) {
    this.config = handwritingConfig(root); this.store = new HandwritingStore(this.config.state);
  }
  private api() { return this.client ?? new InkoClient(this.config); }
  heartbeat(available: boolean, message?: string) {
    atomicJson(path.join(this.config.state, "worker.json"), { pid: process.pid, at: Date.now(), styles: this.styles, available, message });
  }
  async initialize() {
    if (!this.config.key && !this.client) { this.heartbeat(false, "手写服务尚未配置，仍可保存普通文字版本。"); return false; }
    this.styles = await this.api().styles(this.config.styles);
    if (!this.styles.length) throw new HandwritingError("styles-empty", "当前账号没有可用字迹。", 503);
    this.heartbeat(true); return true;
  }
  private async coordinate(job: SavedHandwritingJob, release = false) {
    return withFileLock(this.config.coordination, () => {
      const file = path.join(this.config.coordination, "account.json");
      let current: { id?: string; expiresAt?: number; submittedAt?: number } = {};
      if (existsSync(file)) current = JSON.parse(readFileSync(file, "utf8"));
      if (release) { if (current.id === job.id) atomicJson(file, { submittedAt: current.submittedAt }); return true; }
      if (current.id && current.id !== job.id && (current.expiresAt ?? 0) > Date.now()) return false;
      atomicJson(file, { id: job.id, expiresAt: Date.now() + 150_000, submittedAt: current.submittedAt }); return true;
    });
  }
  private async apply(job: SavedHandwritingJob, mutate: (current: SavedHandwritingJob) => void) {
    return this.store.update(job.id, current => {
      if (current.lease?.token !== job.lease?.token) return;
      mutate(current);
    });
  }
  private async reserveSubmission() {
    return withFileLock(this.config.coordination, () => {
      const file = path.join(this.config.coordination, "account.json"), current = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
      if (Date.now() - (current.submittedAt ?? 0) < 2200) return false;
      atomicJson(file, { ...current, submittedAt: Date.now() }); return true;
    });
  }
  async tick(): Promise<boolean> {
    const job = await this.store.claim(); if (!job) return false;
    try {
      const api = this.api();
      if (job.cancelRequested && job.upstreamId) {
        try { await api.cancel(job.upstreamId); } catch (error) {
          if (!(error instanceof HandwritingError) || ![404, 409].includes(error.status)) throw error;
        }
        await this.apply(job, current => { current.cancelRequested = false; }); await this.coordinate(job, true); return true;
      }
      if (job.state === "ready" && job.upstreamId) {
        if (!existsSync(this.store.assetPath(job.id)) || !existsSync(this.store.scenePath(job.id))) {
          await this.apply(job, current => { current.state = "expired"; delete current.layer; current.message = "本地素材已不可用，原文仍可重新制作。"; }); return true;
        }
        try { const result = await api.delivered(job.upstreamId); await this.apply(job, current => { current.delivered = true; current.deliveryResult = result; delete current.deliveryError; }); }
        catch (error) { await this.apply(job, current => { current.deliveryError = { code: error instanceof HandwritingError ? error.code : "network-unavailable", status: error instanceof HandwritingError ? error.status : 0, at: new Date().toISOString() }; current.nextAttemptAt = Date.now() + 60_000; }); }
        return true;
      }
      if (!await this.coordinate(job)) { await this.apply(job, current => { current.nextAttemptAt = Date.now() + 5000; }); return true; }
      if (Date.now() - Date.parse(job.createdAt) > 30 * 60_000) throw new HandwritingError("job-timeout", "这张纪念卡制作超时，可以保留输入后重试。", 504);
      if (!job.upstreamId) {
        if (!this.styles.some(style => style.code === job.draft.styleCode)) throw new HandwritingError("style-unavailable", "这份字迹暂时不可用，请切换后重试。", 422);
        const checked = await api.validate(job.draft);
        await this.apply(job, current => { current.quote = checked.quote; current.layout = checked.layout; });
        if (this.store.read(job.id)?.state === "canceled") return true;
        if (!await this.reserveSubmission()) { await this.apply(job, current => { current.nextAttemptAt = Date.now() + 2200; }); return true; }
        const upstream = await api.submit(job.draft, checked.layout, job.id);
        if (typeof upstream.id !== "string" || !/^[\w-]{1,100}$/u.test(upstream.id)) throw new HandwritingError("upstream-invalid", "手写服务未返回任务编号，正在核对。", 502);
        await this.apply(job, current => { current.upstreamId = upstream.id;
          if (current.state === "canceled") current.cancelRequested = true;
          else current.state = upstream.status === "succeeded" ? "preparing" : ["queued", "requeued"].includes(upstream.status) ? "queued" : "running";
          current.nextAttemptAt = Date.now() + 3000; });
        return true;
      }
      const upstream = await api.status(job.upstreamId);
      if (["queued", "running", "requeued"].includes(upstream.status)) {
        await this.apply(job, current => { if (current.state !== "canceled") current.state = upstream.status === "running" ? "running" : "queued"; current.nextAttemptAt = Date.now() + 3000; }); return true;
      }
      if (upstream.status === "canceled") { await this.apply(job, current => { current.state = "canceled"; current.cancelRequested = false; }); await this.coordinate(job, true); return true; }
      if (upstream.status === "failed") throw new HandwritingError("generation-failed", "这次手写未能完成，原文已保留，可以重试。", 422);
      if (upstream.status !== "succeeded") throw new HandwritingError("upstream-invalid", "暂时无法确认手写状态，正在重试。", 502);
      const packagePath = this.store.scenePath(job.id);
      if (upstream.files?.expired && !existsSync(packagePath)) throw new HandwritingError("asset-expired", "手写素材已过期，可以保留输入后重新制作。", 410);
      await this.apply(job, current => { if (current.state !== "canceled") current.state = "preparing"; });
      if (this.store.read(job.id)?.state === "canceled") return true;
      const url = upstream.files?.scene;
      if (typeof url !== "string" && !existsSync(packagePath)) throw new HandwritingError("scene-missing", "手写服务没有返回完整笔迹包，可以重试。", 422);
      let zip: Buffer;
      if (existsSync(packagePath)) zip = readFileSync(packagePath);
      else {
        zip = await api.download(url);
        mkdirSync(path.dirname(packagePath), { recursive: true, mode: 0o700 });
        const download = `${packagePath}.${job.lease!.token}.tmp`; writeFileSync(download, zip, { mode: 0o600 }); renameSync(download, packagePath);
      }
      const result = await this.prepare(zip, job.draft, job.upstreamId);
      const destination = this.store.assetPath(job.id), temporary = `${destination}.${job.lease!.token}.tmp`;
      mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
      writeFileSync(temporary, result.png, { mode: 0o600 }); renameSync(temporary, destination);
      await this.apply(job, current => { if (current.state === "canceled") return;
        current.state = "ready"; current.layer = result.layer; delete current.errorCode; delete current.message; current.nextAttemptAt = Date.now(); });
      await this.coordinate(job, true); return true;
    } catch (error) {
      const known = error instanceof HandwritingError ? error : new HandwritingError("network-unavailable", "连接暂时中断，正在保留任务并重试。", 503);
      await this.apply(job, current => {
        if (current.state === "canceled") { current.nextAttemptAt = Date.now() + 5000; return; }
        current.attempts++;
        const retryable = [408, 429, 500, 502, 503, 504].includes(known.status) && current.attempts < 30 && known.code !== "job-timeout";
        current.errorCode = known.code; current.message = known.message; current.nextAttemptAt = Date.now() + Math.max(3000, known.retryAfter * 1000);
        if (!retryable) { current.state = known.status === 410 ? "expired" : "failed"; current.cancelRequested = Boolean(current.upstreamId); }
      });
      if (["failed", "expired"].includes(this.store.read(job.id)?.state ?? "")) await this.coordinate(job, true);
      return true;
    } finally {
      await this.apply(job, current => { delete current.lease; });
      const current = this.store.read(job.id);
      if (current?.state === "canceled" && !current.upstreamId) await this.coordinate(job, true);
    }
  }
  async run(signal: AbortSignal) {
    let ready = false, timer: ReturnType<typeof setInterval> | undefined;
    try {
      while (!signal.aborted) {
        if (!ready) {
          try { ready = await this.initialize(); }
          catch { this.heartbeat(false, "手写服务暂时无法连接，仍可保存普通文字版本。"); }
          if (ready) timer = setInterval(() => this.heartbeat(true), 5000);
        }
        if (ready) await this.tick();
        try { await delay(ready ? 2500 : 15_000, undefined, { signal }); } catch { /* Graceful shutdown. */ }
      }
    } finally { if (timer) clearInterval(timer); this.heartbeat(false, "手写任务处理器已停止，仍可保存普通文字版本。"); }
  }
}
