// Run only after the reference fixture has been independently frozen.
import { readFileSync } from "node:fs";
import path from "node:path";
import { createLocalSemanticEncoder } from "@artduo/corpus/src/local-semantic-provider";
import { sameSemanticSpace, semanticArtworkText } from "@artduo/corpus/src/semantic-index";
import { loadSemanticIndex } from "@artduo/corpus/src/semantic-loader";
import { loadWebReleaseCatalog } from "../lib/release-catalog";
import { withCurationVisualCorrections } from "../lib/curation-visual-corrections";
import { eligibleCurationArtworks, selectForCurationStages } from "../lib/semantic-selection";
import { hash, HOLDOUT_FIXTURE, readHoldoutFixture } from "./stage-holdout-fixture";
import { measureStageHoldout, type HoldoutStage } from "./stage-holdout-metrics";
import type { Clause } from "./stage-holdout-design";
import { createBlindPackets, freezeUniverse, measureUniverse, scoreBlindPackets } from "./stage-holdout-universe";

const rootDir = path.resolve(__dirname, "../../..");

function hasLogicalConflict(criteria: Clause[]): boolean {
  return criteria.some((left, index) => criteria.slice(index + 1).some(right =>
    (left.kind === "medium" && right.kind === "medium" && left.value === right.value && Boolean(left.exclude) !== Boolean(right.exclude))
    || (left.kind === "fact" && right.kind === "fact" && left.subject === right.subject && left.value !== right.value)));
}

// Separate deliberately unused slots in one- and two-work plans from a planned
// slot whose actual pool is empty. Both views keep actual pool widths unchanged.
function requestedStages(count: number, stageCount: number): Set<number> {
  const active = Math.min(count, stageCount);
  return new Set(Array.from({ length: active }, (_, index) => active <= 1 ? 0 : Math.round(index * (stageCount - 1) / (active - 1))));
}

async function main() {
  const args = process.argv.slice(2);
  const universeReport = args[0] === "--universe";
  const blind = args[0] === "--blind-packets";
  const blindAnswers = args[0] === "--score-blind";
  if (args.length && !((universeReport || blind) && args.length === 1 || blindAnswers && [2, 3].includes(args.length))) {
    throw new Error("Usage: stage-holdout-eval.ts [--universe | --blind-packets | --score-blind answers.json [universe-report.json]]");
  }
  const fixtureDirectory = path.join(__dirname, "../test/fixtures");
  const fixture = readHoldoutFixture(readFileSync(path.join(fixtureDirectory, HOLDOUT_FIXTURE)));
  const { provenance } = fixture;
  const rawCatalog = loadWebReleaseCatalog({ rootDir, releaseVersion: provenance.releaseVersion });
  if (hash(readFileSync(rawCatalog.manifestPath)) !== provenance.releaseManifestSha256
    || hash(readFileSync(path.join(rawCatalog.releaseDir, "visual-reviews.json"))) !== provenance.visualLedgerSha256
    || hash(readFileSync(path.join(fixtureDirectory, "stage-fit-plans.json"))) !== provenance.tunedPlansSha256
    || rawCatalog.visualEvidenceVersion !== provenance.visualEvidenceVersion) throw new Error("Holdout provenance does not match the installed release");
  for (const { id, samples } of fixture.cases) {
    for (const sample of samples) {
      const artwork = rawCatalog.artworkById.get(sample.artworkId), review = artwork?.visualEvidence;
      if (!review || artwork.visualEvidenceUnavailable || review.reviewer !== "local-image-review"
        || review.imageSha256 !== sample.imageSha256 || review.imagePath !== artwork.imageUrl || review.artworkId !== artwork.id) {
        throw new Error(`Unbound holdout reference ${id}/${sample.artworkId}`);
      }
    }
  }
  const universe = universeReport || blind || blindAnswers ? freezeUniverse(rawCatalog, fixture) : undefined;
  if (universe && (blind || blindAnswers)) {
    const packets = createBlindPackets(fixture, universe);
    const report = args[2] ? JSON.parse(readFileSync(args[2], "utf8")) : undefined;
    if (report && (report.input?.referenceSha256 !== universe.sha256 || !Array.isArray(report.rows))) {
      throw new Error("Blind coverage requires a report using the same full-catalog reference");
    }
    const output = blind ? packets : scoreBlindPackets(packets, JSON.parse(readFileSync(args[1]!, "utf8")), universe.labels, report?.rows);
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    return;
  }
  const catalog = withCurationVisualCorrections(rawCatalog);
  const index = loadSemanticIndex({ manifestPath: catalog.manifestPath, manifest: catalog.manifest,
    artworks: catalog.artworkRecords.map(artwork => ({ id: artwork.id,
      text: semanticArtworkText({ ...artwork.metadata, description: artwork.metadata.descriptionClean ?? artwork.metadata.storySnippet }) })) });
  if (!index) throw new Error("The installed release lacks its local semantic vectors");
  const encoder = createLocalSemanticEncoder({ rootDir, allowDownload: false });
  const stages: HoldoutStage[] = [];
  const routes: Array<{ caseId: string; expectedLogicalConflict: boolean; eligibleWorks: number; requestedWorks: number; assignedWorks: number }> = [];
  const hardViolations: Array<{ caseId: string; artworkId: string; source: "assignment" | "pool" }> = [];
  const duplicateAssignments: string[] = [];
  try {
    if (!sameSemanticSpace(index.model, encoder.model)) throw new Error("Local encoder and release vectors are incompatible");
    for (const entry of fixture.cases) {
      const { id, query, plan, stratum } = entry;
      const queries = await encoder.embedQueries(plan.stages.map(stage => stage.query));
      const selection = selectForCurationStages({ catalog, query, plan, semantic: { index, queries } });
      const allowed = new Set(eligibleCurationArtworks(catalog, query, plan, { scopedRiverBank: true }).map(artwork => artwork.id));
      if (universeReport) {
        if (new Set(selection.assignments.map(item => item.artworkId)).size !== selection.assignments.length) duplicateAssignments.push(id);
        for (const source of ["assignment", "pool"] as const) {
          const ids = source === "assignment" ? selection.assignments : selection.stagePools?.flat() ?? [];
          for (const { artworkId } of ids) if (!allowed.has(artworkId)) hardViolations.push({ caseId: id, artworkId, source });
        }
      }
      const active = requestedStages(plan.artworkCount, plan.stages.length);
      routes.push({ caseId: id, expectedLogicalConflict: hasLogicalConflict(entry.criteria), eligibleWorks: allowed.size,
        requestedWorks: plan.artworkCount, assignedWorks: selection.assignments.length });
      plan.stages.forEach((_, stageIndex) => stages.push({ caseId: id, stratum, stageIndex, requested: active.has(stageIndex), allowed,
        reference: entry.samples.filter(sample => sample.stageIndexes.includes(stageIndex)),
        pool: selection.stagePools?.[stageIndex]?.map(work => work.artworkId) ?? [] }));
    }
  } finally { await encoder.dispose(); }
  const report = {
    schemaVersion: 1,
    input: { fixture: HOLDOUT_FIXTURE, fixtureSha256: fixture.sha256, ...provenance,
      selectionEvidenceVersion: catalog.visualEvidenceVersion, retrievalModel: index.model,
      retrievalIndexChecksum: catalog.manifest.shards.semanticEmbeddings?.[0]?.checksum,
      selectionMode: "local semantic vectors and deterministic production stage pools; no recent exposure, reranker or remote judging",
      poolOrder: "production stage shortlist prefix: already assigned works, then ranked supplemental candidates; not raw ANN order",
      samplingUnit: "labelled request, stage and artwork context; unknown and unlisted works are outside the judged-error denominator" },
    routes,
  };
  if (universe) {
    const { samplingUnit: _, ...input } = report.input;
    const fullReport = {
      schemaVersion: 1,
      input: { ...input, referenceVersion: "full-catalog-evidence-v1", referenceSha256: universe.sha256, universeSize: universe.artworks.length,
        samplingUnit: "same image-bound evidence judgments across stages of each synthetic request; unknown is neither positive nor negative; no human judgments included" },
      routes,
      safeguards: { hardViolations, duplicateAssignments, shortRoutes: routes.filter(row => row.assignedWorks < row.requestedWorks).length,
        requestedWorks: routes.reduce((sum, row) => sum + row.requestedWorks, 0),
        assignedWorks: routes.reduce((sum, row) => sum + row.assignedWorks, 0),
        logicalConflictRegressions: routes.filter(row => row.expectedLogicalConflict && (row.eligibleWorks || row.assignedWorks)) },
      ...measureUniverse(stages, universe.labels),
    };
    process.stdout.write(JSON.stringify(fullReport, null, 2) + "\n");
    return;
  }
  process.stdout.write(JSON.stringify({ ...report, ...measureStageHoldout(stages) }, null, 2) + "\n");
}

void main();
