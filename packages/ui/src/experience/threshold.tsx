"use client";

import { appPath } from "@artduo/contracts";
import { useEffect, useRef, useState } from "react";
import { EntryQuestion } from "./entry-question";

export function Threshold({ initialValue = "", busy = false, onSubmit, formAction, formFields }: {
  initialValue?: string; busy?: boolean; onSubmit: (query: string) => void;
  formAction?: string; formFields?: Record<string, string>;
}) {
  const [value, setValue] = useState(initialValue);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [systemDark, setSystemDark] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => setSystemDark(media.matches);
    const restore = () => {
      try {
        const saved = localStorage.getItem("theme");
        setTheme(saved === "light" || saved === "dark" ? saved : "system");
      } catch { /* Theme selection still works for this visit. */ }
    };
    const syncStorage = (event: StorageEvent) => { if (event.key === "theme" || event.key === null) restore(); };
    syncSystem(); restore();
    media.addEventListener("change", syncSystem);
    window.addEventListener("storage", syncStorage);
    return () => { media.removeEventListener("change", syncSystem); window.removeEventListener("storage", syncStorage); };
  }, []);
  const dark = theme === "dark" || theme === "system" && systemDark;
  const themeAction = dark ? "切换浅色模式" : "切换深色模式";
  function toggleTheme() {
    const next = dark ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("theme", next); } catch { /* Storage is optional. */ }
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = (inputRef.current?.value ?? value).trim();
    if (!query) {
      setMessage("写下你想看的内容。");
      inputRef.current?.focus();
      return;
    }
    if (!busy) onSubmit(query);
  }
  return <main aria-labelledby="experience-entry-title" className="experience-threshold" data-entry-theme={theme}>
    <header className="experience-entry-header"><a aria-label="ArtDuo，经典入口" href={appPath("/?view=classic")}>ArtDuo</a></header>
    <button aria-label={themeAction} className="experience-entry-theme" disabled={busy} onClick={toggleTheme} title={themeAction} type="button">
      <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
        {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z" />}
      </svg>
    </button>
    <div className="experience-threshold-content">
      <EntryQuestion disabled={busy} paused={busy || editing} />
      <form action={appPath(formAction)} className="experience-intent-form" method="get" onSubmit={submit}>
        {Object.entries(formFields ?? {}).map(([name, fieldValue]) => <input key={name} name={name} type="hidden" value={fieldValue} />)}
        <div className="experience-intent-field">
          <label className="sr-only" htmlFor="experience-query">观看愿望</label>
          <input
            aria-label="写下一句此刻的心情或观看愿望"
            aria-describedby={message ? "experience-query-message" : undefined}
            aria-invalid={message ? true : undefined}
            autoComplete="off"
            id="experience-query"
            name="query"
            maxLength={160}
            onChange={(event) => { setValue(event.target.value); setMessage(""); }}
            onFocus={() => setEditing(true)}
            onBlur={() => setEditing(false)}
            placeholder="写下此刻心情…"
            disabled={busy}
            ref={inputRef}
            value={value}
          />
          <p className="experience-form-message" id="experience-query-message" role="alert">{message}</p>
        </div>
        <button className="experience-enter" disabled={busy} type="submit">{busy ? "准备中…" : "开始观展"}</button>
      </form>
    </div>
  </main>;
}
