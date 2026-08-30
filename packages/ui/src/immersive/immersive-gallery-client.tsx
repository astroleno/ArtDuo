"use client";

import type { CSSProperties, PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { ImageLightbox } from "./image-lightbox";
import { ProgressIndicator } from "./progress-indicator";
import type { ImmersiveScene } from "./scene-orchestrator";

interface ImmersiveGalleryClientProps {
  scenes: ImmersiveScene[];
  initialIndex: number;
  galleryHref: string;
  preface?: string;
  closing?: string;
  sceneHrefs: Array<string | undefined>;
}

const AMBIENT_TRACKS = {
  opening: { label: "First Words", src: "/ambient-audio/First%20Words.mp3" },
  drift: { label: "Felt Letter", src: "/ambient-audio/Felt%20Letter.mp3" },
  return: { label: "Awakening", src: "/ambient-audio/Awakening.mp3" },
  scene: { label: "Felt Letter", src: "/ambient-audio/Felt%20Letter.mp3" },
} as const;

function ambientTrackForStage(stage: string): (typeof AMBIENT_TRACKS)[keyof typeof AMBIENT_TRACKS] {
  if (stage === "opening" || stage === "drift" || stage === "return") {
    return AMBIENT_TRACKS[stage];
  }

  return AMBIENT_TRACKS.scene;
}

function clampSceneIndex(index: number, total: number): number {
  return Math.max(0, Math.min(total - 1, index));
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

function preloadImage(src: string | undefined): void {
  if (!src || typeof window === "undefined") {
    return;
  }

  const image = new Image();
  image.decoding = "async";
  image.src = src;
}

function sceneNarrative(
  scene: ImmersiveScene,
  isFirstScene: boolean,
  isLastScene: boolean,
  preface: string | undefined,
  closing: string | undefined,
): string | undefined {
  if (isFirstScene && preface) {
    return preface;
  }
  if (isLastScene && closing) {
    return closing;
  }

  return scene.unit.curatorNote;
}

function openingWallText(text: string | undefined, title: string): string | undefined {
  if (!text) {
    return undefined;
  }

  const trimmed = text.trim();
  const normalizedTitle = title.trim();

  if (!normalizedTitle || !trimmed.startsWith(normalizedTitle)) {
    return trimmed;
  }

  return trimmed.slice(normalizedTitle.length).replace(/^[\s,.:;，。：；-]+/, "").trim() || trimmed;
}

function splitSentences(text: string | undefined): string[] {
  if (!text) {
    return [];
  }

  const matches = text.trim().match(/[^。！？.!?]+[。！？.!?]?/g);

  return matches?.map((sentence) => sentence.trim()).filter(Boolean) ?? [text.trim()].filter(Boolean);
}

function firstSentences(text: string | undefined, count: number): string | undefined {
  const sentences = splitSentences(text).slice(0, count);

  return sentences.length > 0 ? sentences.join("") : undefined;
}

function narrativeWhisper(text: string | undefined): { preview?: string; detail?: string } {
  const sentences = splitSentences(text);
  const preview = sentences[0];
  const detail = sentences.slice(1).join("");

  return {
    preview,
    detail: detail && detail !== preview ? detail : undefined,
  };
}

function stageWhisperLabel(stage: string): string {
  if (stage === "drift") {
    return "正在经过";
  }
  if (stage === "return") {
    return "慢慢收束";
  }

  return "开场";
}

function routeStageForIndex(index: number, total: number): "opening" | "drift" | "return" | "scene" {
  if (total <= 0) {
    return "scene";
  }
  if (total === 1 || index <= 0) {
    return "opening";
  }
  if (index >= total - 1) {
    return "return";
  }

  return "drift";
}

export function ImmersiveGalleryClient({
  scenes,
  initialIndex,
  galleryHref,
  preface,
  closing,
  sceneHrefs,
}: ImmersiveGalleryClientProps) {
  const [currentIndex, setCurrentIndex] = useState(() => clampSceneIndex(initialIndex, scenes.length));
  const [direction, setDirection] = useState<"next" | "previous">("next");
  const [isSwitching, setIsSwitching] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(false);
  const [ambientError, setAmbientError] = useState<string | undefined>();
  const pointerStartX = useRef<number | null>(null);
  const switchTimer = useRef<number | undefined>(undefined);
  const didRenderSceneRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeScene = scenes[currentIndex] ?? scenes[0];
  const routeStage = routeStageForIndex(currentIndex, scenes.length);
  const ambientTrack = ambientTrackForStage(routeStage);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const nextScene = scenes[currentIndex + 1];
    const previousScene = scenes[currentIndex - 1];

    preloadImage(nextScene?.unit.imageUrl);
    preloadImage(nextScene?.unit.backgroundSceneUrl);
    preloadImage(previousScene?.unit.imageUrl);
    preloadImage(previousScene?.unit.backgroundSceneUrl);
  }, [currentIndex, scenes]);

  useEffect(() => {
    if (!didRenderSceneRef.current) {
      didRenderSceneRef.current = true;
      return;
    }

    if (!window.matchMedia("(max-width: 860px)").matches) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.scrollTo({ left: 0, top: 0, behavior: "auto" });
    });
  }, [currentIndex]);

  useEffect(() => () => {
    if (switchTimer.current !== undefined) {
      window.clearTimeout(switchTimer.current);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = 0.34;

    if (!isAmbientPlaying) {
      return;
    }

    setAmbientError(undefined);
    audio.load();
    void audio.play().catch(() => {
      // Stage changes can briefly interrupt the previous audio request. Keep the
      // control in the user's chosen state and retry when the new source is ready.
    });
  }, [ambientTrack.src]);

  function moveTo(index: number) {
    if (!isHydrated) {
      return;
    }

    const targetIndex = clampSceneIndex(index, scenes.length);

    if (targetIndex === currentIndex) {
      return;
    }

    setDirection(targetIndex > currentIndex ? "next" : "previous");
    setCurrentIndex(targetIndex);
    setIsSwitching(true);

    const href = sceneHrefs[targetIndex];
    if (href && typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", href);
    }

    if (switchTimer.current !== undefined) {
      window.clearTimeout(switchTimer.current);
    }
    switchTimer.current = window.setTimeout(() => setIsSwitching(false), 360);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isImageExpanded) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveTo(currentIndex + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveTo(currentIndex - 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, isHydrated, isImageExpanded, scenes.length]);

  if (!activeScene) {
    return null;
  }

  const activeByline = [activeScene.unit.artistDisplayName, activeScene.unit.yearLabel].filter(Boolean).join(", ");
  const previousScene = scenes[currentIndex - 1];
  const nextScene = scenes[currentIndex + 1];
  const isFirstScene = currentIndex === 0;
  const isLastScene = currentIndex === scenes.length - 1;
  const narrativeText = sceneNarrative(activeScene, isFirstScene, isLastScene, preface, closing);
  const openingText = isFirstScene ? firstSentences(openingWallText(narrativeText, activeScene.unit.title), 2) : undefined;
  const middleNarrative = !isFirstScene && !isLastScene ? narrativeWhisper(narrativeText) : {};
  const activeStageTone = activeScene.unit.stageTone ?? activeScene.unit.growthStageRole ?? stageWhisperLabel(routeStage);
  const affectIntensity = activeScene.unit.emotionalIntensity ?? activeScene.unit.affectState?.arousal;
  const shellStyle: CSSProperties | undefined = activeScene.unit.backgroundSceneUrl
    ? {
      backgroundImage: `linear-gradient(90deg, rgba(16, 13, 11, 0.86), rgba(16, 13, 11, 0.46)), url(${activeScene.unit.backgroundSceneUrl})`,
    }
    : undefined;
  const shellClassName = [
    "immersive-shell",
    activeScene.transition.className,
    isFirstScene ? "is-opening-scene" : "",
    isLastScene ? "is-closing-scene" : "",
    isSwitching ? "is-scene-switching" : "",
    isSwitching && direction === "previous" ? "is-switching-back" : "",
    isSwitching && direction === "next" ? "is-switching-forward" : "",
  ].filter(Boolean).join(" ");

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    pointerStartX.current = event.clientX;
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    const startX = pointerStartX.current;
    pointerStartX.current = null;

    if (startX === null) {
      return;
    }

    const deltaX = event.clientX - startX;
    if (Math.abs(deltaX) < 48) {
      return;
    }

    moveTo(deltaX < 0 ? currentIndex + 1 : currentIndex - 1);
  }

  async function toggleAmbient() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (isAmbientPlaying) {
      audio.pause();
      setIsAmbientPlaying(false);
      return;
    }

    setAmbientError(undefined);
    audio.volume = 0.34;
    setIsAmbientPlaying(true);

    try {
      await audio.play();
    } catch {
      setAmbientError("声场暂时无法播放");
      setIsAmbientPlaying(false);
    }
  }

  return (
    <main
      className={shellClassName}
      data-affect-intensity={affectIntensity === undefined ? undefined : affectIntensity.toFixed(3)}
      data-growth-stage={activeScene.unit.growthStageId}
      data-growth-stage-role={activeScene.unit.growthStageRole}
      data-route-stage={routeStage}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      style={shellStyle}
    >
      <div className="immersive-atmosphere" aria-hidden="true">
        <span className="immersive-spotlight-source" />
        <span className="immersive-spotlight-cone" />
        <span className="immersive-wall-wash" />
        <span className="immersive-floor-wash" />
        <span className="immersive-noise" />
      </div>
      <header className="immersive-topbar">
        <a className="immersive-brand" href="/">ArtDuo</a>
        <div className="immersive-topbar-actions">
          <button
            aria-label={isAmbientPlaying ? `暂停背景音乐：${ambientTrack.label}` : `播放背景音乐：${ambientTrack.label}`}
            className="immersive-sound-toggle"
            disabled={!isHydrated}
            onClick={toggleAmbient}
            type="button"
          >
            {ambientError ? "重试声场" : isAmbientPlaying ? "暂停声场" : "打开声场"}
          </button>
          <a className="immersive-back-link" href={galleryHref}>换一句愿望</a>
        </div>
      </header>
      <audio
        data-testid="immersive-ambient-audio"
        loop
        onCanPlay={() => {
          const audio = audioRef.current;
          if (!isAmbientPlaying || !audio) {
            return;
          }

          void audio.play().catch(() => {
            // Keep the button stable during automatic track changes.
          });
        }}
        onError={() => {
          setAmbientError("声场暂时无法播放");
          setIsAmbientPlaying(false);
        }}
        preload="none"
        ref={audioRef}
        src={ambientTrack.src}
      />

      <section className="immersive-stage" aria-label="Immersive artwork">
        <ImageLightbox
          hasNext={Boolean(nextScene)}
          hasPrevious={Boolean(previousScene)}
          onExpandedChange={setIsImageExpanded}
          onNext={() => moveTo(currentIndex + 1)}
          onPrevious={() => moveTo(currentIndex - 1)}
          unit={activeScene.unit}
        />
        <aside className="immersive-caption">
          {isFirstScene && openingText ? (
            <p
              className="immersive-opening-wall"
              data-testid="immersive-preface"
            >
              {openingText}
            </p>
          ) : null}
          {!isFirstScene && !isLastScene ? (
            <p className="immersive-kicker">
              {activeStageTone}
            </p>
          ) : null}
          {isLastScene && narrativeText ? (
            <p
              className="immersive-narrative immersive-closing-wall"
              data-testid="immersive-closing"
            >
              {narrativeText}
            </p>
          ) : null}
          <h1
            className={[
              isFirstScene ? "is-opening-title" : "",
              isLastScene ? "is-closing-title" : "",
            ].filter(Boolean).join(" ")}
            data-testid="immersive-scene-title"
            aria-live="polite"
          >
            {activeScene.unit.title}
          </h1>
          {activeByline && !isFirstScene ? <p>{activeByline}</p> : null}
          {middleNarrative.preview ? (
            <p
              className="immersive-narrative"
              data-testid="immersive-note"
            >
              {middleNarrative.preview}
            </p>
          ) : null}
          {middleNarrative.detail ? (
            <details className="immersive-note-disclosure">
              <summary>展开解读</summary>
              <p>{middleNarrative.detail}</p>
            </details>
          ) : null}
          {scenes.length > 1 ? (
            <nav className="immersive-scene-nav" aria-label="Immersive scene navigation">
              {previousScene ? (
                <button type="button" disabled={!isHydrated} onClick={() => moveTo(currentIndex - 1)}>
                  上一幅
                </button>
              ) : null}
              {nextScene ? (
                <button type="button" disabled={!isHydrated} onClick={() => moveTo(currentIndex + 1)}>
                  下一幅
                </button>
              ) : null}
            </nav>
          ) : null}
        </aside>
      </section>

      <footer className="immersive-footer">
        <ProgressIndicator
          currentIndex={currentIndex}
          disabled={!isHydrated}
          itemHrefs={sceneHrefs}
          onSelect={moveTo}
          total={scenes.length}
        />
      </footer>
    </main>
  );
}
