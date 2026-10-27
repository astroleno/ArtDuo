import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export interface ArtworkAppearance { meanLightness: number; brightShare: number; darkShare: number; chroma: number; colorVariation: number }

/** Relative pixel measurements, not claims about subject matter or emotion. */
export function measureAppearancePixels(rgb: Uint8Array): ArtworkAppearance {
  if (!rgb.length || rgb.length % 3) throw new TypeError("Expected RGB pixels");
  let light = 0, bright = 0, dark = 0, chroma = 0;
  let redGreen = 0, yellowBlue = 0, redGreenSquared = 0, yellowBlueSquared = 0;
  for (let i = 0; i < rgb.length; i += 3) {
    const r = rgb[i]! / 255, g = rgb[i + 1]! / 255, b = rgb[i + 2]! / 255;
    const value = r * .2126 + g * .7152 + b * .0722;
    light += value; bright += Number(value >= .65); dark += Number(value <= .2);
    chroma += Math.max(r, g, b) - Math.min(r, g, b);
    const rg = r - g, yb = (r + g) / 2 - b;
    redGreen += rg; yellowBlue += yb; redGreenSquared += rg * rg; yellowBlueSquared += yb * yb;
  }
  const pixels = rgb.length / 3, round = (n: number) => Math.round(n / pixels * 10000) / 10000;
  // Constant beige paper can be bright and tinted without containing varied color.
  const variance = Math.max(0, redGreenSquared / pixels - (redGreen / pixels) ** 2)
    + Math.max(0, yellowBlueSquared / pixels - (yellowBlue / pixels) ** 2);
  const colorVariation = Math.round(Math.min(1, Math.sqrt(variance) / .22) * 10000) / 10000;
  return { meanLightness: round(light), brightShare: round(bright), darkShare: round(dark), chroma: round(chroma), colorVariation };
}

export function loadArtworkAppearance(releaseDir: string, fingerprints: ReadonlyMap<string, string>): { version?: string; byId: Map<string, ArtworkAppearance> } {
  const file = path.join(releaseDir, "appearance-v2.json");
  const byId = new Map<string, ArtworkAppearance>();
  if (!existsSync(file)) return { byId };
  try {
    if (statSync(file).size > 2_000_000) return { byId };
    const raw = readFileSync(file, "utf8"), ledger = JSON.parse(raw);
    if (ledger.recipe !== "central-80-rgb-v2" || !Array.isArray(ledger.records)) return { byId };
    for (const row of ledger.records) {
      if (!row || typeof row.artworkId !== "string" || !fingerprints.has(row.artworkId)) continue;
      if (fingerprints.get(row.artworkId) !== row.sourceFingerprint || byId.has(row.artworkId)) continue;
      const values = [row.meanLightness, row.brightShare, row.darkShare, row.chroma, row.colorVariation];
      if (!values.every(value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1)) continue;
      byId.set(row.artworkId, { meanLightness: row.meanLightness, brightShare: row.brightShare, darkShare: row.darkShare, chroma: row.chroma, colorVariation: row.colorVariation });
    }
    return { version: `appearance-v2-${createHash("sha256").update(raw).digest("hex").slice(0, 20)}`, byId };
  } catch { return { byId }; }
}
