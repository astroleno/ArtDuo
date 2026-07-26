import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { buildVisualPresentationPreview } from "./visual-presentation-preview";

function writeJsonFile(filePath: string, data: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

test("visual presentation preview emits VLM candidates and skips trusted annotations", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-visual-presentation-preview-"));
  const releaseVersion = "2026-06-09-test-release";
  const releaseDir = path.join(rootDir, "data", "releases", releaseVersion);

  mkdirSync(releaseDir, { recursive: true });

  writeJsonFile(path.join(releaseDir, "metadata-01.json"), [
    {
      id: "met-paper",
      source: "met",
      sourceArtworkId: "100",
      version: releaseVersion,
      metadata: {
        title: "A Quiet Etching",
        artistDisplayName: "Paper Artist",
        medium: "Etching on paper",
        department: "Drawings and Prints",
        dimensions: "plate: 10 x 12 cm; sheet: 18 x 22 cm",
        moodTags: ["calm"],
        colorTags: ["monochrome"],
        subjectTags: ["Prints"],
        compositionTags: ["single-subject"],
      },
      presentation: {
        grade: "B",
        gradeLabel: "emotional-pillar",
        motionProfile: "static",
      },
    },
    {
      id: "met-annotated",
      source: "met",
      sourceArtworkId: "101",
      version: releaseVersion,
      metadata: {
        title: "Already Cropped Photograph",
        medium: "Gelatin silver print",
        department: "Photographs",
        moodTags: ["stillness"],
        colorTags: ["monochrome"],
        subjectTags: ["Photographs"],
        compositionTags: ["portrait"],
      },
      presentation: {
        grade: "B",
        gradeLabel: "emotional-pillar",
        motionProfile: "static",
      },
    },
    {
      id: "met-canvas",
      source: "met",
      sourceArtworkId: "102",
      version: releaseVersion,
      metadata: {
        title: "Plain Canvas",
        medium: "Oil on canvas",
        department: "European Paintings",
        moodTags: ["warmth"],
        colorTags: ["warm"],
        subjectTags: ["Paintings"],
        compositionTags: ["scene-bias"],
      },
      presentation: {
        grade: "B",
        gradeLabel: "emotional-pillar",
        motionProfile: "static",
      },
    },
  ]);

  writeJsonFile(path.join(releaseDir, "media-01.json"), [
    {
      id: "met-paper",
      source: "met",
      sourceArtworkId: "100",
      version: releaseVersion,
      media: {
        baseImageUrl: "https://example.com/paper-web-large.jpg",
        imageUrlPreview: "https://example.com/paper-web-large.jpg",
        imageUrlFull: "https://example.com/paper-original.jpg",
        aspectRatioHint: "landscape",
        hasMotionAsset: false,
        mediaVersion: "2026-06-09T00:00:00.000Z",
      },
    },
    {
      id: "met-annotated",
      source: "met",
      sourceArtworkId: "101",
      version: releaseVersion,
      media: {
        baseImageUrl: "https://example.com/photo-web-large.jpg",
        imageUrlPreview: "https://example.com/photo-web-large.jpg",
        imageUrlFull: "https://example.com/photo-original.jpg",
        aspectRatioHint: "portrait",
        hasMotionAsset: false,
        mediaVersion: "2026-06-09T00:00:00.000Z",
        visualPresentation: {
          contentBounds: {
            x: 0.08,
            y: 0.04,
            width: 0.84,
            height: 0.9,
          },
          contentAspectRatio: 0.7,
          whiteBorderRatio: 0.16,
          cropStrategy: "trim-border",
          confidence: 0.9,
          source: "vlm:test",
        },
      },
    },
    {
      id: "met-canvas",
      source: "met",
      sourceArtworkId: "102",
      version: releaseVersion,
      media: {
        baseImageUrl: "https://example.com/canvas-web-large.jpg",
        imageUrlPreview: "https://example.com/canvas-web-large.jpg",
        imageUrlFull: "https://example.com/canvas-original.jpg",
        aspectRatioHint: "landscape",
        hasMotionAsset: false,
        mediaVersion: "2026-06-09T00:00:00.000Z",
      },
    },
  ]);

  writeJsonFile(path.join(releaseDir, "search-01.json"), []);
  writeJsonFile(path.join(releaseDir, "background-scenes-01.json"), []);
  writeJsonFile(path.join(releaseDir, "manifest.json"), {
    release: {
      corpusVersion: releaseVersion,
      backgroundCatalogVersion: releaseVersion,
      contractsVersion: "0.1.0",
      createdAt: "2026-06-09T00:00:00.000Z",
    },
    shards: {
      metadata: [
        {
          id: "metadata-01",
          url: "./metadata-01.json",
          checksum: "sha256:test",
          sizeBytes: 1,
          recordCount: 3,
        },
      ],
      search: [
        {
          id: "search-01",
          url: "./search-01.json",
          checksum: "sha256:test",
          sizeBytes: 1,
          recordCount: 0,
        },
      ],
      mediaIndex: [
        {
          id: "media-01",
          url: "./media-01.json",
          checksum: "sha256:test",
          sizeBytes: 1,
          recordCount: 3,
        },
      ],
      backgroundScenes: [
        {
          id: "background-scenes-01",
          url: "./background-scenes-01.json",
          checksum: "sha256:test",
          sizeBytes: 1,
          recordCount: 0,
        },
      ],
    },
  });

  const result = buildVisualPresentationPreview({
    rootDir,
    releaseVersion,
  });
  const persisted = JSON.parse(readFileSync(result.reportPath, "utf8")) as typeof result.report;

  assert.equal(result.report.scope, "visual-presentation-vlm-worklist");
  assert.equal(result.report.counts.totalMediaRecords, 3);
  assert.equal(result.report.counts.alreadyAnnotatedCount, 1);
  assert.equal(result.report.counts.signalCandidateCount, 1);
  assert.equal(result.report.candidates[0]?.id, "met-paper");
  assert.equal(result.report.candidates[0]?.priority, "high");
  assert.equal(result.report.candidates[0]?.recommendedCropStrategy, "trim-border");
  assert.ok(result.report.candidates[0]?.reasonCodes.includes("department-paper-or-photo"));
  assert.match(result.report.candidates[0]?.vlmPrompt ?? "", /Return JSON only/);
  assert.equal(persisted.candidates[0]?.id, "met-paper");
  assert.ok(existsSync(result.reportMarkdownPath));
});
