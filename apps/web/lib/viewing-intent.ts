import type { WebArtwork } from "./release-catalog";
import type { VisualState, VisualSubject } from "./artwork-visual-evidence";
import { ARTWORK_MEDIUM_REQUESTS, artworkMediumKinds, artworkPrintDetails, UNRECORDED_PLATE_ETCHING, type ArtworkMedium, type PrintDetail } from "@artduo/contracts";
export { UNRECORDED_PLATE_ETCHING } from "@artduo/contracts";

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
  printDetailGroups?: Array<Array<ReadonlyArray<PrintRequirement> | ArtworkMedium>>;
  excludedPrintDetails?: ReadonlyArray<ReadonlyArray<PrintRequirement>>;
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
const RIVER_BANK = /河岸|河畔|河边|江岸|江畔|江边|\b(?:river[ -]?banks?|riverside)\b/iu;
const OTHER_WATER = /湖|池塘|(?<!上)海(?:边|岸|面|洋|景)?|\b(?:lakes?|lakesides?|ponds?|sea|seas|ocean|seascapes?|coasts?|coastal|beach(?:es)?)\b/iu;
const DEPICTED_RIVER = /河岸|河畔|河边|江岸|江畔|江边|河流|河面|河道|河水|沿河|\b(?:rivers?|river[ -]?banks?|riverside)\b/iu;
const FOREST_VIEW = /树干|树木|树林|林地|林间|林缘|密林|森林|\b(?:woods|woodlands?|forests?|tree trunks?)\b/iu;
const UNCERTAIN_SCENE = /未见|没有|看不见|无法确认|不能确认|不明|似乎|般的|疑似|可能|\b(?:no|without|unconfirmed|unclear|perhaps|possibly|appears? to be)\b/iu;
const DISTANT_SCENE = /背景|远方|远处|远景|\b(?:background|distant|in the distance)\b/iu;
const MORNING = /清晨|黎明|晨曦|拂晓|破晓|日出|\b(?:dawn|morning|daybreak|sunrise)\b/iu;
const EVENING = /傍晚|黄昏|暮色|日落|夜晚|夜景|夜色|\b(?:evening|dusk|sunset|night|nocturne|nightfall)\b/iu;
const VIEW_REQUEST = /想看|希望看|想找|给我|要看|看看|看点|想欣赏|想观察|\b(?:show me|looking for|look at|(?:want|would like) to (?:see|view))\b/iu;
const SHORT_RIVER_BANK = /^(?:(?:清晨|黎明|黄昏|傍晚|安静|开阔)(?:的)?\s*)*(?:河岸|河畔|河边|江岸|江畔|江边)(?:边)?(?:风景|景色|景观|画作)?$|^(?:(?:dawn|morning|quiet|evening)\s+)?(?:river[ -]?banks?|riverside)(?:\s+(?:landscapes?|paintings?|views?))?$/iu;
const PEOPLE_PROHIBITION = /不要|别|不想(?:看见|看到|看)|不希望|不能|避开|排除/gu;
const PEOPLE_PAUSE = /^\s*(?:(?:出现|入镜)|的(?:画(?:作)?|作品|室内|房间|风景|场景))?\s*(?:[、，,]|也不要|也别|(?:及|和|与|或者|或是)(?!\s*(?:我|你|他|她|谁|大家|朋友|家人))|[吧呀啊]?\s*$)/u;
const PEOPLE_SCOPE_RESET = /但是|而是|不过|改看|只想看|只看|(?<!不)想看|希望看|\bbut\b/iu;
const PRINT_DETAIL_TERM = /铜[版板](?:蚀刻|雕刻|雕版)?(?:版画|画)?|木版(?:印刷)?(?:版画|画)?|木板(?:印刷(?:版画|画)?|版画)|木刻(?:版画|画)?|蚀刻(?:版画|画)?|石[版板](?:版画|画)?|\b(?:copper(?:[ -]?plate)?\s+(?:etchings?|engravings?)|copper[ -]?plates?|wood[ -]?cuts?|wood[ -]?blocks?|wood engravings?|etchings?|engravings?|lithographs?|lithography)(?:\s+prints?)?\b/giu;
const PRINT_SUBJECT_MENTION = /描绘|画中(?:有|的)|画面(?:上有|中有)|关于|表现|题材|主题|制作过程|的(?:工具|历史|技法)|\b(?:about|depict(?:s|ing)?|showing|history of|process of|like|in the style of)\b/iu;
const PRINT_OR = /^\s*(?:、\s*)?(?:或(?:者|是)?|\bor\b)\s*$/iu;
const SCOPED_MOUNTAIN = /(?:画(?:里|中|面里|面中)(?:的|有|不要有|没有)|(?:想看|希望看|看看|给我看|不要看|不要|避开)(?:有)?)山(?:体|峦|脉)?(?=\s*(?:$|[,，、。；;!?]|和|与|及|的(?:画|作品|风景|场景)))/gu;

type PrintRequirement = PrintDetail | "plate-unrecorded";

/** Admit only medium statements whose entire wording identifies etching and other named processes,
 * impression states, ink or paper. Unrecognized qualifiers can describe the plate itself. */
function unrecordedPlateEtching(medium: string | undefined) {
  return Boolean(medium && artworkPrintDetails(medium).etching === "present" &&
    /^(?:hand[- ]colored |colou?red )?(?:etching(?: (?:and|with) (?:engraving|drypoint)(?: and engraving)?)?|engraving and etching)(?:(?:;\s*(?:(?:first|second|third|fourth|fifth|sixth) state of (?:two|three|four|five|six)(?: \([\p{L} -]+\))?|(?:[\p{L}-]+ )?ink on (?:[\p{L}-]+ )*paper|(?:[\p{L}-]+ )?paper))|,\s*printed in (?:[\p{L}-]+ )?ink)?[.\s]*$/iu.test(medium.trim()));
}

function printTerm(value: string): PrintRequirement[] {
  const term = value.toLowerCase();
  const details: PrintRequirement[] = [];
  if (term.startsWith(UNRECORDED_PLATE_ETCHING)) details.push("plate-unrecorded");
  if (/铜[版板]|copper/u.test(term)) details.push("copperplate");
  if (/木[版板刻]|wood/u.test(term)) details.push("woodblock");
  if (/蚀刻|etch/u.test(term)) details.push("etching");
  if (/雕[刻版]|engrav/u.test(term)) details.push("engraving");
  if (/石[版板]|lithograph/u.test(term)) details.push("lithograph");
  return details;
}

function scopedPrintClause(clause: string, permissive: boolean, required: boolean, scopedUnrecordedPlate: boolean) {
  const groups: NonNullable<ViewingIntent["printDetailGroups"]> = [];
  const excluded: PrintRequirement[][] = [];
  const pattern = scopedUnrecordedPlate
    ? new RegExp(UNRECORDED_PLATE_ETCHING + "(?:版画|画)?|" + PRINT_DETAIL_TERM.source, "giu")
    : PRINT_DETAIL_TERM;
  const terms = [...clause.matchAll(pattern)];
  if (!terms.length) return { groups, excluded, generic: clause };
  const masked = clause.replace(pattern, match => " ".repeat(match.length));
  const atoms = [
    ...terms.map(match => ({ index: match.index!, end: match.index! + match[0].length, item: printTerm(match[0]) })),
    ...ARTWORK_MEDIUM_REQUESTS.flatMap(([medium, pattern]) => [...masked.matchAll(new RegExp(pattern.source, "giu"))]
      .map(match => {
        const end = match.index! + match[0].length;
        const suffix = /^(?:画|\s+paintings?\b)/iu.exec(masked.slice(end))?.[0].length ?? 0;
        return { index: match.index!, end: end + suffix, item: medium };
      })),
  ].sort((left, right) => left.index - right.index);
  const alternatives: Array<typeof atoms> = [];
  for (const atom of atoms) {
    const previous = alternatives.at(-1)?.at(-1);
    if (previous && PRINT_OR.test(clause.slice(previous.end, atom.index))) alternatives.at(-1)!.push(atom);
    else alternatives.push([atom]);
  }
  const linkedGeneric: Array<{ index: number; end: number }> = [];
  for (const alternativesGroup of alternatives) {
    if (!alternativesGroup.some(atom => typeof atom.item !== "string")) continue;
    const positive: NonNullable<ViewingIntent["printDetailGroups"]>[number] = [];
    for (const { index, end, item } of alternativesGroup) {
      if (typeof item === "string") {
        if (!isNegated(clause, index)) {
          linkedGeneric.push({ index, end });
          positive.push(item);
        }
        continue;
      }
      const before = clause.slice(0, index).split(PEOPLE_SCOPE_RESET).at(-1) ?? "";
      const after = clause.slice(end);
      if ((PRINT_SUBJECT_MENTION.test(before) && !/的\s*$/u.test(before)) || /^(?:的)?(?:工具|过程|历史|风格|题材|工人|工坊|一样|一般)|^为题/u.test(after)
        || /\b(?:paintings?|views?|images?|depictions?)\s+of\s+(?:an?\s+)?$/iu.test(before)
        || /(?:不是|并非|不只是|不局限于|不介意)\s*$/u.test(before)) continue;
      if (isNegated(clause, index) || /别(?:用|选|看|给我)[^，。；,;.!?]*$/u.test(before)) excluded.push(item);
      else positive.push(item);
    }
    if (positive.length && (!permissive || required)) groups.push(positive);
  }
  const generic = linkedGeneric.reverse().reduce((text, part) => text.slice(0, part.index) + " ".repeat(part.end - part.index) + text.slice(part.end), masked);
  return { groups, excluded, generic };
}
const PEOPLE_NOT_AN_EXCLUSION = /(?:不是|并非|不是说|没说|并不是|不意味着|不表示)\s*(?:画里|画面中?)?\s*$|(?:不要|不想(?:看)?|别|不希望)\s*(?:只有|只是|仅有|仅仅有|全是|都是)\s*$/u;

function excludesBarePeople(clause: string): boolean {
  if (/(?:想看|希望看|给我|看看|只看)(?:一[幅件张])?\s*(?:没有|没)人的(?:画|作品|室内|房间|风景|场景)/u.test(clause)
    && !NEGATION.test(clause.replace(/没有人/u, ""))) return true;
  if (/^(?:\s*(?:我)?(?:希望|想要|要求)\s*)?(?:画里|画面(?:里|中)?|图中|作品里)\s*(?:没有|没)人\s*(?:出现|入镜)?\s*$/u.test(clause)) return true;
  for (const match of clause.matchAll(PEOPLE_PROHIBITION)) {
    const prefix = clause.slice(0, match.index);
    if (PEOPLE_NOT_AN_EXCLUSION.test(prefix) || /(?:新闻|他说|她说|家里|办公室里).{0,8}$/u.test(prefix)) continue;
    const rest = clause.slice(match.index + match[0].length);
    const direct = rest.match(/^\s*(?:(?:画里|画面中?|作品中?|图中|里边|里面)\s*)?(?:(?:看到|看见|出现|放|包含)\s*)?(?:有\s*)?(?:任何\s*)?人/u);
    if (direct && PEOPLE_PAUSE.test(rest.slice(direct[0].length))) return true;
    // In a list this still needs its own visual presence phrase ("战争和有人出现").
    if (/^(?:(?!有人|但是|而是|想看).)+(?:[、]|和|与|及)\s*(?:出现人|有人)(?=\s*(?:出现|入镜)?\s*$)/u.test(rest)) return true;
  }
  return false;
}

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

/** A riverbank is a ranking preference, separate from saved subject constraints. */
export function prefersRiverBank(query: string): boolean {
  let affirmed = false;
  const clauses = intentClauses(query.replace(/《[^》]+》/gu, ""));
  for (const [index, clause] of clauses.entries()) {
    for (const match of clause.matchAll(new RegExp(RIVER_BANK.source, "giu"))) {
      const prefix = clause.slice(0, match.index);
      if (isNegated(clause, match.index) || /(?:不在|不靠|非|不是|并非|别看|别选|别画|不想要|不愿看)\s*$/u.test(prefix)) return false;
      const afterRiver = clause.slice(match.index + match[0].length);
      if (/^一样|^般的/u.test(afterRiver)) continue;
      const imaginedView = /想在|希望在/u.test(prefix)
        && (/看(?:一|组|几|张|件|幅|些|两|三|四|五)/u.test(afterRiver)
          || /^\s*看(?:一|组|几|张|件|幅|些|两|三|四|五)/u.test(clauses[index + 1] ?? ""));
      if (VIEW_REQUEST.test(prefix) || imaginedView || SHORT_RIVER_BANK.test(query.trim().replace(/[。.!?！？]$/u, ""))) affirmed = true;
    }
    if ([...clause.matchAll(new RegExp(OTHER_WATER.source, "giu"))].some(match => !isNegated(clause, match.index))) return false;
  }
  return affirmed;
}

export function mentionsMorning(query: string): boolean {
  const clauses = intentClauses(query.replace(/《[^》]+》/gu, ""));
  return clauses.some(clause => hasAffirmedMood(clause, MORNING)) && !clauses.some(clause => hasAffirmedMood(clause, EVENING));
}

export function depictsEvening(artwork: WebArtwork): boolean {
  if (EVENING.test(artwork.title)) return true;
  return !artwork.visualEvidenceUnavailable && Boolean(artwork.visualEvidence?.observation.split(/[，。；,;.!?]/u)
    .some(clause => EVENING.test(clause) && !UNCERTAIN_SCENE.test(clause)));
}

export function reviewedLandscapeFocus(artwork: WebArtwork, focus: "riverbank" | "forest"): boolean {
  const review = artwork.visualEvidence;
  if (!review || artwork.visualEvidenceUnavailable || review.facts[focus === "riverbank" ? "water" : "forest"] !== "present") return false;
  const subject = focus === "riverbank" ? DEPICTED_RIVER : FOREST_VIEW;
  const clauses = review.observation.split(/[，。；,;.!?]/u);
  if (focus === "forest" && review.facts.people === "present") {
    const opening = clauses[0]!;
    const trees = opening.search(FOREST_VIEW), people = opening.search(SUBJECTS.people);
    if (people >= 0 && (trees < 0 || people < trees)) return false;
  }
  return clauses.some(clause => {
    const mention = clause.match(subject);
    if (!mention || UNCERTAIN_SCENE.test(clause) || DISTANT_SCENE.test(clause.slice(0, mention.index))) return false;
    return focus !== "forest" || !/映出|倒映|反射|\breflect\w*/iu.test(clause);
  });
}
const titleKey = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[\p{P}\p{Z}\s]/gu, "");

const SITUATION = /(?:在|待在|呆在|困在|关在|坐在|窝在|闷在)[^，。；,;]{0,12}(?:里|中|内)|加班|上班|通勤|\b(?:stuck|trapped|cooped up|sitting|working)\s+(?:in|at)\b|\bbeen in\b/iu;

export interface ViewingIntentOptions {
  scopedRiverBank?: boolean;
  scopedPeopleExclusions?: boolean;
  scopedPrintDetails?: boolean;
  scopedUnrecordedPlate?: boolean;
  scopedMountainSubject?: boolean;
}

export function parseViewingIntent(query: string, catalogArtists: readonly string[] = [],
  { scopedRiverBank = false, scopedPeopleExclusions = true, scopedPrintDetails = true, scopedMountainSubject = true, scopedUnrecordedPlate = true }: ViewingIntentOptions = {}): ViewingIntent {
  const subjects = new Set<Subject>();
  const excluded = new Set<Subject>();
  const artists = new Set<string>();
  const excludedArtists = new Set<string>();
  const media = new Set<ArtworkMedium>(), excludedMedia = new Set<ArtworkMedium>();
  const printDetailGroups: NonNullable<ViewingIntent["printDetailGroups"]> = [], excludedPrintDetails: PrintRequirement[][] = [];
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
  const ignorePlaceName = scopedRiverBank && subjectQuery.includes("上海") && prefersRiverBank(subjectQuery);
  for (const clause of clauses) {
    if (scopedPeopleExclusions && excludesBarePeople(clause)) excluded.add("people");
    const wish = /想看|希望看|给我|要看|看看|看点|\b(?:show|want|looking for|see)\b/iu.test(clause);
    // Where the visitor is stuck ("在小房间里加班") describes their day, not what they want to see.
    const situated = SITUATION.test(clause);
    const contextOnly = (/新闻|害怕|担心|\b(?:news|afraid|scared|saw|anxious)\b/iu.test(clause) || situated) && !wish;
    if (scopedMountainSubject && !contextOnly) for (const match of clause.matchAll(SCOPED_MOUNTAIN)) {
      if (/(?:不是|并非|不是真的|不一定)\s*$/u.test(clause.slice(0, match.index))) continue;
      const index = match.index! + match[0].lastIndexOf("山");
      (isNegated(clause, index) ? excluded : subjects).add("mountain");
    }
    for (const [key, pattern] of Object.entries(SUBJECTS)) {
      const subjectClause = ignorePlaceName && key === "sea" ? clause.replace(/上海/gu, "  ") : clause;
      for (const match of subjectClause.matchAll(new RegExp(pattern.source, "giu"))) {
        if (scopedPeopleExclusions && key === "people") {
          const prefix = clause.slice(0, match.index).split(PEOPLE_SCOPE_RESET).at(-1) ?? "";
          if (/^人物画的(?:画框|边框)/u.test(subjectClause.slice(match.index))) continue;
          if (PEOPLE_NOT_AN_EXCLUSION.test(prefix) || /(?:不是|并非|没说|并不是)\s*(?:不要|不想(?:看)?|别|不希望|不能|不看).*$/u.test(prefix)) continue;
        }
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
    // Permission to include a medium is not a request to require it.
    const sentence = subjectQuery.split(/[。；;.!?\n]/u).find(part => part.includes(clause.replace(/^不要 /u, ""))) ?? clause;
    const permissive = /也(?:可以|行|接受|能看)|(?:都|均)可(?:以)?|不限|媒材不限|\b(?:also|welcome|acceptable|allowed|fine|okay|can include|do not mind|don't mind)\b/iu.test(sentence);
    const required = /只(?:要|看|限|接受)|仅(?:限|要|看)|必须|\bonly\b/iu.test(clause);
    const details = scopedPrintDetails ? scopedPrintClause(clause, permissive, required, scopedUnrecordedPlate) : undefined;
    if (details) {
      printDetailGroups.push(...details.groups);
      excludedPrintDetails.push(...details.excluded);
    }
    for (const [medium, pattern] of ARTWORK_MEDIUM_REQUESTS) {
      for (const match of (details?.generic ?? clause).matchAll(new RegExp(pattern.source, "giu"))) {
        if (scopedPrintDetails && medium === "print" && /其他(?:的)?版画.{0,10}(?:都行|(?:都|均)可)|\bother prints?\b/iu.test(clause)) {
          media.add("print");
          continue;
        }
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
    ...(printDetailGroups.length ? { printDetailGroups } : {}),
    ...(excludedPrintDetails.length ? { excludedPrintDetails } : {}),
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
  if (intent.printDetailGroups?.some(group => group.every(item => typeof item !== "string"
    && intent.excludedPrintDetails?.some(excluded => excluded.every(detail => item.includes(detail)))))) {
    return "想看的版画技法也出现在排除条件里。请确认要保留哪一项。";
  }
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
  if (intent.printDetailGroups?.length || intent.excludedPrintDetails?.length) {
    const details = { ...artworkPrintDetails(artwork.medium), "plate-unrecorded": unrecordedPlateEtching(artwork.medium) ? "present" : "unknown" };
    if (intent.printDetailGroups?.some(group => !group.some(item => typeof item === "string"
      ? media.includes(item) : item.every(detail => details[detail] === "present")))) reasons.push("required-print-detail");
    if (intent.excludedPrintDetails?.some(group => group.every(detail => details[detail] !== "absent"))) reasons.push("excluded-print-detail");
  }
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
