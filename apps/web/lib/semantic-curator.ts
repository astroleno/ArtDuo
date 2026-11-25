// Server-only orchestration: intent is completed before any artwork is selected.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CURATION_RECIPE_VERSION, parseCurationIntentPlan, type CurationIntentPlan } from "@artduo/contracts";
import { createLocalSemanticEncoder, type SemanticEncoder } from "@artduo/corpus/src/local-semantic-provider";
import { sameSemanticSpace, semanticArtworkText, semanticFingerprint } from "@artduo/corpus/src/semantic-index";
import { loadSemanticIndex } from "@artduo/corpus/src/semantic-loader";
import { createCurationChatStream, readCurationChatConfig, type ChatStream } from "../../api/src/services/curation/chat-provider";
import { generateCurationIntent, requestedArtworkCount } from "../../api/src/services/curation/intent-planner";
import { NARRATIVE_RECIPE_VERSION } from "../../api/src/services/curation/exhibition-narrative";
import { runtimeDirectories } from "../../api/src/runtime/environment";
import { fallbackCurationIntent, materializeCurationSelection, selectForCurationStages, type SemanticSelection, type StageAssignment } from "./semantic-selection";
import type { WebReleaseCatalog } from "./release-catalog";
import { experienceObservability, recordServerExperienceTiming } from "./experience-observability";
import { requestStageRerank } from "./stage-rerank";
import { withCurationVisualCorrections } from "./curation-visual-corrections";
import { refineAfterglow } from "./afterglow-selection";

export const VISUAL_CORRECTION_SELECTION_VERSION = 19;
export const PEOPLE_EXCLUSION_SELECTION_VERSION = 22;
const SELECTION_VERSION = 23;

export interface CurationRecord {
  schemaVersion: 1; recipeVersion: typeof CURATION_RECIPE_VERSION;
  releaseVersion: string; query: string; plan: CurationIntentPlan;
  assignments: StageAssignment[]; retrievalModel: string; dimensions: number;
  intentModel: string; indexChecksum: string; degraded: string[];
  selectionVersion?: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | typeof VISUAL_CORRECTION_SELECTION_VERSION | 20 | 21 | typeof PEOPLE_EXCLUSION_SELECTION_VERSION | typeof SELECTION_VERSION;
  visualEvidenceVersion?: string;
  appearanceVersion?: string;
  narrativeVersion?: "gallery-guide-v2" | "gallery-guide-v3" | typeof NARRATIVE_RECIPE_VERSION;
}
export interface CuratedExhibition extends SemanticSelection { curationId: string; record: CurationRecord }
export const curationRoot = (catalog: WebReleaseCatalog): string => path.resolve(catalog.releaseDir, "../../..");
export const curationDirectory = (rootDir: string): string => runtimeDirectories(rootDir).curations;

const RECENT_EXHIBITIONS = 40;
const RECENT_SCAN_LIMIT = 5_000;

/** Counts how often each work appeared in the newest saved exhibitions of one release. */
export function recentArtworkExposure(rootDir: string, releaseVersion: string, limit = RECENT_EXHIBITIONS): Map<string, number> {
  const exposure = new Map<string, number>();
  try {
    const directory = curationDirectory(rootDir);
    const files = readdirSync(directory).filter((name) => /^[a-f0-9]{64}\.json$/u.test(name)).slice(0, RECENT_SCAN_LIMIT)
      .map((name) => ({ file: path.join(directory, name), at: statSync(path.join(directory, name)).mtimeMs }))
      .sort((a, b) => b.at - a.at);
    let counted = 0;
    for (const { file } of files) {
      if (counted >= limit) break;
      const record = JSON.parse(readFileSync(file, "utf8")) as { releaseVersion?: unknown; assignments?: Array<{ artworkId?: unknown }> };
      if (record.releaseVersion !== releaseVersion || !Array.isArray(record.assignments)) continue;
      counted++;
      for (const { artworkId } of record.assignments) if (typeof artworkId === "string") exposure.set(artworkId, (exposure.get(artworkId) ?? 0) + 1);
    }
  } catch { /* Rotation is a preference; unreadable history means no rotation. */ }
  return exposure;
}
// Instrumentation and page bundles have separate module caches. Share the
// native session process-wide, while keeping each project's data isolated.
const processRuntime = globalThis as typeof globalThis & {
  __artduoCurationRuntime?: { encoders: Map<string, SemanticEncoder>; warmups: Map<string, Promise<void>> };
};
const runtime = processRuntime.__artduoCurationRuntime ??= { encoders: new Map(), warmups: new Map() };
const encoders = runtime.encoders;
const inFlight = new Map<string, Promise<CuratedExhibition>>();

/** Prepare the installed local model before accepting a visitor's first query. */
export function prepareCurationRuntime(rootDir: string, testEncoder?: SemanticEncoder): Promise<void> {
  const previous = runtime.warmups.get(rootDir);
  if (previous) return previous;
  let encoder = encoders.get(rootDir);
  if (!encoder) { encoder = testEncoder ?? createLocalSemanticEncoder({ rootDir }); encoders.set(rootDir, encoder); }
  const ready = Promise.resolve().then(() => encoder!.warmup?.()).catch(error => {
    runtime.warmups.delete(rootDir);
    throw error;
  });
  runtime.warmups.set(rootDir, ready);
  return ready;
}

async function withinRetrievalDeadline<T>(job: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([job, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Semantic retrieval deadline exceeded")), timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}

function hydrate(catalog: WebReleaseCatalog, curationId: string, value: unknown, query?: string): CuratedExhibition {
  const record = value as CurationRecord;
  if (!record || record.schemaVersion !== 1 || record.recipeVersion !== CURATION_RECIPE_VERSION
    || record.releaseVersion !== catalog.releaseVersion || typeof record.query !== "string" || !record.query.trim() || record.query.length > 1000
    || query !== undefined && record.query !== query || !Array.isArray(record.assignments) || record.assignments.length > 12
    || typeof record.retrievalModel !== "string" || !Number.isInteger(record.dimensions) || record.dimensions < 1 || record.dimensions > 8192
    || !Array.isArray(record.degraded) || record.degraded.some((item) => typeof item !== "string")
    || record.indexChecksum !== (catalog.manifest.shards.semanticEmbeddings?.[0]?.checksum ?? "hash-only")
    || record.assignments.some((item) => !item || !Array.isArray(item.evidence) || item.evidence.some((entry) => typeof entry !== "string"))
    || semanticFingerprint(JSON.stringify(record)) !== curationId) throw new TypeError("Saved curation is invalid or belongs to another request");
  const plan = parseCurationIntentPlan(record.plan);
  const requestedCount = requestedArtworkCount(record.query);
  if (requestedCount !== undefined && plan.artworkCount !== requestedCount) throw new TypeError("Saved curation count does not match the explicit request");
  const scopeEvidence = (record.selectionVersion ?? 0) >= VISUAL_CORRECTION_SELECTION_VERSION;
  const selectionCatalog = scopeEvidence ? withCurationVisualCorrections(catalog) : catalog;
  const intentOptions = { scopedRiverBank: scopeEvidence, scopedPeopleExclusions: (record.selectionVersion ?? 0) >= PEOPLE_EXCLUSION_SELECTION_VERSION };
  return { ...materializeCurationSelection(selectionCatalog, record.query, plan, record.assignments, record.retrievalModel, record.dimensions, intentOptions), curationId, record };
}
export function readSavedCuration(catalog: WebReleaseCatalog, curationId: string, query?: string, rootDir = curationRoot(catalog)): CuratedExhibition {
  if (!/^[a-f0-9]{64}$/u.test(curationId)) throw new TypeError("Invalid curation identity");
  const text = readFileSync(path.join(curationDirectory(rootDir), `${curationId}.json`), "utf8");
  if (text.length > 100_000) throw new TypeError("Saved curation exceeds its size limit");
  return hydrate(catalog, curationId, JSON.parse(text), query);
}

export async function curateExhibition(input: {
  catalog: WebReleaseCatalog; query: string; curationId?: string; rootDir?: string;
  /** Explicit test seams never change the production model identity. */
  stream?: ChatStream; intentModel?: string; encoder?: SemanticEncoder;
  retrievalTimeoutMs?: number; stageChoiceTimeoutMs?: number;
}): Promise<CuratedExhibition> {
  const query = input.query.normalize("NFKC").trim();
  if (!query || query.length > 1000) throw new TypeError("Curation request must contain 1–1000 characters");
  const rootDir = input.rootDir ?? curationRoot(input.catalog);
  const observability = experienceObservability(rootDir);
  if (input.curationId) {
    try {
      const restored = readSavedCuration(input.catalog, input.curationId, query, rootDir);
      observability?.outcome("restore-success");
      return restored;
    } catch (error) {
      observability?.outcome("restore-failure");
      throw error;
    }
  }
  const catalog = withCurationVisualCorrections(input.catalog);
  const config = input.stream ? undefined : readCurationChatConfig(rootDir);
  const stream = input.stream ?? (config && createCurationChatStream(config));
  const intentModel = input.intentModel ?? config?.model ?? "local-rules-v1";
  const indexChecksum = catalog.manifest.shards.semanticEmbeddings?.[0]?.checksum ?? "hash-only";
  const key = semanticFingerprint(JSON.stringify({ recipe: CURATION_RECIPE_VERSION, selectionVersion: SELECTION_VERSION, narrativeVersion: NARRATIVE_RECIPE_VERSION, visualEvidenceVersion: catalog.visualEvidenceVersion, appearanceVersion: catalog.appearanceVersion, release: catalog.releaseVersion, query, intentModel, indexChecksum }));
  const directory = curationDirectory(rootDir);
  const lookup = path.join(directory, `request-${key}.json`);
  if (existsSync(lookup)) {
    try {
      const found = readSavedCuration(input.catalog, JSON.parse(readFileSync(lookup, "utf8")) as string, query, rootDir);
      if (found.record.selectionVersion !== SELECTION_VERSION || found.record.degraded.length) throw new TypeError("Invalid successful curation lookup");
      observability?.outcome("lookup-hit");
      return found;
    } catch { observability?.outcome("lookup-damaged"); }
  }
  const pendingKey = `${rootDir}:${key}`;
  const previous = inFlight.get(pendingKey);
  if (previous) {
    observability?.outcome("pending-join");
    return previous;
  }
  const degraded: string[] = [];
  const freshStartedAt = performance.now();
  observability?.outcome("fresh-started");
  const run = async (): Promise<CuratedExhibition> => {
    let encoder = input.encoder ?? encoders.get(rootDir);
    if (!encoder && indexChecksum !== "hash-only") { encoder = createLocalSemanticEncoder({ rootDir }); encoders.set(rootDir, encoder); }
    // Prepare model weights while intent is being understood; selection still
    // starts only after the validated plan has arrived.
    const modelStartedAt = performance.now();
    const warmed = (encoder ? input.encoder ? encoder.warmup?.() : prepareCurationRuntime(rootDir) : undefined)?.then(() => true, () => false)
      .finally(() => recordServerExperienceTiming("semantic-model", performance.now() - modelStartedAt, catalog.releaseVersion, rootDir));
    const intentStartedAt = performance.now();
    let plan: CurationIntentPlan;
    try {
      if (!stream) throw new Error("Intent provider unavailable");
      plan = await generateCurationIntent(query, stream);
    } catch { plan = fallbackCurationIntent(catalog, query); degraded.push("intent-unavailable"); }
    recordServerExperienceTiming("intent", performance.now() - intentStartedAt, catalog.releaseVersion, rootDir);
    const retrievalStartedAt = performance.now();
    const recentExposure = recentArtworkExposure(rootDir, catalog.releaseVersion);
    let selection: SemanticSelection;
    try {
      selection = await withinRetrievalDeadline((async () => {
      const index = loadSemanticIndex({ manifestPath: catalog.manifestPath, manifest: catalog.manifest,
        artworks: catalog.artworkRecords.map((artwork) => ({ id: artwork.id, text: semanticArtworkText({ ...artwork.metadata, description: artwork.metadata.descriptionClean ?? artwork.metadata.storySnippet }) })) });
      if (!index) throw new Error("Semantic index unavailable");
      if (!encoder) { encoder = createLocalSemanticEncoder({ rootDir }); encoders.set(rootDir, encoder); }
      if (warmed && !await warmed) throw new Error("Semantic model could not be prepared");
      if (!sameSemanticSpace(index.model, encoder.model)) throw new TypeError("Query and document encoders must share one semantic identity");
      const queries = await encoder.embedQueries(plan.stages.map((stage) => stage.query));
      return selectForCurationStages({ catalog, query, plan, semantic: { index, queries }, recentExposure });
      })(), input.retrievalTimeoutMs ?? 8_000);
    } catch { selection = selectForCurationStages({ catalog, query, plan, recentExposure }); degraded.push("semantic-unavailable"); }
    recordServerExperienceTiming("semantic-retrieval", performance.now() - retrievalStartedAt, catalog.releaseVersion, rootDir);
    const pools = selection.stagePools;
    let rerankStatus: "skip" | "accepted" | "rejected" | "unavailable" = "skip";
    if (stream && pools && !degraded.includes("intent-unavailable")) {
      // The model reads observed image facts to choose within each stage's admitted pool.
      const choiceStartedAt = performance.now();
      const choice = await requestStageRerank({ catalog, plan, assignments: selection.assignments, pools, stream, timeoutMs: input.stageChoiceTimeoutMs ?? 10_000 });
      rerankStatus = choice.status;
      if (choice.status === "accepted") {
        try {
          const original = choice.assignments.every((item, index) => selection.assignments[index]?.artworkId === item.artworkId);
          selection = materializeCurationSelection(catalog, query, plan, choice.assignments, selection.search.model, selection.search.dimensions, { scopedRiverBank: true });
          observability?.outcome(original ? "rerank-accepted-original" : "rerank-accepted-changed");
        }
        catch { rerankStatus = "rejected"; }
      }
      if (rerankStatus !== "skip") recordServerExperienceTiming("stage-choice", performance.now() - choiceStartedAt, catalog.releaseVersion, rootDir);
    }
    if (rerankStatus === "rejected") degraded.push("stage-choice-invalid");
    if (rerankStatus === "unavailable") degraded.push("stage-choice-unavailable");
    observability?.outcome(rerankStatus === "skip" ? "rerank-skipped" : `rerank-${rerankStatus}`);
    const ending = pools && refineAfterglow({ catalog, query, plan, assignments: selection.assignments, pools });
    if (ending) selection = materializeCurationSelection(catalog, query, plan, ending, selection.search.model, selection.search.dimensions, { scopedRiverBank: true });
    const record: CurationRecord = { schemaVersion: 1, recipeVersion: CURATION_RECIPE_VERSION, releaseVersion: catalog.releaseVersion,
      query, plan, selectionVersion: SELECTION_VERSION, narrativeVersion: NARRATIVE_RECIPE_VERSION, visualEvidenceVersion: catalog.visualEvidenceVersion, appearanceVersion: catalog.appearanceVersion, assignments: selection.assignments, retrievalModel: selection.search.model, dimensions: selection.search.dimensions,
      intentModel: degraded.includes("intent-unavailable") ? "local-rules-v1" : intentModel, indexChecksum, degraded };
    const curationId = semanticFingerprint(JSON.stringify(record));
    mkdirSync(directory, { recursive: true });
    try { writeFileSync(path.join(directory, `${curationId}.json`), JSON.stringify(record), { flag: "wx", mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    // A transient failure must not poison future requests for the same feeling.
    if (!degraded.length) writeFileSync(lookup, JSON.stringify(curationId), { mode: 0o600 });
    return hydrate(catalog, curationId, record, query);
  };
  const complete = (success: boolean, empty = false) => {
    observability?.finishFresh(success, degraded, empty);
    recordServerExperienceTiming("fresh-curation", performance.now() - freshStartedAt, catalog.releaseVersion, rootDir);
  };
  const pending = run().then(result => { complete(true, !result.assignments.length); return result; }, error => { complete(false); throw error; })
    .finally(() => inFlight.delete(pendingKey));
  inFlight.set(pendingKey, pending);
  return pending;
}
