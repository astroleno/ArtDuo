"use client";

import { useEffect, useRef, useState } from "react";

import type { ArtworkExplanation } from "@artduo/contracts";
import { buildRecommendationReason } from "../lib/artwork-page-copy";
import { recordExperienceDegradation, recordExperienceTiming } from "../lib/experience-analytics";

function scoreLabel(score: number) {
  return `${Math.max(0, Math.min(100, score * 100)).toFixed(1)}%`;
}

export function ArtworkExplanationPanel({ artworkId, releaseVersion, query, backgroundSceneId, retrievalScore, matchedTokens }: {
  artworkId: string;
  releaseVersion: string;
  query: string;
  backgroundSceneId?: string;
  retrievalScore?: number;
  matchedTokens: string[];
}) {
  const [state, setState] = useState<"idle" | "pending" | "ready" | "failed">("idle");
  const [explanation, setExplanation] = useState<ArtworkExplanation>();
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const identityRef = useRef(`${artworkId}:${releaseVersion}`);
  identityRef.current = `${artworkId}:${releaseVersion}`;
  useEffect(() => {
    requestId.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setState("idle");
    setExplanation(undefined);
    return () => {
      requestId.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [artworkId, releaseVersion]);
  async function load() {
    abortRef.current?.abort();
    const current = ++requestId.current;
    const identity = `${artworkId}:${releaseVersion}`;
    const startedAt = performance.now();
    const controller = new AbortController();
    abortRef.current = controller;
    setState("pending");
    try {
      const response = await fetch(`/api/artworks/${encodeURIComponent(artworkId)}/explanation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artworkId, releaseVersion, query, backgroundSceneId, retrievalScore, matchedTokens }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Explanation unavailable");
      const result = await response.json() as ArtworkExplanation;
      if (current !== requestId.current || identityRef.current !== identity || result.artworkId !== artworkId || result.releaseVersion !== releaseVersion) return;
      setExplanation(result);
      setState(result.status === "ready" ? "ready" : "failed");
    } catch {
      if (!controller.signal.aborted && current === requestId.current && identityRef.current === identity) {
        setState("failed");
        recordExperienceDegradation("explanation-unavailable", releaseVersion, artworkId);
      }
    } finally {
      if (!controller.signal.aborted) recordExperienceTiming("explanation", performance.now() - startedAt, releaseVersion);
      if (current === requestId.current) abortRef.current = null;
    }
  }
  return <section aria-label="作品讲解" className="explanation-card" data-testid="explanation-slot">
    <p className="meta">{state === "idle" ? "按需讲解" : state === "pending" ? "正在整理作品线索…" : state === "ready" ? "作品讲解" : "讲解暂时不可用"}</p>
    {state === "idle" ? <button className="experience-text-button" onClick={() => void load()} type="button">生成这件作品的讲解</button> : null}
    {state === "pending" ? <p aria-live="polite">图片与作品资料已就绪，讲解正在单独准备。</p> : null}
    {state === "failed" ? <div role="status"><p>讲解没有完成，作品资料仍可继续查看。</p><button onClick={() => void load()} type="button">重试讲解</button></div> : null}
    {state === "ready" && explanation?.content ? <>
      <p className="explanation-detail">{explanation.content.detailText}</p>
      <div className="recommendation-reason"><p className="evidence-label">为什么推荐这件作品</p><p>{buildRecommendationReason(explanation)}</p></div>
      <details className="explanation-evidence"><summary>检索依据</summary>
        <div className="evidence-summary">
          <span>展厅：{explanation.content.evidence.grounding.scene?.label ?? "作品自身"}</span>
          <span>匹配度：{scoreLabel(explanation.content.evidence.grounding.retrievalScore)}</span>
          <span>线索：{explanation.content.evidence.grounding.matchedTokens.slice(0, 6).join(", ") || "作品资料"}</span>
        </div>
        <ul aria-label="讲解来源与引用" className="citation-list">{explanation.content.evidence.citations.map((citation) => <li key={`${citation.kind}-${citation.sourceId}`}>
          <span>{citation.kind}</span>{citation.url ? <a href={citation.url} rel="noreferrer" target="_blank">{citation.label}</a> : <strong>{citation.label}</strong>}
        </li>)}</ul>
      </details>
    </> : null}
  </section>;
}
