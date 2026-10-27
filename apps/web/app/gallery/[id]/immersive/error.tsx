"use client";

import { appPath } from "@artduo/contracts";
import { startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildExperienceEntryHref } from "../../../../lib/experience-navigation";

export default function ImmersiveError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const retry = () => startTransition(() => { router.refresh(); reset(); });
  return <main className="artduo-experience experience-unavailable" role="alert">
    <h1>展厅暂时未就绪</h1>
    <p>可以重试，或带着原句返回入口。</p>
    <button className="experience-primary" onClick={retry} type="button">重新载入</button>
    <a className="experience-text-button" href={appPath(buildExperienceEntryHref(params.get("query") ?? ""))}>返回入口</a>
  </main>;
}
