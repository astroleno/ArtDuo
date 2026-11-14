import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// A model's reading of what the delivered image offers a viewer. It informs
// stage fit only; it is never shown as museum fact or artist intent.
export const AFFECT_READING_PROMPT_VERSION = "affect-reading-v1";
export const AFFECT_READING_THEMES = [
  "celebration", "play", "dance", "labor", "rest", "solitude", "intimacy", "family", "devotion", "mourning", "death", "war",
  "threat", "storm", "ruin", "calm-nature", "open-vista", "enclosure", "night", "dawn", "formal-portrait", "humor",
] as const;
export type AffectReadingTheme = (typeof AFFECT_READING_THEMES)[number];
export interface AffectReading {
  artworkId: string; sourceFingerprint: string; model: string; promptVersion: string; reviewedAt: string;
  valence: number; arousal: number; tension: number; wonder: number; intimacy: number;
  reading: string; themes: AffectReadingTheme[];
}

const unit = (value: unknown, name: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new TypeError(`${name} must be within 0–1`);
  return Number(value.toFixed(3));
};
const text = (value: unknown, name: string, max: number): string => {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new TypeError(`${name} must be 1–${max} characters`);
  return value.trim();
};

export function parseAffectReading(value: unknown): AffectReading {
  const row = value as Record<string, unknown>;
  if (!row || typeof row !== "object") throw new TypeError("Reading must be an object");
  if (typeof row.sourceFingerprint !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(row.sourceFingerprint)) throw new TypeError("Reading must bind a source fingerprint");
  const themes = Array.isArray(row.themes) ? row.themes : [];
  if (themes.length > 4 || themes.some((theme) => !(AFFECT_READING_THEMES as readonly unknown[]).includes(theme))) throw new TypeError("Unknown or too many themes");
  return {
    artworkId: text(row.artworkId, "artworkId", 120), sourceFingerprint: row.sourceFingerprint, model: text(row.model, "model", 80),
    promptVersion: text(row.promptVersion, "promptVersion", 40), reviewedAt: text(row.reviewedAt, "reviewedAt", 40),
    valence: unit(row.valence, "valence"), arousal: unit(row.arousal, "arousal"), tension: unit(row.tension, "tension"),
    wonder: unit(row.wonder, "wonder"), intimacy: unit(row.intimacy, "intimacy"),
    reading: text(row.reading, "reading", 120), themes: [...new Set(themes as AffectReadingTheme[])],
  };
}

export const affectReadingPath = (rootDir: string, releaseVersion: string): string =>
  path.join(rootDir, "data", "curation", "affect-readings", `${releaseVersion}.json`);

/** Readings apply only to the exact image each artwork currently delivers. */
export function loadAffectReadings(rootDir: string, releaseVersion: string, fingerprints: ReadonlyMap<string, string>): { version?: string; byId: Map<string, AffectReading> } {
  const file = affectReadingPath(rootDir, releaseVersion);
  const byId = new Map<string, AffectReading>();
  if (!existsSync(file)) return { byId };
  try {
    if (statSync(file).size > 5_000_000) throw new Error("Oversized affect ledger");
    const raw = readFileSync(file, "utf8");
    const ledger = JSON.parse(raw) as { schemaVersion?: unknown; releaseVersion?: unknown; readings?: unknown };
    if (ledger.schemaVersion !== 1 || ledger.releaseVersion !== releaseVersion || !Array.isArray(ledger.readings)) throw new Error("Invalid affect ledger");
    for (const value of ledger.readings) {
      const reading = parseAffectReading(value);
      if (fingerprints.get(reading.artworkId) === reading.sourceFingerprint) byId.set(reading.artworkId, reading);
    }
    const bound = [...byId.values()].map((item) => `${item.artworkId}:${item.sourceFingerprint}`).join(";");
    return { version: `affect-v1-${createHash("sha256").update(raw + bound).digest("hex").slice(0, 16)}`, byId };
  } catch {
    // An unreadable ledger is the absence of readings, never a reason to stop the gallery.
    return { byId: new Map() };
  }
}
