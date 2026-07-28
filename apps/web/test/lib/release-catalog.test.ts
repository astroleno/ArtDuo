import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { embedText } from "@artduo/corpus";

import { loadWebReleaseCatalog, searchBackgroundScenes, searchReleaseCatalog } from "../../lib/release-catalog";

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function buildReleaseFixture(): string {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-web-release-"));
  const releaseVersion = "2026-04-25-curation-b";
  const releaseDir = path.join(rootDir, "data", "releases", releaseVersion);
  mkdirSync(releaseDir, { recursive: true });

  const moonVector = embedText("quiet moon contemplation figures night landscape").vector;
  const joyVector = embedText("bright joy garden dance music spring").vector;

  writeJson(path.join(releaseDir, "manifest.json"), {
    release: {
      corpusVersion: releaseVersion,
      backgroundCatalogVersion: releaseVersion,
      contractsVersion: "0.1.0",
      createdAt: "2026-04-25T10:00:00.000Z",
    },
    shards: {
      metadata: [{ id: "metadata-01", url: "./metadata-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 2 }],
      search: [{ id: "search-01", url: "./search-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 2 }],
      mediaIndex: [{ id: "media-01", url: "./media-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 2 }],
      backgroundScenes: [{ id: "background-scenes-01", url: "./background-scenes-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 1 }],
      embeddings: [{ id: "embeddings-01", url: "./embeddings-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 2 }],
    },
  });

  writeJson(path.join(releaseDir, "metadata-01.json"), [
    {
      id: "met-moon",
      source: "met",
      sourceArtworkId: "1",
      version: releaseVersion,
      metadata: {
        title: "Two Men Contemplating the Moon",
        artistDisplayName: "Caspar David Friedrich",
        yearLabel: "ca. 1825-30",
        medium: "Oil on canvas",
        department: "European Paintings",
        objectUrl: "https://example.test/moon",
        descriptionClean: "A quiet nocturne made for contemplation.",
        storySnippet: "Two figures pause under a moonlit sky.",
        moodTags: ["contemplation"],
        colorTags: ["cool-dark"],
        subjectTags: ["moon", "figures"],
        compositionTags: ["landscape"],
      },
      presentation: {
        grade: "A",
        gradeLabel: "director-focus",
        motionProfile: "static",
        narrationMode: "caption",
        sceneAffinity: {
          sceneTypes: ["gallery_interior"],
          paletteModes: ["cool-dark"],
          transitionTags: ["fade"],
        },
      },
    },
    {
      id: "met-joy",
      source: "met",
      sourceArtworkId: "2",
      version: releaseVersion,
      metadata: {
        title: "Spring Dance",
        artistDisplayName: "Unknown Artist",
        yearLabel: "1901",
        medium: "Oil on panel",
        descriptionClean: "A bright scene of garden music.",
        storySnippet: "A garden gathering turns toward joy.",
        moodTags: ["joy"],
        colorTags: ["bright"],
        subjectTags: ["garden", "dance"],
        compositionTags: ["group"],
      },
      presentation: {
        grade: "B",
        gradeLabel: "emotional-pillar",
        motionProfile: "static",
        narrationMode: "caption",
        sceneAffinity: {
          sceneTypes: ["gallery_interior"],
          paletteModes: ["warm"],
          transitionTags: ["light-swell"],
        },
      },
    },
  ]);

  writeJson(path.join(releaseDir, "search-01.json"), [
    {
      id: "met-moon",
      source: "met",
      sourceArtworkId: "1",
      version: releaseVersion,
      retrieval: {
        searchText: "quiet moon contemplation figures night landscape",
        searchTextShort: "quiet moon contemplation",
        emotionLabels: ["contemplation"],
        energyLevel: "low",
        valence: "mixed",
        pace: "still",
        spaceSense: "open",
        keywordBoosts: ["moon", "night"],
      },
    },
    {
      id: "met-joy",
      source: "met",
      sourceArtworkId: "2",
      version: releaseVersion,
      retrieval: {
        searchText: "bright joy garden dance music spring",
        searchTextShort: "bright garden dance",
        emotionLabels: ["joy"],
        energyLevel: "high",
        valence: "bright",
        pace: "active",
        spaceSense: "open",
        keywordBoosts: ["garden", "music"],
      },
    },
  ]);

  writeJson(path.join(releaseDir, "media-01.json"), [
    {
      id: "met-moon",
      source: "met",
      sourceArtworkId: "1",
      version: releaseVersion,
      media: {
        baseImageUrl: "https://images.example.test/moon.jpg",
        imageUrlPreview: "https://images.example.test/moon-preview.jpg",
        imageUrlFull: "https://images.example.test/moon-full.jpg",
        aspectRatioHint: "landscape",
        visualPresentation: {
          contentBounds: { x: 0.08, y: 0.12, width: 0.84, height: 0.74 },
          contentAspectRatio: 1.45,
          whiteBorderRatio: 0.24,
          cropStrategy: "trim-border",
          confidence: 0.82,
          source: "fixture-vlm",
          notes: ["large paper margin around painted scene"],
        },
        hasMotionAsset: false,
        mediaVersion: "2026-04-25T00:00:00.000Z",
      },
    },
    {
      id: "met-joy",
      source: "met",
      sourceArtworkId: "2",
      version: releaseVersion,
      media: {
        baseImageUrl: "https://images.example.test/joy.jpg",
        imageUrlPreview: "https://images.example.test/joy-preview.jpg",
        aspectRatioHint: "square",
        hasMotionAsset: false,
        mediaVersion: "2026-04-25T00:00:00.000Z",
      },
    },
  ]);

  writeJson(path.join(releaseDir, "background-scenes-01.json"), [
    {
      id: "bg-moon",
      asset: {
        local_public_path: "/artduo-gallery/bg-moon.png",
        label_cn: "月光静室",
      },
      visual_profile: {
        scene_type: "gallery_interior",
        mood: ["serene", "quiet"],
        palette: ["cool-dark"],
      },
      curation_profile: {
        emotion_ids: ["contemplation"],
        artwork_palette_modes: ["cool-dark"],
      },
      ui_profile: {
        overlay_readability: "high",
        safe_text_zones: ["left", "center"],
        mobile_crop_tolerance: "good",
        visual_busyness: 0.2,
      },
      retrieval_profile: {
        search_text: "quiet moon contemplation cool dark gallery",
        search_terms: ["quiet", "moon", "contemplation", "cool-dark", "gallery-interior"],
        embedding_text: "月光静室; scene_type=gallery_interior; mood=serene, quiet; palette=cool dark; materials=stone, shadow, moonlight",
      },
    },
  ]);

  writeJson(path.join(releaseDir, "embeddings-01.json"), [
    {
      id: "met-moon",
      source: "met",
      sourceArtworkId: "1",
      version: releaseVersion,
      theme: "contemplation",
      model: "local-hash-embedding-v1",
      dimensions: moonVector.length,
      title: "Two Men Contemplating the Moon",
      artistDisplayName: "Caspar David Friedrich",
      grade: "A",
      moodTags: ["contemplation"],
      text: "quiet moon contemplation figures night landscape",
      tokenCount: 6,
      vector: moonVector,
    },
    {
      id: "met-joy",
      source: "met",
      sourceArtworkId: "2",
      version: releaseVersion,
      theme: "joy",
      model: "local-hash-embedding-v1",
      dimensions: joyVector.length,
      title: "Spring Dance",
      artistDisplayName: "Unknown Artist",
      grade: "B",
      moodTags: ["joy"],
      text: "bright joy garden dance music spring",
      tokenCount: 6,
      vector: joyVector,
    },
  ]);

  return rootDir;
}

test("loads the release manifest into gallery-ready artwork records", () => {
  const rootDir = buildReleaseFixture();
  const catalog = loadWebReleaseCatalog({ rootDir });

  assert.equal(catalog.releaseVersion, "2026-04-25-curation-b");
  assert.equal(catalog.artworkCount, 2);
  assert.equal(catalog.backgroundSceneCount, 1);
  assert.equal(catalog.backgroundSceneEmbeddingRecords.length, 1);
  assert.equal(catalog.artworks[0]?.id, "met-moon");
  assert.equal(catalog.artworks[0]?.title, "Two Men Contemplating the Moon");
  assert.equal(catalog.artworks[0]?.imageUrl, "https://images.example.test/moon-preview.jpg");
  assert.equal(catalog.artworks[0]?.visualPresentation?.cropStrategy, "trim-border");
  assert.deepEqual(catalog.artworks[0]?.visualPresentation?.contentBounds, { x: 0.08, y: 0.12, width: 0.84, height: 0.74 });
  assert.equal(catalog.artworks[0]?.detailHref, "/artwork/met-moon");
  assert.match(catalog.backgroundScenes[0]?.embeddingText ?? "", /moonlight/);
});

test("searches a visitor sentence into ranked gallery cards with detail links", () => {
  const rootDir = buildReleaseFixture();
  const catalog = loadWebReleaseCatalog({ rootDir });
  const result = searchReleaseCatalog(catalog, "I want a quiet moonlit room", { limit: 2 });

  assert.equal(result.query, "I want a quiet moonlit room");
  assert.equal(result.normalizedQuery, "i want a quiet moonlit room");
  assert.equal(result.results.length, 2);
  assert.equal(result.results[0]?.artwork.id, "met-moon");
  assert.equal(result.results[0]?.artwork.detailHref, "/artwork/met-moon?query=I+want+a+quiet+moonlit+room");
  assert.deepEqual(result.results[0]?.artwork.moodTags, ["contemplation"]);
  assert.equal(result.results[0]?.scene?.imageUrl, "/artduo-gallery/bg-moon.png");
  assert.ok((result.results[0]?.combinedScore ?? 0) > (result.results[1]?.combinedScore ?? 0));
});

test("searches background scenes directly from the visitor query", () => {
  const rootDir = buildReleaseFixture();
  const catalog = loadWebReleaseCatalog({ rootDir });
  const result = searchBackgroundScenes(catalog, "quiet moonlit stone room", { limit: 1 });

  assert.equal(result.query, "quiet moonlit stone room");
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0]?.scene.id, "bg-moon");
  assert.ok((result.results[0]?.combinedScore ?? 0) > 0);
});

test("returns an empty gallery result for queries without searchable tokens", () => {
  const rootDir = buildReleaseFixture();
  const catalog = loadWebReleaseCatalog({ rootDir });
  const result = searchReleaseCatalog(catalog, "!!!", { limit: 2 });

  assert.equal(result.normalizedQuery, "");
  assert.equal(result.results.length, 0);
});

test("reports the shard kind and id when a release shard is missing", () => {
  const rootDir = buildReleaseFixture();
  rmSync(path.join(rootDir, "data", "releases", "2026-04-25-curation-b", "media-01.json"));

  assert.throws(
    () => loadWebReleaseCatalog({ rootDir }),
    /Failed to load mediaIndex shard media-01/,
  );
});

test("rejects score inputs that exceed the shared frozen metadata cardinality contract", () => {
  const rootDir = buildReleaseFixture();
  const metadataPath = path.join(rootDir, "data", "releases", "2026-04-25-curation-b", "metadata-01.json");
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as Array<{
    metadata: { moodTags: string[] };
  }>;
  metadata[0]!.metadata.moodTags = ["contemplation", "awe", "wonder", "joy"];
  writeJson(metadataPath, metadata);

  assert.throws(
    () => loadWebReleaseCatalog({ rootDir }),
    /at most 3 values for the frozen image-scene score contract/,
  );
});
