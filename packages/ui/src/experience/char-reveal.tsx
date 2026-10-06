"use client";

import { useEffect, useState } from "react";

export function CharReveal({ text, reducedMotion = false, intervalMs = 22 }: { text: string; reducedMotion?: boolean; intervalMs?: number }) {
  const [visibleCount, setVisibleCount] = useState(reducedMotion ? text.length : 0);
  useEffect(() => {
    if (reducedMotion) {
      setVisibleCount(text.length);
      return;
    }
    setVisibleCount(0);
    let count = 0;
    const timer = window.setInterval(() => {
      count = Math.min(text.length, count + 1);
      setVisibleCount(count);
      if (count >= text.length) window.clearInterval(timer);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, reducedMotion, text]);

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{Array.from(text).slice(0, visibleCount).join("")}</span>
    </>
  );
}
