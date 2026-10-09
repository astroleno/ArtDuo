"use client";

import { useEffect, useId, useRef } from "react";
import type { ExperienceUnit } from "./types";

export function Plaque({ unit, expanded, onToggle, onDetail }: {
  unit: ExperienceUnit;
  expanded: boolean;
  onToggle: () => void;
  onDetail: () => void;
}) {
  const artwork = unit.artwork;
  const metadata = artwork.metadata;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (expanded && !dialog.open) dialog.showModal();
    else if (!expanded && dialog.open) { dialog.close(); triggerRef.current?.focus({ preventScroll: true }); }
  }, [expanded]);
  return <section className="experience-plaque" aria-label={`展签：${metadata.title}`}>
    <button ref={triggerRef} aria-label="展开完整展签" aria-expanded={expanded} aria-haspopup="dialog" className="experience-plaque-heading" onClick={onToggle} type="button">
      <strong>{metadata.title}</strong>
      <span>{[metadata.artistDisplayName, metadata.yearLabel].filter(Boolean).join(" · ")}</span>
      <span aria-hidden="true" className="experience-plaque-cue">作品资料 ↗</span>
    </button>
    <dialog ref={dialogRef} aria-labelledby={titleId} className="experience-reading-layer" onCancel={(event) => { event.preventDefault(); onToggle(); }}>
      <div className="experience-reading-header"><span>作品资料</span><button autoFocus aria-label="收起完整展签" onClick={onToggle} type="button">返回画作 <span aria-hidden="true">×</span></button></div>
      <div className="experience-reading-body">
      <h2 id={titleId}>{metadata.title}</h2>
      <p className="experience-reading-byline">{[metadata.artistDisplayName, metadata.yearLabel].filter(Boolean).join(" · ")}</p>
      <div className="experience-plaque-detail">
      <p className="experience-caption">{unit.caption.text}</p>
      <p className="experience-rationale">{unit.rationale.text}</p>
      <dl>
        {[
          ["媒材", metadata.medium], ["文化", metadata.culture], ["部门", metadata.department],
          ["尺寸", metadata.dimensions], ["来源", metadata.creditLine],
        ].filter((entry): entry is [string, string] => Boolean(entry[1])).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className="experience-plaque-actions">
        <button className="experience-text-button" onClick={onDetail} type="button">进入详细讲解</button>
        {metadata.objectUrl ? <a className="experience-text-button" href={metadata.objectUrl} rel="noreferrer" target="_blank">馆藏来源</a> : null}
      </div>
      </div>
      </div>
    </dialog>
  </section>;
}
