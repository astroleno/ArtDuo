"use client";

import { useRef, useState } from "react";

const PROMPTS = ["安静的月光", "山水与留白", "明亮的颜色"];

export function Threshold({ initialValue = "", busy = false, onSubmit }: { initialValue?: string; busy?: boolean; onSubmit: (query: string) => void }) {
  const [value, setValue] = useState(initialValue);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim();
    if (!query) {
      setMessage("写下想看的内容，或选一个下面的题目。");
      inputRef.current?.focus();
      return;
    }
    if (!busy) onSubmit(query);
  }
  return <main className="experience-threshold">
    <div aria-hidden="true" className="experience-threshold-light" />
    <header className="experience-entry-header"><span>ArtDuo</span><span>心境画廊</span></header>
    <div className="experience-threshold-content">
      <p className="experience-eyebrow">从一件作品开始</p>
      <h1>想看些什么？</h1>
      <p className="experience-intro">一种心情，一处风景，或一件作品。</p>
      <form className="experience-intent-form" onSubmit={submit}>
        <label htmlFor="experience-query">观看愿望</label>
        <input
          aria-label="写下一句此刻的心情或观看愿望"
          autoComplete="off"
          id="experience-query"
          maxLength={160}
          onChange={(event) => { setValue(event.target.value); setMessage(""); }}
          placeholder="例如：想看一片安静的水面"
          disabled={busy}
          ref={inputRef}
          value={value}
        />
        <button className="experience-enter" disabled={busy} type="submit">{busy ? "正在准备作品…" : "开始观展"}<span aria-hidden="true">→</span></button>
        {message ? <p className="experience-form-message" role="alert">{message}</p> : null}
      </form>
      <div aria-label="观看愿望示例" className="experience-prompts">
        <span>也可以看</span>
        {PROMPTS.map((prompt) => <button disabled={busy} key={prompt} onClick={() => { setValue(prompt); onSubmit(prompt); }} type="button">{prompt}<span aria-hidden="true">↗</span></button>)}
      </div>
    </div>
    <footer className="experience-entry-footer"><span>随时停留，随时离开。</span><a href="/?view=classic">经典入口</a></footer>
  </main>;
}
