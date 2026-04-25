import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { parseArtworkRecords } from "@artduo/contracts";

import { buildReleaseReadyCorpus } from "./release-ready-corpus";

test("release-ready corpus builder backfills Phase 1 fields and excludes duplicates", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-release-ready-root-"));
  const confirmedRoot = path.join(rootDir, "data", "curation", "confirmed");
  const metadataBackfillRoot = path.join(rootDir, "data", "curation", "metadata-backfill");
  const releaseReadyRoot = path.join(rootDir, "data", "curation", "release-ready");
  const reportRoot = path.join(rootDir, "data", "curation", "reports");

  mkdirSync(confirmedRoot, { recursive: true });
  mkdirSync(metadataBackfillRoot, { recursive: true });
  mkdirSync(releaseReadyRoot, { recursive: true });
  mkdirSync(reportRoot, { recursive: true });

  writeFileSync(path.join(releaseReadyRoot, "2026-04-23-existing.json"), JSON.stringify([
    {
      id: "met-200",
      source: "met",
      sourceArtworkId: "200",
      version: "2026-04-23-existing",
      metadata: {
        title: "Existing Duplicate",
        artistDisplayName: "Known Artist",
        descriptionRaw: "Existing record already in release-ready.",
        descriptionClean: "Existing record already in release-ready.",
        storySnippet: "Existing record already in release-ready",
        moodTags: ["mystery"],
        colorTags: ["unknown-palette"],
        subjectTags: ["painting"],
        compositionTags: ["single-subject"],
      },
      retrieval: {
        searchText: "Existing Duplicate Known Artist mystery painting",
        emotionLabels: ["mystery"],
      },
      media: {
        baseImageUrl: "https://example.com/existing.jpg",
        imageUrlPreview: "https://example.com/existing.jpg",
        hasMotionAsset: false,
        mediaVersion: "2026-04-23-existing",
      },
      presentation: {
        grade: "B",
        gradeLabel: "emotional-pillar",
        motionProfile: "static",
      },
    },
  ], null, 2));

  writeFileSync(path.join(confirmedRoot, "mystery--review-wave1.json"), JSON.stringify([
    {
      sourceArtworkId: "101",
      id: "met-101",
      source: "met",
      metadata: {
        title: "Moonlit Apparition",
        artistDisplayName: "Jane Painter",
        medium: "Oil on canvas",
        culture: "French",
        department: "European Paintings",
        objectUrl: "https://www.metmuseum.org/art/collection/search/101",
        descriptionRaw: "",
      },
      media: {
        imageUrlPreview: "https://example.com/moonlit-preview.jpg",
        imageUrlFull: "https://example.com/moonlit-full.jpg",
        mediaVersion: "2026-04-24T00:00:00.000Z",
      },
      pipeline: {
        metadataGaps: ["missing-description"],
      },
      review: {
        decision: "promote",
        decisionAt: "2026-04-24T03:23:06.156Z",
        notes: "Strong mystery fit with clear display value.",
      },
    },
    {
      sourceArtworkId: "200",
      id: "met-200",
      source: "met",
      metadata: {
        title: "Existing Duplicate",
        artistDisplayName: "Known Artist",
        medium: "Oil on panel",
      },
      media: {
        imageUrlPreview: "https://example.com/existing.jpg",
        mediaVersion: "2026-04-24T00:00:00.000Z",
      },
      review: {
        decision: "promote",
      },
    },
    {
      sourceArtworkId: "300",
      id: "met-300",
      source: "met",
      metadata: {
        title: "Hold Me Back",
        artistDisplayName: "Curator Pending",
      },
      media: {
        imageUrlPreview: "https://example.com/hold.jpg",
        mediaVersion: "2026-04-24T00:00:00.000Z",
      },
      review: {
        decision: "hold",
      },
    },
  ], null, 2));

  writeFileSync(path.join(metadataBackfillRoot, "mystery--review-wave1.json"), JSON.stringify([
    {
      id: "met-101",
      source: "met",
      sourceArtworkId: "101",
      version: "2026-04-24-metadata-backfill-a",
      metadata: {
        title: "Moonlit Apparition",
        artistDisplayName: "Jane Painter",
        medium: "Oil on canvas",
        culture: "French",
        department: "European Paintings",
        objectUrl: "https://www.metmuseum.org/art/collection/search/101",
        descriptionRaw: "Moonlit Apparition by Jane Painter.",
        descriptionClean: "Moonlit Apparition by Jane Painter.",
        storySnippet: "Moonlit Apparition by Jane Painter",
        moodTags: ["mystery"],
        colorTags: ["charcoal"],
        subjectTags: ["painting", "mystery"],
        compositionTags: ["wide-frame", "scene-bias"],
      },
      retrieval: {
        searchText: "Moonlit Apparition Jane Painter mystery charcoal painting",
        emotionLabels: ["mystery"],
      },
      media: {
        baseImageUrl: "https://example.com/moonlit-preview.jpg",
        imageUrlPreview: "https://example.com/moonlit-preview.jpg",
        imageUrlFull: "https://example.com/moonlit-full.jpg",
        aspectRatioHint: "landscape",
        hasMotionAsset: false,
        mediaVersion: "2026-04-24T00:00:00.000Z",
      },
      presentation: {
        grade: "B",
        gradeLabel: "emotional-pillar",
        motionProfile: "static",
        sceneAffinity: {
          sceneTypes: ["architectural_space"],
          paletteModes: ["charcoal"],
          spatialModes: ["layered-room"],
          transitionTags: ["fade"],
        },
      },
    },
  ], null, 2));

  const result = buildReleaseReadyCorpus({
    rootDir,
    corpusVersion: "2026-04-24-ready",
  });

  const records = parseArtworkRecords(JSON.parse(readFileSync(result.outputPath, "utf8")));

  assert.equal(records.length, 1);
  assert.equal(records[0]?.sourceArtworkId, "101");
  assert.equal(records[0]?.version, "2026-04-24-ready");
  assert.ok(records[0]?.metadata.storySnippet);
  assert.ok(records[0]?.metadata.descriptionRaw);
  assert.deepEqual(records[0]?.metadata.moodTags, ["mystery"]);
  assert.ok(records[0]?.retrieval.searchText.includes("mystery"));
  assert.equal(records[0]?.media.aspectRatioHint, "landscape");
  assert.equal(records[0]?.presentation.sceneAffinity?.sceneTypes?.[0], "architectural_space");
  assert.equal(result.report.counts.existingReleaseReadyCount, 1);
  assert.equal(result.report.exclusionCounts.duplicate, undefined);
  assert.equal(result.report.exclusionCounts["missing-promote-review"], undefined);
  assert.equal(result.report.backfillCounts.description, 0);
});
