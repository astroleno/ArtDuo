import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { VISUAL_SUBJECTS, SPATIAL_FRAMINGS, type VisualFacts, type SpatialFraming, type VerifiedRemoteImage } from "@artduo/contracts";
import type { WebArtwork } from "./release-catalog";

export type { VisualSubject, VisualState } from "@artduo/contracts";
export interface ArtworkVisualEvidence {
  artworkId: string;
  imagePath: string;
  imageSha256: string;
  reviewedAt: string;
  reviewer: "local-image-review";
  facts: VisualFacts;
  spatialFraming?: SpatialFraming;
  observation: string;
}
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

/** Reviews describe the exact delivered image, independently of museum metadata. */
export function loadArtworkVisualEvidence(input: { releaseDir: string; releaseVersion: string; artworks: WebArtwork[];
  verifiedRemoteImages?: ReadonlyMap<string, VerifiedRemoteImage> }): {
  version?: string; byArtworkId: Map<string, ArtworkVisualEvidence>; unverifiedArtworkIds: Set<string>;
} {
  const byArtworkId = new Map<string, ArtworkVisualEvidence>();
  const unverifiedArtworkIds = new Set<string>();
  const embeddedLedger = path.join(input.releaseDir, "visual-reviews.json");
  const filename = existsSync(embeddedLedger) ? embeddedLedger : path.resolve(input.releaseDir, "../../../data/curation/visual-reviews", `${input.releaseVersion}.json`);
  if (!existsSync(filename)) return { byArtworkId, unverifiedArtworkIds };
  let raw: string;
  try {
    if (statSync(filename).size > 20_000_000) throw new Error("Oversized visual review ledger");
    raw = readFileSync(filename, "utf8");
    const ledger = JSON.parse(raw);
    if (![1, 2].includes(ledger.schemaVersion) || ledger.releaseVersion !== input.releaseVersion || !Array.isArray(ledger.reviews) || ledger.reviews.length > input.artworks.length) throw new Error("Invalid visual review ledger");
    const artworks = new Map(input.artworks.map(artwork => [artwork.id, artwork]));
    const root = realpathSync(input.releaseDir) + path.sep;
    const identities: string[] = [];
    const seen = new Set<string>();
    for (const row of ledger.reviews) {
      const artwork = artworks.get(row.artworkId);
      if (!artwork || seen.has(row.artworkId)) throw new Error("Duplicate or unknown reviewed artwork");
      seen.add(row.artworkId);
      unverifiedArtworkIds.add(row.artworkId);
      if (row.reviewer !== "local-image-review" || typeof row.reviewedAt !== "string" || typeof row.observation !== "string" || !row.observation.trim() || row.observation.length > 1400
        || !row.facts || typeof row.facts !== "object" || Array.isArray(row.facts) || Object.entries(row.facts).some(([key, value]) => !(VISUAL_SUBJECTS as readonly string[]).includes(key) || !["present", "absent", "unknown"].includes(String(value)))
        || row.spatialFraming !== undefined && !(SPATIAL_FRAMINGS as readonly string[]).includes(row.spatialFraming)
        || ledger.schemaVersion === 2 && (VISUAL_SUBJECTS.some(subject => !row.facts[subject]) || !row.spatialFraming)) throw new Error("Invalid visual observation");
      const remote = input.verifiedRemoteImages?.get(row.artworkId);
      if (remote) {
        const bound = row.imagePath === artwork.imageUrl && remote.url === row.imagePath && remote.sha256 === row.imageSha256;
        identities.push(`${row.artworkId}:${remote.url}:${remote.sha256}:${bound}`);
        // The image route serves this URL only when the complete response matches
        // the immutable import receipt. A cold cache does not erase its review.
        if (bound) { byArtworkId.set(row.artworkId, row as ArtworkVisualEvidence); unverifiedArtworkIds.delete(row.artworkId); }
        continue;
      }
      if (row.imagePath !== artwork.imageUrl || !/^(?:\.\/)?images\/[^?#]+$/u.test(row.imagePath)) { identities.push(`${row.artworkId}:image-mismatch`); continue; }
      const candidate = path.resolve(input.releaseDir, row.imagePath);
      if (!existsSync(candidate)) { identities.push(`${row.artworkId}:missing-image`); continue; }
      const image = realpathSync(candidate);
      if (!image.startsWith(root) || statSync(image).size > 30_000_000) { identities.push(`${row.artworkId}:invalid-image`); continue; }
      const actual = `sha256:${digest(readFileSync(image))}`;
      identities.push(`${row.artworkId}:${actual}`);
      if (actual === row.imageSha256) { byArtworkId.set(row.artworkId, row as ArtworkVisualEvidence); unverifiedArtworkIds.delete(row.artworkId); }
    }
    return { version: `visual-v1-${digest(raw + identities.join(";")).slice(0, 20)}`, byArtworkId, unverifiedArtworkIds };
  } catch {
    // A corrupt ledger cannot provide evidence of absence.
    return { version: "visual-review-invalid", byArtworkId: new Map(), unverifiedArtworkIds: new Set(input.artworks.map(artwork => artwork.id)) };
  }
}
