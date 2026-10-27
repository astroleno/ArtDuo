// Operator notes are supplied only after looking at the exact labeled images.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { readCachedPublicImage } from "@artduo/corpus/src/public-image-cache";
import { completePublicFacts, readPublicImageArtifacts, writePublicImportJson, type PublicVisualReview } from "./public-url-intake";

const root = path.resolve(__dirname, "../../.."), args = process.argv.slice(2);
const arg = (name: string) => { const index = args.indexOf(name); if (index < 0 || !args[index + 1]) throw new TypeError(`Missing ${name}`); return args[index + 1]; };
const manifest = JSON.parse(readFileSync(path.resolve(root, arg("--sheet")), "utf8"));
const notes = JSON.parse(readFileSync(path.resolve(root, arg("--notes")), "utf8"));
const work = path.join(root, "data/curation/public-url-import", manifest.version), filename = path.join(work, "reviews.json");
const previous = existsSync(filename) ? JSON.parse(readFileSync(filename, "utf8")).reviews as PublicVisualReview[] : [];
const byId = new Map(previous.map(review => [review.candidateId, review]));
const receipts = readPublicImageArtifacts(path.join(work, "image-receipts.jsonl"));
for (const note of notes) {
  const row = manifest.rows.find((row: any) => row.index === note.i);
  const receipt = row && receipts.get(row.candidateId)?.find(artifact => artifact.ref?.sha256 === row.sourceImageSha256);
  if (!row || !receipt?.ref || receipt.status !== "fetched" || receipt.ref.sha256 !== row.sourceImageSha256
    || !readCachedPublicImage(root, receipt.ref) || typeof note.o !== "string" || !note.o.trim()) throw new TypeError("Operator note does not identify a reviewed, unchanged source image");
  if (byId.has(row.candidateId) && !args.includes("--replace")) throw new TypeError(`Review already exists: ${row.candidateId}`);
  const review: PublicVisualReview = { candidateId: row.candidateId, sourceImageSha256: row.sourceImageSha256,
    reviewedAt: new Date().toISOString(), reviewer: "local-image-review", view: note.v ?? "complete-frontal",
    facts: completePublicFacts(note.p ?? [], note.a ?? []), spatialFraming: note.f, observation: note.o,
    editorial: { description: note.o, moodTags: note.m ?? ["quiet", "attentive"], colorTags: note.c ?? ["brown", "gray"],
      compositionTags: note.t ?? [], energyLevel: note.e ?? "low", valence: note.val ?? "mixed", pace: note.pace ?? "still" } };
  byId.set(row.candidateId, review);
}
writePublicImportJson(filename, { schemaVersion: 1, releaseVersion: manifest.version,
  scope: "Assistant observation of current-source proportional previews. Unresolved subjects remain unknown; no full-image native-pixel audit or independent human verification is claimed.",
  reviews: [...byId.values()] });
console.log(JSON.stringify({ recorded: notes.length, total: byId.size }));
