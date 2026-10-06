"use client";

import { useState } from "react";

import { generateShareCard } from "./share-card";
import type { ExhibitionSnapshot, ExperienceUnit } from "./types";
import { CharReveal } from "./char-reveal";

export function Closing({ snapshot, lastUnit, reducedMotion, onRevisit, onRestart }: {
  snapshot: ExhibitionSnapshot;
  lastUnit?: ExperienceUnit;
  reducedMotion: boolean;
  onRevisit: () => void;
  onRestart: () => void;
}) {
  const [shareState, setShareState] = useState<"idle" | "generating" | "ready" | "failed">("idle");
  const [copied, setCopied] = useState(false);
  const [imageState, setImageState] = useState<"loading" | "ready" | "failed">("loading");
  const fallbackText = [lastUnit?.artwork.metadata.title, lastUnit?.artwork.metadata.artistDisplayName, snapshot.closing.text].filter(Boolean).join(" · ");
  async function share() {
    if (!lastUnit || shareState === "generating") return;
    setShareState("generating");
    try {
      await generateShareCard({
        imageUrl: lastUnit.media.fullUrl,
        artworkTitle: lastUnit.artwork.metadata.title,
        artistLine: [lastUnit.artwork.metadata.artistDisplayName, lastUnit.artwork.metadata.yearLabel].filter(Boolean).join(" · "),
        sourceLabel: lastUnit.artwork.metadata.creditLine ?? (lastUnit.artwork.source === "met" ? "The Metropolitan Museum of Art" : "ArtDuo"),
        closingLine: snapshot.closing.text,
      });
      setShareState("ready");
    } catch {
      setShareState("failed");
      window.dispatchEvent(new CustomEvent("artduo:experience-degraded", { detail: { reason: "share-card-generation-failed", artworkId: lastUnit.artwork.id } }));
    }
  }
  async function copyText() {
    try {
      await navigator.clipboard.writeText(fallbackText);
      setCopied(true);
    } catch {
      setShareState("failed");
    }
  }
  return <section className="experience-closing" aria-labelledby="experience-closing-title">
    {lastUnit ? <figure className="experience-closing-artwork">
      <div className="experience-closing-image" data-image-state={imageState}>
        <img alt={lastUnit.artwork.metadata.title} onLoad={() => setImageState("ready")} onError={() => setImageState("failed")} src={lastUnit.media.previewUrl} />
        {imageState === "failed" ? <p role="status">作品图片暂时无法显示</p> : null}
      </div>
      <figcaption>{lastUnit.artwork.metadata.title}<span>{lastUnit.artwork.metadata.artistDisplayName}</span></figcaption>
    </figure> : null}
    <div className="experience-closing-copy">
    <p className="experience-eyebrow">本次观展结束</p>
    <h1 id="experience-closing-title"><CharReveal intervalMs={16} reducedMotion={reducedMotion} text={snapshot.closing.text} /></h1>
    <p className="experience-closing-meta">可以回看，也可以把最后一件作品保存下来。</p>
    <details className="experience-closing-route">
      <summary>回看展览路线</summary>
    <div className="experience-closing-curve">
      <svg viewBox="0 0 600 150" preserveAspectRatio="none">
        <path d={snapshot.stages.map((stage, index) => `${index ? "L" : "M"} ${snapshot.stages.length < 2 ? 300 : 40 + index * (520 / (snapshot.stages.length - 1))} ${128 - stage.intensity * 94}`).join(" ")} />
      </svg>
      <ol>{snapshot.stages.map((stage) => <li key={stage.id}>{stage.label}</li>)}</ol>
    </div>
    </details>
    <div className="experience-closing-actions">
      <button onClick={onRevisit} type="button">回看最后一件</button>
      <button onClick={onRestart} type="button">重新选一组</button>
      <button disabled={!lastUnit || shareState === "generating"} onClick={() => void share()} type="button">{shareState === "generating" ? "正在保存…" : shareState === "ready" ? "已保存分享图" : "保存分享图"}</button>
    </div>
    {shareState === "failed" ? <div className="experience-share-fallback" role="status">
      <p>分享图暂时无法生成。可以重试，或复制这段文字：</p>
      <p>{fallbackText}</p>
      <button onClick={() => void share()} type="button">重试生成</button>
      <button onClick={() => void copyText()} type="button">{copied ? "已复制" : "复制文字卡"}</button>
    </div> : null}
    {snapshot.omittedUnitCount > 0 ? <p className="experience-omitted-note">有 {snapshot.omittedUnitCount} 件记录暂不可用，已保留其余作品顺序。</p> : null}
    </div>
  </section>;
}
