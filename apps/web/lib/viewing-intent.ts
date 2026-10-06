import type { WebArtwork } from "./release-catalog";

// Concrete subject evidence never uses the emotional aliases in the embedding
// tokenizer. A quiet title is not evidence that a work depicts a quiet scene.
const SUBJECTS = {
  sea: /海(?:洋|边|面|岸|景)?|大海|\b(?:sea|seas|ocean|seascape|coast|coastal|beach|waves?)\b/iu,
  forest: /森林|树林|树木|\b(?:forest|woods|woodland|trees?|cypresses?|pines?)\b/iu,
  mountain: /山水|山川|山峰|高山|\b(?:mountains?|hills?)\b/iu,
  water: /水面|河流|湖水|湖泊|池塘|睡莲|\b(?:water|river|lake|pond|water lilies|water lily)\b/iu,
  moon: /月光|月亮|月夜|\b(?:moon|moonlight|moonlit)\b/iu,
  flowers: /花卉|花朵|鲜花|花园|睡莲|向日葵|\b(?:flowers?|garden|roses?|lilies|sunflowers?)\b/iu,
  stillLife: /静物|\bstill[ -]life\b/iu,
  architecture: /建筑|街景|教堂|房屋|\b(?:architecture|buildings?|cathedral|church|houses?|cityscapes?|street|monastery|windows?|interiors?|bedroom|ruins)\b/iu,
  portrait: /肖像|人像|\bportraits?\b/iu,
  war: /战争|战场|战役|\b(?:war|battle|warfare)\b/iu,
  death: /死亡|死去|葬礼|\b(?:death|dead|funeral|crucifixion)\b/iu,
} satisfies Record<string, RegExp>;
type Subject = keyof typeof SUBJECTS;
const ARTISTS = [
  { name: "claude monet", pattern: /莫奈|\bmonet\b/iu },
  { name: "vincent van gogh", pattern: /梵[·・]?高|\bvan gogh\b/iu },
  { name: "katsushika hokusai", pattern: /(?:葛饰)?北斋|\bhokusai\b/iu },
  { name: "georges seurat", pattern: /修拉|\bseurat\b/iu },
  { name: "paul cezanne", pattern: /塞尚|\bc[eé]zanne\b/iu },
  { name: "paul gauguin", pattern: /高更|\bgauguin\b/iu },
  { name: "pierre-auguste renoir", pattern: /雷诺阿|\brenoir\b/iu },
  { name: "gustave caillebotte", pattern: /卡耶博特|\bcaillebotte\b/iu },
];
export interface ViewingIntent {
  subjects: Subject[];
  excludedSubjects: Subject[];
  rest: boolean;
  bright: boolean;
  artists: string[];
  excludedArtists: string[];
  allowIntense: boolean;
  retrievalText: string;
}

const INTENSE = /火灾|战争|死亡|屠杀|沉船|\b(?:fire|burning|burnt|conflagration|explosion|war|battle|dead|death|dying|funeral|crucifixion|massacre|murder|execution|shipwreck|storm|tempest|slaughter|martyrdom|beheading|crucified|wounded|rough sea)\b/iu;
const REST = /累|疲惫|疲劳|撑了|休息|安静|平静|宁静|缓和|放松|舒缓|低落|难过|\b(?:tired|exhausted|rest|restful|quiet|calm|serene|serenity|relax|sad)\b/iu;
const BRIGHT = /明亮|活力|欢快|喜悦|开心|\b(?:bright|joy|joyful|cheerful|energy|lively)\b/iu;
const NEGATION = /不要|不想|不看|不喜欢|避开|排除|别给|没有|\b(?:not|no|without|avoid|exclude|don['’]t(?: want)?)\b/iu;

function isNegated(clause: string, index: number): boolean {
  // "not forest but sea" and "不要森林，想看海" have separate scopes.
  const prefix = clause.slice(0, index).split(/但是|而是|不过|改看|\bbut\b/iu).at(-1) ?? "";
  return NEGATION.test(prefix);
}

export function parseViewingIntent(query: string): ViewingIntent {
  const subjects = new Set<Subject>();
  const excluded = new Set<Subject>();
  const artists = new Set<string>();
  const excludedArtists = new Set<string>();
  let rest = false;
  let bright = false;
  for (const clause of query.split(/[，。；,;.!?\n]/u)) {
    const contextOnly = /新闻|害怕|担心|\b(?:news|afraid|scared|saw|anxious)\b/iu.test(clause) && !/想看|希望看|给我|要看|\b(?:show|want|looking for)\b/iu.test(clause);
    for (const [key, pattern] of Object.entries(SUBJECTS)) {
      for (const match of clause.matchAll(new RegExp(pattern.source, "giu"))) {
        if (isNegated(clause, match.index)) excluded.add(key as Subject);
        else if (!contextOnly) subjects.add(key as Subject);
      }
    }
    for (const artist of ARTISTS) {
      const match = clause.match(artist.pattern);
      if (match) (isNegated(clause, match.index ?? 0) ? excludedArtists : artists).add(artist.name);
    }
    const restMatch = clause.match(REST);
    const brightMatch = clause.match(BRIGHT);
    if (restMatch && !isNegated(clause, restMatch.index ?? 0)) rest = true;
    if (brightMatch && !isNegated(clause, brightMatch.index ?? 0)) bright = true;
  }
  for (const subject of excluded) subjects.delete(subject);
  for (const artist of excludedArtists) artists.delete(artist);
  const explicitIntensity = subjects.has("war") || subjects.has("death");
  const positiveClauses = query.split(/[，。；,;.!?\n]|\bbut\b/iu).filter((clause) => !NEGATION.test(clause));
  return {
    subjects: [...subjects], excludedSubjects: [...excluded], rest: rest && !explicitIntensity, bright, artists: [...artists], excludedArtists: [...excludedArtists], allowIntense: explicitIntensity,
    retrievalText: [...positiveClauses, ...subjects, ...artists, rest && !explicitIntensity ? "quiet calm serenity restful" : "", bright ? "bright joy lively" : "", NEGATION.test(query) && positiveClauses.every((clause) => !clause.trim()) ? "contemplation" : ""].join(" "),
  };
}

function subjectEvidence(artwork: WebArtwork): string {
  return [artwork.title, ...artwork.subjectTags].join(" ");
}

export function matchesViewingIntent(artwork: WebArtwork, intent: ViewingIntent): boolean {
  const evidence = subjectEvidence(artwork);
  const artistName = (artwork.artistDisplayName ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  if (intent.excludedArtists.some((artist) => artistName.includes(artist))) return false;
  if (intent.artists.length && !intent.artists.some((artist) => artistName.includes(artist))) return false;
  if (intent.excludedSubjects.some((subject) => SUBJECTS[subject].test(evidence))) return false;
  if ((intent.rest || intent.bright) && !intent.allowIntense && INTENSE.test(evidence)) return false;
  if (intent.subjects.length && !intent.subjects.some((subject) => SUBJECTS[subject].test(evidence))) return false;
  return true;
}

export function viewingIntentEvidence(artwork: WebArtwork, intent: ViewingIntent): string[] {
  const result = intent.subjects.filter((subject) => SUBJECTS[subject].test(subjectEvidence(artwork))).map((subject) => `subject:${subject}`);
  for (const subject of intent.subjects) {
    if (SUBJECTS[subject].test(artwork.subjectTags[0] ?? "")) result.push(`primary-subject:${subject}`);
    if (SUBJECTS[subject].test(artwork.title.split(/\bin front of\b/iu)[0]!)) result.push(`title-subject:${subject}`);
  }
  const moods = [...artwork.moodTags, ...artwork.emotionLabels].join(" ");
  if (intent.rest && /\b(?:quiet|calm|serenity|restful|serene)\b/iu.test(moods)) result.push("mood:rest");
  if (intent.bright && /\b(?:joy|bright|hope|lively)\b/iu.test(moods)) result.push("mood:bright");
  return result;
}
