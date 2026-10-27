"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { NarrativeBlock } from "./types";
import { useStableNarrative } from "./use-stable-narrative";
import { ROOM_IMAGE_SIZES, roomImageSrcSet } from "./room-assets";
export function Preface({ block, onContinue, ready, backdropUrl, count, pending, selectionNotice, keepsake }: { block: NarrativeBlock; reducedMotion: boolean; onContinue: () => void; ready: boolean; backdropUrl?: string; count?: number; pending?: boolean; selectionNotice?: string; keepsake?: ReactNode }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const visible = useStableNarrative(block, pending);
  useEffect(() => {
    if (ready && document.activeElement === document.body) buttonRef.current?.focus();
  }, [ready]);
  return <section className="experience-preface" aria-labelledby="experience-preface-title">
    {backdropUrl ? <img alt="" aria-hidden="true" className="experience-preface-backdrop" src={backdropUrl} srcSet={roomImageSrcSet(backdropUrl)} sizes={ROOM_IMAGE_SIZES} fetchPriority="high" /> : null}
    <div className="experience-preface-copy">
    <p className="experience-eyebrow">关于这次展览{count !== undefined ? ` · ${count} 件作品` : ""}</p>
    {visible ? <h1 id="experience-preface-title">{visible.text}</h1> : <p id="experience-preface-title" className="experience-narrative-pending" role="status">这次展览正在展开。</p>}
    {selectionNotice ? <p className="experience-selection-notice">{selectionNotice}</p> : null}
    <div className="experience-preface-actions">
      <button aria-label="跳过前言，开始观展" disabled={!ready} onClick={onContinue} ref={buttonRef} type="button">进入展厅 <span aria-hidden="true">→</span></button>
    </div>
    {keepsake}
    </div>
  </section>;
}
