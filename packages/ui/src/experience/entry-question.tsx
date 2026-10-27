"use client";

import { useEffect, useState, type CSSProperties } from "react";

// The short prompts and letter timing come from the original 2025 homepage.
const QUESTIONS = [
  "此刻你是何种颜色？", "你的心像圆还是碎片？", "今天属于冷色还是暖调？",
  "心绪更像山脊还是海浪？", "现在的你是线条还是涂抹？", "若是旋律，你轻快吗？",
  "今天，你的心声像什么？", "现在像耳语还是合唱？", "今天闪过的光点是什么？",
  "你更像晨光还是夜色？", "你的心情像风还是雨？", "此刻是一句怎样的诗？",
  "今天，你更像火还是水？", "若添一件作品，会是什么？", "此刻的你，会在想些什么？",
];

function nextQuestion(current: number): number {
  return (current + 1 + Math.floor(Math.random() * (QUESTIONS.length - 1))) % QUESTIONS.length;
}

export function EntryQuestion({ paused, disabled }: { paused: boolean; disabled: boolean }) {
  // A fixed first pair keeps the server and hydration render identical.
  const [question, setQuestion] = useState({ current: 0, next: 1, flipping: false });
  const [motion, setMotion] = useState({ reduced: true, visible: true });
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMotion({ reduced: media.matches, visible: !document.hidden });
    sync();
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      media.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  useEffect(() => {
    if (paused || motion.reduced || !motion.visible) return;
    const timer = window.setInterval(() => {
      setQuestion(current => current.flipping ? current : { ...current, flipping: true });
    }, 8_000);
    return () => window.clearInterval(timer);
  }, [paused, motion.reduced, motion.visible]);

  useEffect(() => {
    if (!question.flipping) return;
    const settle = () => setQuestion({ current: question.next, next: nextQuestion(question.next), flipping: false });
    if (motion.reduced || !motion.visible) { settle(); return; }
    const letters = Math.max(Array.from(QUESTIONS[question.current]!).length, Array.from(QUESTIONS[question.next]!).length);
    const timer = window.setTimeout(settle, 420 + Math.max(0, letters - 1) * 80 + 120);
    return () => window.clearTimeout(timer);
  }, [question, motion.reduced, motion.visible]);

  function advance() {
    if (disabled) return;
    setQuestion(current => {
      if (current.flipping) return current;
      return motion.reduced
        ? { current: current.next, next: nextQuestion(current.next), flipping: false }
        : { ...current, flipping: true };
    });
  }

  const currentText = QUESTIONS[question.current]!;
  const row = (text: string, className: string) => <span className={className}>
    {Array.from(text).map((letter, index) => <span key={index} style={{ "--flip-index": index } as CSSProperties}>{letter}</span>)}
  </span>;
  return <h1 aria-label={currentText} className="experience-entry-question" id="experience-entry-title">
    <button aria-label="换一句问句" className="experience-question-trigger" disabled={disabled} onClick={advance} title="换一句问句" type="button">
      <span aria-hidden="true" className={`experience-question-flip${question.flipping ? " is-flipping" : ""}`}>
        {row(currentText, "experience-question-current")}
        {row(QUESTIONS[question.next]!, "experience-question-next")}
      </span>
    </button>
  </h1>;
}
