"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { NarrativeBlock } from "./types";
import { ROOM_IMAGE_SIZES, roomImageSrcSet } from "./room-assets";
/** A preface still being written never holds the visitor longer than this. */
export const PREFACE_TEXT_GRACE_MS = 8_000;

export function Preface({ block, onContinue, ready, backdropUrl, backdropSmallUrl, count, selectionNotice, keepsake, query = "", pending = false }: { block: NarrativeBlock | null; reducedMotion: boolean; onContinue: () => void; ready: boolean; backdropUrl?: string; backdropSmallUrl?: string; count?: number; selectionNotice?: string; keepsake?: ReactNode;
  /** The visitor's sentence: held in the heading position until the preface text arrives. */
  query?: string; pending?: boolean }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [graceElapsed, setGraceElapsed] = useState(false);
  const waitingForText = !block && pending && !graceElapsed;
  useEffect(() => {
    if (!waitingForText) return;
    const timer = setTimeout(() => setGraceElapsed(true), PREFACE_TEXT_GRACE_MS);
    return () => clearTimeout(timer);
  }, [waitingForText]);
  const actionable = ready && !waitingForText;
  useEffect(() => {
    if (actionable && document.activeElement === document.body) buttonRef.current?.focus();
  }, [actionable]);
  const sentence = query.trim();
  return <section className="experience-preface" aria-labelledby="experience-preface-title">
    {backdropUrl ? <img alt="" aria-hidden="true" className="experience-preface-backdrop" crossOrigin="anonymous" sizes={ROOM_IMAGE_SIZES} srcSet={roomImageSrcSet(backdropUrl, backdropSmallUrl)} src={backdropUrl} fetchPriority="high" /> : null}
    <div className="experience-preface-copy">
    <p className="experience-eyebrow">关于这次展览{count !== undefined ? ` · ${count} 件作品` : ""}</p>
    {block ? <h1 key="preface" className="experience-preface-text" id="experience-preface-title">{block.text}</h1>
      : sentence ? <h1 key="echo" aria-busy={waitingForText} className="experience-waiting-echo" id="experience-preface-title">“{sentence}”</h1>
      : <p id="experience-preface-title" className="experience-narrative-pending" role="status">这次展览正在展开。</p>}
    {selectionNotice ? <p className="experience-selection-notice">{selectionNotice}</p> : null}
    <div className="experience-preface-actions">
      {waitingForText ? <div aria-hidden="true" className="experience-waiting-line" /> : null}
      <button className={waitingForText ? "is-waiting" : undefined} disabled={!actionable} onClick={onContinue} ref={buttonRef} type="button">进入展厅 <span aria-hidden="true">→</span></button>
    </div>
    {keepsake}
    </div>
  </section>;
}
