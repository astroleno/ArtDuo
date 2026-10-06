"use client";

import { useState, type ReactNode } from "react";

export function LifecycleHarness({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(true);
  return <>
    {mounted ? children : <p>Test exhibition unmounted</p>}
    <button data-testid="fixture-mount" onClick={() => setMounted((value) => !value)} style={{ position: "fixed", bottom: 0, left: "45%", zIndex: 200 }} type="button">
      {mounted ? "Unmount fixture" : "Mount fixture"}
    </button>
  </>;
}
