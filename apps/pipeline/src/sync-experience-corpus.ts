import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { galleryArtworkDecision } from "@artduo/corpus";
import { measureImage } from "./existing-corpus-repair";
import type { ArtworkRecord } from "@artduo/contracts";

/** Update the existing prototype sample only; never pick additional artworks. */
async function main() {
  const root = process.cwd();
  const version = "2026-10-13-quality";
  const corpus: ArtworkRecord[] = JSON.parse(readFileSync(path.join(root, "data/curation/existing-quality", version, "corpus.json"), "utf8"));
  const currentFile = path.join(root, "experience/public/data/artworks.json");
  const current: ArtworkRecord[] = JSON.parse(readFileSync(currentFile, "utf8"));
  const next: ArtworkRecord[] = [];
  for (const record of current) {
    const repaired = corpus.find((candidate) => candidate.id === record.id);
    if (!repaired) throw new Error(`Prototype identity missing from existing corpus: ${record.id}`);
    if (galleryArtworkDecision({ id: record.id, ...repaired.metadata }).status !== "eligible") continue;
    const bytes = readFileSync(path.join(root, "experience/public", record.media.imageUrlPreview!));
    const measured = await measureImage(bytes);
    next.push({ ...record, version, metadata: repaired.metadata, retrieval: repaired.retrieval,
      presentation: repaired.presentation, media: { ...record.media,
        visualPresentation: { contentAspectRatio: measured.width / measured.height, cropStrategy: "preserve-paper", source: "decoded-prototype-preview" },
        sourceAssetFingerprint: `sha256:${createHash("sha256").update(bytes).digest("hex")}` } });
  }
  const narratives = readFileSync(path.join(root, "experience/src/data/narratives.ts"), "utf8");
  for (const [, id] of narratives.matchAll(/artworkId:\s*'([^']+)'/g)) {
    if (!next.some((record) => record.id === id)) throw new Error(`Prototype narrative still references an ineligible or missing artwork: ${id}`);
  }
  writeFileSync(currentFile, JSON.stringify(next, null, 1) + "\n");
  console.log(`Synced ${next.length}/${current.length} existing prototype artworks; no additions`);
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
