// Step 2 of the 2026-11-16 gap fill: read a small preview of every discovered
// candidate with an image-capable model. One call drafts the affect reading and
// the visual facts that the assistant later confirms by eye. Resumable.
// Usage: tsx apps/web/scripts/open-collection/screen.ts [--limit N]
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { VISUAL_SUBJECTS, SPATIAL_FRAMINGS } from "@artduo/contracts";
import { readCurationChatConfig } from "../../../api/src/services/curation/chat-provider";
import { AFFECT_READING_THEMES } from "../../lib/artwork-affect-reading";
import type { Candidate } from "./discovery";

const ROOT = path.resolve(__dirname, "../../../..");
const DIR = path.join(ROOT, "data/sources/open-collections/2026-11-16");
const OUT = path.join(DIR, "screening.jsonl");
const limit = Number(process.argv[process.argv.indexOf("--limit") + 1] ?? Infinity) || Infinity;
const CONCURRENCY = 3;
const USER_AGENT = "ArtDuo-curation/1.0 (open collection research)";
export const PRESENTATIONS = ["flat-artwork", "framed-photo", "object-photo", "detail", "multi-panel", "verso-or-damaged"] as const;
export const MOOD_TAGS = ["quiet", "restful", "serenity", "calm", "contemplation", "melancholy", "hope", "joy", "bright", "lively", "playful", "warm",
  "wonder", "awe", "mystery", "dramatic", "tense", "solemn", "intimate", "spacious", "nocturnal", "gentle", "graceful"] as const;

export interface Screening {
  candidateId: string; previewSha256: string; previewWidth: number; previewHeight: number; model: string; screenedAt: string;
  presentation: (typeof PRESENTATIONS)[number]; valence: number; arousal: number; tension: number; wonder: number; intimacy: number;
  reading: string; themes: string[]; moodTags: string[]; facts: Record<string, "present" | "absent" | "unknown">;
  spatialFraming: (typeof SPATIAL_FRAMINGS)[number]; observation: string;
}

const unit = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : NaN;

function parse(raw: any, base: Pick<Screening, "candidateId" | "previewSha256" | "previewWidth" | "previewHeight" | "model" | "screenedAt">): Screening {
  const values = ["valence", "arousal", "tension", "wonder", "intimacy"].map((key) => unit(raw[key]));
  if (values.some(Number.isNaN)) throw new TypeError("Affect values missing");
  if (!(PRESENTATIONS as readonly string[]).includes(raw.presentation)) throw new TypeError("Unknown presentation");
  if (!(SPATIAL_FRAMINGS as readonly string[]).includes(raw.spatialFraming)) throw new TypeError("Unknown framing");
  const facts = Object.fromEntries(VISUAL_SUBJECTS.map((subject) => {
    const value = raw.facts?.[subject];
    return [subject, value === "present" || value === "absent" ? value : "unknown"];
  })) as Screening["facts"];
  const text = (value: unknown, max: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : "";
  if (!text(raw.observation, 120) || !text(raw.reading, 80)) throw new TypeError("Observation missing");
  return { ...base, presentation: raw.presentation, valence: values[0]!, arousal: values[1]!, tension: values[2]!, wonder: values[3]!, intimacy: values[4]!,
    reading: text(raw.reading, 80), observation: text(raw.observation, 120), facts, spatialFraming: raw.spatialFraming,
    themes: (Array.isArray(raw.themes) ? raw.themes : []).filter((t: unknown) => (AFFECT_READING_THEMES as readonly unknown[]).includes(t)).slice(0, 4),
    moodTags: (Array.isArray(raw.moodTags) ? raw.moodTags : []).filter((t: unknown) => (MOOD_TAGS as readonly unknown[]).includes(t)).slice(0, 3) };
}

function messages(candidate: Candidate, image: string) {
  return [
    { role: "system", content: "你是严谨的绘画观看记录员。只依据图像和档案，不编造画中不存在的物体、作者意图或典故。看不清就写unknown。只输出 JSON。" },
    { role: "user", content: [
      { type: "image_url", image_url: { url: image } },
      { type: "text", text: [
        `档案：${JSON.stringify({ title: candidate.title, artist: candidate.artist, date: candidate.date, medium: candidate.medium })}`,
        `presentation：这张图是否为一件完整的平面作品（${PRESENTATIONS.join("/")}）。连画框一起拍、只拍局部、立体物件照片、多联拼图、背面或严重破损都不算flat-artwork。`,
        "五个0–1数值：作品能给普通观众的感受 valence愉悦、arousal唤醒/动感、tension紧张/沉重、wonder惊奇/开阔、intimacy亲近/私密。",
        "reading：≤50字中文，画面传达的情绪；题材若有公认沉重含义必须点明。",
        `themes：0–4个，限 ${AFFECT_READING_THEMES.join(",")}。moodTags：1–3个，限 ${MOOD_TAGS.join(",")}。`,
        `facts：对 ${VISUAL_SUBJECTS.join(",")} 逐项给 present/absent/unknown。people 指画中任何人物，即使很小；看不清是否有人就写unknown。`,
        `spatialFraming：${SPATIAL_FRAMINGS.join("/")}（open=开阔远景，framed=局部框景，enclosed=围合近景或室内）。`,
        "observation：≤60字中文，客观描述可见画面的主要内容、颜色和构图。",
        "输出 {\"presentation\":string,\"valence\":number,\"arousal\":number,\"tension\":number,\"wonder\":number,\"intimacy\":number,\"reading\":string,\"themes\":string[],\"moodTags\":string[],\"facts\":object,\"spatialFraming\":string,\"observation\":string}",
      ].join("\n") },
    ] },
  ];
}

async function screen(candidate: Candidate, config: { endpoint: string; model: string; apiKey: string }): Promise<Screening> {
  const response = await fetch(candidate.previewUrl, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`preview HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const { width = 0, height = 0 } = await sharp(bytes).metadata();
  const jpeg = await sharp(bytes).resize({ width: 768, height: 768, fit: "inside" }).jpeg({ quality: 82 }).toBuffer();
  const base = { candidateId: candidate.candidateId, previewSha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`, previewWidth: width, previewHeight: height,
    model: config.model, screenedAt: new Date().toISOString().slice(0, 10) };
  const body = JSON.stringify({ model: config.model, temperature: 0.2, max_tokens: 700, response_format: { type: "json_object" }, thinking: { type: "disabled" },
    messages: messages(candidate, `data:image/jpeg;base64,${jpeg.toString("base64")}`) });
  for (let attempt = 1; ; attempt++) {
    try {
      const reply = await fetch(config.endpoint, { method: "POST", signal: AbortSignal.timeout(90_000), headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" }, body });
      if (!reply.ok) throw new Error(`model HTTP ${reply.status}`);
      const payload = await reply.json() as { choices?: Array<{ message?: { content?: string } }> };
      return parse(JSON.parse(payload.choices?.[0]?.message?.content ?? ""), base);
    } catch (error) {
      if (attempt >= 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 4000));
    }
  }
}

async function main(): Promise<void> {
  const config = readCurationChatConfig(ROOT);
  if (!config) throw new Error("Model provider is not configured");
  const candidates = readFileSync(path.join(DIR, "candidates.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as Candidate);
  const done = new Set(existsSync(OUT) ? readFileSync(OUT, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line).candidateId) : []);
  const todo = candidates.filter((candidate) => !done.has(candidate.candidateId)).slice(0, limit);
  console.log(`${candidates.length} candidates, ${done.size} screened, ${todo.length} to screen`);
  let next = 0, saved = 0;
  const failures: string[] = [];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < todo.length) {
      const candidate = todo[next++]!;
      try {
        appendFileSync(OUT, JSON.stringify(await screen(candidate, config)) + "\n");
        if (++saved % 25 === 0) console.log(`${saved} screened`);
      } catch (error) { failures.push(`${candidate.candidateId}: ${String(error).slice(0, 140)}`); }
    }
  }));
  appendFileSync(path.join(DIR, "screening-failures.log"), failures.map((line) => `${new Date().toISOString()} ${line}`).join("\n") + (failures.length ? "\n" : ""));
  console.log(`finished: ${saved} screened, ${failures.length} failures`);
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
