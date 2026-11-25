import { CURATION_RECIPE_VERSION, parseGrowthForm, type CurationIntentPlan, type GrowthForm, type SemanticIndex } from "@artduo/contracts";
import { buildUserAffectAgent, embedText } from "@artduo/corpus";
import { semanticFingerprint } from "@artduo/corpus/src/semantic-index";
import { artworkHardConflict, buildAffectiveGrowthForm } from "./affective-negotiation";
import { artworkOffering, stageFit } from "./artwork-offering";
import { DEPARTMENT_HAND_CAP, handOf } from "./artwork-hand";
import { withCurationVisualCorrections } from "./curation-visual-corrections";
import { STAGE_RERANK_POOL_SIZE, type StageCandidate } from "./stage-rerank";
import { isGalleryArtwork } from "./artwork-eligibility";
import { selectBackgroundScene, type WebArtwork, type WebReleaseCatalog, type WebSearchResult } from "./release-catalog";
import { depictsEvening, hasIntenseContent, matchesViewingIntent, mentionsMorning, parseViewingIntent, prefersRiverBank, reviewedLandscapeFocus, viewingIntentEvidence, viewingFocusEvidence, type ViewingIntentOptions } from "./viewing-intent";
import { requestedArtworkCount } from "../../api/src/services/curation/intent-planner";

export interface StageAssignment { artworkId: string; stageIndex: number; vectorScore: number; score: number; evidence: string[] }
export interface SemanticSelection { search: WebSearchResult; growthForm: GrowthForm; assignments: StageAssignment[];
  /** Fresh selections only: the strongest admitted works per stage, for an optional model choice. */
  stagePools?: StageCandidate[][] }

function exactName(artwork: WebArtwork, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase();
  return normalized.length > 1 && [artwork.title, artwork.artistDisplayName, ...artwork.keywordBoosts].some((name) => name?.toLocaleLowerCase() === normalized);
}
export function fallbackCurationIntent(catalog: WebReleaseCatalog, query: string): CurationIntentPlan {
  const growth = buildAffectiveGrowthForm({ query, results: [], backgroundScenes: catalog.backgroundScenes });
  const intent = parseViewingIntent(query, catalog.artworks.flatMap((artwork) => artwork.artistDisplayName ? [artwork.artistDisplayName] : []), { scopedRiverBank: true });
  return {
    schemaVersion: 1, currentFeeling: "按原句中的明确线索理解", desiredExperience: query.slice(0, 160),
    wantsRelief: intent.rest, pace: intent.rest ? "slow" : "medium", artworkCount: requestedArtworkCount(query) ?? 6,
    stages: growth.stages.map((stage) => ({ ...stage, query: `${stage.signals.map((signal) => signal.value).join(" ")} ${intent.retrievalText}`.slice(0, 240), signals: stage.signals.map((signal) => signal.value) })),
  };
}
export function eligibleCurationArtworks(catalog: WebReleaseCatalog, query: string, plan: CurationIntentPlan, options?: ViewingIntentOptions): WebArtwork[] {
  const intent = parseViewingIntent(query, catalog.artworks.flatMap((artwork) => artwork.artistDisplayName ? [artwork.artistDisplayName] : []), options);
  const normalizedName = query.trim().toLocaleLowerCase();
  const titled = catalog.artworks.filter((artwork) => artwork.title.toLocaleLowerCase() === normalizedName);
  const authored = catalog.artworks.filter((artwork) => artwork.artistDisplayName?.toLocaleLowerCase() === normalizedName);
  const pool = titled.length ? titled : authored.length ? authored : catalog.artworks;
  // Exact catalog requests and explicit difficult subjects take precedence over inferred relief.
  const named = catalog.artworks.some((artwork) => exactName(artwork, query));
  const effective = { ...intent, rest: intent.rest || (plan.wantsRelief && !intent.allowIntense && !named) };
  const affect = buildUserAffectAgent(query);
  const hardSignals = [...affect.resistances.map((signal) => signal.value), ...affect.visualConstraints.filter((item) => item.severity === "hard" && item.polarity === "avoid").map((item) => item.value)];
  return pool.filter((artwork) => isGalleryArtwork(artwork) && matchesViewingIntent(artwork, effective) && !artworkHardConflict(artwork, hardSignals));
}
// Stage queries are atmospheric English. "Breathing room" or "a lit window" names
// a feeling of space or light, not a depicted interior or building.
const FIGURATIVE_STAGE_WORDS = /\b(?:breathing|elbow|head)\s*room\b|\broom\s+(?:to|for)\s+\w+|\bwindows?\b/giu;
export const stageSubjectText = (stageQuery: string): string => stageQuery.replace(FIGURATIVE_STAGE_WORDS, " ").replace(/\bstill[- ]lifes\b/giu, "still life");
const OPEN_STAGE = /\b(?:open|wide|expansive|distant)(?:\s+(?:open|wide|distant))*\s+(?:landscape|horizon|sky|view|vista)/iu;
const STILL_LIFE_INTERIOR_LIST = /\bstill[- ]lifes?\s+and\s+interiors?\b|\binteriors?\s+and\s+still[- ]lifes?\b|静物[和与及]室内|室内[和与及]静物/iu;
const WARM_LIGHT = /(?:暖(?:[黄金褐橙]?色?)|金(?:色|黄色?)|琥珀色)的?(?:窗光|灯光|阳光|日光|天光|光线|光斑|光晕|光(?!泽))|\b(?:warm|golden|amber)(?:\s+(?:soft|window|ambient))*\s+(?:sunlight|daylight|light(?:ing)?|glow)\b|\bwarmly lit\b/iu;
const UNVERIFIED_LIGHT = /未见|无法确认|不能确认|看不清|不明|不确定|没有|缺乏|不要|并非|疑似|\b(?:no|not|without|avoid|unclear|unconfirmed|possibly|appears? to be|might be)\b/iu;

function hasWarmLight(text: string): boolean {
  return text.split(/[，,。；;.!?\n]/u).some((clause) => WARM_LIGHT.test(clause) && !UNVERIFIED_LIGHT.test(clause));
}

function quotasFor(count: number, stages: number): number[] {
  const quotas = Array.from({ length: stages }, () => 0);
  if (count < stages) {
    for (let i = 0; i < count; i++) quotas[count === 1 ? 0 : Math.round(i * (stages - 1) / (count - 1))]++;
  } else {
    quotas.fill(Math.floor(count / stages));
    for (let i = 0; i < count % stages; i++) quotas[Math.floor(stages / 2 + i) % stages]++;
  }
  return quotas;
}
const AFFECT_WEIGHT = 0.22;
const RECENT_PENALTY_STEP = 0.01;
const MIN_STAGE_FIT = 0.55;
const RECENT_PENALTY_CAP = 0.04;

/**
 * Filling stages in order lets an early stage take the work another stage needs
 * most. Swap selected works between stages while the total stage fit improves;
 * the selected set, and therefore every diversity choice, stays unchanged.
 */
function improveStageAssignment(perStage: StageAssignment[][], ranked: Array<Array<{ artwork: WebArtwork; vectorScore: number; score: number; evidence: string[] }>>): void {
  const scored = ranked.map((rows) => new Map(rows.map((row) => [row.artwork.id, row])));
  const value = (stage: number, id: string) => scored[stage]!.get(id)?.score ?? -Infinity;
  for (let round = 0, changed = true; changed && round < 20; round++) {
    changed = false;
    for (let a = 0; a < perStage.length; a++) for (let b = a + 1; b < perStage.length; b++) {
      for (let i = 0; i < perStage[a]!.length; i++) for (let j = 0; j < perStage[b]!.length; j++) {
        const left = perStage[a]![i]!.artworkId, right = perStage[b]![j]!.artworkId;
        if (value(a, right) + value(b, left) <= value(a, left) + value(b, right) + 1e-9) continue;
        const place = (stage: number, id: string): StageAssignment => {
          const row = scored[stage]!.get(id)!;
          return { artworkId: id, stageIndex: stage, vectorScore: row.vectorScore, score: row.score, evidence: row.evidence };
        };
        perStage[a]![i] = place(a, right);
        perStage[b]![j] = place(b, left);
        changed = true;
      }
    }
  }
  for (const stage of perStage) stage.sort((x, y) => y.score - x.score || x.artworkId.localeCompare(y.artworkId));
}

export function selectForCurationStages(input: {
  catalog: WebReleaseCatalog; query: string; plan: CurationIntentPlan;
  semantic?: { index: SemanticIndex; queries: number[][] };
  /** How many recent exhibitions showed each work; fresh but equally fitting works come first. */
  recentExposure?: ReadonlyMap<string, number>;
}): SemanticSelection {
  const { query, plan } = input;
  const catalog = withCurationVisualCorrections(input.catalog);
  const options = { scopedRiverBank: true };
  const eligible = eligibleCurationArtworks(catalog, query, plan, options);
  const semanticRecords = new Map(input.semantic?.index.records.map((record) => [record.artworkId, record.vector]));
  const hashRecords = new Map(catalog.embeddingRecords.map((record) => [record.id, record.vector]));
  const dimensions = input.semantic?.index.model.dimensions ?? catalog.embeddingRecords[0]?.dimensions ?? 256;
  const queries = input.semantic?.queries ?? plan.stages.map((stage) => embedText(stage.query, { dimensions }).vector);
  if (queries.length !== plan.stages.length || queries.some((vector) => vector.length !== dimensions || vector.some((value) => !Number.isFinite(value)))) throw new TypeError("Stage query vectors do not match their index");
  if (!input.semantic && catalog.embeddingRecords.some((record) => record.model !== "local-hash-embedding-v1")) throw new TypeError("Hash fallback requires a separate hash index");
  const intent = parseViewingIntent(query, catalog.artworks.flatMap(artwork => artwork.artistDisplayName ? [artwork.artistDisplayName] : []), options);
  const casual = !intent.allowIntense && !intent.rest && !intent.bright && !intent.spacious
    && !intent.subjects.length && !intent.artists.length && !intent.media?.length && !intent.focuses?.length
    && !intent.artworkTitles?.length && !eligible.some(artwork => exactName(artwork, query));
  const moodRequested = intent.rest || intent.bright;
  const riverBank = prefersRiverBank(query) && !intent.subjects.includes("sea") && !intent.excludedSubjects.includes("water");
  const morningRiverBank = riverBank && mentionsMorning(query);
  const forest = intent.subjects.includes("forest") && !intent.alternativeSubjects;
  const candidates = eligible.map((artwork) => ({ artwork, offering: artworkOffering(artwork),
    riverFit: riverBank && reviewedLandscapeFocus(artwork, "riverbank"), evening: morningRiverBank && depictsEvening(artwork),
    forestFit: forest && reviewedLandscapeFocus(artwork, "forest") }));
  const ranked = plan.stages.map((stage, stageIndex) => {
    const openStage = OPEN_STAGE.test(stage.query);
    const parsedStage = parseViewingIntent(stageSubjectText(stage.query));
    // An open landscape stage cannot also ask for an enclosed room.
    const stageIntent = openStage ? { ...parsedStage, subjects: parsedStage.subjects.filter(subject => subject !== "interior" && subject !== "architecture") } : parsedStage;
    const stillLifeOrInterior = stageIntent.subjects.length === 2 && STILL_LIFE_INTERIOR_LIST.test(stage.query);
    const wantsStillLife = stageIntent.subjects.includes("stillLife");
    const wantsInterior = stageIntent.subjects.includes("interior");
    const warmStage = (wantsStillLife || wantsInterior) && hasWarmLight(stage.query);
    return candidates.map(({ artwork, offering, riverFit, evening, forestFit }) => {
    const vector = (input.semantic ? semanticRecords : hashRecords).get(artwork.id);
    if (!vector || vector.length !== dimensions) throw new TypeError("Missing artwork vector in the selected semantic space");
    const vectorScore = queries[stageIndex].reduce((sum, value, index) => sum + value * vector[index], 0);
    const affectFit = stageFit(offering, stage);
    const tags = new Set([...artwork.moodTags, ...artwork.emotionLabels, ...artwork.colorTags].map((value) => value.toLowerCase()));
    const matched = stage.signals.filter((signal) => tags.has(signal));
    const evidence = viewingIntentEvidence(artwork, intent);
    // A building behind a portrait is weaker architectural evidence than a
    // named building or a reviewed interior. All hard constraints still apply.
    const architectureFocus = !intent.subjects.includes("architecture") ? 0
      : evidence.includes("title-subject:architecture") || evidence.includes("primary-subject:architecture") ? 0.12
      : artwork.visualEvidence?.facts.interior === "present" && artwork.visualEvidence.facts.portrait !== "present" ? 0.08 : 0;
    const detailedFocus = viewingFocusEvidence(artwork, intent);
    const stageSubjects = viewingIntentEvidence(artwork, stageIntent).filter(item => item.startsWith("subject:"));
    const subjectFit = !stageIntent.subjects.length ? 0 : stageIntent.alternativeSubjects || stillLifeOrInterior
      ? Number(stageSubjects.length > 0) : stageSubjects.length / stageIntent.subjects.length;
    const openFit = openStage && artwork.visualEvidence?.spatialFraming === "open";
    const enclosedConflict = openStage && (artwork.visualEvidence?.spatialFraming === "enclosed" || artwork.visualEvidence?.facts.interior === "present");
    const appearance = artwork.appearance;
    const visual = artwork.visualEvidence;
    const warmFit = warmStage && visual && ((wantsStillLife && visual.facts.stillLife === "present") || (wantsInterior && visual.facts.interior === "present"))
      && hasWarmLight(visual.observation);
    // Give measured brightness less weight when the stage specifies warm light.
    const brightFit = intent.bright && appearance
      ? (warmStage ? .5 : 1) * (.12 * (appearance.meanLightness - .45) + .025 * appearance.brightShare + .12 * appearance.chroma
        + .26 * appearance.colorVariation - .22 * appearance.darkShare) : 0;
    // A saturated night scene or its gold frame does not establish bright daylight.
    // Keep night scenes eligible, and honor an explicit request to see one.
    const nightPenalty = intent.bright && !/夜|月|\b(?:night|nocturne|moon\w*)\b/iu.test(query)
      && /夜景|夜色|夜晚|\b(?:nocturne|night|moonlit)\b/iu.test([artwork.title, artwork.visualEvidence?.observation].join(" ")) ? .16 : 0;
    const heavyPenalty = casual && hasIntenseContent(artwork) ? .3 : 0;
    // Rotate among equally fitting works across visitors; never away from a named work or artist.
    const named = exactName(artwork, query) || intent.artists.length > 0 || Boolean(intent.artworkTitles?.length);
    const shown = named ? 0 : input.recentExposure?.get(artwork.id) ?? 0;
    const exposurePenalty = Math.min(RECENT_PENALTY_CAP, shown * RECENT_PENALTY_STEP);
    const score = vectorScore * 0.78 + affectFit * AFFECT_WEIGHT + Math.min(2, matched.length) * 0.04 + architectureFocus - (enclosedConflict ? 0.12 : 0)
      + Math.min(0.16, detailedFocus.length * 0.1) + subjectFit * 0.12 + (openFit ? 0.12 : 0) + (warmFit ? .24 : 0)
      + brightFit + (forestFit ? .10 : 0) + (evening ? -.12 : riverFit ? .24 : 0) - nightPenalty - heavyPenalty - exposurePenalty + (exactName(artwork, query) ? 2 : 0);
    return { artwork, vectorScore, score, affectFit, evidence: [...evidence, ...(architectureFocus ? ["focus:architecture"] : []), ...detailedFocus.map(focus => `focus:${focus.topic}`),
      ...stageSubjects.map(subject => `stage-${subject}`), ...(openFit ? ["stage-space:open"] : []), ...(enclosedConflict ? ["stage-space:enclosed-conflict"] : []), ...(warmFit ? ["stage-light:warm"] : []), ...(riverFit && !evening ? ["reviewed-focus:riverbank"] : []), ...(forestFit ? ["reviewed-focus:forest"] : []), ...(intent.bright && appearance ? ["pixels:brightness"] : []), ...(heavyPenalty ? ["default:gentle"] : []), ...(exposurePenalty ? [`recent:${shown}`] : []), ...matched.map((signal) => `stage:${signal}`), ...(exactName(artwork, query) ? ["catalog:name"] : [])] };
    // When the visitor asked for a mood, a work that contradicts its stage is
    // left out; a shorter exhibition beats a festival in a still closing. Subject
    // requests without a stated mood still fill their count. Named works stay.
    }).filter((row) => !moodRequested || row.affectFit >= MIN_STAGE_FIT || exactName(row.artwork, query) || intent.artworkTitles?.includes(row.artwork.title))
      .sort((a, b) => b.score - a.score || a.artwork.id.localeCompare(b.artwork.id));
  });
  const quotas = quotasFor(Math.min(plan.artworkCount, eligible.length), plan.stages.length);
  const selected = new Set<string>();
  const assignments: StageAssignment[] = [];
  const perStage: StageAssignment[][] = plan.stages.map(() => []);
  const authors = new Map<string, number>();
  const subjects = new Map<string, number>();
  // Every stage receives its anchor before any stage takes a second work.
  for (let pass = 0; pass < Math.max(...quotas, 0); pass++) {
    for (let stageIndex = 0; stageIndex < plan.stages.length; stageIndex++) {
      if (pass >= quotas[stageIndex]) continue;
      const open = ranked[stageIndex].filter((candidate) => !selected.has(candidate.artwork.id));
      // One department of unknown hands fills at most two places, unless a stage has nothing else.
      const uncrowded = open.filter((candidate) => { const hand = handOf(candidate.artwork); return !hand.startsWith("department:") || (authors.get(hand) ?? 0) < DEPARTMENT_HAND_CAP; });
      const candidates = uncrowded.length ? uncrowded : open;
      const winner = candidates.sort((a, b) => {
        const penalty = (artwork: WebArtwork) => intent.artists.length || exactName(artwork, query) ? 0
          : Math.max(0, (authors.get(handOf(artwork)) ?? 0) - (handOf(artwork).startsWith("department:") ? 0 : 1)) * 0.035
            + (casual ? Math.max(0, (subjects.get(artwork.subjectTags[0] ?? "") ?? 0) - 1) * .04 : 0);
        return (b.score - penalty(b.artwork)) - (a.score - penalty(a.artwork)) || a.artwork.id.localeCompare(b.artwork.id);
      })[0];
      if (!winner) continue;
      selected.add(winner.artwork.id);
      const author = handOf(winner.artwork);
      if (author) authors.set(author, (authors.get(author) ?? 0) + 1);
      const subject = winner.artwork.subjectTags[0];
      if (subject) subjects.set(subject, (subjects.get(subject) ?? 0) + 1);
      perStage[stageIndex].push({ artworkId: winner.artwork.id, stageIndex, vectorScore: winner.vectorScore, score: winner.score, evidence: winner.evidence });
    }
  }
  improveStageAssignment(perStage, ranked);
  assignments.push(...perStage.flat());
  const stagePools = ranked.map((rows, stageIndex) => {
    const chosen = new Set(perStage[stageIndex]!.map((item) => item.artworkId));
    if (!chosen.size) return [];
    const pool = [...rows.filter((row) => chosen.has(row.artwork.id)), ...rows.filter((row) => !chosen.has(row.artwork.id)).slice(0, STAGE_RERANK_POOL_SIZE)];
    return pool.slice(0, Math.max(STAGE_RERANK_POOL_SIZE, chosen.size)).map((row) => ({ artworkId: row.artwork.id, score: row.score, vectorScore: row.vectorScore, evidence: row.evidence }));
  });
  return { ...materializeCurationSelection(catalog, query, plan, assignments, input.semantic?.index.model.id ?? "local-hash-embedding-v1", dimensions, options), stagePools };
}

export function materializeCurationSelection(catalog: WebReleaseCatalog, query: string, plan: CurationIntentPlan, assignments: StageAssignment[], model: string, dimensions: number,
  options?: ViewingIntentOptions): SemanticSelection {
  const allowed = new Set(eligibleCurationArtworks(catalog, query, plan, options).map((artwork) => artwork.id));
  if (assignments.length > plan.artworkCount || new Set(assignments.map((item) => item.artworkId)).size !== assignments.length
    || assignments.some((item, index) => !allowed.has(item.artworkId) || !Number.isInteger(item.stageIndex) || !plan.stages[item.stageIndex]
      || index > 0 && item.stageIndex < assignments[index - 1].stageIndex || !Array.isArray(item.evidence) || item.evidence.some((value) => typeof value !== "string")
      || !Number.isFinite(item.score) || !Number.isFinite(item.vectorScore))) {
    throw new TypeError("Cached curation contains invalid or disallowed assignments");
  }
  const search: WebSearchResult = {
    query, normalizedQuery: query.normalize("NFKC").trim(), model, dimensions,
    results: assignments.map((item, index) => {
      const artwork = catalog.artworkById.get(item.artworkId)!;
      return { rank: index + 1, vectorScore: item.vectorScore, lexicalScore: 0, combinedScore: item.score, matchedTokens: item.evidence,
        artwork: { ...artwork, detailHref: `/artwork/${encodeURIComponent(artwork.id)}?${new URLSearchParams({ query, releaseVersion: catalog.releaseVersion })}` },
        scene: selectBackgroundScene(artwork, catalog.backgroundScenes) };
    }),
  };
  const baseline = buildAffectiveGrowthForm({ query, results: search.results, backgroundScenes: catalog.backgroundScenes });
  const growthForm = parseGrowthForm({
    ...baseline,
    id: `growth-${semanticFingerprint(`${CURATION_RECIPE_VERSION}:${query}:${assignments.map((item) => `${item.stageIndex}:${item.artworkId}`).join(",")}`).slice(0, 16)}`,
    stages: plan.stages.map((stage, index) => ({ ...stage, id: `stage-${index + 1}`, signals: stage.signals.map((value) => ({ kind: "emotion", value })),
      intensity: Math.min(0.9, 0.15 + stage.arousal * 0.45 + stage.tension * 0.2 + stage.wonder * 0.2),
      sceneIntent: stage.query, artworkIds: assignments.filter((item) => item.stageIndex === index).map((item) => item.artworkId) })),
    supportingArtworkIds: assignments.map((item) => item.artworkId),
    trace: [...baseline.trace.filter((entry) => entry.step !== "stage"), ...assignments.map((item, index) => ({ id: `assignment-${index}`, step: "assign", artworkId: item.artworkId, stageId: `stage-${item.stageIndex + 1}`, message: "Selected from the complete eligible pool for this planned stage.", score: Math.max(0, Math.min(1, item.score)) }))],
  });
  return { search, growthForm, assignments };
}
