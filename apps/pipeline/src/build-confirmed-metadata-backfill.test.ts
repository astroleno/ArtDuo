import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { parseArtworkRecords, parseBackgroundSceneRecords } from "@artduo/contracts";

import { buildConfirmedMetadataBackfill } from "./confirmed-metadata-backfill";

test("confirmed metadata backfill builds a parallel artifact and refreshes coverage with orientation + scene matches", async () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-metadata-backfill-root-"));
  const confirmedRoot = path.join(rootDir, "data", "curation", "confirmed");
  const outputRoot = path.join(rootDir, "data", "curation", "metadata-backfill");
  const reportRoot = path.join(rootDir, "data", "curation", "reports");

  mkdirSync(confirmedRoot, { recursive: true });
  mkdirSync(outputRoot, { recursive: true });
  mkdirSync(reportRoot, { recursive: true });

  const confirmedPath = path.join(
    confirmedRoot,
    "mystery--2026-04-24T10-46-00-000Z--mystery--review-wave2.json",
  );

  writeFileSync(confirmedPath, JSON.stringify([
    {
      sourceArtworkId: "101",
      id: "met-101",
      source: "met",
      metadata: {
        title: "Moonlit Apparition",
        artistDisplayName: "Jane Painter",
        medium: "Oil on canvas",
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
        decisionAt: "2026-04-24T10:46:00.000Z",
        notes: "Strong mystery fit with usable image and title signal.",
      },
    },
  ], null, 2));

  writeFileSync(path.join(reportRoot, "coverage-2026-04-24T10-46-00-000Z--mystery--review-wave2.json"), JSON.stringify({
    runId: "2026-04-24T10-46-00-000Z--mystery--review-wave2",
    theme: "mystery",
    gateThresholds: {
      confirmedMin: 30,
      orientationMinPercent: 15,
      sceneMatchMinPercent: 60,
      sourceConcentrationMaxPercent: 70,
    },
    sourceCoverage: {
      met: {
        reviewed: 1,
        reviewedPercent: 100,
        promote: 1,
        hold: 0,
        reject: 0,
      },
    },
    emotionCoverage: {
      mystery: {
        reviewed: 1,
        promote: 1,
        hold: 0,
        reject: 0,
      },
    },
    estimatedSceneMatch: {
      matchedPercent: 44.4,
    },
    triggers: {
      confirmedBelowThirty: true,
      sceneMatchBelowSixty: true,
      orientationCoverageBelowTarget: true,
      sourceConcentrationAboveSeventy: true,
    },
  }, null, 2));

  const backgroundScenes = parseBackgroundSceneRecords(JSON.parse(
    readFileSync(path.resolve(__dirname, "../../../packages/contracts/fixtures/background-scenes.json"), "utf8"),
  ));

  const result = await buildConfirmedMetadataBackfill({
    rootDir,
    inputPath: confirmedPath,
    corpusVersion: "2026-04-24-metadata-backfill-a",
    backgroundScenes,
    imageProbe: async () => ({
      width: 1600,
      height: 900,
      aspectRatioHint: "landscape",
    }),
  });

  const records = parseArtworkRecords(JSON.parse(readFileSync(result.outputPath, "utf8")));
  const report = JSON.parse(readFileSync(result.reportPath, "utf8"));
  const coverage = JSON.parse(readFileSync(path.join(reportRoot, "coverage-2026-04-24T10-46-00-000Z--mystery--review-wave2.json"), "utf8"));

  assert.equal(path.basename(result.outputPath), path.basename(confirmedPath));
  assert.equal(records.length, 1);
  assert.equal(records[0]?.version, "2026-04-24-metadata-backfill-a");
  assert.ok(records[0]?.metadata.storySnippet);
  assert.deepEqual(records[0]?.metadata.moodTags, ["mystery"]);
  assert.ok(records[0]?.retrieval.searchText.includes("mystery"));
  assert.equal(records[0]?.media.aspectRatioHint, "landscape");
  assert.ok(records[0]?.presentation.sceneAffinity?.sceneTypes?.length);
  assert.equal(report.scope, "metadata-backfill-only");
  assert.equal(report.backfillCounts.aspectRatioHint, 1);
  assert.equal(report.backfillCounts.sceneAffinity, 1);
  assert.deepEqual(report.coverageContexts[0]?.themeGateBlockers, [
    "confirmed-below-thirty",
    "orientation-coverage-below-target",
  ]);
  assert.deepEqual(report.coverageContexts[0]?.portfolioGateBlockers, [
    "source-concentration-above-seventy",
  ]);
  assert.equal(coverage.orientationCoverage.landscape, 1);
  assert.equal(coverage.orientationCoverage.landscapePercent, 100);
  assert.equal(coverage.estimatedSceneMatch.matchedCount, 1);
  assert.equal(coverage.estimatedSceneMatch.matchedPercent, 100);
  assert.equal(coverage.triggers.orientationCoverageBelowTarget, true);
  assert.equal(coverage.triggers.sceneMatchBelowSixty, false);
});

test("confirmed metadata backfill uses theme-specific scene hints for newly reviewed themes", async () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-metadata-backfill-joy-root-"));
  const confirmedRoot = path.join(rootDir, "data", "curation", "confirmed");
  const outputRoot = path.join(rootDir, "data", "curation", "metadata-backfill");
  const reportRoot = path.join(rootDir, "data", "curation", "reports");

  mkdirSync(confirmedRoot, { recursive: true });
  mkdirSync(outputRoot, { recursive: true });
  mkdirSync(reportRoot, { recursive: true });

  const confirmedPath = path.join(
    confirmedRoot,
    "joy--2026-04-25T03-04-29-359Z--joy--review-wave1.json",
  );

  writeFileSync(confirmedPath, JSON.stringify([
    {
      sourceArtworkId: "joy-101",
      id: "met-joy-101",
      source: "met",
      metadata: {
        title: "Merry Company on a Terrace",
        artistDisplayName: "Jan Steen",
        medium: "Oil on canvas",
        department: "European Paintings",
        objectUrl: "https://www.metmuseum.org/art/collection/search/joy-101",
        descriptionRaw: "",
      },
      media: {
        imageUrlPreview: "https://example.com/joy-preview.jpg",
        imageUrlFull: "https://example.com/joy-full.jpg",
        mediaVersion: "2026-04-25T00:00:00.000Z",
      },
      pipeline: {
        metadataGaps: ["missing-description"],
      },
      review: {
        decision: "promote",
        decisionAt: "2026-04-25T03:04:29.000Z",
        notes: "Strong joy fit with usable image and title signal.",
      },
    },
  ], null, 2));

  writeFileSync(path.join(reportRoot, "coverage-2026-04-25T03-04-29-359Z--joy--review-wave1.json"), JSON.stringify({
    runId: "2026-04-25T03-04-29-359Z--joy--review-wave1",
    theme: "joy",
    gateThresholds: {
      confirmedMin: 30,
      orientationMinPercent: 15,
      sceneMatchMinPercent: 60,
      sourceConcentrationMaxPercent: 70,
    },
    sourceCoverage: {
      met: {
        reviewed: 1,
        reviewedPercent: 100,
        promote: 1,
        hold: 0,
        reject: 0,
      },
    },
    emotionCoverage: {
      joy: {
        reviewed: 1,
        promote: 1,
        hold: 0,
        reject: 0,
      },
    },
    estimatedSceneMatch: {
      matchedPercent: 61.8,
    },
    triggers: {
      confirmedBelowThirty: true,
      sceneMatchBelowSixty: false,
      orientationCoverageBelowTarget: true,
      sourceConcentrationAboveSeventy: true,
    },
  }, null, 2));

  const backgroundScenes = parseBackgroundSceneRecords([
    {
      id: "bg-joy-001",
      asset: {
        original_filename: "joy-scene.png",
        suggested_filename: "joy-scene.png",
        local_public_path: "/artduo-gallery/joy-scene.png",
        label_cn: "糖果几何展墙",
        asset_group: "playful-editorial-geometry",
        metadata_version: "test",
      },
      image_info: {
        width: 1672,
        height: 941,
        aspect_ratio: "16:9",
        orientation: "landscape",
      },
      visual_profile: {
        scene_type: "editorial_space",
        styles: ["playful modern", "editorial set"],
        materials: ["painted plaster", "terrazzo"],
        lighting: ["track spotlights"],
        mood: ["cheerful", "lighthearted"],
        palette: ["cream", "coral", "pink"],
        composition: ["rounded central panel", "graphic side volumes"],
        negative_space_level: "medium",
        space_depth: "layered",
        focal_density: "medium",
        reference_inference: [],
      },
      curation_profile: {
        emotion_ids: ["playfulness", "optimism", "novelty"],
        art_styles: ["playful modern", "editorial set"],
        artwork_palette_modes: ["neutral", "pastel_friendly", "color_pop_friendly"],
        artwork_composition_modes: ["centered", "single_hero"],
        artwork_orientation_modes: ["landscape", "portrait"],
      },
      ui_profile: {
        overlay_readability: "medium",
        safe_text_zones: ["center", "top"],
        mobile_crop_tolerance: "good",
        visual_busyness: 0.32,
      },
      stage_profile: {
        primary_mount_zone: {
          shape: "rect",
          rect: {
            x: 0.2,
            y: 0.2,
            width: 0.6,
            height: 0.5,
          },
        },
        preferred_artwork_scale: "large",
        wall_visibility: "high",
        depth_strategy: "flat-wall",
        dominant_axis: "center",
      },
      transition_profile: {
        entry_families: ["fade", "light-swell"],
        exit_families: ["dissolve", "match-cut"],
        transition_tempo: "medium",
        transition_intensity: "moderate",
        implementation_hint: "auto",
      },
      retrieval_profile: {
        search_text: "joy playful geometry cheerful coral pink cream",
        search_terms: ["joy", "playful", "optimism", "coral", "pink", "cream"],
        embedding_text: "playful geometry cheerful coral pink cream",
      },
      parse_meta: {
        parsed_by: "manual",
        parser_model: "test",
        parsed_at: "2026-04-25",
        needs_review: false,
      },
      confidence: 0.95,
    },
  ]);

  const result = await buildConfirmedMetadataBackfill({
    rootDir,
    inputPath: confirmedPath,
    corpusVersion: "2026-04-25-metadata-backfill-joy-test",
    backgroundScenes,
    imageProbe: async () => ({
      width: 1600,
      height: 900,
      aspectRatioHint: "landscape",
    }),
  });

  const report = JSON.parse(readFileSync(result.reportPath, "utf8"));
  const coverage = JSON.parse(readFileSync(path.join(reportRoot, "coverage-2026-04-25T03-04-29-359Z--joy--review-wave1.json"), "utf8"));

  assert.equal(report.coverageContexts[0]?.matchedCount, 1);
  assert.equal(report.coverageContexts[0]?.matchedPercent, 100);
  assert.equal(coverage.estimatedSceneMatch.matchedCount, 1);
  assert.equal(coverage.estimatedSceneMatch.matchedPercent, 100);
  assert.equal(coverage.triggers.sceneMatchBelowSixty, false);
});
