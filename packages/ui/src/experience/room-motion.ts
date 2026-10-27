"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createDeviceParallaxTracker, requestDeviceOrientationAccess, updateDeviceParallax } from "../immersive/device-parallax";
import { boundedRoomLightInput, type RoomLightInput } from "./room-lighting";

export function createRoomOrientationFilter() {
  let angle: number | undefined;
  let samples: Array<{ beta: number; gamma: number }> = [];
  let tracker = createDeviceParallaxTracker();
  return {
    sample(reading: { beta: number | null; gamma: number | null }, screenAngle = 0) {
      if (!Number.isFinite(reading.beta) || !Number.isFinite(reading.gamma)) return undefined;
      const nextAngle = ((screenAngle % 360) + 360) % 360;
      if (angle !== nextAngle) { angle = nextAngle; samples = []; tracker = createDeviceParallaxTracker(); }
      const radians = nextAngle * Math.PI / 180;
      const beta = reading.beta! * Math.cos(radians) + reading.gamma! * Math.sin(radians);
      const gamma = reading.gamma! * Math.cos(radians) - reading.beta! * Math.sin(radians);
      if (samples.length < 5) {
        samples.push({ beta, gamma });
        if (samples.length < 5) return { calibrated: false, x: 0, y: 0 };
        tracker.baselineBeta = samples.reduce((sum, v) => sum + v.beta, 0) / 5;
        tracker.baselineGamma = samples.reduce((sum, v) => sum + v.gamma, 0) / 5;
      }
      return updateDeviceParallax(tracker, { beta, gamma });
    },
  };
}

type MotionState = "off" | "requesting" | "calibrating" | "on" | "denied" | "unavailable";
// Memory of an actual button grant, shared only by rooms in this document.
// Changing to a sculpture and back never silently discards that visitor choice.
let deviceMotionChosenForVisit = false;

export function useRoomMotion(reducedMotion: boolean, paused: boolean, motionAllowed = true) {
  const [input, setInput] = useState<RoomLightInput>({ x: 0, y: 0 });
  const [state, setState] = useState<MotionState>("off");
  const [available, setAvailable] = useState(false);
  const [visible, setVisible] = useState(true);
  const [message, setMessage] = useState<string>();
  const alive = useRef(true);
  const permissionRequest = useRef(0);
  const lastPointer = useRef(0);
  const pointerTimer = useRef<number | undefined>(undefined);
  const pendingPointer = useRef<RoomLightInput>({ x: 0, y: 0 });
  const enabled = state === "on" || state === "calibrating";
  useEffect(() => {
    alive.current = true;
    setAvailable(typeof window.DeviceOrientationEvent !== "undefined" && (navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches));
    const visibility = () => setVisible(document.visibilityState === "visible" && document.hasFocus());
    visibility(); document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", visibility); window.addEventListener("blur", visibility);
    return () => {
      alive.current = false; window.clearTimeout(pointerTimer.current); document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", visibility); window.removeEventListener("blur", visibility);
    };
  }, []);
  useEffect(() => {
    if (available && !reducedMotion && motionAllowed && deviceMotionChosenForVisit && state === "off") setState("calibrating");
  }, [available, reducedMotion, motionAllowed, state]);
  useEffect(() => {
    window.clearTimeout(pointerTimer.current); pointerTimer.current = undefined;
    if (reducedMotion || !motionAllowed || paused || !visible) setInput({ x: 0, y: 0 });
    if (reducedMotion || !motionAllowed) { permissionRequest.current++; setState("off"); setMessage(undefined); }
  }, [reducedMotion, motionAllowed, paused, visible, enabled]);
  useEffect(() => {
    if (!enabled || reducedMotion || !motionAllowed || paused || !visible) return;
    const filter = createRoomOrientationFilter();
    let last = -Infinity;
    let calibrated = false;
    setState("calibrating");
    const timeout = setTimeout(() => {
      if (!calibrated) { setState("unavailable"); setInput({ x: 0, y: 0 }); setMessage("未检测到感应，可照常观展"); }
    }, 2800);
    const reading = (event: DeviceOrientationEvent) => {
      const result = filter.sample(event, window.screen.orientation?.angle ?? window.orientation ?? 0);
      if (!result) return;
      if (!result.calibrated) { setInput({ x: 0, y: 0 }); return; }
      if (!calibrated) { calibrated = true; clearTimeout(timeout); setState("on"); setMessage(undefined); }
      const now = performance.now();
      if (now - last < 33) return;
      last = now; setInput(boundedRoomLightInput(result));
    };
    window.addEventListener("deviceorientation", reading, { passive: true });
    return () => { clearTimeout(timeout); window.removeEventListener("deviceorientation", reading); };
  }, [enabled, reducedMotion, motionAllowed, paused, visible]);
  const setPointer = useCallback((value: RoomLightInput, reset = false) => {
    if (enabled || reducedMotion || !motionAllowed || paused || !visible) return;
    const now = performance.now();
    pendingPointer.current = boundedRoomLightInput(value);
    const deliver = () => {
      pointerTimer.current = undefined;
      if (!alive.current) return;
      lastPointer.current = performance.now(); setInput(pendingPointer.current);
    };
    if (reset || now - lastPointer.current >= 33) { window.clearTimeout(pointerTimer.current); deliver(); }
    else if (pointerTimer.current === undefined) pointerTimer.current = window.setTimeout(deliver, 33 - (now - lastPointer.current));
  }, [enabled, reducedMotion, motionAllowed, paused, visible]);
  const toggle = async () => {
    if (enabled || state === "requesting") { permissionRequest.current++; deviceMotionChosenForVisit = false; setState("off"); setInput({ x: 0, y: 0 }); setMessage(undefined); return; }
    if (reducedMotion || !motionAllowed) return;
    const request = ++permissionRequest.current;
    setState("requesting"); setMessage(undefined);
    // Keep the permission call inside the actual button gesture.
    const access = window.isSecureContext === false ? "unsupported" : await requestDeviceOrientationAccess();
    if (!alive.current || permissionRequest.current !== request) return;
    if (access === "granted") { deviceMotionChosenForVisit = true; setState("calibrating"); }
    else { setState(access === "denied" ? "denied" : "unavailable"); setMessage(access === "denied" ? "未开启感应，可照常观展" : "此设备暂不支持感应，可照常观展"); }
  };
  return { input, state, available: available && !reducedMotion, enabled, message, setPointer, toggle };
}
