import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { runtimeDirectories } from "../../api/src/runtime/environment";

export const PREVIEW_RECIPE = "inside-1600-webp84-v1";
interface PreviewMetadata { recipe: string; sourceFingerprint: string; sha256: string; bytes: number; width: number; height: number }
export interface ArtworkPreview extends PreviewMetadata { body: Buffer }
const digest = (body: Buffer) => `sha256:${createHash("sha256").update(body).digest("hex")}`;
const filename = (root: string, fingerprint: string) => {
  if (!/^sha256:[a-f0-9]{64}$/u.test(fingerprint)) throw new TypeError("Invalid artwork source fingerprint");
  return path.join(runtimeDirectories(root).state, "artwork-previews", `${fingerprint.slice(7)}-${PREVIEW_RECIPE}`);
};

/** A preview is derived only from the exact verified source, with no crop. */
export async function readArtworkPreview(root: string, sourceFingerprint: string): Promise<ArtworkPreview | undefined> {
  const base = filename(root, sourceFingerprint);
  try {
    const metadata: PreviewMetadata = JSON.parse(await readFile(`${base}.json`, "utf8"));
    if (metadata.recipe !== PREVIEW_RECIPE || metadata.sourceFingerprint !== sourceFingerprint || !Number.isInteger(metadata.bytes)
      || metadata.bytes < 1 || metadata.bytes > 8_000_000 || !Number.isInteger(metadata.width) || !Number.isInteger(metadata.height)
      || metadata.width < 1 || metadata.height < 1 || Math.max(metadata.width, metadata.height) > 1600) return undefined;
    const body = await readFile(`${base}.webp`);
    if (body.length !== metadata.bytes || digest(body) !== metadata.sha256) return undefined;
    return { ...metadata, body };
  } catch { return undefined; }
}

const inFlight = new Map<string, Promise<ArtworkPreview>>();
export async function prepareArtworkPreview(root: string, sourceFingerprint: string, loadOriginal: () => Promise<Buffer>): Promise<ArtworkPreview> {
  const saved = await readArtworkPreview(root, sourceFingerprint);
  if (saved) return saved;
  const base = filename(root, sourceFingerprint);
  const previous = inFlight.get(base);
  if (previous) return previous;
  const job = (async () => {
    const original = await loadOriginal();
    if (digest(original) !== sourceFingerprint) throw new TypeError("Preview source fingerprint mismatch");
    const { data: body, info } = await sharp(original, { limitInputPixels: 100_000_000, failOn: "error" }).rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 84, effort: 4 }).toBuffer({ resolveWithObject: true });
    const metadata: PreviewMetadata = { recipe: PREVIEW_RECIPE, sourceFingerprint, sha256: digest(body), bytes: body.length, width: info.width, height: info.height };
    await mkdir(path.dirname(base), { recursive: true, mode: 0o700 });
    const temp = `${base}.${randomUUID()}`;
    try {
      await writeFile(`${temp}.webp`, body, { flag: "wx", mode: 0o600 });
      await writeFile(`${temp}.json`, JSON.stringify(metadata), { flag: "wx", mode: 0o600 });
      await rename(`${temp}.webp`, `${base}.webp`);
      await rename(`${temp}.json`, `${base}.json`);
    } finally { await Promise.allSettled([unlink(`${temp}.webp`), unlink(`${temp}.json`)]); }
    return { ...metadata, body };
  })().finally(() => inFlight.delete(base));
  inFlight.set(base, job);
  return job;
}
