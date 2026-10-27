// Server-only orchestration: intent is completed before any artwork is selected.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
import { recordExperienceTiming } from "./experience-analytics";

export interface CurationRecord {
  schemaVersion: 1; recipeVersion: typeof CURATION_RECIPE_VERSION;
  releaseVersion: string; query: string; plan: CurationIntentPlan;
  assignments: StageAssignment[]; retrievalModel: string; dimensions: number;
  intentModel: string; indexChecksum: string; degraded: string[];
  selectionVersion?: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  visualEvidenceVersion?: string;
  appearanceVersion?: string;
  narrativeVersion?: "gallery-guide-v2" | "gallery-guide-v3" | typeof NARRATIVE_RECIPE_VERSION;
}
export interface CuratedExhibition extends SemanticSelection { curationId: string; record: CurationRecord }
export const curationRoot = (catalog: WebReleaseCatalog): string => path.resolve(catalog.releaseDir, "../../..");
export const curationDirectory = (rootDir: string): string => runtimeDirectories(rootDir).curations;
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
  return { ...materializeCurationSelection(catalog, record.query, plan, record.assignments, record.retrievalModel, record.dimensions), curationId, record };
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
  retrievalTimeoutMs?: number;
}): Promise<CuratedExhibition> {
  const { catalog } = input;
  const query = input.query.normalize("NFKC").trim();
  if (!query || query.length > 1000) throw new TypeError("Curation request must contain 1–1000 characters");
  const rootDir = input.rootDir ?? curationRoot(catalog);
  if (input.curationId) return readSavedCuration(catalog, input.curationId, query, rootDir);
  const config = input.stream ? undefined : readCurationChatConfig(rootDir);
  const stream = input.stream ?? (config && createCurationChatStream(config));
  const intentModel = input.intentModel ?? config?.model ?? "local-rules-v1";
  const indexChecksum = catalog.manifest.shards.semanticEmbeddings?.[0]?.checksum ?? "hash-only";
  const key = semanticFingerprint(JSON.stringify({ recipe: CURATION_RECIPE_VERSION, selectionVersion: 12, narrativeVersion: NARRATIVE_RECIPE_VERSION, visualEvidenceVersion: catalog.visualEvidenceVersion, appearanceVersion: catalog.appearanceVersion, release: catalog.releaseVersion, query, intentModel, indexChecksum }));
  const directory = curationDirectory(rootDir);
  const lookup = path.join(directory, `request-${key}.json`);
  if (existsSync(lookup)) {
    try { return readSavedCuration(catalog, JSON.parse(readFileSync(lookup, "utf8")) as string, query, rootDir); } catch { /* Recompute a damaged lookup; existing URLs fail explicitly. */ }
  }
  const pendingKey = `${rootDir}:${key}`;
  const previous = inFlight.get(pendingKey);
  if (previous) return previous;
  const run = async (): Promise<CuratedExhibition> => {
    const degraded: string[] = [];
    let encoder = input.encoder ?? encoders.get(rootDir);
    if (!encoder && indexChecksum !== "hash-only") { encoder = createLocalSemanticEncoder({ rootDir }); encoders.set(rootDir, encoder); }
    // Prepare model weights while intent is being understood; selection still
    // starts only after the validated plan has arrived.
    const modelStartedAt = performance.now();
    const warmed = (encoder ? input.encoder ? encoder.warmup?.() : prepareCurationRuntime(rootDir) : undefined)?.then(() => true, () => false)
      .finally(() => recordExperienceTiming("semantic-model", performance.now() - modelStartedAt, catalog.releaseVersion));
    const intentStartedAt = performance.now();
    let plan: CurationIntentPlan;
    try {
      if (!stream) throw new Error("Intent provider unavailable");
      plan = await generateCurationIntent(query, stream);
    } catch { plan = fallbackCurationIntent(catalog, query); degraded.push("intent-unavailable"); }
    recordExperienceTiming("intent", performance.now() - intentStartedAt, catalog.releaseVersion);
    const retrievalStartedAt = performance.now();
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
      return selectForCurationStages({ catalog, query, plan, semantic: { index, queries } });
      })(), input.retrievalTimeoutMs ?? 8_000);
    } catch { selection = selectForCurationStages({ catalog, query, plan }); degraded.push("semantic-unavailable"); }
    recordExperienceTiming("semantic-retrieval", performance.now() - retrievalStartedAt, catalog.releaseVersion);
    const record: CurationRecord = { schemaVersion: 1, recipeVersion: CURATION_RECIPE_VERSION, releaseVersion: catalog.releaseVersion,
      query, plan, selectionVersion: 12, narrativeVersion: NARRATIVE_RECIPE_VERSION, visualEvidenceVersion: catalog.visualEvidenceVersion, appearanceVersion: catalog.appearanceVersion, assignments: selection.assignments, retrievalModel: selection.search.model, dimensions: selection.search.dimensions,
      intentModel: degraded.includes("intent-unavailable") ? "local-rules-v1" : intentModel, indexChecksum, degraded };
    const curationId = semanticFingerprint(JSON.stringify(record));
    mkdirSync(directory, { recursive: true });
    try { writeFileSync(path.join(directory, `${curationId}.json`), JSON.stringify(record), { flag: "wx", mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    // A transient failure must not poison future requests for the same feeling.
    if (!degraded.length) writeFileSync(lookup, JSON.stringify(curationId), { mode: 0o600 });
    return hydrate(catalog, curationId, record, query);
  };
  const pending = run().finally(() => inFlight.delete(pendingKey));
  inFlight.set(pendingKey, pending);
  return pending;
}
