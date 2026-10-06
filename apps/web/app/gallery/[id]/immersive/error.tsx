"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";

export default function ImmersiveError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const retry = () => startTransition(() => { router.refresh(); reset(); });
  return <main className="artduo-experience experience-unavailable" role="alert">
    <p className="experience-eyebrow">展厅暂时没有准备好</p>
    <h1>这次观展可以重新尝试</h1>
    <p>已载入的馆藏不会被替换；重新策展会重新读取当前版本。</p>
    <button className="experience-primary" onClick={retry} type="button">重新载入</button>
    <a className="experience-text-button" href="/gallery?view=route">返回画廊</a>
  </main>;
}
