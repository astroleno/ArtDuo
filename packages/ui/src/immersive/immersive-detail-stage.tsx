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
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  unit: ImmersiveGalleryUnit;
}

type DepthStatus = "loading" | "ready" | "static";
type MotionState = "idle" | "requesting" | "calibrating" | "enabled" | "denied" | "unavailable";
type StagePhase = "entering" | "open" | "closing";

const ENTER_DURATION_MS = 720;
const EXIT_DURATION_MS = 520;
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
  onClose,
  onNext,
  onPrevious,
  unit,
}: ImmersiveDetailStageProps) {
  const [depthStatus, setDepthStatus] = useState<DepthStatus>("loading");
  const [motionMessage, setMotionMessage] = useState<string | undefined>();
  const [motionState, setMotionState] = useState<MotionState>("idle");
  const [phase, setPhase] = useState<StagePhase>("entering");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<DepthParallaxController | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const closingRef = useRef(false);
  const motionTrackerRef = useRef<DeviceParallaxTracker>(createDeviceParallaxTracker());
  const motionVectorRef = useRef({ x: 0, y: 0 });
  const byline = [unit.artistDisplayName, unit.yearLabel].filter(Boolean).join(", ");
  const depthSource = unit.depthMapUrl ? "depth-map" : "simulated";
  const originStyle = {
    "--immersive-entry-scale": String(entryOrigin?.scale ?? 0.72),
    "--immersive-entry-x": `${entryOrigin?.x ?? 0}px`,
    "--immersive-entry-y": `${entryOrigin?.y ?? 0}px`,
  } as CSSProperties;

  const requestClose = useCallback(() => {
    if (closingRef.current) {
      return;
    }

    if (prefersReducedMotion()) {
      onClose();
      return;
    }

    closingRef.current = true;
    setPhase("closing");
    window.setTimeout(onClose, EXIT_DURATION_MS);
  }, [onClose]);

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
  }, []);

  const resetParallax = useCallback(() => {
    applyParallaxVector(0, 0, "rest");
    rendererRef.current?.reset();
  }, [applyParallaxVector]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const timer = window.setTimeout(() => setPhase("open"), prefersReducedMotion() ? 0 : ENTER_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        requestClose();
      } else if (event.key === "ArrowLeft" && hasPrevious && onPrevious) {
        event.preventDefault();
        event.stopPropagation();
        onPrevious();
      } else if (event.key === "ArrowRight" && hasNext && onNext) {
        event.preventDefault();
        event.stopPropagation();
        onNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [hasNext, hasPrevious, onNext, onPrevious, requestClose]);

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
    if (!canvas || prefersReducedMotion()) {
      setDepthStatus("static");
      return;
    }

    let disposed = false;
    setDepthStatus("loading");

    void import("./depth-parallax-renderer")
      .then(({ createDepthParallaxRenderer }) => createDepthParallaxRenderer({
        canvas,
        depthMapUrl: unit.depthMapUrl,
        imageUrl: imageSrc,
      }))
      .then((renderer) => {
        if (disposed) {
          renderer.destroy();
          return;
        }

        rendererRef.current = renderer;
        setDepthStatus("ready");
      })
      .catch(() => {
        if (!disposed) {
          setDepthStatus("static");
        }
      });

    return () => {
      disposed = true;
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [imageSrc, unit.depthMapUrl, unit.id]);

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
      setMotionMessage("此设备暂不支持手机随动，仍可拖动画面");
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
      return "手机随动已开";
    }
    if (motionState === "unavailable") {
      return "手机随动不可用";
    }

    return "随手机轻动";
  }

  function setPointerPosition(clientX: number, clientY: number) {
    if (prefersReducedMotion()) {
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
    if (prefersReducedMotion()) {
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
    if (prefersReducedMotion()) {
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
      className="immersive-detail-dialog"
      data-depth-source={depthSource}
      data-depth-status={depthStatus}
      data-experience-stage="immersive-detail"
      data-motion-state={motionState}
      data-phase={phase}
      role="dialog"
      style={originStyle}
    >
      <div className="immersive-detail-atmosphere" aria-hidden="true">
        <img alt="" className="immersive-detail-backdrop" src={imageSrc} />
        <span className="immersive-detail-vignette" />
        <span className="immersive-detail-grain" />
      </div>

      <header className="immersive-detail-header">
        <div className="immersive-detail-heading">
          <p className="immersive-detail-stage-label">
            <span>第二阶段</span>
            <strong>沉浸观看</strong>
          </p>
          <button
            aria-label={motionState === "enabled" || motionState === "calibrating"
              ? "关闭随手机轻动"
              : "开启随手机轻动"}
            aria-pressed={motionState === "enabled" || motionState === "calibrating"}
            className="immersive-detail-motion-toggle"
            disabled={motionState === "requesting" || motionState === "unavailable"}
            onClick={toggleDeviceMotion}
            type="button"
          >
            <span className="immersive-detail-motion-mark" aria-hidden="true" />
            {motionButtonLabel()}
          </button>
          {motionMessage ? (
            <p className="immersive-detail-motion-status" role="status">{motionMessage}</p>
          ) : null}
        </div>
        <button
          aria-label="返回画廊视图"
          className="immersive-detail-close"
          onClick={requestClose}
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
            alt={`${unit.title} artwork immersive view`}
            className="immersive-detail-fallback"
            decoding="async"
            src={imageSrc}
          />
          <canvas aria-hidden="true" className="immersive-detail-canvas" ref={canvasRef} />
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
        <small>{depthSource === "depth-map" ? "DEPTH MAP" : "SPIKE · 模拟深度"}</small>
      </p>

      <nav aria-label="沉浸作品切换" className="immersive-detail-navigation">
        <button
          aria-label="上一幅作品"
          className="is-previous"
          disabled={!hasPrevious}
          onClick={onPrevious}
          type="button"
        >
          <span aria-hidden="true">←</span>
          上一幅
        </button>
        <button
          aria-label="下一幅作品"
          className="is-next"
          disabled={!hasNext}
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
