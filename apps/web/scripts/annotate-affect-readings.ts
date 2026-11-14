// Offline, once per release: ask an image-capable model what each delivered
// image offers a viewer emotionally, including widely recognised themes such as
// mourning or labour that tags and pixels cannot express. Readings are bound to
// the exact source image fingerprint and resumable.
// Usage: tsx scripts/annotate-affect-readings.ts [--probe=<artworkId>] [--limit=N]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { readCurationChatConfig } from "../../api/src/services/curation/chat-provider";
import { AFFECT_READING_THEMES, AFFECT_READING_PROMPT_VERSION, affectReadingPath, parseAffectReading, type AffectReading } from "../lib/artwork-affect-reading";
import { isGalleryArtwork } from "../lib/artwork-eligibility";
import { readArtworkPreview } from "../lib/artwork-preview";
import { loadWebReleaseCatalog, type WebArtwork } from "../lib/release-catalog";

const rootDir = path.resolve(__dirname, "../../..");
const probe = process.argv.find((arg) => arg.startsWith("--probe="))?.slice(8);
const limit = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.slice(8) ?? Infinity);
const CONCURRENCY = 3;

function messages(artwork: WebArtwork, image: string) {
  return [
    { role: "system", content: "你是严谨的绘画观看记录员。只依据图像和给出的档案，不编造作者意图、典故或画中不存在的物体。只输出 JSON。" },
    { role: "user", content: [
      { type: "image_url", image_url: { url: image } },
      { type: "text", text: [
        `档案：${JSON.stringify({ title: artwork.title, artist: artwork.artistDisplayName, year: artwork.yearLabel, medium: artwork.medium, observed: artwork.visualEvidence?.observation?.slice(0, 300) })}`,
        "判断这幅作品实际能给普通观众带来的感受（不是作者意图），五个0–1数值：valence愉悦、arousal唤醒/动感、tension紧张/沉重、wonder惊奇/开阔、intimacy亲近/私密。",
        "reading：不超过50字中文，说清画面传达的情绪；若题材有公认的沉重或特殊含义（如哀悼、死亡、战争、劳作的艰辛、宗教受难），必须点明；严肃的官方肖像不等于忧郁。",
        `themes：从下列词中选0–4个确实成立的：${AFFECT_READING_THEMES.join(",")}。`,
        "输出 {\"valence\":number,\"arousal\":number,\"tension\":number,\"wonder\":number,\"intimacy\":number,\"reading\":string,\"themes\":string[]}",
      ].join("\n") },
    ] },
  ];
}

async function readOne(artwork: WebArtwork, fingerprint: string, config: { endpoint: string; model: string; apiKey: string }): Promise<AffectReading> {
  const preview = await readArtworkPreview(rootDir, fingerprint);
  if (!preview) throw new Error(`No verified preview for ${artwork.id}`);
  const jpeg = await sharp(preview.body).resize({ width: 768, height: 768, fit: "inside" }).jpeg({ quality: 82 }).toBuffer();
  const body = JSON.stringify({ model: config.model, temperature: 0.2, max_tokens: 400, response_format: { type: "json_object" }, thinking: { type: "disabled" },
    messages: messages(artwork, `data:image/jpeg;base64,${jpeg.toString("base64")}`) });
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(config.endpoint, { method: "POST", signal: AbortSignal.timeout(90_000),
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" }, body });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "");
      // Keep the strict ledger contract; an off-list theme word is dropped, not invented into the list.
      const themes = (Array.isArray(parsed.themes) ? parsed.themes : []).filter((theme: unknown) => (AFFECT_READING_THEMES as readonly unknown[]).includes(theme)).slice(0, 4);
      return parseAffectReading({ ...parsed, themes, artworkId: artwork.id, sourceFingerprint: fingerprint, model: config.model,
        promptVersion: AFFECT_READING_PROMPT_VERSION, reviewedAt: new Date().toISOString().slice(0, 10) });
    } catch (error) {
      if (attempt >= 6) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 4000));
    }
  }
}

async function main(): Promise<void> {
  const catalog = loadWebReleaseCatalog({ rootDir });
  const config = readCurationChatConfig(rootDir);
  if (!config) throw new Error("Model provider is not configured");
  const fingerprints = new Map(catalog.artworkRecords.flatMap((record) => record.media.sourceAssetFingerprint ? [[record.id, record.media.sourceAssetFingerprint] as const] : []));
  const file = affectReadingPath(rootDir, catalog.releaseVersion);
  mkdirSync(path.dirname(file), { recursive: true });
  const ledger: { schemaVersion: 1; releaseVersion: string; readings: AffectReading[] } = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8")) : { schemaVersion: 1, releaseVersion: catalog.releaseVersion, readings: [] };
  const done = new Set(ledger.readings.filter((item) => item.promptVersion === AFFECT_READING_PROMPT_VERSION && fingerprints.get(item.artworkId) === item.sourceFingerprint).map((item) => item.artworkId));
  const todo = catalog.artworks.filter((artwork) => isGalleryArtwork(artwork) && fingerprints.has(artwork.id) && (probe ? artwork.id === probe : !done.has(artwork.id))).slice(0, limit);
  console.log(`release ${catalog.releaseVersion}: ${done.size} done, ${todo.length} to read`);
  const failures: string[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < todo.length) {
      const artwork = todo[next++]!;
      try {
        const reading = await readOne(artwork, fingerprints.get(artwork.id)!, config);
        if (probe) { console.log(JSON.stringify(reading, null, 1)); continue; }
        ledger.readings = [...ledger.readings.filter((item) => item.artworkId !== artwork.id), reading];
        writeFileSync(file, JSON.stringify(ledger, null, 1) + "\n");
        if (ledger.readings.length % 25 === 0) console.log(`${ledger.readings.length} readings saved`);
      } catch (error) { failures.push(`${artwork.id}: ${String(error).slice(0, 160)}`); }
    }
  }));
  console.log(`finished: ${ledger.readings.length} readings, ${failures.length} failures`);
  for (const failure of failures) console.log(`  ${failure}`);
}

void main();
