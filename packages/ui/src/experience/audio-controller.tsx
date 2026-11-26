"use client";

import { useEffect, useState } from "react";
import { appPath } from "@artduo/contracts";
import type { ExperienceState } from "./state";

const TRACKS = ["Awakening.mp3", "Felt Letter.mp3", "First Words.mp3"] as const;
const LOOP_VOLUME = 0.16;
const START_TIMEOUT_MS = 20_000;
const TURN_FLOOR = .65;
const TURN_DOWN_MS = 200;
const TURN_RECOVER_MS = 400;
const CLOSING_FADE_MS = 1200;
const LEVEL_RAMP_MS = 300;
type AudioState = ExperienceState["audioState"];

interface AmbientPlaybackOptions {
  createAudio: () => HTMLAudioElement;
  now: () => number;
  frame: (callback: FrameRequestCallback) => number;
  cancelFrame: (id: number) => void;
  onState: (state: AudioState) => void;
  isVisible: () => boolean;
}

function releaseAudio(audio: HTMLAudioElement) {
  audio.onerror = null;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
}

export function createAmbientPlayback(options: AmbientPlaybackOptions) {
  let audio: HTMLAudioElement | undefined;
  let state: AudioState = "off";
  let authorized = false, closing = false, endingQuiet = false, volumeLocked = false;
  let base = LOOP_VOLUME;
  let frame: number | undefined, startTimer: ReturnType<typeof setTimeout> | undefined;
  let playbackSeq = 0;
  let fade: { at: number; from: number } | undefined;
  let turn: { at: number; from: number } | undefined;
  let level: { at: number; from: number } | undefined;

  const setState = (next: AudioState) => {
    if (state === next) return;
    state = next;
    options.onState(next);
  };
  const cancelAnimation = () => {
    if (frame !== undefined) options.cancelFrame(frame);
    frame = undefined;
    fade = turn = level = undefined;
  };
  const invalidatePlay = () => {
    ++playbackSeq;
    clearTimeout(startTimer);
    startTimer = undefined;
  };
  const writeVolume = (value: number) => {
    if (!audio || volumeLocked) return;
    const next = Math.min(1, Math.max(0, value));
    try {
      audio.volume = next;
      volumeLocked = Math.abs(audio.volume - next) > .002;
    } catch { volumeLocked = true; }
  };
  const pause = () => {
    invalidatePlay();
    audio?.pause();
    setState("off");
  };
  const stop = () => {
    authorized = endingQuiet = false;
    invalidatePlay();
    cancelAnimation();
    if (audio) releaseAudio(audio);
    audio = undefined;
    setState("off");
    return state;
  };
  const finishClosing = () => {
    cancelAnimation();
    writeVolume(0);
    endingQuiet = true;
    pause();
  };
  const tick = (now: number) => {
    frame = undefined;
    if (!audio || !authorized || state !== "on") return;
    if (fade) {
      const elapsed = Math.max(0, now - fade.at);
      if (elapsed >= CLOSING_FADE_MS) { finishClosing(); return; }
      writeVolume(Math.min(audio.volume, base, fade.from * (1 - elapsed / CLOSING_FADE_MS)));
    } else if (turn) {
      const elapsed = Math.max(0, now - turn.at);
      if (elapsed < TURN_DOWN_MS) writeVolume(Math.min(base, turn.from + (base * TURN_FLOOR - turn.from) * elapsed / TURN_DOWN_MS));
      else if (elapsed < TURN_DOWN_MS + TURN_RECOVER_MS) writeVolume(base * (TURN_FLOOR + (1 - TURN_FLOOR) * (elapsed - TURN_DOWN_MS) / TURN_RECOVER_MS));
      else { writeVolume(base); turn = undefined; }
    } else if (level) {
      const progress = Math.min(1, Math.max(0, now - level.at) / LEVEL_RAMP_MS);
      writeVolume(level.from + (base - level.from) * progress);
      if (progress === 1 || volumeLocked) level = undefined;
    }
    if (fade || turn || level) frame = options.frame(tick);
  };
  const schedule = () => { if (frame === undefined) frame = options.frame(tick); };
  const rampToBase = () => {
    if (!audio || volumeLocked || state !== "on" || endingQuiet) return;
    level = { at: options.now(), from: audio.volume };
    schedule();
  };
  const fail = (media: HTMLAudioElement) => {
    if (audio !== media) return;
    stop();
    setState("error");
  };
  const start = async (resume: boolean): Promise<AudioState> => {
    const media = audio;
    if (!media || !authorized || base === 0 || !options.isVisible()) return state;
    const ticket = ++playbackSeq;
    setState("loading");
    startTimer = setTimeout(() => { if (ticket === playbackSeq) fail(media); }, START_TIMEOUT_MS);
    try {
      await media.play();
      if (ticket !== playbackSeq) {
        if (audio !== media || !authorized || !base || endingQuiet || !options.isVisible()) media.pause();
        return state;
      }
      clearTimeout(startTimer);
      startTimer = undefined;
      setState("on");
      if (resume) rampToBase();
      return state;
    } catch {
      if (ticket !== playbackSeq) return state;
      if (resume) {
        authorized = false;
        pause();
      } else fail(media);
      return state;
    }
  };

  const toggle = (trackUrls?: readonly string[]): Promise<AudioState> => {
    if (state === "on" || state === "loading") return Promise.resolve(stop());
    if (!base || !options.isVisible()) return Promise.resolve(state);
    const urls = trackUrls?.length ? trackUrls : TRACKS.map(track => appPath("/ambient-audio/" + encodeURIComponent(track)));
    const create = !audio;
    audio ??= options.createAudio();
    if (create) {
      volumeLocked = false;
      try { volumeLocked = audio.matches(":volume-locked"); } catch { /* Detect by reading back the first volume write. */ }
      audio.loop = true;
      audio.preload = "none";
      const media = audio;
      audio.onerror = () => fail(media);
    }
    authorized = true;
    endingQuiet = false;
    writeVolume(base);
    if (create) audio.src = urls[Math.floor(Math.random() * urls.length)]!;
    return start(false);
  };

  const setScene = (nextBase: number, nextClosing: boolean) => {
    const levelChanged = base !== nextBase;
    base = nextBase;
    const wasClosing = closing;
    closing = nextClosing;
    if (!audio) return;
    if (!base) {
      cancelAnimation();
      authorized = false;
      writeVolume(0);
      pause();
      return;
    }
    if (closing && !wasClosing) {
      if (!authorized) return;
      cancelAnimation();
      if (state === "loading") { finishClosing(); return; }
      if (state === "on") {
        fade = { at: options.now(), from: audio.volume };
        schedule();
      }
    } else if (!closing && wasClosing) {
      cancelAnimation();
      const resume = endingQuiet;
      endingQuiet = false;
      if (resume && authorized && options.isVisible()) void start(true);
      else rampToBase();
    } else if (levelChanged && !fade && !turn) {
      if (state === "loading") writeVolume(base);
      else rampToBase();
    }
  };

  const navigate = (isTurn: boolean) => {
    if (!audio || closing || state !== "on" || volumeLocked) return;
    if (!isTurn && !turn) return;
    cancelAnimation();
    if (isTurn) {
      turn = { at: options.now(), from: audio.volume };
      schedule();
    } else rampToBase();
  };

  return { stop, toggle, setScene, navigate };
}

export function useAmbientAudio(reading = false, atmosphereGain = 1, trackUrls?: readonly string[], closing = false) {
  const [state, setState] = useState<AudioState>("off");
  const [volume, setVolume] = useState(LOOP_VOLUME);
  const [player] = useState(() => createAmbientPlayback({
    createAudio: () => new Audio(),
    now: () => performance.now(),
    frame: request => requestAnimationFrame(request),
    cancelFrame: id => cancelAnimationFrame(id),
    onState: setState,
    isVisible: () => document.visibilityState === "visible",
  }));
  const targetVolume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : LOOP_VOLUME))
    * Math.max(.5, Math.min(1, Number.isFinite(atmosphereGain) ? atmosphereGain : 1)) * (reading ? .4 : 1);

  useEffect(() => { player.setScene(targetVolume, closing); }, [player, targetVolume, closing]);
  useEffect(() => {
    const onVisibilityChange = () => { if (document.visibilityState !== "visible") player.stop(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { document.removeEventListener("visibilitychange", onVisibilityChange); player.stop(); };
  }, [player]);

  return { state, volume, setVolume, toggle: () => player.toggle(trackUrls), navigate: player.navigate };
}

export function AudioButton({ state, onToggle }: { state: AudioState; onToggle: () => void }) {
  const label = state === "loading" ? "取消环境音加载" : state === "on" ? "关闭环境音" : state === "error" ? "重试环境音" : "开启环境音";
  return <button aria-label={label} aria-pressed={state === "on"} data-audio-state={state} className="experience-audio-button" onClick={onToggle} type="button">
    <span aria-hidden="true" className={`experience-audio-glyph ${state === "on" ? "is-on" : state === "loading" ? "is-loading" : ""}`}><i /><i /><i /><i /><i /></span>
    <span className="experience-audio-label">{state === "loading" ? "正在准备环境音" : state === "on" ? "环境音已开" : state === "error" ? "音频不可用，重试" : "开启环境音"}</span>
    <span aria-live="polite" className="sr-only">{state === "loading" ? "正在准备环境音，再次按下可取消。" : state === "error" ? "环境音暂时无法播放，可以重试。" : ""}</span>
  </button>;
}
