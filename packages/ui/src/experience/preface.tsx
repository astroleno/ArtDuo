"use client";

import type { NarrativeBlock } from "./types";
export function Preface({ block, onContinue }: { block: NarrativeBlock; reducedMotion: boolean; onContinue: () => void }) {
  return <section className="experience-preface" aria-labelledby="experience-preface-title">
    <p className="experience-eyebrow">关于这次展览</p>
    <h1 id="experience-preface-title">{block.text}</h1>
    <div className="experience-preface-actions">
      <button aria-label="跳过前言，开始观展" autoFocus onClick={onContinue} type="button">开始观展 <span aria-hidden="true">→</span></button>
    </div>
  </section>;
}
