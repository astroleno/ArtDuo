"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type HTMLAttributeReferrerPolicy } from "react";
import type { DetailNavigation, ExperienceUnit, NarrativeBlock } from "./types";
import type { RoomPlaqueSize } from "./layout";
import { experienceArtistName } from "./artwork-credits";
import { displaySourceCredit, sameReadingText } from "./reading-copy";
import { prepareReadingImage } from "./reading-image";
import { useOverlayHistory } from "./use-overlay-history";

function ReadingNote({ note, caption }: { note?: NarrativeBlock; caption: NarrativeBlock }) {
  const [visible] = useState(note?.text.trim() ? note : caption);
  const extra = note?.text.trim() && caption.source === "grounded" && !sameReadingText(visible.text, caption.text);
  return <>
    <p className="experience-reading-note" data-narrative-source={visible.source}>{visible.text}</p>
    {extra ? <details className="experience-source-description"><summary>馆藏说明</summary><p className="experience-caption">{caption.text}</p></details> : null}
  </>;
}

function LabelLines({ metadata, artistName, opening = false }: { metadata: ExperienceUnit["artwork"]["metadata"]; artistName: string; opening?: boolean }) {
  return <>
    <strong>{metadata.title}</strong>
    <span className="experience-plaque-artist">{artistName}</span>
    {opening || metadata.yearLabel ? <span className="experience-plaque-period" role={opening ? "status" : undefined}>{opening ? "正在打开… · 取消" : metadata.yearLabel}</span> : null}
  </>;
}

export type PlaqueArtwork = Pick<ExperienceUnit, "displayCredits" | "caption" | "curatorNote" | "media"> & { artwork: Pick<ExperienceUnit["artwork"], "id" | "metadata"> };

export function Plaque({ unit, previewSource, backgroundSource, expanded, onToggle, onDetail, detailNavigation, onSizeChange, measureWidth = 188, artworkKind = "painting", referrerPolicy }: {
  unit: PlaqueArtwork;
  previewSource?: string;
  backgroundSource?: string;
  expanded: boolean;
  onToggle: () => void;
  onDetail?: () => void;
  artworkKind?: "painting" | "sculpture";
  referrerPolicy?: HTMLAttributeReferrerPolicy;
  detailNavigation?: DetailNavigation;
  onSizeChange?: (size: RoomPlaqueSize) => void;
  measureWidth?: number;
}) {
  const artwork = unit.artwork;
  const metadata = artwork.metadata;
  const artistName = experienceArtistName(unit);
  const [readingImage, setReadingImage] = useState<{ url: string; state: "ready" | "failed"; compact: boolean }>();
  const [imageAttempt, setImageAttempt] = useState(0);
  const [retryingImage, setRetryingImage] = useState(false);
  const readingImageRef = useRef<HTMLImageElement>(null);
  const readingBodyRef = useRef<HTMLDivElement>(null);
  const previewUrl = previewSource ?? unit.media.previewUrl;
  const readingImageState = readingImage?.url === previewUrl ? readingImage.state : "loading";
  const opening = expanded && readingImageState === "loading";
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeReader = useOverlayHistory(expanded, () => { detailNavigation?.onCancel(); onToggle(); });
  useLayoutEffect(() => {
    if (!onSizeChange) return;
    let disposed = false;
    const measure = () => {
      if (disposed || !measureRef.current) return;
      const height = Math.ceil(measureRef.current.getBoundingClientRect().height) + 1;
      onSizeChange({ width: measureWidth, height });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (measureRef.current) observer?.observe(measureRef.current);
    document.fonts?.addEventListener("loadingdone", measure);
    void document.fonts?.ready.then(measure);
    return () => { disposed = true; observer?.disconnect(); document.fonts?.removeEventListener("loadingdone", measure); };
  }, [metadata.title, artistName, metadata.yearLabel, measureWidth, onSizeChange]);
  useEffect(() => {
    if (!expanded) { setReadingImage(undefined); setRetryingImage(false); return; }
    const image = readingImageRef.current;
    if (!image) return;
    const controller = new AbortController();
    // Decode the actual reading image while the gallery stays visible. A
    // completed download alone can still produce an empty first modal paint.
    void prepareReadingImage(image, controller.signal).then(state => {
      if (!controller.signal.aborted && state) {
        setReadingImage(previous => ({ url: previewUrl, state, compact: state === "failed" || previous?.url === previewUrl && previous.compact === true }));
        setRetryingImage(false);
      }
    });
    return () => controller.abort();
  }, [previewUrl, expanded, imageAttempt]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (expanded && readingImageState !== "loading" && !dialog.open) {
      dialog.showModal();
      // A closed dialog has no scroll box; reset only after it is laid out.
      if (readingBodyRef.current) readingBodyRef.current.scrollTop = 0;
    }
    else if (!expanded && dialog.open) { dialog.close(); triggerRef.current?.focus({ preventScroll: true }); }
  }, [expanded, readingImageState]);
  return <><section className="experience-plaque" aria-label={`展签：${metadata.title}`}>
    <button ref={triggerRef} aria-label={opening ? "正在打开完整展签，点击取消" : "展开完整展签"} aria-expanded={expanded} aria-busy={opening} aria-haspopup="dialog" className="experience-plaque-heading" onClick={onToggle} type="button">
      <LabelLines metadata={metadata} artistName={artistName} opening={opening} />
    </button>
    <dialog ref={dialogRef} aria-labelledby={titleId} className="experience-reading-layer" data-image-layout={readingImage?.url === previewUrl && readingImage.compact ? "compact" : "full"} onCancel={(event) => { event.preventDefault(); closeReader(); }}>
      <div className="experience-reading-header"><span>作品资料</span><button autoFocus aria-label="收起完整展签" onClick={closeReader} type="button">返回{artworkKind === "sculpture" ? "雕塑" : "画作"} <span aria-hidden="true">×</span></button></div>
      <div className="experience-reading-artwork" data-image-state={readingImageState} style={expanded && readingImageState !== "failed" && unit.media.backgroundUrl ? { backgroundImage: `url(${backgroundSource ?? unit.media.backgroundUrl})` } : undefined}>
        {expanded ? <img key={`${previewUrl}:${imageAttempt}`} ref={readingImageRef} crossOrigin="anonymous" referrerPolicy={referrerPolicy} alt={`阅读时参照《${metadata.title}》`} decoding="sync" src={previewUrl} style={readingImageState === "failed" ? { display: "none" } : undefined} /> : null}
        {readingImageState === "failed" ? <><p role="status">图片暂不可用，资料仍可阅读。</p><button className="experience-reading-retry" disabled={retryingImage} onClick={() => { setRetryingImage(true); setImageAttempt(attempt => attempt + 1); }} type="button">{retryingImage ? "正在重试…" : "重试图片"}</button></> : null}
      </div>
      <div key={artwork.id} ref={readingBodyRef} className="experience-reading-body" role="region" aria-label="作品文字" tabIndex={0}>
      <h2 id={titleId}>{metadata.title}</h2>
      <p className="experience-reading-byline">{[artistName, metadata.yearLabel].filter(Boolean).join(" · ")}</p>
      <div className="experience-plaque-detail">
      {expanded ? <ReadingNote key={artwork.id} note={unit.curatorNote} caption={unit.caption} /> : null}
      <dl>
        {[
          ["出版", unit.displayCredits?.publishers.join("; ")],
          ["媒材", metadata.medium], ["文化", metadata.culture], ["部门", metadata.department],
          ["馆方尺寸", metadata.dimensions ?? "尺寸尚待核实"], ["来源", displaySourceCredit(metadata.creditLine)],
        ].filter((entry): entry is [string, string] => Boolean(entry[1])).map(([label, value]) => <div key={label}><dt>{label}</dt><dd style={{ whiteSpace: "pre-line" }}>{value}</dd></div>)}
      </dl>
      <p className="experience-rationale">{artworkKind === "sculpture" ? "雕塑" : "画作"}按屏幕适配，展厅中的大小不代表原作实际尺寸。</p>
      <div className="experience-plaque-actions">
        {onDetail ? <button className="experience-text-button" onClick={onDetail} disabled={Boolean(detailNavigation)} aria-busy={Boolean(detailNavigation)} type="button">{detailNavigation ? "正在打开资料…" : "更多作品资料"}</button> : null}
        {detailNavigation ? <button className="experience-text-button" onClick={detailNavigation.onCancel} type="button">取消打开资料</button> : null}
        {metadata.objectUrl ? <a className="experience-text-button" href={metadata.objectUrl} rel="noreferrer" target="_blank">馆藏来源</a> : null}
      </div>
      {detailNavigation ? <p className="experience-detail-status" role="status">{detailNavigation.slow ? "资料准备得有些慢。你可以取消，继续看这件作品。" : "正在准备作品资料，画作仍可继续观看。"}</p> : null}
      </div>
      </div>
    </dialog>
  </section>
  {onSizeChange ? <div className="experience-plaque-measure" aria-hidden="true">
    <div ref={measureRef} className="experience-plaque-heading" style={{ width: measureWidth }}><LabelLines metadata={metadata} artistName={artistName} /></div>
  </div> : null}
  </>;
}
