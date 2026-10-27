"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ARTWORK_SOURCE_LABELS, HANDWRITING_CARD_VERSION, keepsakeDraftIdentity, parseKeepsakeDraft,
  type CreateHandwritingJob, type ExhibitionKeepsakeDraft, type HandwritingJob, type HandwritingOptions } from "@artduo/contracts";
import type { ExhibitionSnapshot, ExperienceUnit } from "./types";
import { experienceArtistName } from "./artwork-credits";
import { displaySourceCredit } from "./reading-copy";
import { createShareCard, downloadShareCard } from "./share-card";

export interface HandwritingProvider {
  options(signal?: AbortSignal): Promise<HandwritingOptions>;
  create(input: CreateHandwritingJob, signal?: AbortSignal): Promise<HandwritingJob>;
  get(id: string, signal?: AbortSignal): Promise<HandwritingJob>;
  cancel(id: string): Promise<HandwritingJob>;
}
type Form = { closingText: string; viewerSignature: string; styleCode: string };
type Saved = { form: Form; artworkId: string; sourceClosing: string; requestId: string; draft?: ExhibitionKeepsakeDraft; jobId?: string };
const busy = (job?: HandwritingJob) => job && ["queued", "running", "preparing"].includes(job.state);
const labels = { queued: "正在等待书写", running: "正在书写寄语", preparing: "正在整理笔迹", ready: "笔迹已就绪", failed: "这次制作未完成", canceled: "已取消制作", expired: "素材已过期" };
const canceled = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

export function useKeepsakeController(snapshot: ExhibitionSnapshot, lastUnit: ExperienceUnit | undefined, provider?: HandwritingProvider) {
  const [form, setForm] = useState<Form>({ closingText: snapshot.closing.text, viewerSignature: "", styleCode: "" });
  const [edited, setEdited] = useState(false), [open, setOpen] = useState(false), [early, setEarly] = useState(false);
  const [confirmed, setConfirmed] = useState(false), [options, setOptions] = useState<HandwritingOptions>();
  const [job, setJob] = useState<HandwritingJob>(), [working, setWorking] = useState(false), [error, setError] = useState("");
  const [preview, setPreview] = useState<{ blob: Blob; url: string }>(), [composing, setComposing] = useState(false), [saved, setSaved] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), opener = useRef<HTMLElement | null>(null), generation = useRef(0);
  const controller = useRef<AbortController | undefined>(undefined), currentJob = useRef<HandwritingJob | undefined>(undefined), request = useRef<Saved | undefined>(undefined);
  const formRef = useRef(form); formRef.current = form; currentJob.current = job;
  const identity = `${snapshot.exhibitionId}:${lastUnit?.artwork.id ?? ""}:${snapshot.closing.text}`;
  const identityRef = useRef(identity); identityRef.current = identity;
  const storageKey = `artduo.handwritten.v1:${snapshot.releaseVersion}:${snapshot.exhibitionId}`;
  const persist = useCallback((record: Saved) => { request.current = record; try { localStorage.setItem(storageKey, JSON.stringify(record)); } catch { /* The active task still works without local storage. */ } }, [storageKey]);
  const readyText = !snapshot.narrativePending && Boolean(snapshot.closing.text.trim()) && Boolean(lastUnit);
  const textLength = Array.from(form.closingText).length, signatureLength = Array.from(form.viewerSignature).length;
  const formInvalid = textLength > 2000 || signatureLength > 40 || !form.closingText.trim();

  useEffect(() => { if (!edited && !snapshot.narrativePending) setForm(current => ({ ...current, closingText: snapshot.closing.text })); }, [snapshot.closing.text, snapshot.narrativePending, edited]);
  useEffect(() => {
    const element = dialog.current; if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) { element.close(); opener.current?.focus(); }
  }, [open]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const accept = useCallback((result: HandwritingJob, version: number) => {
    if (generation.current !== version) return;
    if (!request.current?.draft || result.contentDigest !== request.current.draft.contentDigest) {
      setWorking(false); setJob(undefined); setError("这份结果对应另一份寄语，请确认当前文字后重新制作。"); return;
    }
    setJob(result); setWorking(false); setError("");
    const record = request.current;
    if (record) persist({ ...record, jobId: result.id });
  }, [persist]);

  useEffect(() => {
    generation.current++; const version = generation.current, abort = new AbortController(); controller.current?.abort(); controller.current = abort;
    setJob(undefined); setPreview(undefined); setError(""); setSaved(false); setConfirmed(false);
    if (!provider || !lastUnit || snapshot.narrativePending) return () => abort.abort();
    try {
      const record = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Saved | null;
      if (record?.artworkId === lastUnit.artwork.id && record.sourceClosing === snapshot.closing.text && record.form && typeof record.form.closingText === "string"
        && typeof record.form.viewerSignature === "string" && typeof record.form.styleCode === "string") {
        request.current = record; setForm(record.form); setEdited(true);
        if (record.draft && /^[a-f0-9]{64}$/u.test(record.draft.contentDigest)) {
          const restored = parseKeepsakeDraft(record.draft);
          if (restored.exhibitionId !== snapshot.exhibitionId || restored.artworkId !== lastUnit.artwork.id || restored.releaseVersion !== snapshot.releaseVersion
            || restored.closingText !== record.form.closingText || (restored.viewerSignature ?? "") !== record.form.viewerSignature || restored.styleCode !== record.form.styleCode) return () => abort.abort();
          setWorking(true);
          void (record.jobId ? provider.get(record.jobId, abort.signal) : provider.create({ requestId: record.requestId, confirmed: true, draft: record.draft, curationId: snapshot.curationId }, abort.signal))
            .then(result => accept(result, version)).catch(reason => { if (!abort.signal.aborted && generation.current === version) { setWorking(false); setError(reason.message ?? "暂时无法恢复这张纪念卡，输入已保留。"); } });
        }
      }
    } catch { /* A malformed saved draft never starts a task. */ }
    return () => abort.abort();
  }, [identity, provider, storageKey, accept, snapshot.narrativePending]);

  useEffect(() => {
    if (!provider || !job || !busy(job)) return;
    const version = generation.current, abort = new AbortController();
    const timer = setTimeout(() => {
      void provider.get(job.id, abort.signal).then(result => accept(result, version)).catch(reason => {
        if (!abort.signal.aborted && generation.current === version) setError(reason.message ?? "连接暂时中断，可以重试查看进度。");
      });
    }, Math.max(2000, Math.min(5000, job.retryAfterMs || 3000)));
    return () => { clearTimeout(timer); abort.abort(); };
  }, [job, provider, accept]);

  const compose = useCallback(async () => {
    if (!job?.layer || job.state !== "ready" || !lastUnit) return;
    const version = generation.current; setComposing(true); setError("");
    try {
      const blob = await createShareCard({ imageUrl: lastUnit.media.previewUrl, artworkTitle: lastUnit.artwork.metadata.title,
        artistLine: [experienceArtistName(lastUnit), lastUnit.artwork.metadata.yearLabel].filter(Boolean).join(" · "),
        sourceLabel: displaySourceCredit(lastUnit.artwork.metadata.creditLine) ?? ARTWORK_SOURCE_LABELS[lastUnit.artwork.source], closingLine: form.closingText,
        handwritingLayer: job.layer, provenance: { exhibitionId: snapshot.exhibitionId, artworkId: lastUnit.artwork.id, releaseVersion: snapshot.releaseVersion } });
      if (generation.current === version) setPreview({ blob, url: URL.createObjectURL(blob) });
    } catch (reason) {
      if (generation.current === version) {
        setError(reason instanceof Error ? reason.message : "卡面暂时无法合成，可以重试。");
        if (provider) void provider.get(job.id).then(value => { if (value.state !== "ready") accept(value, version); }).catch(() => undefined);
      }
    }
    finally { if (generation.current === version) setComposing(false); }
  }, [job, lastUnit, form.closingText, snapshot.exhibitionId, snapshot.releaseVersion, provider, accept]);
  // The worker prepares the ink while viewing; Canvas work waits until the
  // visitor opens the card, so it does not interrupt artwork navigation.
  useEffect(() => { if (open && job?.state === "ready" && !preview) void compose(); }, [open, job?.id, job?.state, preview, compose]);

  const show = async (prepareEarly: boolean) => {
    opener.current = document.activeElement as HTMLElement; setEarly(prepareEarly); setOpen(true);
    if (!provider) return;
    try { const value = await provider.options(); setOptions(value);
      setForm(current => ({ ...current, styleCode: current.styleCode || value.styles[0]?.code || "" }));
    } catch { setOptions({ available: false, styles: [], message: "手写服务暂时无法连接，仍可保存普通文字版本。" }); }
  };
  const change = (key: keyof Form, value: string) => {
    generation.current++; controller.current?.abort();
    const previous = currentJob.current;
    if (provider && busy(previous)) void provider.cancel(previous!.id).catch(() => undefined);
    setWorking(false); setComposing(false); setJob(undefined); setPreview(undefined); setSaved(false); setError(""); setConfirmed(false); setEdited(true);
    const next = { ...formRef.current, [key]: value }; formRef.current = next; setForm(next);
    if (lastUnit) persist({ form: next, artworkId: lastUnit.artwork.id, sourceClosing: snapshot.closing.text, requestId: crypto.randomUUID() });
  };
  const submit = async () => {
    if (!provider || !lastUnit || !confirmed || !readyText || formInvalid || working || busy(job)) return;
    const version = ++generation.current, activeIdentity = identityRef.current;
    const fields = { exhibitionId: snapshot.exhibitionId, artworkId: lastUnit.artwork.id, releaseVersion: snapshot.releaseVersion,
      closingText: form.closingText, ...(form.viewerSignature ? { viewerSignature: form.viewerSignature } : {}), styleCode: form.styleCode, cardVersion: HANDWRITING_CARD_VERSION };
    setWorking(true); setError(""); setSaved(false);
    try {
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(keepsakeDraftIdentity(fields)));
      if (generation.current !== version) return;
      const draft = { ...fields, contentDigest: Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("") };
      const previous = request.current, retry = job && ["failed", "canceled", "expired"].includes(job.state);
      const requestId = !retry && previous?.draft?.contentDigest === draft.contentDigest ? previous.requestId : crypto.randomUUID();
      persist({ form, artworkId: lastUnit.artwork.id, sourceClosing: snapshot.closing.text, requestId, draft });
      const result = await provider.create({ requestId, confirmed: true, draft, curationId: snapshot.curationId });
      if (generation.current !== version || identityRef.current !== activeIdentity) {
        if (identityRef.current === activeIdentity && request.current?.draft?.contentDigest !== draft.contentDigest) void provider.cancel(result.id).catch(() => undefined);
        return;
      }
      accept(result, version);
    } catch (reason) { if (generation.current === version && !canceled(reason)) { setWorking(false); setError(reason instanceof Error ? reason.message : "制作暂时无法开始，输入已保留。"); } }
  };
  const cancel = async () => {
    if (!provider) return;
    if (!job) {
      generation.current++; setWorking(false); setConfirmed(false);
      if (lastUnit) persist({ form, artworkId: lastUnit.artwork.id, sourceClosing: snapshot.closing.text, requestId: crypto.randomUUID() });
      return;
    }
    try { const result = await provider.cancel(job.id); generation.current++; setJob(result); setWorking(false); setComposing(false); setPreview(undefined); setError(""); }
    catch { setError("取消暂时未确认，可以重试。离开后不会自动替换当前卡面。"); }
  };
  const refresh = async () => {
    if (!provider || !job) return;
    try { accept(await provider.get(job.id), generation.current); } catch { setError("暂时无法读取制作进度，可以稍后再试。"); }
  };
  const entry = (prepareEarly: boolean): ReactNode => provider ? <div className="experience-keepsake-entry">
    <button className="experience-text-button" disabled={!readyText} type="button" onClick={() => void show(prepareEarly)}>
      {preview || job?.state === "ready" ? "查看手写寄语卡" : busy(job) || working ? "查看寄语卡进度" : prepareEarly ? "提前准备手写纪念卡" : "制作手写寄语卡"}
    </button>
    {busy(job) ? <span role="status">{labels[job!.state]}</span> : null}
  </div> : null;
  const modal = provider ? <dialog className="experience-keepsake-dialog" aria-labelledby="keepsake-title" ref={dialog} onCancel={event => { event.preventDefault(); setOpen(false); }}>
    {open ? <div className="experience-keepsake-panel">
      <div className="experience-keepsake-heading"><div><p className="experience-eyebrow">把这一刻留下</p><h2 id="keepsake-title">手写寄语纪念卡</h2></div><button aria-label="关闭寄语卡制作" type="button" onClick={() => setOpen(false)}>×</button></div>
      <p className="experience-keepsake-notice">只将下方确认的寄语和个人落款发送给 Inko。作品图片、心情原句和观看记录不随之发送。</p>
      {lastUnit ? <p className="experience-keepsake-work">本次作品：{lastUnit.artwork.metadata.title}<span>{experienceArtistName(lastUnit)}</span></p> : null}
      <label className="experience-keepsake-field">寄语 <span>{textLength} / 2000 字</span><textarea rows={4} aria-invalid={textLength > 2000} value={form.closingText} onChange={event => change("closingText", event.target.value)} /></label>
      <label className="experience-keepsake-field">个人落款 <span>可不填，与作品作者分别显示 · {signatureLength} / 40 字</span><input aria-invalid={signatureLength > 40} value={form.viewerSignature} onChange={event => change("viewerSignature", event.target.value)} placeholder="例如：观展人" /></label>
      {textLength > 2000 || signatureLength > 40 ? <p className="experience-keepsake-error" role="alert">{textLength > 2000 ? "寄语超过 2000 字" : "落款超过 40 字"}，原文已保留，请调整后制作。</p> : null}
      <label className="experience-keepsake-field">字迹<select value={form.styleCode} onChange={event => change("styleCode", event.target.value)}>
        {!options?.styles.length ? <option value={form.styleCode}>{form.styleCode || "正在读取可用字迹…"}</option> : null}
        {options?.styles.map(style => <option key={style.code} value={style.code}>{style.name}</option>)}
      </select></label>
      {options?.styles.find(style => style.code === form.styleCode)?.previewUrl ? <figure className="experience-keepsake-style-preview"><img alt="当前所选字迹的真实示例" src={options.styles.find(style => style.code === form.styleCode)!.previewUrl} loading="lazy" referrerPolicy="no-referrer" /><figcaption>字迹示例，实际寄语以生成结果为准。</figcaption></figure> : null}
      {early ? <p className="experience-keepsake-notice">启用这次观展的提前准备：确认后开始书写，你可以继续观展，结束时再查看。</p> : null}
      <label className="experience-keepsake-confirm"><input checked={confirmed} onChange={event => setConfirmed(event.target.checked)} type="checkbox" />我已确认寄语和落款的准确文字，同意发送给 Inko 制作本次卡片。</label>
      <div className="experience-keepsake-actions">
        <button disabled={!confirmed || !readyText || formInvalid || !form.styleCode || !options?.available || working || Boolean(busy(job))} type="button" onClick={() => void submit()}>{working ? "正在确认制作…" : early ? "确认并提前准备" : "确认并制作"}</button>
        {busy(job) || working ? <button type="button" onClick={() => void cancel()}>取消制作</button> : null}
        <button type="button" onClick={() => setOpen(false)}>{early ? "继续观展" : "返回结语"}</button>
      </div>
      {!options?.available ? <p role="status">{options?.message ?? "正在连接手写服务。"}</p> : null}
      {job ? <p aria-live="polite" className="experience-keepsake-status">{composing ? "正在整理纪念卡" : preview ? "纪念卡已就绪，可以预览和保存。" : labels[job.state]}</p> : null}
      {error || job?.message ? <div className="experience-keepsake-error" role="alert"><p>{error || job?.message}</p>
        {job && busy(job) ? <button type="button" onClick={() => void refresh()}>重试查看进度</button> : null}
        {job?.state === "ready" && !preview ? <button type="button" onClick={() => void compose()}>重试整理卡面</button> : null}
        <p>可以关闭面板，选择原有的“保存分享图”保存普通文字版本。</p>
      </div> : null}
      {preview ? <figure className="experience-keepsake-result"><img alt="包含本次作品、完整署名与手写寄语的纪念卡" src={preview.url} />
        <figcaption>手写寄语由 AI 生成 · Inko。作品归属与个人落款分别保留。</figcaption>
        <button type="button" onClick={() => { downloadShareCard(preview.blob, `artduo-keepsake-${snapshot.exhibitionId}.png`); setSaved(true); }}>{saved ? "再次保存 PNG" : "保存手写寄语卡 PNG"}</button>
      </figure> : null}
    </div> : null}
  </dialog> : null;
  return { entry, modal, open };
}
