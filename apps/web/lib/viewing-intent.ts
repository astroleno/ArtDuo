import type { WebArtwork } from "./release-catalog";
import type { VisualState, VisualSubject } from "./artwork-visual-evidence";
import { ARTWORK_MEDIUM_REQUESTS, artworkMediumKinds, type ArtworkMedium } from "@artduo/contracts";

// Concrete subject evidence never uses the emotional aliases in the embedding
// tokenizer. A quiet title is not evidence that a work depicts a quiet scene.
const SUBJECTS = {
  sea: /海(?:洋|边|面|岸|景)?|大海|\b(?:sea|seas|ocean|seascape|coast|coastal|beach|waves?)\b/iu,
  forest: /森林|树林|树木|\b(?:forest|woods|woodland|trees?|cypresses?|pines?)\b/iu,
  mountain: /山景|山水|山川|山峰|高山|\b(?:mountains?|hills?)\b/iu,
  water: /水景|水域|水面|水边|河流|河水|河边|湖水|湖泊|湖边|池塘|睡莲|海边|海面|瀑布|溪流|溪水|(?<=有)水(?=的|[，。、；,;.!?！？\s和与及或]|$)|水(?=[，。、；,;.!?！？\s和与及或]|$)|\b(?:water|waterscape|waterside|river|riverside|lake|lakeside|pond|lagoon|sea|seascape|coast|beach|waterfalls?|streams?|creeks?|water lilies|water lily)\b/iu,
  waterfall: /瀑布|\bwaterfalls?\b/iu,
  moon: /月光|月亮|月夜|\b(?:moon|moonlight|moonlit)\b/iu,
  flowers: /花卉|花朵|鲜花|花园|睡莲|向日葵|花(?=[，。、；,;.!?！？\s和与及或]|$)|\b(?:flowers?|garden|roses?|lil(?:y|ies)|sunflowers?)\b/iu,
  stillLife: /静物|\bstill[ -]life\b/iu,
  architecture: /建筑|街景|教堂|房屋|\b(?:architecture|buildings?|cathedral|church|houses?|cityscapes?|street|monastery|windows?|interiors?|bedroom|ruins)\b/iu,
  portrait: /肖像|人像|\bportraits?\b/iu,
  people: /人物|(?<=无)人|人群|行人|渔民|少女|女子|妇人|男孩|女孩|孩子|\b(?:people|persons?|humans?|figures?|men|man|women|woman|girls?|boys?|children|child|bandits?|soldiers?|sailors?|crowds?|mother|father|fisherm[ae]n|shepherds?|farmers?|monks?)\b/iu,
  interior: /室内|房间|卧室|屋内|\b(?:interiors?|bedrooms?|rooms?|indoors?)\b/iu,
  war: /战争|战场|战役|\b(?:war|battle|warfare)\b/iu,
  death: /死亡|死去|葬礼|\b(?:death|dead|funeral|crucifixion)\b/iu,
  boats: /船只|船舶|小船|帆船|(?<=无)船|船(?=的|[，。、；,;.!?！？\s和与及或]|$)|舟|\b(?:boats?|ships?|vessels?|sailing|shipping)\b/iu,
  religion: /宗教|教堂|圣经|佛教|菩萨|观音|佛陀|基督|圣母|\b(?:religio\w*|church|cathedral|monastery|buddh\w*|bodhisattva|christ|crucifix\w*|madonna|virgin mary|saints?|apostles?|piet[aà])\b/iu,
  outdoors: /户外|室外|野外|\boutdoors?\b/iu,
} satisfies Record<string, RegExp>;
type Subject = keyof typeof SUBJECTS;
export type ViewingFocus = "hands" | "roads";
const VIEWING_FOCUS: Record<ViewingFocus, { request: RegExp; evidence: RegExp }> = {
  hands: { request: /手势|手部|双手|手指|手掌|手背|手(?:的)?(?:姿态|动作|位置)|托腮|\b(?:hands?|gestures?)\b/iu, evidence: /双手|一手|手部|手背|手指|手中|手持|用手|托腮|托着头|\b(?:hands?|gestures?)\b/iu },
  roads: { request: /道路|小路|路径|林径|山径|\b(?:roads?|paths?|trails?)\b/iu, evidence: /道路|小路|路径|林径|山径|\b(?:roads?|paths?|trails?)\b/iu },
};
const ARTISTS = [
  { name: "claude monet", pattern: /莫奈|\bmonet\b/iu },
  { name: "vincent van gogh", pattern: /梵[·・]?高|\bvan gogh\b/iu },
  { name: "katsushika hokusai", pattern: /(?:葛饰)?北斋|\bhokusai\b/iu },
  { name: "georges seurat", pattern: /修拉|\bseurat\b/iu },
  { name: "paul cezanne", pattern: /塞尚|\bc[eé]zanne\b/iu },
  { name: "paul gauguin", pattern: /高更|\bgauguin\b/iu },
  { name: "pierre-auguste renoir", pattern: /雷诺阿|\brenoir\b/iu },
  { name: "gustave caillebotte", pattern: /卡耶博特|\bcaillebotte\b/iu },
  { name: "pablo picasso", pattern: /毕加索|\bpicasso\b/iu },
];
export interface ViewingIntent {
  subjects: Subject[];
  excludedSubjects: Subject[];
  rest: boolean;
  bright: boolean;
  spacious?: boolean;
  media?: ArtworkMedium[];
  excludedMedia?: ArtworkMedium[];
  artists: string[];
  excludedArtists: string[];
  allowIntense: boolean;
  retrievalText: string;
  alternativeSubjects?: boolean;
  artworkTitles?: string[];
  excludedArtworkTitles?: string[];
  focuses?: ViewingFocus[];
}

const INTENSE = /火灾|战争|死亡|屠杀|沉船|受难|殉难|斩首|尸体|骷髅|头骨|\b(?:fire|burning|burnt|conflagration|explosion|war|battle|dead|death|dying|funeral|crucifixion|massacre|murder|execution|shipwreck|storm|tempest|slaughter|martyrdom|beheading|crucified|wounded|skull|skeleton|rough sea)\b/iu;
const REST = /累|疲惫|疲劳|撑了|休息|安静|平静|宁静|缓和|放松|舒缓|低落|难过|\b(?:tired|exhausted|rest|restful|quiet|calm|serene|serenity|relax|sad)\b/iu;
const BRIGHT = /明亮|活力|欢快|喜悦|开心|\b(?:bright|joy|joyful|cheerful|energy|lively)\b/iu;
const SPACIOUS = /开阔|辽阔|宽阔|空旷|\b(?:spacious|open\s+(?:views?|spaces?|vistas?)|wide\s+(?:views?|vistas?))\b/iu;
const NEGATION = /不要|不用|不必|不需要|无需|不想|不看|不喜欢|避开|排除|别(?:给|有|来|放|出现|强行|强迫|催|让)|没有|不含|不带|无人物|\b(?:not|no|without|avoid|exclude|don['’]t(?: want)?)\b/iu;

function isNegated(clause: string, index: number): boolean {
  // "not forest but sea" and "不要森林，想看海" have separate scopes.
  const prefix = (clause.slice(0, index).split(/但是|而是|不过|改看|只想看|只看|(?<!不)想看|希望看|\bbut\b/iu).at(-1) ?? "")
    .replace(/(?:没有|不含|不带|无)[^，。；,;.!?]*?的/gu, "");
  return NEGATION.test(prefix) || /无$/u.test(prefix);
}

function hasAffirmedMood(clause: string, pattern: RegExp): boolean {
  return [...clause.matchAll(new RegExp(pattern.source, "giu"))].some((match) => {
    const prefix = clause.slice(0, match.index);
    const denied = /(?:并不|并非|不是|不)(?:感到|觉得|算|很|太|特别|那么)?$/u.test(prefix);
    const doubleNegative = /(?:不是|并非)不(?:感到|觉得|很|太)?$/u.test(prefix);
    return !isNegated(clause, match.index!) && (!denied || doubleNegative);
  });
}

function intentClauses(query: string): string[] {
  return query.split(/[。；;.!?\n]/u).flatMap((sentence) => {
    let negativeList = false;
    return sentence.split(/[，,]/u).map((part) => {
      const freshRequest = /(?:只想看|只看|想看|希望看|只聊|只谈|只观察|只比较|重点看|留意|关注|给我|我要|但是|而是|不过|也可以|都可以|均可|也行)|\b(?:but|instead|show|give|want|would like|looking for|also|fine|welcome|focus on|talk about|look at)\b/iu.test(part);
      const scoped = negativeList && !freshRequest && !NEGATION.test(part) ? `不要 ${part}` : part;
      negativeList = NEGATION.test(scoped);
      return scoped;
    });
  });
}
const titleKey = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[\p{P}\p{Z}\s]/gu, "");

export function parseViewingIntent(query: string, catalogArtists: readonly string[] = []): ViewingIntent {
  const subjects = new Set<Subject>();
  const excluded = new Set<Subject>();
  const artists = new Set<string>();
  const excludedArtists = new Set<string>();
  const media = new Set<ArtworkMedium>(), excludedMedia = new Set<ArtworkMedium>();
  let rest = false;
  let bright = false;
  let spacious = false;
  const focuses = new Set<ViewingFocus>();
  const artworkTitles: string[] = [], excludedArtworkTitles: string[] = [];
  const subjectQuery = query.replace(/《([^》]+)》/gu, (full, title: string, index: number) => {
    const clause = query.slice(0, index).split(/[，。；,;.!?\n]/u).at(-1) ?? "";
    (isNegated(clause, clause.length) ? excludedArtworkTitles : artworkTitles).push(title);
    return " ".repeat(full.length);
  });
  const clauses = intentClauses(subjectQuery);
  for (const clause of clauses) {
    const contextOnly = /新闻|害怕|担心|\b(?:news|afraid|scared|saw|anxious)\b/iu.test(clause) && !/想看|希望看|给我|要看|\b(?:show|want|looking for)\b/iu.test(clause);
    for (const [key, pattern] of Object.entries(SUBJECTS)) {
      for (const match of clause.matchAll(new RegExp(pattern.source, "giu"))) {
        if (isNegated(clause, match.index)) excluded.add(key as Subject);
        else if (!contextOnly) subjects.add(key as Subject);
      }
    }
    for (const artist of ARTISTS) {
      for (const match of clause.matchAll(new RegExp(artist.pattern.source, "giu"))) {
        (isNegated(clause, match.index!) ? excludedArtists : artists).add(artist.name);
      }
    }
    for (const [focus, patterns] of Object.entries(VIEWING_FOCUS)) {
      for (const match of clause.matchAll(new RegExp(patterns.request.source, "giu"))) {
        if (!isNegated(clause, match.index!)) focuses.add(focus as ViewingFocus);
      }
    }
    for (const [medium, pattern] of ARTWORK_MEDIUM_REQUESTS) {
      // Permission to include a medium is not a request to require it.
      const sentence = subjectQuery.split(/[。；;.!?\n]/u).find(part => part.includes(clause.replace(/^不要 /u, ""))) ?? clause;
      const permissive = /也(?:可以|行|接受|能看)|(?:都|均)可(?:以)?|不限|媒材不限|\b(?:also|welcome|acceptable|allowed|fine|okay|can include|do not mind|don't mind)\b/iu.test(sentence);
      const required = /只(?:要|看|限|接受)|仅(?:限|要|看)|必须|\bonly\b/iu.test(clause);
      for (const match of clause.matchAll(new RegExp(pattern.source, "giu"))) {
        if (isNegated(clause, match.index!) && !/不介意|\b(?:do not mind|don't mind)\b/iu.test(clause)) excludedMedia.add(medium);
        else if (!permissive || required) media.add(medium);
      }
    }
    const restMatch = hasAffirmedMood(clause, REST);
    const brightMatch = hasAffirmedMood(clause, BRIGHT);
    const spaciousMatch = clause.match(SPACIOUS);
    if (restMatch) rest = true;
    if (brightMatch) bright = true;
    if (spaciousMatch && !isNegated(clause, spaciousMatch.index ?? 0)) spacious = true;
  }
  const normalized = query.normalize("NFKC").trim();
  for (const name of catalogArtists) {
    if (!name.trim()) continue;
    for (const clause of intentClauses(normalized)) {
      const lower = clause.toLocaleLowerCase(), needle = name.toLocaleLowerCase();
      let index = lower.indexOf(needle);
      while (index >= 0) {
        (isNegated(clause, index) ? excludedArtists : artists).add(name.toLowerCase());
        index = lower.indexOf(needle, index + needle.length);
      }
    }
  }
  // Explicit authors remain hard constraints even when absent from this catalog.
  const authorRequests = [
    ...normalized.matchAll(/只(?:想)?(?:看|要)(?:画家|艺术家)?\s*([^，。；,;!?]{1,35}?)的(?:油画|水彩|版画|素描|粉彩|水墨|画作|绘画|作品|画)(?=[，。；,;!?]|$)/gu),
    ...normalized.matchAll(/\b(?:only\s+(?:paintings?|works?|artworks?|prints?|drawings?|watercolou?rs?|oils?)\s+(?:by|from)|(?:paintings?|works?|artworks?|prints?|drawings?|watercolou?rs?|oils?)\s+by)\s+([^,;.!?]{2,60})/giu),
  ];
  for (const match of authorRequests) {
    const raw = match[1].trim();
    if (/幅|件|张|安静|平静|明亮|颜色|风景|人物|山水|水边|海景|没有|\b(?:quiet|calm|bright|landscape|portrait|without)\b/iu.test(raw)) continue;
    const alias = ARTISTS.find((artist) => artist.pattern.test(raw));
    const known = catalogArtists.find((name) => name.toLocaleLowerCase() === raw.toLocaleLowerCase());
    artists.add(alias?.name ?? known?.toLowerCase() ?? raw.toLowerCase());
  }
  // A conflicting request must not turn into permission to select other subjects,
  // authors or media. Keeping both constraints produces an honest empty result;
  // an explicit alternative can still match one of its non-excluded options.
  if (subjects.has("sea")) subjects.delete("water");
  if (subjects.has("interior") && !/建筑|\b(?:architecture|buildings?)\b/iu.test(query)) subjects.delete("architecture");
  const explicitIntensity = subjects.has("war") || subjects.has("death");
  const positiveClauses = clauses.filter((clause) => !NEGATION.test(clause));
  return {
    subjects: [...subjects], excludedSubjects: [...excluded], rest: rest && !explicitIntensity, bright, spacious, media: [...media], excludedMedia: [...excludedMedia], artists: [...artists], excludedArtists: [...excludedArtists], allowIntense: explicitIntensity,
    alternativeSubjects: /或者|或是|\bor\b/iu.test(positiveClauses.join(" ")),
    artworkTitles, excludedArtworkTitles, focuses: [...focuses],
    retrievalText: [...positiveClauses, ...subjects, ...artists, rest && !explicitIntensity ? "quiet calm serenity restful" : "", bright ? "bright joy lively" : "", NEGATION.test(query) && positiveClauses.every((clause) => !clause.trim()) ? "contemplation" : ""].join(" "),
  };
}

function subjectEvidence(artwork: WebArtwork): string {
  return [artwork.title, ...artwork.subjectTags, artwork.description, artwork.storySnippet].filter(Boolean).join(" ");
}
export function hasIntenseContent(artwork: WebArtwork): boolean {
  if (artwork.visualEvidence?.facts.war === "present" || artwork.visualEvidence?.facts.death === "present") return true;
  const evidence = artwork.visualEvidence
    ? [artwork.title, ...artwork.subjectTags, artwork.visualEvidence.observation].join("。") : subjectEvidence(artwork);
  return evidence.split(/[。；;.!?]/u).some(clause => INTENSE.test(clause) && !/未见|没有|不含|\b(?:no|without)\b/iu.test(clause));
}
function hasSubject(subject: Subject, evidence: string): boolean {
  return subject === "outdoors"
    ? /户外|室外|田野|原野|海滩|草地|\b(?:outdoors?|landscapes?|fields?|forests?|coast|beach|mountains?|sky|parks?|gardens?|pond)\b/iu.test(evidence)
    : SUBJECTS[subject].test(evidence);
}

function subjectState(artwork: WebArtwork, subject: Subject, evidence: string): VisualState {
  const reviewed = artwork.visualEvidence?.facts[subject as VisualSubject];
  if (reviewed) return reviewed;
  if (artwork.visualEvidenceUnavailable) return "unknown";
  if (hasSubject(subject, evidence) || subject === "people" && SUBJECTS.portrait.test(evidence)) return "present";
  if (subject === "boats" && /海湾|港口|潟湖|\b(?:bay|harbou?rs?|lagoon|seaports?)\b/iu.test(evidence)) return "unknown";
  if (subject === "people") {
    const description = (artwork.description ?? artwork.storySnippet)?.trim();
    if (!description || description.startsWith(artwork.title) || /Strong\s+.+\s+fit with usable image/iu.test(description)
      || /船|舟|帆|\b(?:boats?|ships?|vessels?|harbou?rs?|sailing)\b/iu.test(evidence)) return "unknown";
  }
  // Silence in metadata cannot certify absence, even when a rich description exists.
  return "unknown";
}

export function matchesViewingIntent(artwork: WebArtwork, intent: ViewingIntent): boolean {
  return viewingIntentDecision(artwork, intent).matches;
}

/** Explain only a fully blocked requirement; remaining alternatives stay valid. */
export function viewingIntentConflictMessage(intent: ViewingIntent): string | undefined {
  const normalized = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  if (intent.artists.length && intent.artists.every(artist => intent.excludedArtists.some(excluded => normalized(artist) === normalized(excluded)))) {
    return "这句话同时要求和排除了同一位作者。请确认想保留哪一项。";
  }
  if (intent.media?.length && intent.media.every(medium => intent.excludedMedia?.includes(medium))) {
    return "想看的媒材又被排除了。请确认要保留哪一种媒材。";
  }
  const blocked = intent.subjects.map(subject => intent.excludedSubjects.includes(subject));
  if (blocked.length && (intent.alternativeSubjects ? blocked.every(Boolean) : blocked.some(Boolean))) {
    return "想看的题材也出现在排除条件里。请确认要保留哪一项。";
  }
  if (intent.artworkTitles?.length && intent.artworkTitles.every(title => intent.excludedArtworkTitles?.some(excluded => titleKey(title) === titleKey(excluded)))) {
    return "想看的作品又被排除了。请确认是否要看这件作品。";
  }
  return undefined;
}

/** Used by selection and its audit: unknown is never proof of a strict exclusion. */
export function viewingIntentDecision(artwork: WebArtwork, intent: ViewingIntent): { matches: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const titles = [artwork.title, ...(artwork.keywordBoosts ?? [])].map(titleKey);
  if (intent.excludedArtworkTitles?.some((title) => titles.includes(titleKey(title)))) reasons.push("excluded-artwork");
  if (intent.artworkTitles?.length && !intent.artworkTitles.some((title) => titles.includes(titleKey(title)))) reasons.push("different-artwork");
  const evidence = subjectEvidence(artwork);
  const artistName = (artwork.artistDisplayName ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  const normalizeArtist = (artist: string) => artist.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  if (intent.excludedArtists.some((artist) => artistName.includes(normalizeArtist(artist)))) reasons.push("excluded-artist");
  const uncertainAuthorship = /\b(?:attributed\s+to|formerly\s+attributed|previously\s+ascribed|workshop\s+of|school\s+of|circle\s+of|follower\s+of|manner\s+of|(?:copy\s+)?after)\b|工作室|门人|仿作|摹本|传为|旧归属/u;
  const authorSegments = artistName.split(/;|\n/u);
  if (intent.artists.length && !intent.artists.some(artist => authorSegments.some(segment =>
    segment.includes(normalizeArtist(artist)) && !uncertainAuthorship.test(segment)))) reasons.push("different-artist");
  const media = artworkMediumKinds(artwork.medium);
  if (intent.media?.length && !intent.media.some(medium => media.includes(medium))) reasons.push(media.length ? "different-medium" : "required-medium-unconfirmed");
  if (intent.excludedMedia?.length && (!media.length || intent.excludedMedia.some(medium => media.includes(medium)))) reasons.push(media.length ? "excluded-medium" : "excluded-medium-unconfirmed");
  if (intent.spacious && artwork.visualEvidence?.spatialFraming !== "open") reasons.push(`required-space:${artwork.visualEvidence?.spatialFraming ?? "unknown"}`);
  for (const subject of intent.excludedSubjects) {
    const state = subjectState(artwork, subject, evidence);
    if (state !== "absent") reasons.push(`excluded-subject:${subject}:${state}`);
  }
  if ((intent.rest || intent.bright) && !intent.allowIntense && hasIntenseContent(artwork)) reasons.push("intense-content");
  const subjectMatches = intent.subjects.map(subject => subjectState(artwork, subject, evidence) === "present");
  if (subjectMatches.length && !(intent.alternativeSubjects ? subjectMatches.some(Boolean) : subjectMatches.every(Boolean))) reasons.push("required-subject-unconfirmed");
  // A still life behind a portrait is not the requested still-life subject.
  // Explicit requests for both people and still life may keep that combination.
  if (intent.subjects.includes("stillLife") && !intent.subjects.some(subject => subject === "portrait" || subject === "people")
    && subjectState(artwork, "portrait", evidence) === "present"
    && !SUBJECTS.stillLife.test(artwork.title.split(/\bin front of\b/iu)[0]!)
    && !SUBJECTS.stillLife.test(artwork.subjectTags[0] ?? "")) reasons.push("required-focus:stillLife");
  return { matches: reasons.length === 0, reasons };
}

/** Only exact-image observations can substantiate a fine visual viewing focus. */
export function viewingFocusEvidence(artwork: WebArtwork, intent: ViewingIntent): Array<{ topic: ViewingFocus; text: string }> {
  const observation = artwork.visualEvidence?.observation;
  if (!observation) return [];
  return (intent.focuses ?? []).flatMap(topic => {
    const text = observation.split(/[。；;.!?]/u).find(clause => VIEWING_FOCUS[topic].evidence.test(clause)
      && !/未见|无法确认|不能确认|不易确认|不明确|不清楚|(?:手|姿态|动作)[^。；]{0,18}(?:遮挡|不可见|难以辨认)|\b(?:no|without|unconfirmed|unclear)\b/iu.test(clause));
    return text ? [{ topic, text: text.trim() }] : [];
  });
}

export function viewingIntentEvidence(artwork: WebArtwork, intent: ViewingIntent): string[] {
  const result = intent.subjects.filter((subject) => subjectState(artwork, subject, subjectEvidence(artwork)) === "present").map((subject) => `subject:${subject}`);
  for (const subject of intent.subjects) {
    if (subjectState(artwork, subject, subjectEvidence(artwork)) !== "present") continue;
    if (SUBJECTS[subject].test(artwork.subjectTags[0] ?? "")) result.push(`primary-subject:${subject}`);
    if (SUBJECTS[subject].test(artwork.title.split(/\bin front of\b/iu)[0]!)) result.push(`title-subject:${subject}`);
  }
  const moods = [...artwork.moodTags, ...artwork.emotionLabels].join(" ");
  if (intent.rest && /\b(?:quiet|calm|serenity|restful|serene)\b/iu.test(moods)) result.push("mood:rest");
  if (intent.bright && /\b(?:joy|bright|hope|lively)\b/iu.test(moods)) result.push("mood:bright");
  for (const medium of intent.media ?? []) if (artworkMediumKinds(artwork.medium).includes(medium)) result.push(`medium:${medium}`);
  if (intent.spacious && artwork.visualEvidence?.spatialFraming === "open") result.push("space:open");
  return result;
}
