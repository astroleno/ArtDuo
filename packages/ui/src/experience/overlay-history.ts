"use client";

type HistoryState = Record<string, unknown>;
interface Layer { id: string; base: string; href: string; dismiss: (sameView: boolean) => void; closed: boolean }
export interface OverlayHistoryHost {
  history: Pick<History, "state" | "pushState" | "replaceState" | "back">;
  location: { href: string };
  addEventListener(type: "popstate", listener: (event: PopStateEvent) => void, capture: boolean): void;
}
const LAYER_KEY = "__artduoLayer";
const BASE_KEY = "__artduoView";
let sequence = 0;
const uniqueId = () => `${Date.now().toString(36)}-${++sequence}`;
const objectState = (state: unknown): HistoryState => state && typeof state === "object" ? { ...state } : {};
function externalState(state: unknown): HistoryState {
  const next = objectState(state);
  // Next reattaches its current router fields to external history updates.
  // Copying these flags would bypass that bridge and leave its canonical URL
  // behind the work displayed in the gallery.
  delete next.__NA;
  delete next._N;
  return next;
}
const layerState = (state: unknown): { id: string; base: string } | undefined => {
  const value = objectState(state)[LAYER_KEY] as Partial<Layer> | undefined;
  return value && typeof value.id === "string" && typeof value.base === "string" ? { id: value.id, base: value.base } : undefined;
};

/** One temporary entry, separate from the exhibition's replace-only positions. */
export function createOverlayHistory(host: OverlayHistoryHost) {
  let active: Layer | undefined;
  let returning: Layer | undefined;
  let queued: Layer | undefined;
  const settledLocations = new Map<string, string>();
  const remember = (base: string, href: string) => {
    settledLocations.set(base, href);
    if (settledLocations.size > 128) settledLocations.delete(settledLocations.keys().next().value!);
  };
  const plainState = (state: unknown) => {
    const next = objectState(state);
    delete next[LAYER_KEY];
    return next;
  };
  function begin(layer: Layer) {
    layer.base = uniqueId();
    layer.href = host.location.href;
    remember(layer.base, layer.href);
    const base = { ...plainState(host.history.state), [BASE_KEY]: layer.base };
    host.history.replaceState(base, "", layer.href);
    host.history.pushState({ ...base, [LAYER_KEY]: { id: layer.id, base: layer.base } }, "", layer.href);
    active = layer;
  }
  function close(layer: Layer, notify: boolean) {
    if (layer.closed) return;
    layer.closed = true;
    if (queued === layer) queued = undefined;
    if (active === layer) {
      active = undefined;
      if (layerState(host.history.state)?.id === layer.id) {
        returning = layer;
        host.history.back();
      }
    }
    if (notify) layer.dismiss(true);
  }
  host.addEventListener("popstate", event => {
    const marker = layerState(event.state);
    const base = objectState(event.state)[BASE_KEY];
    const closing = returning ?? active;
    if (closing && marker?.id !== closing.id) {
      // A layer may have changed works. Back returns to that work, not the
      // URL captured when the layer was first opened.
      if (base === closing.base) {
        remember(closing.base, closing.href);
        host.history.replaceState(externalState(plainState(host.history.state)), "", closing.href);
        event.stopImmediatePropagation();
      }
      returning = undefined;
      if (active === closing) {
        active = undefined;
        closing.closed = true;
        closing.dismiss(base === closing.base);
      }
      if (queued) { const next = queued; queued = undefined; if (!next.closed) begin(next); }
    } else if (marker && marker.id !== active?.id) {
      // Forward must not resurrect a layer already closed, including records
      // left by a reload or navigation to the separate artwork page.
      event.stopImmediatePropagation();
      returning = { ...marker, href: settledLocations.get(marker.base) ?? host.location.href, dismiss: () => {}, closed: true };
      host.history.back();
    }
  }, true);
  const stale = layerState(host.history.state);
  if (stale) {
    returning = { ...stale, href: host.location.href, dismiss: () => {}, closed: true };
    host.history.back();
  }
  return {
    open(dismiss: (sameView: boolean) => void) {
      const layer: Layer = { id: uniqueId(), base: "", href: host.location.href, dismiss, closed: false };
      if (active) close(active, true);
      if (returning) { if (queued) close(queued, true); queued = layer; }
      else begin(layer);
      return { close: () => close(layer, true), dispose: () => close(layer, false) };
    },
    replaceLocation(href: string) {
      if (active) active.href = href;
      if (returning) returning.href = href;
      const base = objectState(host.history.state)[BASE_KEY];
      if (typeof base === "string") remember(base, href);
      host.history.replaceState(externalState(host.history.state), "", href);
    },
  };
}

// The app route and lazy UI boundaries can have separate module instances.
// Both must publish positions into the controller that owns the open layer.
const runtime = globalThis as typeof globalThis & { __artduoOverlayHistory?: ReturnType<typeof createOverlayHistory> };
export function overlayHistory() { return runtime.__artduoOverlayHistory ??= createOverlayHistory(window); }
export function replaceExperienceHistory(href: string) { overlayHistory().replaceLocation(href); }
