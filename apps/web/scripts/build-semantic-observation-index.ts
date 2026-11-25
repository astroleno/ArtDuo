// cd apps/web && node --import tsx scripts/build-semantic-observation-index.ts RELEASE OUTPUT.json
// After review, install the verified output as semantic-observation-index-v1.json
// beside that release's manifest. Removing it restores the museum-only path.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { createLocalSemanticEncoder } from "@artduo/corpus/src/local-semantic-provider";
import { semanticFingerprint } from "@artduo/corpus/src/semantic-index";
import { loadSemanticIndex } from "@artduo/corpus/src/semantic-loader";
import { buildSemanticObservationIndex } from "@artduo/corpus/src/semantic-observation-index";
import { loadWebReleaseCatalog } from "../lib/release-catalog";
import { museumSemanticDocuments, observationReleaseInput } from "../lib/semantic-observation-release";

async function main() {
  const [releaseVersion, output, ...rest] = process.argv.slice(2);
  if (!releaseVersion || !output || rest.length) throw new Error("Provide the installed release version and a new output file");
  const rootDir = path.resolve(__dirname, "../../..");
  const catalog = loadWebReleaseCatalog({ rootDir, releaseVersion });
  const documents = museumSemanticDocuments(catalog);
  const museumIndex = loadSemanticIndex({ manifest: catalog.manifest, manifestPath: catalog.manifestPath, artworks: documents });
  if (!museumIndex) throw new Error("The installed release lacks its museum index");
  const input = observationReleaseInput(catalog, museumIndex);
  const documentById = new Map(documents.map(({ id, text }) => [id, text]));
  const startedAt = performance.now();
  const encoder = createLocalSemanticEncoder({ rootDir, allowDownload: false });
  try {
    const indexed = await buildSemanticObservationIndex(input, encoder);
    const bytes = Buffer.from(JSON.stringify(indexed) + "\n");
    writeFileSync(output, bytes, { flag: "wx" });
    const fullObservationInMuseumIndex = input.sources.filter(({ artworkId, observation }) =>
      documentById.get(artworkId)?.includes(observation.normalize("NFKC"))).length;
    process.stdout.write(JSON.stringify({ ...input.provenance, output,
      records: indexed.payload.records.length, museumRecords: museumIndex.records.length, fullObservationInMuseumIndex,
      textVersion: indexed.payload.textVersion, model: indexed.payload.model,
      bytes: bytes.length, sha256: semanticFingerprint(bytes), contentChecksum: indexed.checksum,
      buildMs: Math.round(performance.now() - startedAt), network: "local-model-cache-only; allowDownload false" }, null, 2) + "\n");
  } finally { await encoder.dispose(); }
}

void main();
