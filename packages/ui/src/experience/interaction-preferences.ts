"use client";

import { useCallback, useEffect, useState } from "react";

export const INTERACTION_PREFERENCES_KEY = "artduo.interaction.v1";
const PREFERENCES_CHANGED = "artduo:interaction-preferences";
export function readMouseMotionPreference(raw: string | null): boolean {
  if (!raw || raw.length > 512) return true;
  try {
    const value = JSON.parse(raw);
    return value?.version === 1 && typeof value.mouseMotion === "boolean" ? value.mouseMotion : true;
  } catch { return true; }
}

export function useInteractionPreferences() {
  const [mouseMotion, setValue] = useState(true);
  useEffect(() => {
    const restore = () => {
      try { setValue(readMouseMotionPreference(localStorage.getItem(INTERACTION_PREFERENCES_KEY))); } catch { /* Storage is optional. */ }
    };
    restore();
    const sync = (event: StorageEvent) => { if (event.key === INTERACTION_PREFERENCES_KEY) restore(); };
    const local = (event: Event) => { const enabled = (event as CustomEvent<{ mouseMotion?: unknown }>).detail?.mouseMotion;
      if (typeof enabled === "boolean") setValue(enabled); };
    window.addEventListener("storage", sync);
    window.addEventListener(PREFERENCES_CHANGED, local);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener(PREFERENCES_CHANGED, local); };
  }, []);
  const setMouseMotion = useCallback((enabled: boolean) => {
    setValue(enabled);
    try { localStorage.setItem(INTERACTION_PREFERENCES_KEY, JSON.stringify({ version: 1, mouseMotion: enabled })); } catch { /* Apply for this visit even without storage. */ }
    window.dispatchEvent(new CustomEvent(PREFERENCES_CHANGED, { detail: { mouseMotion: enabled } }));
  }, []);
  return { mouseMotion, setMouseMotion };
}
