"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomLightInput } from "./room-lighting";
import type { SculptureRenderer } from "./sculpture-renderer";
import type { SculptureRoomScene, SculptureWork } from "./sculpture-types";

export function SculptureCanvas({ work, url, room, backgroundSource, input, paused, followEnabled, onPoster, onState }: {
  work: SculptureWork;
  url: string;
  room: SculptureRoomScene;
  backgroundSource?: string;
  input: RoomLightInput;
  paused: boolean;
  followEnabled: boolean;
  onPoster: (url: string) => void;
  onState: (state: "loading" | "ready" | "fallback") => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<SculptureRenderer | undefined>(undefined);
  const latest = useRef({ room, backgroundSource, input, paused, followEnabled, onPoster, onState });
  latest.current = { room, backgroundSource, input, paused, followEnabled, onPoster, onState };
  const [state, setState] = useState<"loading" | "ready" | "fallback">("loading");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const abort = new AbortController();
    let disposed = false;
    const update = (value: typeof state) => { if (!disposed) { setState(value); latest.current.onState(value); } };
    const fail = () => { renderer.current?.destroy(); renderer.current = undefined; update("fallback"); };
    const lost = (event: Event) => { event.preventDefault(); element.dataset.loadError = "WebGL context lost"; fail(); };
    const timeout = window.setTimeout(() => { element.dataset.loadError = "Sculpture loading timed out"; abort.abort(); fail(); }, 20_000);
    delete element.dataset.loadError;
    delete element.dataset.loadedModel;
    update("loading");
    element.addEventListener("webglcontextlost", lost);
    void import("./sculpture-renderer").then(module => module.createSculptureRenderer({
      canvas: element, work, url, room: latest.current.room, signal: abort.signal,
      backgroundSource: latest.current.backgroundSource,
      onPoster: poster => { if (!disposed) latest.current.onPoster(poster); },
    })).then(value => {
      window.clearTimeout(timeout);
      if (disposed) { value.destroy(); return; }
      renderer.current = value;
      element.dataset.loadedModel = work.id;
      value.setRoom(latest.current.room, latest.current.backgroundSource);
      value.update(latest.current.input, latest.current.paused || !latest.current.followEnabled);
      update("ready");
    }).catch(error => {
      window.clearTimeout(timeout);
      if (!disposed) { element.dataset.loadError ||= error instanceof Error ? error.message : String(error); fail(); }
    });
    return () => {
      disposed = true; window.clearTimeout(timeout); abort.abort();
      renderer.current?.destroy(); renderer.current = undefined;
      element.removeEventListener("webglcontextlost", lost);
    };
  }, [work, url, retry]);
  useEffect(() => { renderer.current?.update(input, paused || !followEnabled); }, [input, paused, followEnabled]);
  useEffect(() => renderer.current?.setRoom(room, backgroundSource), [room, backgroundSource]);

  return <>
    {/* Lazy above-the-fold images still load immediately after layout. This
        avoids React's HTTP Link preload, which drops the no-referrer policy. */}
    <img className="experience-sculpture-poster" crossOrigin="anonymous" referrerPolicy="no-referrer" loading="lazy" src={work.posterUrl} alt="" aria-hidden="true" hidden={state === "ready"} />
    <canvas ref={canvas} className="experience-sculpture-canvas" aria-hidden="true" data-state={state} data-interaction="depth-parallax" />
    {state !== "ready" ? <div className="experience-sculpture-status" role="status">
      {state === "loading" ? "正在请入雕塑…" : <>三维视图暂时无法显示，仍可查看作品资料。<button type="button" onClick={() => setRetry(value => value + 1)}>重试载入</button></>}
    </div> : null}
  </>;
}
