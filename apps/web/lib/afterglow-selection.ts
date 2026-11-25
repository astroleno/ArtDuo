import { artworkMediumKinds, type CurationIntentPlan } from "@artduo/contracts";
import { handOf } from "./artwork-hand";
import { artworkOffering, stageFit } from "./artwork-offering";
import type { WebArtwork, WebReleaseCatalog } from "./release-catalog";
import type { StageAssignment } from "./semantic-selection";
import { STAGE_RERANK_POOL_SIZE, type StageCandidate } from "./stage-rerank";
import { parseViewingIntent } from "./viewing-intent";

const PINNED_ORDER = /比较|比对|对比|对照|并排|顺序|次序|先后|第[一二三四五六七八九十\d]+[幅件张]|最后(?:[一1]?[幅件张]|用|放|以|选)|开场(?:用|放|看)|收尾(?:用|放|看)|按[^。；]{0,25}从[^。；]{0,20}到|\b(?:compare|comparison|side[ -]by[ -]side|in (?:this|that|the) order|first (?:show|work|painting)|last (?:work|painting)|start with|end with)\b/iu;
const ORDERED_VIEWING = /先(?:看|欣赏|展示)[^。；]{1,45}(?:再|然后|接着|随后)(?:看|欣赏|展示)|\b(?:show|see|view|look at|present|display)\b[^.!?;]{1,70}\b(?:before|after)\b[^.!?;]{0,45}\b(?:paintings?|works?|artworks?|prints?|interiors?|landscapes?|portraits?|outdoors?|still lifes?)\b/iu;
const SORTED_WORKS = /按[^。；]{1,18}(?:排列|排序)|\b(?:sort|order|arrange|sequence|show)\b[^.!?;]{0,40}\b(?:chronologically|by (?:date|year|size|dimensions?|format|medium))\b/iu;
const UNCONFIRMED_HAND = /匿名|佚名|无名|不详|未知|艺术家不明|传为|工作室|门人|仿作|摹本|\b(?:anonymous|unknown|unidentified|unrecorded|unattributed|after|attributed|studio|workshop|school of|circle of|follower of|manner of|master of|collective|museum|academy|manufactor\w*|company|department)\b|[?？;&、]|\band\b/iu;
const EPSILON = 1e-9;
const normalize = (text: string) => text.normalize("NFKC").trim().toLocaleLowerCase();

function artistNameVariants(name: string): string[] {
  const inverted = /^([^,]+),\s*([^,]+)$/u.exec(name);
  return inverted ? [name, `${inverted[2]!.trim()} ${inverted[1]!.trim()}`] : [name];
}

function verifiedFraming(artwork: WebArtwork) {
  const review = artwork.visualEvidence;
  if (!review || artwork.visualEvidenceUnavailable || review.reviewer !== "local-image-review"
    || review.artworkId !== artwork.id || review.imagePath !== artwork.imageUrl || !review.observation.trim()
    || !/^sha256:[a-f0-9]{64}$/u.test(review.imageSha256)) return undefined;
  const framing = review.spatialFraming;
  return framing === "open" || framing === "enclosed" || framing === "framed" ? framing : undefined;
}

function stageImageEvidence(candidate: StageCandidate): string {
  return ["stage-light:warm", "stage-space:open"].filter(tag => candidate.evidence.includes(tag)).join("|");
}

/** A bounded change after either final route is chosen, confined to its last position. */
export function refineAfterglow(input: { catalog: Pick<WebReleaseCatalog, "artworkById">; query: string; plan: CurationIntentPlan;
  assignments: StageAssignment[]; pools: StageCandidate[][] }): StageAssignment[] | undefined {
  const { assignments, catalog, plan, pools, query } = input;
  if (assignments.length < 4 || plan.artworkCount < 4 || PINNED_ORDER.test(query) || ORDERED_VIEWING.test(query) || SORTED_WORKS.test(query)) return undefined;
  const last = assignments.at(-1)!, previous = assignments.at(-2)!;
  const stage = plan.stages[last.stageIndex];
  if (stage?.role !== "afterglow" || previous.stageIndex !== last.stageIndex) return undefined;
  const shortlist = pools[last.stageIndex];
  if (!shortlist || shortlist.length > STAGE_RERANK_POOL_SIZE) return undefined;
  const original = shortlist.find(candidate => candidate.artworkId === last.artworkId);
  const evidence = original && stageImageEvidence(original);
  if (!original || !evidence) return undefined;

  const artwork = catalog.artworkById.get(last.artworkId), bridge = catalog.artworkById.get(previous.artworkId);
  if (!artwork || !bridge || !artwork.medium || !artworkMediumKinds(artwork.medium).length) return undefined;
  const medium = normalize(artwork.medium);
  const framing = verifiedFraming(artwork), hand = handOf(artwork);
  if (!framing || !hand || hand.startsWith("department:") || UNCONFIRMED_HAND.test(hand)) return undefined;

  const artworks = [...catalog.artworkById.values()];
  const normalizedQuery = normalize(query);
  if (artworks.some(candidate => normalize(candidate.title) === normalizedQuery
    || candidate.artistDisplayName && (normalize(candidate.artistDisplayName) === normalizedQuery
      || candidate.artistDisplayName.includes(",") && normalizedQuery.includes(normalize(candidate.artistDisplayName))))) return undefined;
  const intent = parseViewingIntent(query, artworks.flatMap(candidate => candidate.artistDisplayName ? artistNameVariants(candidate.artistDisplayName) : []));
  if (intent.artists.length || intent.excludedArtists.length || intent.artworkTitles?.length || intent.excludedArtworkTitles?.length
    || assignments.some(assignment => assignment.evidence.includes("catalog:name"))) return undefined;
  const used = new Set(assignments.map(assignment => assignment.artworkId));
  const originalMood = artworkOffering(artwork), bridgeMood = artworkOffering(bridge);
  const originalFit = stageFit(originalMood, stage);
  const originalError = Math.abs(originalMood.arousal - stage.arousal);
  const originalContinuity = stageFit(bridgeMood, originalMood);
  const choices = shortlist.flatMap(candidate => {
    if (used.has(candidate.artworkId) || candidate.score + EPSILON < original.score - .05 || stageImageEvidence(candidate) !== evidence) return [];
    const replacement = catalog.artworkById.get(candidate.artworkId);
    if (!replacement?.medium || medium !== normalize(replacement.medium)
      || normalize(handOf(replacement)) !== normalize(hand) || verifiedFraming(replacement) !== framing) return [];
    const offered = artworkOffering(replacement), fit = stageFit(offered, stage);
    const error = Math.abs(offered.arousal - stage.arousal), continuity = stageFit(bridgeMood, offered);
    if (fit + EPSILON < originalFit + .07 || error > originalError - .04 + EPSILON || continuity + EPSILON < originalContinuity - .05) return [];
    return [{ candidate, fit }];
  });
  const chosen = choices.sort((a, b) => b.fit - a.fit || b.candidate.score - a.candidate.score || a.candidate.artworkId.localeCompare(b.candidate.artworkId))[0]?.candidate;
  return chosen ? [...assignments.slice(0, -1), { ...chosen, stageIndex: last.stageIndex, evidence: [...chosen.evidence, "rule:afterglow-fit"] }] : undefined;
}
