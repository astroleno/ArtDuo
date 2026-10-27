"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { appPath } from "@artduo/contracts";
import type { ExperienceState } from "./state";

const TRACKS = ["Awakening.mp3", "Felt Letter.mp3", "First Words.mp3"] as const;
const LOOP_VOLUME = 0.16;
const START_TIMEOUT_MS = 20_000;
type AudioState = ExperienceState["audioState"];

function releaseAudio(audio: HTMLAudioElement) {
  audio.onerror = null;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
}

export function useAmbientAudio(reading = false, atmosphereGain = 1, trackUrls?: readonly string[]) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingRef = useRef(false);
  const stateRef = useRef<AudioState>("off");
  const [state, setState] = useState<AudioState>("off");
  const [volume, setVolume] = useState(LOOP_VOLUME);
  const targetVolume = volume * Math.max(.5, Math.min(1, Number.isFinite(atmosphereGain) ? atmosphereGain : 1)) * (reading ? 0.4 : 1);

  const stop = useCallback((): "off" => {
    clearTimeout(startTimerRef.current);
    startTimerRef.current = undefined;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    if (audioRef.current) releaseAudio(audioRef.current);
    audioRef.current = null;
    pendingRef.current = false;
    stateRef.current = "off";
    setState("off");
    return "off";
  }, []);

  const toggle = useCallback(async (): Promise<AudioState> => {
    if (stateRef.current === "on" || pendingRef.current) {
      return stop();
    }
    let audio = audioRef.current;
    if (!audio) {
      const urls = trackUrls?.length ? trackUrls : TRACKS.map(track => appPath(`/ambient-audio/${encodeURIComponent(track)}`));
      const track = urls[Math.floor(Math.random() * urls.length)]!;
      audio = new Audio(track);
      audio.loop = true;
      audio.preload = "none";
      audio.volume = targetVolume;
      audioRef.current = audio;
      audio.onerror = () => {
        if (audioRef.current !== audio) return;
        clearTimeout(startTimerRef.current);
        startTimerRef.current = undefined;
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
    stateRef.current = "loading";
    setState("loading");
    startTimerRef.current = setTimeout(() => {
      if (audioRef.current === audio && pendingRef.current) audio.onerror?.(new Event("error"));
    }, START_TIMEOUT_MS);
    try {
      await audio.play();
      if (audioRef.current !== audio) {
        releaseAudio(audio);
        return "off";
      }
      clearTimeout(startTimerRef.current);
      startTimerRef.current = undefined;
      pendingRef.current = false;
      stateRef.current = "on";
      setState("on");
      return "on";
    } catch {
      if (audioRef.current !== audio) return stateRef.current;
      clearTimeout(startTimerRef.current);
      startTimerRef.current = undefined;
      releaseAudio(audio);
      audioRef.current = null;
      pendingRef.current = false;
      stateRef.current = "error";
      setState("error");
      return "error";
    }
  }, [stop, targetVolume, trackUrls]);

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
  }, [state, targetVolume]);

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
    clearTimeout(startTimerRef.current);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (audioRef.current) releaseAudio(audioRef.current);
    audioRef.current = null;
    pendingRef.current = false;
  }, []);

  return { state, volume, setVolume, toggle, stop, dip };
}

export function AudioButton({ state, onToggle }: { state: AudioState; onToggle: () => void }) {
  const label = state === "loading" ? "取消环境音加载" : state === "on" ? "关闭环境音" : state === "error" ? "重试环境音" : "开启环境音";
  return <button aria-label={label} aria-pressed={state === "on"} data-audio-state={state} className="experience-audio-button" onClick={onToggle} type="button">
    <span aria-hidden="true" className={`experience-audio-glyph ${state === "on" ? "is-on" : state === "loading" ? "is-loading" : ""}`}><i /><i /><i /><i /><i /></span>
    <span className="experience-audio-label">{state === "loading" ? "正在准备环境音" : state === "on" ? "环境音已开" : state === "error" ? "音频不可用，重试" : "开启环境音"}</span>
    <span aria-live="polite" className="sr-only">{state === "loading" ? "正在准备环境音，再次按下可取消。" : state === "error" ? "环境音暂时无法播放，可以重试。" : ""}</span>
  </button>;
}
