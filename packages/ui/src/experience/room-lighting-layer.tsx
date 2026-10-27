"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomLightingController } from "./room-lighting-renderer";
import { NEUTRAL_ROOM_MOOD, type RoomLightInput, type RoomLightMood, type RoomLightProfile } from "./room-lighting";

export function RoomLightingLayer({ imageUrl, profile, input, mood = NEUTRAL_ROOM_MOOD, active, onState = () => {}, className = "", imageAlignment = "center", sculptureInteraction = false }: {
  imageUrl?: string;
  profile?: RoomLightProfile;
  input: RoomLightInput;
  mood?: RoomLightMood;
  active: boolean;
  onState?: (state: "loading" | "ready" | "fallback") => void;
  className?: string;
  imageAlignment?: "center" | "bottom";
  sculptureInteraction?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<RoomLightingController | undefined>(undefined);
  const callback = useRef(onState); callback.current = onState;
  const latestInput = useRef(input); latestInput.current = input;
  const latestMood = useRef(mood); latestMood.current = mood;
  const [state, setState] = useState("loading");
  useEffect(() => {
    if (!active || !imageUrl || !profile || !canvasRef.current) { callback.current("fallback"); return; }
    const canvas = canvasRef.current;
    const controller = new AbortController();
    let disposed = false;
    const update = (next: "loading" | "ready" | "fallback") => { if (!disposed) { setState(next); callback.current(next); } };
    const resize = () => renderer.current?.resize();
    const lost = (event: Event) => { event.preventDefault(); renderer.current?.destroy(); renderer.current = undefined; update("fallback"); };
    update("loading");
    canvas.addEventListener("webglcontextlost", lost);
    window.addEventListener("resize", resize, { passive: true });
    void import("./room-lighting-renderer").then(({ createRoomLightingRenderer }) => createRoomLightingRenderer({ canvas, imageUrl, profile, signal: controller.signal, imageAlignment, sculptureInteraction })).then((value) => {
      if (disposed) { value.destroy(); return; }
      renderer.current = value; value.setInput(latestInput.current); value.setMood(latestMood.current); update("ready");
    }).catch(() => { if (!controller.signal.aborted) update("fallback"); });
    return () => {
      disposed = true; controller.abort(); renderer.current?.destroy(); renderer.current = undefined;
      canvas.removeEventListener("webglcontextlost", lost); window.removeEventListener("resize", resize);
    };
  }, [active, imageUrl, profile, imageAlignment, sculptureInteraction]);
  useEffect(() => { renderer.current?.setInput(input); }, [input]);
  useEffect(() => { renderer.current?.setMood(mood); }, [mood]);
  if (!active || !imageUrl || !profile) return null;
  return <canvas aria-hidden="true" ref={canvasRef} className={`experience-room-lighting ${className}`} data-lighting-state={state} data-light-shape={profile.shape} />;
}
