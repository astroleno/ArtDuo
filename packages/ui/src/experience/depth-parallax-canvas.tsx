"use client";

import { useEffect, useRef, useState } from "react";

import type { DepthParallaxController } from "../immersive/depth-parallax-renderer";

export function DepthParallaxCanvas({ imageUrl, depthMapUrl, pointer, active, reducedMotion }: {
  imageUrl: string;
  depthMapUrl?: string;
  pointer: { x: number; y: number };
  active: boolean;
  reducedMotion: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<DepthParallaxController | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "static">("static");
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const sync = () => setVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active || reducedMotion || !visible) {
      setStatus("static");
      return;
    }
    let disposed = false;
    const abort = new AbortController();
    const onContextLost = (event: Event) => {
      event.preventDefault();
      disposed = true;
      abort.abort();
      rendererRef.current?.destroy();
      rendererRef.current = null;
      setStatus("static");
      window.dispatchEvent(new CustomEvent("artduo:experience-degraded", { detail: { reason: "depth-context-lost" } }));
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    setStatus("loading");
    void import("../immersive/depth-parallax-renderer")
      .then(({ createDepthParallaxRenderer }) => createDepthParallaxRenderer({ canvas, depthMapUrl, imageUrl, requireDepthMap: true, signal: abort.signal }))
      .then((renderer) => {
        if (disposed) {
          renderer.destroy();
          return;
        }
        rendererRef.current = renderer;
        setStatus("ready");
        renderer.setPointer(pointer.x, pointer.y);
      })
      .catch(() => {
        if (disposed) return;
        setStatus("static");
        window.dispatchEvent(new CustomEvent("artduo:experience-degraded", { detail: { reason: "depth-renderer-unavailable" } }));
      });
    return () => {
      disposed = true;
      canvas.removeEventListener("webglcontextlost", onContextLost);
      abort.abort();
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [active, depthMapUrl, imageUrl, reducedMotion, visible]);

  useEffect(() => rendererRef.current?.setPointer(pointer.x, pointer.y), [pointer.x, pointer.y]);

  if (!active || reducedMotion || !visible) return null;
  return <canvas aria-hidden="true" className="experience-depth-canvas" data-depth-state={status} ref={canvasRef} />;
}
