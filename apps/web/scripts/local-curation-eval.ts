// Local synthetic diagnostics only. The evaluator owns all state it reads/writes.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseCurationIntentPlan, type CurationIntentPlan } from "@artduo/contracts";
import { createLocalSemanticEncoder, type SemanticEncoder } from "@artduo/corpus/src/local-semantic-provider";
import { sameSemanticSpace, semanticArtworkText } from "@artduo/corpus/src/semantic-index";
import { loadSemanticIndex } from "@artduo/corpus/src/semantic-loader";
import type { ChatStream } from "../../api/src/services/curation/chat-provider";
import { defaultAnalyticsSink } from "../lib/analytics";
import { refineAfterglow } from "../lib/afterglow-selection";
import { withCurationVisualCorrections } from "../lib/curation-visual-corrections";
import { loadWebReleaseCatalog } from "../lib/release-catalog";
import { curateExhibition, curationDirectory } from "../lib/semantic-curator";
import { eligibleCurationArtworks, fallbackCurationIntent, selectForCurationStages } from "../lib/semantic-selection";
import { parseViewingIntent } from "../lib/viewing-intent";

const rootDir = path.resolve(__dirname, "../../..");
const releaseVersion = process.argv.find(arg => arg.startsWith("--release="))?.slice(10) ?? "2026-11-19-open-gap-739";
const variant = {
  normal: { intent: "fixed", semantic: "local", rerank: "accepted" },
  "intent-unavailable": { intent: "throw", semantic: "local", rerank: "not attempted" },
  "semantic-unavailable": { intent: "fixed", semantic: "missing local encoder", rerank: "accepted" },
  "semantic-timeout": { intent: "fixed", semantic: "stalled query batch", rerank: "accepted" },
  "stage-choice-unavailable": { intent: "fixed", semantic: "local", rerank: "throw" },
  "stage-choice-invalid": { intent: "fixed", semantic: "local", rerank: "invalid response" },
} as const;
type Scenario = keyof typeof variant;
const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

function acceptedChoice(prompt: string) {
  const rows: Array<{ stage: number; count: number; artworkIds: string[] }> = [];
  for (const line of prompt.split("\n")) {
    const match = /^stage (\d+) 选 (\d+) 件：/u.exec(line);
    if (match) rows.push({ stage: Number(match[1]), count: Number(match[2]), artworkIds: [] });
    if (line.startsWith("  候选 ")) {
      const row = rows.at(-1)!;
      if (row.artworkIds.length < row.count) row.artworkIds.push(JSON.parse(line.slice("  候选 ".length)).id);
    }
  }
  assert.ok(rows.length > 0 && rows.every(row => row.artworkIds.length === row.count));
  return { stages: rows.map(({ stage, artworkIds }) => ({ stage, artworkIds })) };
}

async function main() {
  delete process.env.ARTDUO_TIMING_DIAGNOSTICS;
  process.env.ARTDUO_MEDIA_MODE = "local";
  globalThis.fetch = async () => { throw new Error("Network disabled for local synthetic diagnostics"); };
  const temporary = mkdtempSync(path.join(os.tmpdir(), "artduo-local-curation-eval-"));
  const actualEncoder = createLocalSemanticEncoder({ rootDir, allowDownload: false });
  try {
    const catalog = withCurationVisualCorrections(loadWebReleaseCatalog({ rootDir, releaseVersion }));
    const index = loadSemanticIndex({ manifestPath: catalog.manifestPath, manifest: catalog.manifest,
      artworks: catalog.artworkRecords.map(artwork => ({ id: artwork.id, text: semanticArtworkText({
        ...artwork.metadata, description: artwork.metadata.descriptionClean ?? artwork.metadata.storySnippet,
      }) })) });
    if (!index || !sameSemanticSpace(index.model, actualEncoder.model)) throw new Error("Installed release requires its matching cached encoder and vectors");
    const raw = readFileSync(path.join(__dirname, "../test/fixtures/stage-fit-plans.json"));
    const plans = JSON.parse(raw.toString()) as Record<string, unknown>;
    const query = Object.keys(plans).find(key => key.startsWith("最近一直在硬撑"))!;
    const fixedPlan = parseCurationIntentPlan(plans[query]);
    const allowedFor = (query: string, plan: CurationIntentPlan) => new Set(
      eligibleCurationArtworks(catalog, query, plan, { scopedRiverBank: true }).map(artwork => artwork.id));
    const artists = catalog.artworks.flatMap(artwork => artwork.artistDisplayName ? [artwork.artistDisplayName] : []);
    const hardExclusions = (query: string) => parseViewingIntent(query, artists, { scopedRiverBank: true });
    const inspect = (artworkIds: string[], allowed: ReadonlySet<string>) => {
      assert.ok(artworkIds.every(id => allowed.has(id)));
      assert.equal(new Set(artworkIds).size, artworkIds.length);
      return { eligibleWorks: allowed.size, assignedWorks: artworkIds.length, allAssignmentsAllowed: true };
    };
    const cases: {
      scenario: Scenario;
      configured: typeof variant[Scenario];
      counts: Record<string, number>;
      timingPhases: Record<string, number>;
      observed: { intentModel: string; retrievalModel: string; rerankApplied: boolean; degraded: string[] };
      eligibleWorks: number;
      assignedWorks: number;
      allAssignmentsAllowed: boolean;
      requestedWorks: number;
      candidateCountsByStage: number[];
      candidateCountMethod: string;
      recordSaved: boolean;
      savedRestore: { sameRecord: boolean; additionalIntentCalls: number; additionalRerankCalls: number; additionalEncoderCalls: number };
    }[] = [];
    for (const name of Object.keys(variant) as Scenario[]) {
      process.env.ARTDUO_STATE_DIR = path.join(temporary, name);
      const counts = { intent: 0, rerank: 0, encoderWarmup: 0, encoderQueryBatches: 0, encoderQueryTexts: 0 };
      const backend = name === "semantic-unavailable" ? createLocalSemanticEncoder({ rootDir: path.join(temporary, "no-model"), allowDownload: false }) : actualEncoder;
      let vectors: number[][] | undefined;
      let cancelStall: (() => void) | undefined;
      const encoder: SemanticEncoder = { ...backend,
        async warmup() { counts.encoderWarmup++; await backend.warmup?.(); },
        async embedQueries(texts) {
          counts.encoderQueryBatches++;
          counts.encoderQueryTexts += texts.length;
          if (name === "semantic-timeout") return new Promise((_, reject) => { cancelStall = () => reject(new Error("Release synthetic stalled query")); });
          vectors = await backend.embedQueries(texts);
          return vectors;
        },
      };
      const stream: ChatStream = async function* (messages) {
        if (!messages[0]!.content.includes("选画编辑")) {
          counts.intent++;
          if (name === "intent-unavailable") throw new Error("Synthetic intent interruption");
          yield JSON.stringify(fixedPlan);
          return;
        }
        counts.rerank++;
        if (name === "stage-choice-unavailable") throw new Error("Synthetic rerank interruption");
        yield JSON.stringify(name === "stage-choice-invalid" ? { stages: [] } : acceptedChoice(messages[1]!.content));
      };
      const startEvent = defaultAnalyticsSink.events.length;
      const result = await curateExhibition({ rootDir: temporary, catalog, query, encoder, stream, intentModel: "local-fixed-stream-fixture",
        ...(name === "semantic-timeout" ? { retrievalTimeoutMs: 100 } : {}) });
      cancelStall?.();
      if (backend !== actualEncoder) await backend.dispose();
      const timingPhases = Object.fromEntries([...new Set(defaultAnalyticsSink.events.slice(startEvent).map(event => event.properties.phase).filter(Boolean))]
        .map(phase => [phase, defaultAnalyticsSink.events.slice(startEvent).filter(event => event.name === "experience.performance" && event.properties.phase === phase).length]));
      const { record, assignments } = result;
      const measuredPlan = record.plan;
      const expectedReason = ["intent-unavailable", "semantic-unavailable", "stage-choice-unavailable"].includes(name) ? [name]
        : name === "semantic-timeout" ? ["semantic-unavailable"] : [];
      assert.deepEqual(record.degraded, expectedReason);
      if (name === "semantic-timeout") assert.equal(counts.encoderQueryBatches, 1, "deadline must interrupt query retrieval, not initial model preparation");
      assert.equal(counts.intent, 1);
      assert.equal(counts.rerank, name === "intent-unavailable" ? 0 : 1);
      const rerankApplied = assignments.some(item => item.evidence.includes("model:stage-fit"));
      assert.equal(rerankApplied, variant[name].rerank === "accepted");
      const seed = selectForCurationStages({ catalog, query, plan: measuredPlan,
        semantic: record.retrievalModel === index.model.id && vectors ? { index, queries: vectors } : undefined });
      const allowed = allowedFor(query, measuredPlan);
      assert.ok((seed.stagePools ?? []).flat().every(item => allowed.has(item.artworkId)));
      const directory = curationDirectory(temporary);
      const recordSaved = existsSync(path.join(directory, `${result.curationId}.json`));
      const beforeRestore = { ...counts };
      const restored = await curateExhibition({ rootDir: temporary, catalog, query, curationId: result.curationId, encoder, stream });
      assert.deepEqual(counts, beforeRestore);
      assert.deepEqual(restored.record, record);
      cases.push({
        scenario: name, configured: variant[name], counts, timingPhases,
        observed: { intentModel: record.intentModel, retrievalModel: record.retrievalModel, rerankApplied, degraded: record.degraded },
        ...inspect(assignments.map(item => item.artworkId), allowed), requestedWorks: measuredPlan.artworkCount,
        candidateCountsByStage: seed.stagePools?.map(pool => pool.length) ?? [],
        candidateCountMethod: "deterministic seed reconstructed with the actual plan and the captured local query vectors or hash fallback",
        recordSaved, savedRestore: { sameRecord: true, additionalIntentCalls: 0, additionalRerankCalls: 0, additionalEncoderCalls: 0 },
      });
    }

    async function replay(intentMode: "fixture" | "rules") {
      const recent: string[][] = [];
      const routes = [];
      for (const [query, rawPlan] of Object.entries(plans)) {
        const plan = intentMode === "fixture" ? parseCurationIntentPlan(rawPlan) : fallbackCurationIntent(catalog, query);
        const queries = await actualEncoder.embedQueries(plan.stages.map(stage => stage.query));
        const recentExposure = new Map<string, number>();
        for (const previous of recent.slice(-40)) for (const id of previous) recentExposure.set(id, (recentExposure.get(id) ?? 0) + 1);
        const seed = selectForCurationStages({ catalog, query, plan, semantic: { index: index!, queries }, recentExposure });
        const ending = seed.stagePools && refineAfterglow({ catalog, query, plan, assignments: seed.assignments, pools: seed.stagePools });
        const assignments = ending ?? seed.assignments;
        const ids = assignments.map(item => item.artworkId);
        recent.push(ids);
        routes.push({ case: routes.length + 1, requestedWorks: plan.artworkCount, ...inspect(ids, allowedFor(query, plan)),
          candidateCountsByStage: seed.stagePools?.map(pool => pool.length) ?? [],
          artworks: assignments.map(({ artworkId, stageIndex }) => ({ artworkId, stageIndex })) });
      }
      return { intentMode, selectionMode: "deterministic rules; local semantic vectors; simulated recent exposure within this group",
        exhibitions: routes.length, assignedWorks: routes.reduce((sum, route) => sum + route.assignedWorks, 0),
        distinctWorks: new Set(recent.flat()).size, emptyRoutes: routes.filter(route => route.assignedWorks === 0).length,
        shortRoutes: routes.filter(route => route.assignedWorks < route.requestedWorks).length, routes };
    }

    const exclusions = hardExclusions(query);
    const reasonCounts = Object.fromEntries([...new Set(cases.flatMap(row => row.observed.degraded))].sort()
      .map(reason => [reason, cases.filter(row => row.observed.degraded.includes(reason)).length]));
    const corpus = { releaseVersion, tunedFixtureSha256: sha(raw), installedReleaseManifestSha256: sha(readFileSync(catalog.manifestPath)), semanticModel: index.model };
    const ruleBaselines = [await replay("fixture"), await replay("rules")];
    process.stdout.write(JSON.stringify({ schemaVersion: 1, corpus,
      scenarios: { observedFreshCases: cases.length, recordedReasonCounts: reasonCounts, excludedSubjects: exclusions.excludedSubjects,
        excludedArtists: exclusions.excludedArtists, excludedMedia: exclusions.excludedMedia, cases },
      ruleBaselines,
      limits: {
        scenarioCounts: "injected synthetic cases; not a production fallback rate. Invalid model payloads can fall back without a recorded reason",
        production: "no authorized production timing distribution or degradation denominator",
        analytics: "the existing default sink is process-local memory; no production timing flag or persistent sink was enabled",
      },
    }, null, 2) + "\n");
  } finally {
    await actualEncoder.dispose();
    rmSync(temporary, { recursive: true, force: true });
  }
}

void main();
