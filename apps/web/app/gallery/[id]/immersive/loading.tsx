"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { EXPERIENCE_LOADING_LONG_WAIT_MS, EXPERIENCE_LOADING_RETRY_MS } from "../../../../lib/experience-loading";

export default function ImmersiveLoading() {
  const [returnHref, setReturnHref] = useState("/?view=experience");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("query");
    if (query) setReturnHref(`/?${new URLSearchParams({ view: "experience", query })}`);
  }, []);
  return <main className="artduo-experience experience-loading" aria-busy="true" aria-live="polite" style={{
    "--experience-long-wait": `${EXPERIENCE_LOADING_LONG_WAIT_MS}ms`,
    "--experience-retry-wait": `${EXPERIENCE_LOADING_RETRY_MS}ms`,
  } as CSSProperties}>
    <p className="experience-eyebrow">ARTDUO · MOOD GALLERY</p>
    <h1>正在为你准备展厅</h1>
    <p>作品清单正在整理，前言不会阻挡第一件作品继续载入。</p>
    <p className="experience-loading-long" role="status">准备时间较长，仍在整理这次展览；你可以继续等候或返回修改。</p>
    <a className="experience-primary experience-loading-retry" href="">重试准备</a>
    <a className="experience-text-button" href={returnHref}>返回修改愿望</a>
  </main>;
}
