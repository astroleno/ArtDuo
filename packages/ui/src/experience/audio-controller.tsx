"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TRACKS = ["Awakening.mp3", "Felt Letter.mp3", "First Words.mp3"] as const;
const LOOP_VOLUME = 0.16;

function releaseAudio(audio: HTMLAudioElement) {
  audio.onerror = null;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
}

export function useAmbientAudio(reading = false) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef(false);
  const stateRef = useRef<"off" | "on" | "error">("off");
  const [state, setState] = useState<"off" | "on" | "error">("off");
  const [volume, setVolume] = useState(LOOP_VOLUME);
  const targetVolume = volume * (reading ? 0.4 : 1);

  const stop = useCallback((): "off" => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    if (audioRef.current) releaseAudio(audioRef.current);
    audioRef.current = null;
    pendingRef.current = false;
    stateRef.current = "off";
    setState("off");
    return "off";
  }, []);

  const toggle = useCallback(async (): Promise<"off" | "on" | "error"> => {
    if (stateRef.current === "on" || pendingRef.current) {
      return stop();
    }
    let audio = audioRef.current;
    if (!audio) {
      const track = TRACKS[Math.floor(Math.random() * TRACKS.length)] ?? TRACKS[0];
      audio = new Audio(`/ambient-audio/${encodeURIComponent(track)}`);
      audio.loop = true;
      audio.preload = "none";
      audio.volume = targetVolume;
      audioRef.current = audio;
      audio.onerror = () => {
        if (audioRef.current !== audio) return;
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        releaseAudio(audio!);
        audioRef.current = null;
        pendingRef.current = false;
        stateRef.current = "error";
        setState("error");
      };
    }
    pendingRef.current = true;
    try {
      await audio.play();
      if (audioRef.current !== audio) {
        releaseAudio(audio);
        return "off";
      }
      pendingRef.current = false;
      stateRef.current = "on";
      setState("on");
      return "on";
    } catch {
      if (audioRef.current !== audio) return stateRef.current;
      releaseAudio(audio);
      audioRef.current = null;
      pendingRef.current = false;
      stateRef.current = "error";
      setState("error");
      return "error";
    }
  }, [stop, targetVolume]);

  const dip = useCallback((durationMs = 700) => {
    const audio = audioRef.current;
    if (!audio || stateRef.current !== "on") return;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const envelope = progress < 0.5 ? 1 - progress * 1.2 : 0.4 + (progress - 0.5) * 1.2;
      audio.volume = Math.max(0, Math.min(1, targetVolume * envelope));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
      else {
        audio.volume = targetVolume;
        frameRef.current = null;
      }
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [targetVolume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || stateRef.current !== "on") return;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    const from = audio.volume;
    const start = performance.now();
    const fade = (now: number) => {
      const progress = Math.min(1, (now - start) / 300);
      audio.volume = from + (targetVolume - from) * progress;
      frameRef.current = progress < 1 ? requestAnimationFrame(fade) : null;
    };
    frameRef.current = requestAnimationFrame(fade);
    return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); };
  }, [targetVolume]);

  useEffect(() => {
    const onVisibilityChange = () => { if (document.visibilityState !== "visible") stop(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [stop]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (audioRef.current) releaseAudio(audioRef.current);
    audioRef.current = null;
    pendingRef.current = false;
  }, []);

  return { state, volume, setVolume, toggle, stop, dip };
}

export function AudioButton({ state, onToggle }: { state: "off" | "on" | "error"; onToggle: () => void }) {
  const label = state === "on" ? "关闭环境音" : state === "error" ? "重试环境音" : "开启环境音";
  return <button aria-label={label} aria-pressed={state === "on"} className="experience-audio-button" onClick={onToggle} type="button">
    <span aria-hidden="true" className={`experience-audio-glyph ${state === "on" ? "is-on" : ""}`}><i /><i /><i /><i /><i /></span>
    <span>{state === "on" ? "环境音已开" : state === "error" ? "音频不可用" : "开启环境音"}</span>
  </button>;
}
