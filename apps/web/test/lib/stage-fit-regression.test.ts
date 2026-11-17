import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parseCurationIntentPlan } from "@artduo/contracts";
import { createLocalSemanticEncoder } from "@artduo/corpus/src/local-semantic-provider";
import { semanticArtworkText } from "@artduo/corpus/src/semantic-index";
import { loadSemanticIndex } from "@artduo/corpus/src/semantic-loader";
import { loadWebReleaseCatalog } from "../../lib/release-catalog";
import { selectForCurationStages } from "../../lib/semantic-selection";

const rootDir = path.resolve(__dirname, "../../../..");
const OPEN_STAGE = /\b(?:open|wide|expansive|distant)(?:\s+(?:open|wide|distant))*\s+(?:landscape|horizon|sky|view|vista)/iu;

// Replays recorded model plans through deterministic selection. No model is
// called, so this guards stage fit in ordinary test runs. The active release
// has many open views and forgives a weaker ranking; the 630-work release does
// not, and reverting stage-fit scoring there puts a Gauguin interior in
// "看向远处" again.
for (const releaseVersion of [undefined, "2026-10-24-da3-curated-630"]) test(`recorded plans never place an enclosed room in an open-vista stage (${releaseVersion ?? "active release"})`, async () => {
  const catalog = loadWebReleaseCatalog({ rootDir, ...(releaseVersion ? { releaseVersion } : {}) });
  const plans = JSON.parse(readFileSync(path.join(__dirname, "../fixtures/stage-fit-plans.json"), "utf8")) as Record<string, unknown>;
  const index = loadSemanticIndex({ manifestPath: catalog.manifestPath, manifest: catalog.manifest,
    artworks: catalog.artworkRecords.map((artwork) => ({ id: artwork.id, text: semanticArtworkText({ ...artwork.metadata, description: artwork.metadata.descriptionClean ?? artwork.metadata.storySnippet }) })) });
  assert.ok(index, "the active release has a semantic index");
  const encoder = createLocalSemanticEncoder({ rootDir });
  let openStageWorks = 0;
  try {
    for (const [query, raw] of Object.entries(plans)) {
      const plan = parseCurationIntentPlan(raw);
      const queries = await encoder.embedQueries(plan.stages.map((stage) => stage.query));
      const { assignments } = selectForCurationStages({ catalog, query, plan, semantic: { index, queries } });
      assert.equal(new Set(assignments.map((item) => item.artworkId)).size, assignments.length, `no repeated work: ${query}`);
      for (const item of assignments) {
        const stage = plan.stages[item.stageIndex]!;
        if (!OPEN_STAGE.test(stage.query)) continue;
        openStageWorks++;
        const evidence = catalog.artworkById.get(item.artworkId)!.visualEvidence;
        assert.ok(evidence?.spatialFraming !== "enclosed" && evidence?.facts.interior !== "present",
          `"${stage.label}" asks for an open view but received ${catalog.artworkById.get(item.artworkId)!.title} (${query})`);
      }
    }
  } finally { await encoder.dispose(); }
  assert.ok(openStageWorks >= 10, "the fixtures still exercise open-vista stages");
});
