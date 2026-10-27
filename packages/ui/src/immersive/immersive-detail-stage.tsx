"use client";

import type { CSSProperties, PointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { DepthParallaxController } from "./depth-parallax-renderer";
import {
  createDeviceParallaxTracker,
  requestDeviceOrientationAccess,
  updateDeviceParallax,
  type DeviceParallaxTracker,
} from "./device-parallax";
import type { ImmersiveGalleryUnit } from "./scene-orchestrator";
import { useIdleChrome } from "../experience/use-idle-chrome";
import { RoomLightingLayer } from "../experience/room-lighting-layer";
import { boundedRoomLightInput, roomLightProfile, type RoomLightInput } from "../experience/room-lighting";

export interface ImmersiveDetailOrigin {
  scale: number;
  x: number;
  y: number;
}

interface ImmersiveDetailStageProps {
  entryOrigin?: ImmersiveDetailOrigin;
  hasNext?: boolean;
  hasPrevious?: boolean;
  imageSrc: string;
  pendingArtwork?: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  requireDepthMap?: boolean;
  motionEnabled?: boolean;
  unit: ImmersiveGalleryUnit;
}

type DepthStatus = "loading" | "ready" | "static";
type MotionState = "idle" | "requesting" | "calibrating" | "enabled" | "denied" | "unavailable";
type StagePhase = "entering" | "open" | "closing";

const ENTER_DURATION_MS = 720;
const EXIT_DURATION_MS = 200;
const MOTION_STRENGTH = 0.32;
const MOTION_CALIBRATION_TIMEOUT_MS = 2200;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export function ImmersiveDetailStage({
  entryOrigin,
  hasNext = false,
  hasPrevious = false,
  imageSrc,
  pendingArtwork = false,
  onClose,
  onNext,
  onPrevious,
  requireDepthMap = false,
  motionEnabled = true,
  unit,
}: ImmersiveDetailStageProps) {
  const [depthResult, setDepthResult] = useState<{ artworkId: string; status: DepthStatus }>({ artworkId: unit.id, status: "loading" });
  const depthStatus = depthResult.artworkId === unit.id ? depthResult.status : "loading";
  const [motionMessage, setMotionMessage] = useState<string | undefined>();
  const [motionState, setMotionState] = useState<MotionState>("idle");
  const [motionAvailable, setMotionAvailable] = useState(false);
  const [phase, setPhase] = useState<StagePhase>("entering");
  const [decodedImage, setDecodedImage] = useState<{ src: string; ratio: number }>();
  const measuredAspect = decodedImage?.src === imageSrc ? decodedImage.ratio
    : unit.visualPresentation?.cropStrategy === "preserve-paper" ? unit.visualPresentation.contentAspectRatio : undefined;
  const hasMeasuredAspect = Number.isFinite(measuredAspect) && (measuredAspect ?? 0) > 0;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<DepthParallaxController | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const closingRef = useRef(false);
  const enterTimerRef = useRef<number | undefined>(undefined);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const motionTrackerRef = useRef<DeviceParallaxTracker>(createDeviceParallaxTracker());
  const motionVectorRef = useRef({ x: 0, y: 0 });
  const byline = [unit.artistDisplayName, unit.yearLabel].filter(Boolean).join(", ");
  const chromeVisible = useIdleChrome(true, pendingArtwork || motionState === "requesting" || motionState === "calibrating");
  const [environmentInput, setEnvironmentInput] = useState<RoomLightInput>({ x: 0, y: 0 });
  const lastEnvironmentUpdate = useRef(0);
  const environmentProfile = roomLightProfile(unit.backgroundSceneId);
  const depthSource = unit.depthMapUrl ? "depth-map" : requireDepthMap ? "static" : "simulated";
  // Release depth maps are fingerprinted against the complete preview pixels.
  // Keep that exact image in the renderer even after the high-resolution still loads.
  const depthImageSrc = requireDepthMap && unit.depthMapUrl ? unit.imageUrl : imageSrc;
  const originStyle = {
    "--immersive-entry-scale": String(entryOrigin?.scale ?? 0.72),
    "--immersive-entry-x": `${entryOrigin?.x ?? 0}px`,
    "--immersive-entry-y": `${entryOrigin?.y ?? 0}px`,
    ...(hasMeasuredAspect ? { "--immersive-source-aspect-ratio": String(measuredAspect) } : {}),
  } as CSSProperties;

  const requestClose = useCallback((immediate = false) => {
    if (immediate || prefersReducedMotion()) {
      closingRef.current = true;
      window.clearTimeout(enterTimerRef.current);
      window.clearTimeout(closeTimerRef.current);
      onClose();
      return;
    }
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    window.clearTimeout(enterTimerRef.current);
    setPhase("closing");
    closeTimerRef.current = window.setTimeout(onClose, EXIT_DURATION_MS);
  }, [onClose]);

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

  const applyParallaxVector = useCallback((x: number, y: number, input: "touch" | "motion" | "rest") => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    frame.style.cssText = [
      `--immersive-tilt-x:${-y * 1.15}deg`,
      `--immersive-tilt-y:${x * 1.35}deg`,
      `--immersive-glow-x:${50 + x * 12}%`,
      `--immersive-glow-y:${42 + y * 10}%`,
    ].join(";");
    frame.dataset.parallaxInput = input;
    rendererRef.current?.setPointer(x, y);
    const now = performance.now();
    if (input === "rest" || now - lastEnvironmentUpdate.current >= 33) {
      lastEnvironmentUpdate.current = now;
      const strength = input === "motion" ? 1 / MOTION_STRENGTH : 1;
      setEnvironmentInput(boundedRoomLightInput({ x: x * strength, y: y * strength }));
    }
  }, []);

  const resetParallax = useCallback(() => {
    applyParallaxVector(0, 0, "rest");
    rendererRef.current?.reset();
  }, [applyParallaxVector]);

  useEffect(() => {
    setMotionAvailable(typeof window.DeviceOrientationEvent !== "undefined"
      && (navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches)
      && motionEnabled && !prefersReducedMotion());
    if (!motionEnabled) { setMotionState("idle"); resetParallax(); }
  }, [motionEnabled, resetParallax]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    enterTimerRef.current = window.setTimeout(() => { if (!closingRef.current) setPhase("open"); }, prefersReducedMotion() ? 0 : ENTER_DURATION_MS);

    return () => window.clearTimeout(enterTimerRef.current);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Tab") {
        const dialog = dialogRef.current;
        const focusable = dialog?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) {
          event.preventDefault();
          dialog?.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !dialog?.contains(active))) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && (active === last || !dialog?.contains(active))) {
          event.preventDefault();
          first?.focus();
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        requestClose(true);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        event.stopPropagation();
        if (hasPrevious && !pendingArtwork && phase === "open") onPrevious?.();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        if (hasNext && !pendingArtwork && phase === "open") onNext?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [hasNext, hasPrevious, onNext, onPrevious, pendingArtwork, phase, requestClose]);

  useEffect(() => {
    if (motionState !== "calibrating" && motionState !== "enabled") {
      return;
    }

    function handleOrientation(event: DeviceOrientationEvent) {
      if (prefersReducedMotion()) {
        setMotionMessage("已按系统设置关闭动态效果");
        setMotionState("unavailable");
        resetParallax();
        return;
      }

      if (typeof event.beta !== "number" || typeof event.gamma !== "number") {
        return;
      }

      const vector = updateDeviceParallax(motionTrackerRef.current, {
        beta: event.beta,
        gamma: event.gamma,
      });
      motionVectorRef.current = { x: vector.x, y: vector.y };

      if (activePointerRef.current === null) {
        applyParallaxVector(vector.x * MOTION_STRENGTH, vector.y * MOTION_STRENGTH, "motion");
      }

      if (motionState === "calibrating") {
        setMotionMessage(undefined);
        setMotionState("enabled");
      }
    }

    window.addEventListener("deviceorientation", handleOrientation, { passive: true });
    const calibrationTimeout = motionState === "calibrating"
      ? window.setTimeout(() => {
        setMotionMessage("没有检测到手机姿态，仍可拖动画面");
        setMotionState("unavailable");
        resetParallax();
      }, MOTION_CALIBRATION_TIMEOUT_MS)
      : undefined;

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      if (calibrationTimeout !== undefined) {
        window.clearTimeout(calibrationTimeout);
      }
    };
  }, [applyParallaxVector, motionState, resetParallax]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !motionEnabled || prefersReducedMotion() || (requireDepthMap && !unit.depthMapUrl)) {
      setDepthResult({ artworkId: unit.id, status: "static" });
      return;
    }

    let disposed = false;
    const abort = new AbortController();
    setDepthResult({ artworkId: unit.id, status: "loading" });

    void import("./depth-parallax-renderer")
      .then(({ createDepthParallaxRenderer }) => createDepthParallaxRenderer({
        canvas,
        depthMapUrl: unit.depthMapUrl,
        imageUrl: depthImageSrc,
        requireDepthMap,
        signal: abort.signal,
      }))
      .then((renderer) => {
        if (disposed) {
          renderer.destroy();
          return;
        }

        rendererRef.current = renderer;
        setDepthResult({ artworkId: unit.id, status: "ready" });
      })
      .catch(() => {
        if (!disposed) {
          setDepthResult({ artworkId: unit.id, status: "static" });
        }
      });

    return () => {
      disposed = true;
      abort.abort();
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [depthImageSrc, motionEnabled, requireDepthMap, unit.depthMapUrl, unit.id]);

  useEffect(() => {
    if (motionState === "enabled") {
      const vector = motionVectorRef.current;
      applyParallaxVector(vector.x * MOTION_STRENGTH, vector.y * MOTION_STRENGTH, "motion");
      return;
    }

    if (activePointerRef.current === null) {
      resetParallax();
    }
  }, [applyParallaxVector, motionState, resetParallax, unit.id]);

  async function toggleDeviceMotion() {
    if (motionState === "enabled" || motionState === "calibrating") {
      setMotionMessage(undefined);
      setMotionState("idle");
      motionTrackerRef.current = createDeviceParallaxTracker();
      motionVectorRef.current = { x: 0, y: 0 };
      if (activePointerRef.current === null) {
        resetParallax();
      }
      return;
    }

    if (prefersReducedMotion()) {
      setMotionMessage("已按系统设置关闭动态效果");
      setMotionState("unavailable");
      return;
    }

    setMotionMessage(undefined);
    setMotionState("requesting");
    const access = await requestDeviceOrientationAccess();

    if (access === "unsupported") {
      setMotionMessage("此设备暂不支持感应，仍可拖动画面");
      setMotionState("unavailable");
      return;
    }
    if (access === "denied") {
      setMotionMessage("未获得运动权限，仍可拖动画面");
      setMotionState("denied");
      return;
    }

    motionTrackerRef.current = createDeviceParallaxTracker();
    motionVectorRef.current = { x: 0, y: 0 };
    setMotionMessage("轻轻移动手机完成校准");
    setMotionState("calibrating");
  }

  function motionButtonLabel(): string {
    if (motionState === "requesting") {
      return "正在开启";
    }
    if (motionState === "calibrating") {
      return "轻动手机校准";
    }
    if (motionState === "enabled") {
      return "关闭手机感应";
    }
    if (motionState === "unavailable") {
      return "手机感应不可用";
    }

    return "开启手机感应";
  }

  function setPointerPosition(clientX: number, clientY: number) {
    if (!motionEnabled || prefersReducedMotion()) {
      resetParallax();
      return;
    }

    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const bounds = frame.getBoundingClientRect();
    const x = clamp((clientX - bounds.left - bounds.width / 2) / Math.max(1, bounds.width / 2));
    const y = clamp((clientY - bounds.top - bounds.height / 2) / Math.max(1, bounds.height / 2));

    applyParallaxVector(x, y, "touch");
  }

  function resumeAmbientParallax() {
    if (!motionEnabled || prefersReducedMotion()) {
      resetParallax();
      return;
    }

    if (motionState === "enabled") {
      const vector = motionVectorRef.current;
      applyParallaxVector(vector.x * MOTION_STRENGTH, vector.y * MOTION_STRENGTH, "motion");
      return;
    }

    resetParallax();
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!motionEnabled || prefersReducedMotion()) {
      resetParallax();
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    activePointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPointerPosition(event.clientX, event.clientY);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" && activePointerRef.current !== event.pointerId) {
      return;
    }

    setPointerPosition(event.clientX, event.clientY);
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (activePointerRef.current === event.pointerId) {
      activePointerRef.current = null;
    }
    resumeAmbientParallax();
  }

  return (
    <div
      aria-label={`《${unit.title}》沉浸观看`}
      aria-modal="true"
      aria-busy={pendingArtwork}
      className="immersive-detail-dialog"
      data-depth-source={depthSource}
      data-depth-status={depthStatus}
      data-experience-stage="immersive-detail"
      data-motion-state={motionState}
      data-gallery-context={Boolean(unit.backgroundSceneUrl)}
      data-chrome-visible={chromeVisible}
      data-phase={phase}
      data-artwork-id={unit.id}
      ref={dialogRef}
      role="dialog"
      style={originStyle}
      tabIndex={-1}
    >
      <div className="immersive-detail-atmosphere" aria-hidden="true">
        <img alt="" crossOrigin="anonymous" className="immersive-detail-backdrop" src={unit.backgroundSceneUrl ?? imageSrc} />
        <RoomLightingLayer className="immersive-environment-lighting" imageUrl={unit.backgroundSceneUrl}
          profile={environmentProfile} input={environmentInput} mood={unit.lightingMood} active={motionEnabled && !prefersReducedMotion() && phase !== "closing"} />
        <span className="immersive-detail-vignette" />
        <span className="immersive-detail-grain" />
      </div>

      <header className="immersive-detail-header">
        <div className="immersive-detail-heading">
          {motionAvailable ? <button
            aria-label={motionState === "enabled" || motionState === "calibrating"
              ? "关闭手机感应"
              : "开启手机感应"}
            aria-pressed={motionState === "enabled" || motionState === "calibrating"}
            className="immersive-detail-motion-toggle"
            disabled={motionState === "requesting" || motionState === "unavailable"}
            onClick={toggleDeviceMotion}
            type="button"
          >
            <span className="immersive-detail-motion-mark" aria-hidden="true" />
            {motionButtonLabel()}
          </button> : null}
          {motionMessage ? (
            <p className="immersive-detail-motion-status" role="status">{motionMessage}</p>
          ) : null}
        </div>
        <button
          aria-label="返回画廊视图"
          className="immersive-detail-close"
          onClick={() => requestClose()}
          ref={closeButtonRef}
          type="button"
        >
          <span aria-hidden="true">↙</span>
          返回画廊
        </button>
      </header>

      <div className="immersive-detail-world">
        <div
          className="immersive-detail-frame"
          data-aspect-ratio={unit.aspectRatioHint ?? "landscape"}
          data-exact-aspect={hasMeasuredAspect ? "true" : undefined}
          key={unit.id}
          onPointerCancel={handlePointerEnd}
          onPointerDown={handlePointerDown}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") {
              resumeAmbientParallax();
            }
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          ref={frameRef}
        >
          <img
            crossOrigin="anonymous"
            alt={`${unit.title} artwork immersive view`}
            className="immersive-detail-fallback"
            onLoad={(event) => {
              const image = event.currentTarget;
              if (image.naturalWidth > 0 && image.naturalHeight > 0) setDecodedImage({ src: imageSrc, ratio: image.naturalWidth / image.naturalHeight });
            }}
            decoding="async"
            src={imageSrc}
          />
          <canvas key={`${unit.id}|${depthImageSrc}|${unit.depthMapUrl ?? ""}`} aria-hidden="true" className="immersive-detail-canvas" ref={canvasRef} />
          <span className="immersive-detail-surface-light" aria-hidden="true" />
        </div>
      </div>

      <p className="immersive-detail-caption">
        <strong>{unit.title}</strong>
        {byline ? <span>{byline}</span> : null}
      </p>

      <p className="immersive-detail-hint" aria-hidden="true">
        <span className="immersive-detail-touch-mark" />
        {depthStatus === "static" ? "静静观看这幅作品" : "拖动画面，感受空间层次"}
      </p>
      {pendingArtwork ? <p className="immersive-detail-pending" role="status">正在准备作品</p> : null}

      <nav aria-label="沉浸作品切换" className="immersive-detail-navigation">
        <button
          aria-label="上一幅作品"
          className="is-previous"
          disabled={!hasPrevious || pendingArtwork || phase !== "open"}
          onClick={onPrevious}
          type="button"
        >
          <span aria-hidden="true">←</span>
          上一幅
        </button>
        <button
          aria-label="下一幅作品"
          className="is-next"
          disabled={!hasNext || pendingArtwork || phase !== "open"}
          onClick={onNext}
          type="button"
        >
          下一幅
          <span aria-hidden="true">→</span>
        </button>
      </nav>
    </div>
  );
}
