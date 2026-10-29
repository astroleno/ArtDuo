"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ARTWORK_SOURCE_LABELS } from "@artduo/contracts";

import { generateShareCard } from "./share-card";
import type { ExhibitionSnapshot, ExperienceUnit } from "./types";
import { useStableNarrative } from "./use-stable-narrative";
import { experienceArtistName } from "./artwork-credits";
import { displaySourceCredit } from "./reading-copy";
import { observeClosingImage, type ClosingImageState } from "./closing-image";

export function Closing({ snapshot, lastUnit, reducedMotion, onRevisit, onRestart, keepsake }: {
  snapshot: ExhibitionSnapshot;
  lastUnit?: ExperienceUnit;
  reducedMotion: boolean;
  onRevisit: () => void;
  onRestart: () => void;
  keepsake?: ReactNode;
}) {
  const [shareState, setShareState] = useState<"idle" | "generating" | "ready" | "failed">("idle");
  const [copied, setCopied] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const previewUrl = lastUnit?.media.previewUrl;
  const [image, setImage] = useState<ClosingImageState & { url: string }>();
  const currentImage = image?.url === previewUrl ? image : undefined;
  const imageState = currentImage?.state ?? "loading";
  const verified = lastUnit?.artwork.media?.verifiedRemoteImage;
  const imageRatio = currentImage?.state === "ready" ? currentImage.ratio
    : verified ? verified.width / verified.height : undefined;
  useEffect(() => {
    if (!imageRef.current || !previewUrl) return;
    return observeClosingImage(imageRef.current, value => setImage({ url: previewUrl, ...value }));
  }, [previewUrl]);
  const closing = useStableNarrative(snapshot.closing, snapshot.narrativePending);
  const closingText = closing?.text ?? "";
  const artistName = lastUnit ? experienceArtistName(lastUnit) : undefined;
  const fallbackText = [lastUnit?.artwork.metadata.title, artistName, closingText].filter(Boolean).join(" · ");
  async function share() {
    if (!lastUnit || !closing || shareState === "generating") return;
    setShareState("generating");
    try {
      await generateShareCard({
        imageUrl: lastUnit.media.fullUrl,
        artworkTitle: lastUnit.artwork.metadata.title,
        artistLine: [artistName, lastUnit.artwork.metadata.yearLabel].filter(Boolean).join(" · "),
        sourceLabel: displaySourceCredit(lastUnit.artwork.metadata.creditLine) ?? ARTWORK_SOURCE_LABELS[lastUnit.artwork.source],
        closingLine: closingText,
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
    {lastUnit ? <figure className="experience-closing-artwork" style={imageRatio ? { "--closing-aspect": imageRatio } as CSSProperties : undefined}>
      <div className="experience-closing-image" data-image-state={imageState}>
        <img ref={imageRef} alt={lastUnit.artwork.metadata.title} src={lastUnit.media.previewUrl} />
        {imageState === "failed" ? <p role="status">作品图片暂时无法显示</p> : null}
      </div>
      <figcaption>{lastUnit.artwork.metadata.title}<span>{artistName}</span></figcaption>
    </figure> : null}
    <div className="experience-closing-copy">
    <p className="experience-eyebrow">本次观展结束</p>
    {closing ? <h1 id="experience-closing-title">{closingText}</h1> : <p id="experience-closing-title" className="experience-narrative-pending" role="status">正在收拢这段观看。</p>}
    <p className="experience-closing-meta">可以回看，也可以把最后一件作品保存下来。</p>
    <div className="experience-closing-actions">
      <button onClick={onRevisit} type="button">回看最后一件</button>
      <button onClick={onRestart} type="button">重新选一组</button>
      <button disabled={!lastUnit || !closing || shareState === "generating"} onClick={() => void share()} type="button">{shareState === "generating" ? "正在保存…" : shareState === "ready" ? "已保存分享图" : "保存分享图"}</button>
    </div>
    {keepsake}
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
