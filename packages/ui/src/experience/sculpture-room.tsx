"use client";

import { appPath } from "@artduo/contracts";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AtmosphereLayer } from "./atmosphere-layer";
import { useInteractionPreferences } from "./interaction-preferences";
import { Plaque } from "./plaque";
import { RoomBackdrop } from "./room-backdrop";
import { RoomLightingLayer } from "./room-lighting-layer";
import { roomLightProfile } from "./room-lighting";
import { useRoomMotion } from "./room-motion";
import { SculptureCanvas } from "./sculpture-canvas";
import type { SculptureNarrator, SculptureQuality, SculptureRoomScene, SculptureWork } from "./sculpture-types";
import { useIdleChrome } from "./use-idle-chrome";

export function SculptureRoom({ works, scenes, initialModel, initialScene, initialQuality, encounter, narrate, query = "在雕塑侧厅慢慢看" }: {
  works: SculptureWork[];
  scenes: SculptureRoomScene[];
  initialModel: string;
  initialScene: string;
  initialQuality: SculptureQuality;
  encounter?: { onContinue: () => void; onUnavailable: () => void; onReadingChange: (open: boolean) => void; audioControl?: ReactNode };
  narrate?: SculptureNarrator;
  query?: string;
}) {
  const [index, setIndex] = useState(Math.max(0, works.findIndex(work => work.id === initialModel)));
  const [sceneId, setSceneId] = useState(initialScene);
  const [quality, setQuality] = useState(initialQuality);
  const [readerOpen, setReaderOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [renderState, setRenderState] = useState<"loading" | "ready" | "fallback">("loading");
  const [decoded, setDecoded] = useState<{ url: string; currentSrc: string }>();
  const [backgroundFailed, setBackgroundFailed] = useState<string>();
  const [posters, setPosters] = useState<Record<string, string>>({});
  const [note, setNote] = useState<{ id: string; text: string; source: "grounded" | "fallback" }>();
  const settings = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const work = works[index];
  const room = scenes.find(scene => scene.id === sceneId) ?? scenes[0];
  const { mouseMotion, setMouseMotion } = useInteractionPreferences();
  const paused = readerOpen || settingsOpen;
  const motion = useRoomMotion(reducedMotion, paused, mouseMotion);
  const chrome = useIdleChrome(!reducedMotion, paused);
  const profile = useMemo(() => roomLightProfile(room.id, { depthUrl: room.depthUrl, normalUrl: room.normalUrl }), [room]);
  const callbacks = useRef(encounter); callbacks.current = encounter;
  useEffect(() => { callbacks.current?.onReadingChange(readerOpen || settingsOpen); }, [readerOpen, settingsOpen]);
  useEffect(() => () => callbacks.current?.onReadingChange(false), []);
  useEffect(() => {
    if (!narrate) return;
    const abort = new AbortController();
    void narrate(work.id, query, abort.signal).then(value => { if (!abort.signal.aborted) setNote({ id: work.id, ...value }); }).catch(() => undefined);
    return () => abort.abort();
  }, [work.id, query, narrate]);
  useEffect(() => {
    if (!encounter) return;
    const key = (event: KeyboardEvent) => {
      if (paused || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))) return;
      if (event.key === "ArrowRight") { event.preventDefault(); callbacks.current?.onContinue(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [Boolean(encounter), paused]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync(); media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const dialog = settings.current;
    if (!dialog) return;
    if (settingsOpen && !dialog.open) dialog.showModal();
    else if (!settingsOpen && dialog.open) { dialog.close(); trigger.current?.focus({ preventScroll: true }); }
  }, [settingsOpen]);
  useEffect(() => {
    if (encounter) return;
    const url = new URL(window.location.href);
    url.searchParams.set("model", work.id);
    url.searchParams.set("room", room.id);
    url.searchParams.set("quality", quality);
    window.history.replaceState(window.history.state, "", url);
  }, [work.id, room.id, quality, Boolean(encounter)]);
  const go = (next: number) => { setReaderOpen(false); setIndex((next + works.length) % works.length); };
  const reading = { ...work.reading, ...(note?.id === work.id ? { curatorNote: { text: note.text, source: note.source } } : {}), media: { previewUrl: posters[work.id] ?? work.posterUrl, fullUrl: work.posterUrl, backgroundUrl: room.imageUrl } };
  const readyBackground = decoded?.url === room.imageUrl ? decoded.currentSrc : undefined;
  const Root = encounter ? "div" : "main";

  return <Root className="artduo-experience experience-act-walk experience-sculpture-exhibition" data-chrome-visible={chrome} data-sculpture-encounter={encounter ? "active" : undefined}>
    <div className="experience-walk">
      <section className={`experience-room experience-sculpture-room ${reducedMotion ? "is-reduced-motion" : ""}`} aria-label={encounter ? "雕塑侧厅" : "ArtDuo 雕塑试展"}
        data-scene-id={room.id} data-scene-state={backgroundFailed === room.imageUrl ? "fallback" : readyBackground ? "ready" : "loading"}
        data-model={work.id} data-quality={quality} data-sculpture-state={renderState}
        data-room-motion-state={motion.state} data-mouse-motion={mouseMotion && !reducedMotion ? "on" : "off"} data-wall-tone={room.tone}
        style={{ "--art-center-x": "50vw", "--art-center-y": "48vh", "--art-width": "42vw", "--art-height": "65vh", "--room-light-x": motion.input.x, "--room-light-y": motion.input.y } as CSSProperties}
        onPointerMove={event => {
          if (event.pointerType !== "mouse" || !mouseMotion || reducedMotion || paused) return;
          const rect = event.currentTarget.getBoundingClientRect();
          motion.setPointer({ x: (event.clientX - rect.left) / rect.width * 2 - 1, y: (event.clientY - rect.top) / rect.height * 2 - 1 });
        }} onPointerLeave={() => motion.setPointer({ x: 0, y: 0 }, true)}>
        <div aria-hidden="true" className="experience-room-backdrop experience-room-fallback" />
        <RoomBackdrop url={room.imageUrl} smallUrl={room.smallImageUrl} reducedMotion={reducedMotion} referrerPolicy="no-referrer"
          onReady={image => setDecoded({ url: room.imageUrl, currentSrc: image.currentSrc })} onError={() => setBackgroundFailed(room.imageUrl)} />
        <RoomLightingLayer imageUrl={readyBackground} profile={profile} input={motion.input} imageAlignment="bottom" sculptureInteraction active={renderState === "ready" && mouseMotion && !reducedMotion && !paused} />
        <div className="experience-room-shade" aria-hidden="true" />
        <AtmosphereLayer tone={room.tone} reducedMotion={reducedMotion} />
        <header className="experience-room-header">
          <a className="experience-mark" href={appPath(encounter ? `/?${new URLSearchParams({ view: "experience", query }).toString()}` : "/?view=experience")} aria-label="ArtDuo，返回选展">ArtDuo</a>
          <div className="experience-room-meta"><span>{encounter ? "片刻停留" : room.label}</span>{encounter ? encounter.audioControl : <span>{String(index + 1).padStart(2, "0")} / {String(works.length).padStart(2, "0")}</span>}</div>
        </header>
        <SculptureCanvas work={work} url={quality === "reference" ? work.referenceUrl : work.compactUrl} room={room} backgroundSource={readyBackground}
          input={motion.input} paused={paused} followEnabled={mouseMotion && !reducedMotion} onState={state => { setRenderState(state); if (state === "fallback") callbacks.current?.onUnavailable(); }}
          onPoster={poster => setPosters(previous => ({ ...previous, [work.id]: poster }))} />
        <div className="experience-plaque-position experience-sculpture-plaque" data-placement="right">
          <Plaque key={work.id} artworkKind="sculpture" referrerPolicy="no-referrer" unit={reading} expanded={readerOpen} onToggle={() => setReaderOpen(value => !value)} />
        </div>
        <nav className="experience-walk-controls" aria-label="作品导航">
          <button type="button" aria-label={encounter ? "略过雕塑，继续观展" : "上一件雕塑"} onClick={() => encounter ? encounter.onContinue() : go(index - 1)}>{encounter ? "略过" : <>← <span>上一件</span></>}</button>
          <button className="experience-next" type="button" aria-label={encounter ? "继续观展" : "下一件雕塑"} onClick={() => encounter ? encounter.onContinue() : go(index + 1)}>{encounter ? "继续观展" : "下一件"} <span aria-hidden="true">→</span></button>
        </nav>
        {motion.message && !settingsOpen ? <p role="status" className="experience-motion-status">{motion.message}</p> : null}
      </section>
      <button ref={trigger} className="experience-settings-trigger" type="button" aria-label="观展设置" aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}><span aria-hidden="true">•••</span></button>
      <dialog ref={settings} className="experience-settings-panel" aria-label="观展设置" onCancel={event => { event.preventDefault(); setSettingsOpen(false); }}
        onClick={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) setSettingsOpen(false);
        }}>
        <header><h2>观展设置</h2><button autoFocus type="button" aria-label="关闭观展设置" onClick={() => setSettingsOpen(false)}>×</button></header>
        <label className="experience-motion-choice"><span>画面轻动<small>{reducedMotion ? "已遵循系统的减少动态效果设置" : "轻移画面，感受前后层次"}</small></span>
          <input type="checkbox" checked={mouseMotion && !reducedMotion} disabled={reducedMotion} onChange={event => setMouseMotion(event.target.checked)} /></label>
        {motion.available ? <button type="button" className="experience-settings-motion" aria-label={!mouseMotion ? "先开启画面轻动，再开启手机感应" : motion.enabled ? "关闭手机感应" : "开启手机感应"} aria-pressed={motion.enabled} disabled={!mouseMotion || motion.state === "requesting"}
          onClick={() => { void motion.toggle(); setSettingsOpen(false); }}>{!mouseMotion ? "先开启画面轻动" : motion.state === "requesting" ? "正在开启感应" : motion.enabled ? "关闭手机感应" : "开启手机感应"}</button> : null}
        {motion.message ? <p role="status">{motion.message}</p> : null}
        {!encounter ? <><label className="experience-sculpture-select">展厅<select aria-label="展厅" value={room.id} onChange={event => setSceneId(event.target.value)}>{scenes.map(scene => <option key={scene.id} value={scene.id}>{scene.label}</option>)}</select></label>
        <label className="experience-sculpture-select">雕塑细节<select aria-label="雕塑细节" value={quality} onChange={event => setQuality(event.target.value as SculptureQuality)}><option value="compact">轻巧载入</option><option value="reference">更多细节</option></select></label></> : null}
        {!encounter ? <p className="experience-sculpture-preview-note">雕塑试展 · {works.length} 件作品</p> : null}
      </dialog>
    </div>
  </Root>;
}
