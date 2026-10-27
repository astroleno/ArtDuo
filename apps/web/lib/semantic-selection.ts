import { CURATION_RECIPE_VERSION, parseGrowthForm, type CurationIntentPlan, type GrowthForm, type SemanticIndex } from "@artduo/contracts";
import { buildUserAffectAgent, embedText } from "@artduo/corpus";
import { semanticFingerprint } from "@artduo/corpus/src/semantic-index";
import { artworkAffectState, artworkHardConflict, buildAffectiveGrowthForm } from "./affective-negotiation";
import { isGalleryArtwork } from "./artwork-eligibility";
import { selectBackgroundScene, type WebArtwork, type WebReleaseCatalog, type WebSearchResult } from "./release-catalog";
import { hasIntenseContent, matchesViewingIntent, parseViewingIntent, viewingIntentEvidence, viewingFocusEvidence } from "./viewing-intent";
import { requestedArtworkCount } from "../../api/src/services/curation/intent-planner";

export interface StageAssignment { artworkId: string; stageIndex: number; vectorScore: number; score: number; evidence: string[] }
export interface SemanticSelection { search: WebSearchResult; growthForm: GrowthForm; assignments: StageAssignment[] }

function exactName(artwork: WebArtwork, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase();
  return normalized.length > 1 && [artwork.title, artwork.artistDisplayName, ...artwork.keywordBoosts].some((name) => name?.toLocaleLowerCase() === normalized);
}
export function fallbackCurationIntent(catalog: WebReleaseCatalog, query: string): CurationIntentPlan {
  const growth = buildAffectiveGrowthForm({ query, results: [], backgroundScenes: catalog.backgroundScenes });
  const intent = parseViewingIntent(query, catalog.artworks.flatMap((artwork) => artwork.artistDisplayName ? [artwork.artistDisplayName] : []));
  return {
    schemaVersion: 1, currentFeeling: "按原句中的明确线索理解", desiredExperience: query.slice(0, 160),
    wantsRelief: intent.rest, pace: intent.rest ? "slow" : "medium", artworkCount: requestedArtworkCount(query) ?? 6,
    stages: growth.stages.map((stage) => ({ ...stage, query: `${stage.signals.map((signal) => signal.value).join(" ")} ${intent.retrievalText}`.slice(0, 240), signals: stage.signals.map((signal) => signal.value) })),
  };
}
export function eligibleCurationArtworks(catalog: WebReleaseCatalog, query: string, plan: CurationIntentPlan): WebArtwork[] {
  const intent = parseViewingIntent(query, catalog.artworks.flatMap((artwork) => artwork.artistDisplayName ? [artwork.artistDisplayName] : []));
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
export function selectForCurationStages(input: {
  catalog: WebReleaseCatalog; query: string; plan: CurationIntentPlan;
  semantic?: { index: SemanticIndex; queries: number[][] };
}): SemanticSelection {
  const { catalog, query, plan } = input;
  const eligible = eligibleCurationArtworks(catalog, query, plan);
  const semanticRecords = new Map(input.semantic?.index.records.map((record) => [record.artworkId, record.vector]));
  const hashRecords = new Map(catalog.embeddingRecords.map((record) => [record.id, record.vector]));
  const dimensions = input.semantic?.index.model.dimensions ?? catalog.embeddingRecords[0]?.dimensions ?? 256;
  const queries = input.semantic?.queries ?? plan.stages.map((stage) => embedText(stage.query, { dimensions }).vector);
  if (queries.length !== plan.stages.length || queries.some((vector) => vector.length !== dimensions || vector.some((value) => !Number.isFinite(value)))) throw new TypeError("Stage query vectors do not match their index");
  if (!input.semantic && catalog.embeddingRecords.some((record) => record.model !== "local-hash-embedding-v1")) throw new TypeError("Hash fallback requires a separate hash index");
  const intent = parseViewingIntent(query, catalog.artworks.flatMap(artwork => artwork.artistDisplayName ? [artwork.artistDisplayName] : []));
  const casual = !intent.allowIntense && !intent.rest && !intent.bright && !intent.spacious
    && !intent.subjects.length && !intent.artists.length && !intent.media?.length && !intent.focuses?.length
    && !intent.artworkTitles?.length && !eligible.some(artwork => exactName(artwork, query));
  const ranked = plan.stages.map((stage, stageIndex) => {
    const stageIntent = parseViewingIntent(stage.query);
    const openStage = /\b(?:open|wide|expansive|distant)(?:\s+(?:open|wide|distant))*\s+(?:landscape|horizon|sky|view|vista)/iu.test(stage.query);
    return eligible.map((artwork) => {
    const vector = (input.semantic ? semanticRecords : hashRecords).get(artwork.id);
    if (!vector || vector.length !== dimensions) throw new TypeError("Missing artwork vector in the selected semantic space");
    const vectorScore = queries[stageIndex].reduce((sum, value, index) => sum + value * vector[index], 0);
    const offered = artworkAffectState(artwork);
    const affectFit = 1 - (Math.abs(offered.valence - stage.valence) + Math.abs(offered.arousal - stage.arousal) * 1.5
      + Math.abs(offered.tension - stage.tension) * 1.5 + Math.abs(offered.wonder - stage.wonder) + Math.abs(offered.intimacy - stage.intimacy)) / 6;
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
    const subjectFit = !stageIntent.subjects.length ? 0 : stageIntent.alternativeSubjects
      ? Number(stageSubjects.length > 0) : stageSubjects.length / stageIntent.subjects.length;
    const openFit = openStage && artwork.visualEvidence?.spatialFraming === "open";
    const appearance = artwork.appearance;
    const brightFit = intent.bright && appearance
      ? .12 * (appearance.meanLightness - .45) + .025 * appearance.brightShare + .12 * appearance.chroma
        + .26 * appearance.colorVariation - .22 * appearance.darkShare : 0;
    // A saturated night scene or its gold frame does not establish bright daylight.
    // Keep night scenes eligible, and honor an explicit request to see one.
    const nightPenalty = intent.bright && !/夜|月|\b(?:night|nocturne|moon\w*)\b/iu.test(query)
      && /夜景|夜色|夜晚|\b(?:nocturne|night|moonlit)\b/iu.test([artwork.title, artwork.visualEvidence?.observation].join(" ")) ? .16 : 0;
    const heavyPenalty = casual && hasIntenseContent(artwork) ? .3 : 0;
    const score = vectorScore * 0.78 + affectFit * 0.14 + Math.min(2, matched.length) * 0.04 + architectureFocus
      + Math.min(0.16, detailedFocus.length * 0.1) + subjectFit * 0.12 + (openFit ? 0.12 : 0) + brightFit - nightPenalty - heavyPenalty + (exactName(artwork, query) ? 2 : 0);
    return { artwork, vectorScore, score, evidence: [...evidence, ...(architectureFocus ? ["focus:architecture"] : []), ...detailedFocus.map(focus => `focus:${focus.topic}`),
      ...stageSubjects.map(subject => `stage-${subject}`), ...(openFit ? ["stage-space:open"] : []), ...(intent.bright && appearance ? ["pixels:brightness"] : []), ...(heavyPenalty ? ["default:gentle"] : []), ...matched.map((signal) => `stage:${signal}`), ...(exactName(artwork, query) ? ["catalog:name"] : [])] };
    }).sort((a, b) => b.score - a.score || a.artwork.id.localeCompare(b.artwork.id));
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
      const candidates = ranked[stageIndex].filter((candidate) => !selected.has(candidate.artwork.id));
      const winner = candidates.sort((a, b) => {
        const penalty = (artwork: WebArtwork) => intent.artists.length || exactName(artwork, query) ? 0
          : Math.max(0, (authors.get(artwork.artistDisplayName ?? "") ?? 0) - 1) * 0.035
            + (casual ? Math.max(0, (subjects.get(artwork.subjectTags[0] ?? "") ?? 0) - 1) * .04 : 0);
        return (b.score - penalty(b.artwork)) - (a.score - penalty(a.artwork)) || a.artwork.id.localeCompare(b.artwork.id);
      })[0];
      if (!winner) continue;
      selected.add(winner.artwork.id);
      const author = winner.artwork.artistDisplayName ?? "";
      if (author) authors.set(author, (authors.get(author) ?? 0) + 1);
      const subject = winner.artwork.subjectTags[0];
      if (subject) subjects.set(subject, (subjects.get(subject) ?? 0) + 1);
      perStage[stageIndex].push({ artworkId: winner.artwork.id, stageIndex, vectorScore: winner.vectorScore, score: winner.score, evidence: winner.evidence });
    }
  }
  assignments.push(...perStage.flat());
  return materializeCurationSelection(catalog, query, plan, assignments, input.semantic?.index.model.id ?? "local-hash-embedding-v1", dimensions);
}

export function materializeCurationSelection(catalog: WebReleaseCatalog, query: string, plan: CurationIntentPlan, assignments: StageAssignment[], model: string, dimensions: number): SemanticSelection {
  const allowed = new Set(eligibleCurationArtworks(catalog, query, plan).map((artwork) => artwork.id));
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
