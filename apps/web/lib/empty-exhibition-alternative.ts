import { withCurationVisualCorrections } from "./curation-visual-corrections";
import type { WebReleaseCatalog } from "./release-catalog";
import { eligibleCurationArtworks, fallbackCurationIntent, selectForCurationStages } from "./semantic-selection";
import { parseViewingIntent, UNRECORDED_PLATE_ETCHING, viewingIntentConflictMessage, type ViewingIntent } from "./viewing-intent";

const INTERIOR_WORDING = /室内(?:陈设|场景|画作|画)?(?=$|[\s，,。；;！？!?]|和|与|及|且|但|不要|油画|水彩|版画|静物|素描)/gu;
const COPPER_ETCHING_WORDING = /铜[版板]蚀刻(?:版画|画)?/gu;
const OPTIONS = { scopedRiverBank: true };

function remainingRequirements(intent: ViewingIntent) {
  const { subjects: _, retrievalText: __, ...requirements } = intent;
  return JSON.stringify(requirements);
}

function knownDetail(part: string, artists: string[]) {
  const words = part.trim().replace(/^(?:一[件幅张只朵艘片座棵条]|几[件幅张只])?/u, "").replace(/(?:的)?(?:画作|作品|图像)$/u, "");
  // A known word inside a longer object description does not prove the whole requirement.
  return /^(?:花|花卉|花朵|花束|鲜花|花瓶|船|船只|帆船|建筑|人|人物|静物|森林|树林|海景|山|山景|高山|河流|水面|室内|油画|水彩画?|版画|木版画|木刻|蚀刻|铜版蚀刻|铜版雕刻|石版画|素描|粉彩|水墨)$/u.test(words)
    || artists.some(artist => artist === words);
}

function verifiedPositiveDetail(part: string, artists: string[]) {
  if (!knownDetail(part, artists)) return false;
  const intent = parseViewingIntent(`想看${part}`, artists, OPTIONS);
  return Boolean(intent.subjects.length || intent.artists.length || intent.media?.length || intent.printDetailGroups?.length || intent.focuses?.length);
}

const SIMPLE_PRESENTATION = /^(?:(?:共|只要)?\s*(?:\d{1,2}|[一二两三四五六七八九十]+)\s*[件幅张](?:画|作品)?(?:即可|就好)?|(?:请|想|希望)?(?:慢慢|静静|安静地|放松地)看|(?:请)?(?:慢一点|节奏慢一点|安静一点)|有点累|今天有点累|轻松一点)$/u;
const CLAUSE_BOUNDARY = /[，,。；;！？!?]/u;

function unrecognizedRestriction(query: string, artists: string[], start: number, end: number) {
  const negatives = /^(?:且\s*|但(?:是)?\s*)?(?:希望\s*)?(?:(?:画(?:里|中|面里|面中)|图中)\s*)?(?:不要(?:有)?|别(?:用|看|有)|不想看(?:有)?|排除|避开|不含|不带|没有|无人(?=\s*$))/u;
  const explicitDetail = /^(?:(?:必须|一定要|只能|还要|要求|只限)(?:要?有)?|(?:画(?:里|中|面里|面中)|图中|里面|前景|背景)(?:要)?(?:有|摆着|放着|出现|可见|能看到))/u;
  const primaryTail = query.slice(end).split(CLAUSE_BOUNDARY)[0] ?? "";
  const primaryHead = query.slice(0, start).split(CLAUSE_BOUNDARY).at(-1) ?? "";
  const primary = primaryHead + query.slice(start, end) + primaryTail;
  if (/^\s*[、和与及]/u.test(primaryTail)
    && primaryTail.trim().slice(1).split(/[、和与及]/u).some(part => !verifiedPositiveDetail(part, artists))) return true;
  const tail = primaryTail.trim();
  if (tail && !/^[、和与及]/u.test(tail) && !negatives.test(tail)
    && !SIMPLE_PRESENTATION.test(tail) && !verifiedPositiveDetail(tail, artists)) return true;
  if (/[、和与及]\s*$/u.test(primaryHead)) {
    const joined = primaryHead.replace(/^.*?(?:想看|希望看|只看|给我看|看看)\s*/u, "").trim().slice(0, -1);
    if (joined.split(/[、和与及]/u).some(part => !verifiedPositiveDetail(part, artists))) return true;
  } else if (!/^(?:(?:(?:请|我|我想|我希望)\s*)?(?:想看|希望看|只看|给我看|看看)\s*)?(?:(?:\d{1,2}|[一二两三四五六七八九十]+)\s*[件幅张]\s*)?(?:画(?:里|中|面里|面中)的\s*)?$/u.test(primaryHead.trim())) {
    return true;
  }
  for (const raw of query.split(CLAUSE_BOUNDARY)) {
    const clause = (raw === primary && negatives.test(tail) ? tail : raw).trim();
    if (!clause) continue;
    if (negatives.test(clause)) {
      for (const [index, part] of clause.split(/[、和与及]/u).entries()) {
        const target = index ? part : part.replace(negatives, "") || "人";
        if (!knownDetail(target, artists)) return true;
        const intent = parseViewingIntent(`不要${target}`, artists, OPTIONS);
        if (!(intent.excludedSubjects.length || intent.excludedArtists.length || intent.excludedMedia?.length
          || intent.excludedPrintDetails?.length || intent.excludedArtworkTitles?.length)) return true;
      }
    } else {
      const detail = explicitDetail.exec(clause);
      if (!detail) {
        if (raw !== primary && !SIMPLE_PRESENTATION.test(clause) && !verifiedPositiveDetail(clause, artists)) return true;
        continue;
      }
      if (clause.slice(detail.index + detail[0].length).split(/[、和与及]/u).some(part => !verifiedPositiveDetail(part, artists))) return true;
    }
  }
  return false;
}

export function emptyExhibitionAlternative(catalog: WebReleaseCatalog, query: string) {
  const artists = catalog.artworks.flatMap(artwork => artwork.artistDisplayName ? [artwork.artistDisplayName] : []);
  const original = parseViewingIntent(query, artists, OPTIONS);
  if (original.alternativeSubjects || original.artworkTitles?.length || viewingIntentConflictMessage(original)) return undefined;
  const copperRequired = original.printDetailGroups?.some(group => group.length === 1
    && Array.isArray(group[0]) && group[0].includes("copperplate") && group[0].includes("etching"));
  const stillLife = original.subjects.includes("interior") && original.excludedSubjects.includes("people");
  if (!copperRequired && !stillLife) return undefined;
  const sites = [...query.matchAll(copperRequired ? COPPER_ETCHING_WORDING : INTERIOR_WORDING)];
  if (sites.length !== 1) return undefined;
  const match = sites[0]!, start = match.index!;
  if (unrecognizedRestriction(query, artists, start, start + match[0].length)) return undefined;
  const toClause = query.slice(0, start).split(CLAUSE_BOUNDARY).at(-1) ?? "";
  if (!(copperRequired || /^(?:\s*|.*(?:想看|希望看|只看|给我看|看看)[^，,。；;！？!?]*)$/u.test(toClause))
    || /环境|我在|在这里|装修|新闻|比如|我喜欢|以前/u.test(toClause)) return undefined;
  const changed = query.slice(0, start) + (copperRequired ? UNRECORDED_PLATE_ETCHING : "静物") + query.slice(start + match[0].length);
  const revised = parseViewingIntent(changed, artists, OPTIONS);
  const expected: ViewingIntent = copperRequired ? {
    ...original,
    printDetailGroups: original.printDetailGroups!.map(group => group.map(item => typeof item !== "string"
      && item.includes("copperplate") && item.includes("etching")
      ? ["plate-unrecorded", ...item.filter(detail => detail !== "copperplate")] : item)),
  } : { ...original, subjects: [...new Set(original.subjects.map(subject => subject === "interior" ? "stillLife" : subject))] };
  if (viewingIntentConflictMessage(revised) || remainingRequirements(expected) !== remainingRequirements(revised)
    || JSON.stringify([...revised.subjects].sort()) !== JSON.stringify([...expected.subjects].sort())) return undefined;
  const visualCatalog = withCurationVisualCorrections(catalog);
  const originalPlan = fallbackCurationIntent(visualCatalog, query);
  if (eligibleCurationArtworks(visualCatalog, query, originalPlan, OPTIONS).length) return undefined;
  const plan = fallbackCurationIntent(visualCatalog, changed);
  const eligible = new Set(eligibleCurationArtworks(visualCatalog, changed, plan, OPTIONS).map(work => work.id)).size;
  if (!eligible || plan.artworkCount !== originalPlan.artworkCount) return undefined;
  if (copperRequired && selectForCurationStages({ catalog: visualCatalog, query: changed, plan }).assignments.length
    !== Math.min(eligible, plan.artworkCount)) return undefined;
  return { kind: copperRequired ? "unrecorded-plate-etching" as const : "unoccupied-still-life" as const,
    query: changed, eligible, requested: plan.artworkCount };
}
