import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ArtworkDisplayCredits } from "@artduo/ui";
import type { ExperienceArtworkRecord } from "./release-catalog";

interface CreditRow extends ArtworkDisplayCredits {
  artworkId: string;
  originalArtistDisplayName: string;
  objectUrl: string;
  sourceAssetFingerprint: string;
}

/** A display overlay leaves the published record and its fingerprints immutable. */
export function loadArtworkCredits(input: { releaseDir: string; releaseVersion: string; records: ExperienceArtworkRecord[] }): Map<string, ArtworkDisplayCredits> {
  const embedded = path.join(input.releaseDir, "creator-credits.json");
  const filename = existsSync(embedded) ? embedded : path.resolve(input.releaseDir, "../../curation/public-url-import", input.releaseVersion, "creator-credits.json");
  if (!existsSync(filename)) return new Map();
  const data = JSON.parse(readFileSync(filename, "utf8"));
  if (data.schemaVersion !== 1 || data.releaseVersion !== input.releaseVersion || !Array.isArray(data.entries)) throw new TypeError("Invalid creator credit ledger");
  const records = new Map(input.records.map(record => [record.id, record]));
  const credits = new Map<string, ArtworkDisplayCredits>();
  for (const row of data.entries as CreditRow[]) {
    const record = records.get(row.artworkId);
    if (!record || credits.has(row.artworkId) || row.originalArtistDisplayName !== record.metadata.artistDisplayName
      || row.objectUrl !== record.metadata.objectUrl || row.sourceAssetFingerprint !== record.media.sourceAssetFingerprint
      || row.artistDisplayName !== null && (typeof row.artistDisplayName !== "string" || !row.artistDisplayName.trim())
      || !Array.isArray(row.publishers) || !row.publishers.length || row.publishers.some(name => typeof name !== "string" || !name.trim())) {
      throw new TypeError(`Unbound creator credit: ${row.artworkId}`);
    }
    credits.set(row.artworkId, { artistDisplayName: row.artistDisplayName, publishers: row.publishers });
  }
  return credits;
}
