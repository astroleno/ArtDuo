import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { getCorpusManifestResponse, resolveCorpusManifestPath } from "../../src/routes/corpus";

test("corpus route resolves the latest release manifest", () => {
  const releasesRoot = mkdtempSync(path.join(os.tmpdir(), "artduo-api-releases-"));
  const releaseDir = path.join(releasesRoot, "2026-04-24-z");
  mkdirSync(releaseDir, { recursive: true });
  writeFileSync(
    path.join(releaseDir, "manifest.json"),
    JSON.stringify(
      {
        release: {
          corpusVersion: "2026-04-24-z",
          backgroundCatalogVersion: "2026-04-24-z",
          contractsVersion: "0.1.0",
          createdAt: "2026-04-24T10:00:00.000Z",
        },
        shards: {
          metadata: [
            {
              id: "metadata-01",
              url: "./metadata-01.json",
              checksum: "sha256:test",
              sizeBytes: 128,
              recordCount: 5,
            },
          ],
          search: [
            {
              id: "search-01",
              url: "./search-01.json",
              checksum: "sha256:test",
              sizeBytes: 128,
              recordCount: 5,
            },
          ],
          mediaIndex: [
            {
              id: "media-01",
              url: "./media-01.json",
              checksum: "sha256:test",
              sizeBytes: 128,
              recordCount: 5,
            },
          ],
          backgroundScenes: [
            {
              id: "background-scenes-01",
              url: "./background-scenes-01.json",
              checksum: "sha256:test",
              sizeBytes: 128,
              recordCount: 50,
            },
          ],
        },
      },
      null,
      2,
    ),
  );

  const manifestPath = resolveCorpusManifestPath({ releasesRoot });
  const manifest = getCorpusManifestResponse({ releasesRoot });

  assert.equal(manifestPath, path.join(releasesRoot, "2026-04-24-z", "manifest.json"));
  assert.equal(manifest.release.corpusVersion, "2026-04-24-z");
  assert.equal(manifest.shards.metadata[0]?.recordCount, 5);
});
