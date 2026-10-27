"use client";

import { useEffect, useRef, useState } from "react";

export function nearGalleryControls(x: number, y: number, width: number, height: number): boolean {
  return x <= 48 || x >= width - 48 || y <= 72 || y >= height - 88;
}

/** Pointer stillness quiets the room; keyboard users and open readers retain controls. */
export function useIdleChrome(enabled: boolean, protectedState: boolean): boolean {
  const [visible, setVisible] = useState(true);
  const keyboard = useRef(false);
  useEffect(() => {
    setVisible(true);
    if (!enabled || protectedState) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      if (keyboard.current) return;
      timer = setTimeout(() => {
        const focused = document.activeElement;
        if (document.querySelector("dialog[open]") || focused instanceof HTMLElement && focused.matches(":focus-visible")) return;
        setVisible(false);
      }, 3_000);
    };
    const show = () => { setVisible(true); schedule(); };
    const pointerMove = (event: PointerEvent) => {
      // Moving over the artwork is a viewing gesture, not a request for chrome.
      const control = event.target instanceof Element ? event.target.closest("button, a, input, summary, [data-gallery-control]") : null;
      if (nearGalleryControls(event.clientX, event.clientY, innerWidth, innerHeight)
        || control && !control.matches(".immersive-lightbox-trigger")) show();
    };
    const pointerDown = () => { keyboard.current = false; show(); };
    const keyDown = () => { keyboard.current = true; clearTimeout(timer); setVisible(true); };
    const focusIn = () => { setVisible(true); schedule(); };
    const visibility = () => { if (document.visibilityState === "visible") show(); else clearTimeout(timer); };
    schedule();
    window.addEventListener("pointermove", pointerMove, { passive: true });
    window.addEventListener("pointerdown", pointerDown, { passive: true });
    window.addEventListener("keydown", keyDown);
    window.addEventListener("focusin", focusIn);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("focusin", focusIn);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled, protectedState]);
  return visible || !enabled || protectedState;
}
