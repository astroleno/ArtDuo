import { glassDisplacementMap } from "./glass-optics";

const PRIMARY = ".primary-button,.experience-enter,.experience-primary,.experience-preface-actions>button:first-child,.experience-keepsake-actions>button:first-child";
const COMPACT = ".experience-entry-theme,.experience-settings-trigger";
const QUIET = [
  ".secondary-link", ".prompt-chip", ".experience-walk-controls button", ".experience-audio-button",
  ".experience-text-button", ".experience-closing-actions button", ".experience-keepsake-actions button",
  ".experience-keepsake-heading button", ".experience-keepsake-result button", ".experience-keepsake-error button",
  ".experience-share-fallback button", ".experience-reading-header button", ".experience-settings-panel>header button",
  ".experience-settings-motion", ".experience-preferences button", ".experience-pending button",
  ".experience-sculpture-status button", ".experience-media-fallback button", ".artwork-image-fallback button",
  ".immersive-back-link", ".immersive-sound-toggle", ".immersive-detail-navigation button",
  ".immersive-detail-close", ".immersive-detail-motion-toggle",
  ".immersive-scene-nav button", ".immersive-scene-nav a",
].join(",");
const SELECTOR = `${PRIMARY},${COMPACT},${QUIET}`;
const SVG_NS = "http://www.w3.org/2000/svg";
let serial = 0;

/** DOM text/actions stay native; only the pixels behind the surface refract. */
export function createGlassButtons(root: HTMLElement) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reducedTransparency = window.matchMedia("(prefers-reduced-transparency: reduce)");
  const contrast = window.matchMedia("(prefers-contrast: more)");
  // WebKit accepts the syntax but does not render SVG backdrop references.
  const refracts = /(?:Chrome|Chromium|Edg)\//.test(navigator.userAgent)
    && !/(?:CriOS|iPhone|iPad|iPod)/.test(navigator.userAgent)
    && CSS.supports("backdrop-filter", 'url("#artduo-glass")');
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
  svg.style.cssText = "position:fixed;pointer-events:none;overflow:hidden";
  const defs = document.createElementNS(SVG_NS, "defs");
  svg.append(defs); root.append(svg);
  const entries = new Map<HTMLElement, { filter?: SVGFilterElement; size: string }>();
  const maps = new Map<string, string>();
  let frame = 0;
  let pointFrame = 0;
  let pendingPoint: { element: HTMLElement; x: number; y: number } | undefined;
  let disposed = false;

  function prepare(element: HTMLElement) {
    const entry = entries.get(element);
    if (!entry) return;
    const width = element.offsetWidth, height = element.offsetHeight;
    if (!width || !height) return;
    const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 8;
    const size = `${width}:${height}:${radius}`;
    const solid = reducedTransparency.matches || contrast.matches;
    element.dataset.artduoGlassEngine = solid ? "solid" : refracts ? "refraction" : "frosted";
    if (solid || !refracts) { element.style.removeProperty("--glass-refraction"); return; }
    if (entry.size === size && entry.filter) {
      element.style.setProperty("--glass-refraction", `url("#${entry.filter.id}")`); return;
    }
    let mapUrl = maps.get(size);
    if (!mapUrl) {
      const map = glassDisplacementMap(width, height, radius);
      const canvas = document.createElement("canvas");
      canvas.width = map.width; canvas.height = map.height;
      const context = canvas.getContext("2d");
      if (!context) { element.dataset.artduoGlassEngine = "frosted"; return; }
      try {
        context.putImageData(new ImageData(map.data, map.width, map.height), 0, 0);
        mapUrl = canvas.toDataURL();
      } catch {
        element.dataset.artduoGlassEngine = "frosted";
        element.style.removeProperty("--glass-refraction");
        return;
      }
      if (maps.size >= 48) maps.delete(maps.keys().next().value!);
      maps.set(size, mapUrl);
    }
    const filter = document.createElementNS(SVG_NS, "filter");
    filter.id = `artduo-glass-${++serial}`;
    filter.setAttribute("filterUnits", "userSpaceOnUse"); filter.setAttribute("primitiveUnits", "userSpaceOnUse");
    filter.setAttribute("x", "-12"); filter.setAttribute("y", "-12");
    filter.setAttribute("width", String(width + 24)); filter.setAttribute("height", String(height + 24));
    filter.setAttribute("color-interpolation-filters", "sRGB");
    const map = document.createElementNS(SVG_NS, "feImage");
    map.setAttribute("href", mapUrl); map.setAttribute("x", "0"); map.setAttribute("y", "0");
    map.setAttribute("width", String(width)); map.setAttribute("height", String(height));
    map.setAttribute("preserveAspectRatio", "none"); map.setAttribute("result", "lens");
    const displacement = document.createElementNS(SVG_NS, "feDisplacementMap");
    displacement.setAttribute("in", "SourceGraphic"); displacement.setAttribute("in2", "lens");
    displacement.setAttribute("scale", element.dataset.artduoGlass === "compact" ? "13" : "19");
    displacement.setAttribute("xChannelSelector", "R"); displacement.setAttribute("yChannelSelector", "G");
    filter.append(map, displacement); defs.append(filter);
    element.style.setProperty("--glass-refraction", `url("#${filter.id}")`);
    entry.filter?.remove(); entry.filter = filter; entry.size = size;
  }
  const resize = new ResizeObserver(items => {
    for (const item of items) prepare(item.target as HTMLElement);
  });
  function release(element: HTMLElement) {
    entries.get(element)?.filter?.remove(); resize.unobserve(element); entries.delete(element);
    delete element.dataset.artduoGlass; delete element.dataset.artduoGlassEngine;
    for (const property of ["--glass-refraction", "--glass-pointer-x", "--glass-pointer-y"]) element.style.removeProperty(property);
  }
  function scan() {
    frame = 0;
    if (disposed) return;
    const elements = new Set(root.querySelectorAll<HTMLElement>(SELECTOR));
    for (const element of entries.keys()) if (!elements.has(element)) release(element);
    for (const element of elements) {
      if (entries.has(element)) continue;
      element.dataset.artduoGlass = element.matches(PRIMARY) ? "primary" : element.matches(COMPACT) ? "compact" : "quiet";
      entries.set(element, { size: "" }); resize.observe(element); prepare(element);
    }
  }
  function schedule() { if (!frame && !disposed) frame = requestAnimationFrame(scan); }
  const mutations = new MutationObserver(schedule);
  mutations.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden", "open"] });
  function pointer(event: PointerEvent) {
    if (reducedMotion.matches || event.pointerType === "touch") return;
    const element = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-artduo-glass]") : null;
    if (!element || element.matches(":disabled")) return;
    const rect = element.getBoundingClientRect();
    pendingPoint = { element, x: (event.clientX - rect.left) / rect.width * 100, y: (event.clientY - rect.top) / rect.height * 100 };
    if (!pointFrame) pointFrame = requestAnimationFrame(() => {
      pointFrame = 0;
      if (!pendingPoint?.element.isConnected) return;
      pendingPoint.element.style.setProperty("--glass-pointer-x", `${pendingPoint.x.toFixed(1)}%`);
      pendingPoint.element.style.setProperty("--glass-pointer-y", `${pendingPoint.y.toFixed(1)}%`);
    });
  }
  function accessibility() {
    cancelAnimationFrame(pointFrame); pointFrame = 0; pendingPoint = undefined;
    for (const element of entries.keys()) {
      prepare(element);
      element.style.removeProperty("--glass-pointer-x"); element.style.removeProperty("--glass-pointer-y");
    }
  }
  root.addEventListener("pointermove", pointer, { passive: true });
  for (const media of [reducedMotion, reducedTransparency, contrast]) media.addEventListener("change", accessibility);
  scan();
  return () => {
    disposed = true; cancelAnimationFrame(frame); cancelAnimationFrame(pointFrame);
    mutations.disconnect(); resize.disconnect(); root.removeEventListener("pointermove", pointer);
    for (const media of [reducedMotion, reducedTransparency, contrast]) media.removeEventListener("change", accessibility);
    for (const element of entries.keys()) release(element);
    svg.remove(); maps.clear();
  };
}
