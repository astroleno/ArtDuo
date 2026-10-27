import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createCurationChatStream, readCurationChatConfig, type ChatStream } from "../../api/src/services/curation/chat-provider";
import { fallbackExhibitionNarrative, generateExhibitionNarrative, narrativePieceKey, NARRATIVE_RECIPE_VERSION, validateExhibitionNarrativePiece,
  type DeliveredNarrativePiece, type ExhibitionNarrativeInput } from "../../api/src/services/curation/exhibition-narrative";
import { curationDirectory, curationRoot, type CuratedExhibition } from "./semantic-curator";
import type { WebReleaseCatalog } from "./release-catalog";
import type { CurationNarrative } from "./curation-narrative";
import { parseViewingIntent, viewingIntentDecision, viewingIntentEvidence, viewingFocusEvidence } from "./viewing-intent";

export function curationNarrativeView(catalog: WebReleaseCatalog, curation: CuratedExhibition) {
  const saved = readNarrativeCache(catalog, curation);
  const pieces = saved?.pieces ?? fallbackExhibitionNarrative(exhibitionNarrativeInput(catalog, curation));
  const narrative: CurationNarrative = {
    title: `${curation.record.plan.stages[0].label}，再慢慢看`,
    preface: pieces.find((piece) => piece.kind === "preface")!.text,
    closing: pieces.find((piece) => piece.kind === "closing")!.text,
    growthForm: curation.growthForm,
    intentSignals: [...new Set(curation.record.plan.stages.flatMap((stage) => stage.signals))],
    curve: curation.growthForm.stages.map((stage) => ({ label: stage.label, tone: stage.signals[0]?.value ?? "quiet", intensity: stage.intensity })),
  };
  return { pieces, narrative, complete: Boolean(saved && (saved.retryAfter === 0 || saved.retryAfter > Date.now())) || curation.assignments.length === 0 };
}

export function exhibitionNarrativeInput(catalog: WebReleaseCatalog, curation: CuratedExhibition): ExhibitionNarrativeInput {
  const intent = parseViewingIntent(curation.record.query, catalog.artworks.flatMap(artwork => artwork.artistDisplayName ? [artwork.artistDisplayName] : []));
  return { query: curation.record.query, plan: curation.record.plan,
    requirements: { subjects: intent.subjects, excludedSubjects: intent.excludedSubjects, media: intent.media, excludedMedia: intent.excludedMedia, spacious: intent.spacious, artists: intent.artists, excludedArtists: intent.excludedArtists },
    viewingFocus: intent.focuses?.length ? intent.focuses.map(topic => ({ topic, label: topic === "hands" ? "手部与手势" : "道路",
      evidenceIds: curation.assignments.filter(item => viewingFocusEvidence(catalog.artworkById.get(item.artworkId)!, intent).some(focus => focus.topic === topic)).map(item => item.artworkId) })) : undefined,
    artworks: curation.assignments.map((item) => {
    const artwork = catalog.artworkById.get(item.artworkId)!;
    if (!artwork || !viewingIntentDecision(artwork, intent).matches) throw new TypeError("Narrative selection no longer satisfies its explicit requirements");
    const description = curation.record.narrativeVersion === NARRATIVE_RECIPE_VERSION && artwork.visualEvidence
      ? undefined : artwork.description ?? artwork.storySnippet;
    return { id: artwork.id, title: artwork.title, artist: artwork.artistDisplayName, date: artwork.yearLabel, medium: artwork.medium,
      visualObservation: artwork.visualEvidence ? { text: artwork.visualEvidence.observation, imageSha256: artwork.visualEvidence.imageSha256, source: "local-image-review" as const, facts: artwork.visualEvidence.facts, spatialFraming: artwork.visualEvidence.spatialFraming } : undefined,
      selectionEvidence: viewingIntentEvidence(artwork, intent),
      description: description && !/Strong\s+.+\s+fit with usable image and title signal/iu.test(description) ? description.slice(0, 1600) : undefined,
      stageIndex: item.stageIndex, editorialMoods: artwork.moodTags, editorialPalette: artwork.colorTags, editorialComposition: artwork.compositionTags };
  }) };
}
interface NarrativeRun { pieces: DeliveredNarrativePiece[]; listeners: Set<(piece: DeliveredNarrativePiece) => void>; issues: Array<{ key: string; reason: string }>; complete: Promise<void> }
// Next's page and route bundles must observe the same in-flight generation.
const narrativeRuntime = globalThis as typeof globalThis & { __artduoNarrativeRuns?: Map<string, NarrativeRun> };
const runs = narrativeRuntime.__artduoNarrativeRuns ??= new Map<string, NarrativeRun>();
const inputIdentity = (catalog: WebReleaseCatalog, curation: CuratedExhibition) => createHash("sha256").update(JSON.stringify(exhibitionNarrativeInput(catalog, curation))).digest("hex").slice(0, 24);
const narrativeFilename = (catalog: WebReleaseCatalog, curation: CuratedExhibition) => path.join(curationDirectory(curationRoot(catalog)), `${curation.curationId}.narrative-v5-${inputIdentity(catalog, curation)}.json`);

function narrativeFilenames(catalog: WebReleaseCatalog, curation: CuratedExhibition, version: 4 | 5): string[] {
  const input = exhibitionNarrativeInput(catalog, curation);
  const directory = curationDirectory(curationRoot(catalog));
  const filename = (identity: string) => path.join(directory, `${curation.curationId}.narrative-v${version}-${identity}.json`);
  const filenames = [filename(inputIdentity(catalog, curation))];
  if (input.artworks.some(artwork => catalog.artworkById.get(artwork.id)?.displayCredits)) {
    // A verified role correction does not discard truthful prose from a frozen
    // exhibit. Only the former author string may differ; all other input facts
    // must still have exactly the same fingerprint, then pass current guards.
    const previousInput = { ...input, artworks: input.artworks.map(artwork => ({ ...artwork,
      artist: catalog.artworkRecordById.get(artwork.id)?.metadata.artistDisplayName ?? artwork.artist,
    })) };
    const previousIdentity = createHash("sha256").update(JSON.stringify(previousInput)).digest("hex").slice(0, 24);
    filenames.push(filename(previousIdentity));
  }
  return [...new Set(filenames)];
}

interface NarrativeCache { schemaVersion: 1; recipe: string; pieces: DeliveredNarrativePiece[]; attempts: number; retryAfter: number; issues: Array<{ key: string; reason: string }> }

function readNarrativeCache(catalog: WebReleaseCatalog, curation: CuratedExhibition): NarrativeCache | undefined {
  const input = exhibitionNarrativeInput(catalog, curation);
  const fallback = fallbackExhibitionNarrative(input);
  const filenames = [...narrativeFilenames(catalog, curation, 5), ...(curation.record.narrativeVersion ? [] : narrativeFilenames(catalog, curation, 4))];
  for (const filename of filenames) {
    if (!existsSync(filename)) continue;
    try {
    const raw = readFileSync(filename, "utf8");
    if (raw.length > 50_000) continue;
    const decoded = JSON.parse(raw);
    const value: NarrativeCache = filename.includes(".narrative-v4-")
      ? { schemaVersion: 1, recipe: "legacy-v4", pieces: decoded, attempts: 1, retryAfter: 0, issues: [] } : decoded;
    if (!value || value.schemaVersion !== 1 || ![NARRATIVE_RECIPE_VERSION, "gallery-guide-v2", "legacy-v4"].includes(value.recipe)
      || !Array.isArray(value.pieces) || value.pieces.length !== fallback.length || !Number.isFinite(value.retryAfter) || value.retryAfter < 0
      || !Number.isInteger(value.attempts) || value.attempts < 1) continue;
    let invalidPiece = false;
    const pieces = value.pieces.map((item, index): DeliveredNarrativePiece => {
      if (item?.source === "fallback" && value.recipe !== "legacy-v4") {
        if (narrativePieceKey(item) !== narrativePieceKey(fallback[index]!)) throw new TypeError("Invalid saved fallback");
        // Regenerate failure copy from current facts; never display stored text.
        return fallback[index]!;
      }
      if (item?.source !== "grounded" || narrativePieceKey(item) !== narrativePieceKey(fallback[index]!)) throw new TypeError("Invalid saved narrative");
      try { return { ...validateExhibitionNarrativePiece(item, input), source: "grounded" }; }
      catch { invalidPiece = true; return fallback[index]!; }
    });
    if (!invalidPiece && pieces.some(piece => piece.source === "fallback") && value.retryAfter === 0) continue;
    return { ...value, pieces, retryAfter: invalidPiece ? 1 : value.retryAfter, issues: Array.isArray(value.issues) ? value.issues.slice(0, 20) : [] };
    } catch { /* Try only the specifically bound former author identity. */ }
  }
  return undefined;
}

/** Only a wholly validated model response is called complete by this compatibility API. */
export function readNarrativePieces(catalog: WebReleaseCatalog, curation: CuratedExhibition): DeliveredNarrativePiece[] | undefined {
  const saved = readNarrativeCache(catalog, curation);
  return saved?.pieces.every(piece => piece.source === "grounded") ? saved.pieces : undefined;
}

export function getExhibitionNarrative(catalog: WebReleaseCatalog, curation: CuratedExhibition, deps: { stream?: ChatStream; now?: () => number } = {}): NarrativeRun {
  const rootDir = curationRoot(catalog);
  const key = `${curationDirectory(rootDir)}:${curation.curationId}:${inputIdentity(catalog, curation)}`;
  const existing = runs.get(key);
  if (existing) return existing;
  const saved = readNarrativeCache(catalog, curation);
  const now = deps.now ?? Date.now;
  if (saved && (saved.retryAfter === 0 || saved.retryAfter > now())) return { pieces: saved.pieces, listeners: new Set(), issues: saved.issues, complete: Promise.resolve() };
  const run: NarrativeRun = { pieces: [], listeners: new Set(), issues: [], complete: Promise.resolve() };
  const deliver = (piece: DeliveredNarrativePiece) => {
    run.pieces.push(piece);
    for (const listener of run.listeners) listener(piece);
  };
  runs.set(key, run);
  run.complete = Promise.resolve().then(async () => {
    const input = exhibitionNarrativeInput(catalog, curation);
    const fallback = fallbackExhibitionNarrative(input);
    const available = new Map(saved?.pieces.filter(piece => piece.source === "grounded").map(piece => [narrativePieceKey(piece), piece]));
    const expected = fallback.map(narrativePieceKey);
    let cursor = 0;
    const drain = () => { while (cursor < expected.length && available.has(expected[cursor]!)) deliver(available.get(expected[cursor++]!)!); };
    drain();
    try {
      if (!input.artworks.length) throw new Error("No exhibited artworks to narrate");
      const config = deps.stream ? undefined : readCurationChatConfig(rootDir);
      const stream = deps.stream ?? (config && createCurationChatStream(config));
      if (!stream) throw new Error("Narrative provider unavailable");
      const missing = expected.filter(key => !available.has(key));
      for await (const piece of generateExhibitionNarrative(input, stream, undefined, (key, reason) => run.issues.push({ key, reason }), saved ? missing : undefined, saved?.issues)) {
        available.set(narrativePieceKey(piece), { ...piece, source: piece.source ?? "grounded" }); drain();
      }
    } catch (error) { run.issues.push({ key: "transport", reason: error instanceof Error ? error.message : "Narrative interrupted" }); }
    for (const piece of fallback) if (!available.has(narrativePieceKey(piece))) available.set(narrativePieceKey(piece), piece);
    drain();
    const filename = narrativeFilename(catalog, curation);
    const temporary = `${filename}.${randomUUID()}.tmp`;
    const attempts = (saved?.attempts ?? 0) + 1;
    const cache: NarrativeCache = { schemaVersion: 1, recipe: NARRATIVE_RECIPE_VERSION, pieces: run.pieces, attempts,
      retryAfter: run.pieces.every(piece => piece.source === "grounded") ? 0 : now() + Math.min(3_600_000, 60_000 * 2 ** Math.min(attempts - 1, 6)), issues: run.issues };
    try {
      mkdirSync(path.dirname(filename), { recursive: true });
      writeFileSync(temporary, JSON.stringify(cache), { flag: "wx", mode: 0o600 });
      renameSync(temporary, filename);
    } catch { run.issues.push({ key: "persistence", reason: "Narrative could not be saved" }); }
    finally { try { if (existsSync(temporary)) unlinkSync(temporary); } catch { /* Only our own incomplete write is eligible for cleanup. */ } }
  }).finally(() => { runs.delete(key); });
  return run;
}
