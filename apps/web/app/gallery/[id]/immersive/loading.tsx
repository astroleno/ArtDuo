"use client";

import { appPath } from "@artduo/contracts";
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
    <h1>正在准备展厅</h1>
    <p className="experience-loading-long" role="status">准备较慢，可稍候或返回修改。</p>
    <a className="experience-primary experience-loading-retry" href="">重试准备</a>
    <a className="experience-text-button" href={appPath(returnHref)}>返回修改</a>
  </main>;
}
