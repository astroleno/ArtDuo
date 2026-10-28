import type { ArtworkMedium } from "./artwork-evidence";

/** Request vocabulary shared by painting selection and the sculpture interlude. */
export const ARTWORK_MEDIUM_REQUESTS: ReadonlyArray<readonly [ArtworkMedium, RegExp]> = [
  ["oil", /油画|油彩|\boils?\b/iu], ["watercolor", /水彩|\bwatercolou?rs?\b/iu],
  ["print", /版画|木版|铜版|蚀刻|石版|\b(?:prints?|etchings?|engravings?|woodcuts?|woodblocks?|lithographs?|mezzotints?)\b/iu],
  ["drawing", /素描|炭笔|铅笔|\b(?:drawings?|charcoal|pencils?)\b/iu], ["pastel", /粉彩|色粉|\bpastels?\b/iu],
  ["ink", /水墨|墨笔|\bink\b/iu], ["tempera", /蛋彩|\btempera\b/iu],
  ["fresco", /壁画|\bfrescos?\b|\bfrescoes\b/iu], ["gouache", /水粉|\bgouache\b/iu],
];

export function hasExclusivePaintingRequest(clause: string): boolean {
  const terms = [...ARTWORK_MEDIUM_REQUESTS.map(([, pattern]) => pattern), /绘画|画作|风景|静物|\b(?:paintings?|landscapes?|still lifes?)\b/iu];
  return terms.some(pattern => [...clause.matchAll(new RegExp(pattern.source, "giu"))].some(match => {
    const before = clause.slice(0, match.index);
    const exclusive = before.match(/(?:只(?:要|看|想看|想要|接受|限)|仅(?:限|看|要)|全部|全是|\bonly\b)[^，。；,;.!?]{0,60}$/iu);
    if (exclusive && !/(?:不|不是|并非|不想|不愿(?:意)?|不希望|\bnot\s*|\b(?:don['’]t|do not)\s+want\s*)$/iu.test(before.slice(0, exclusive.index))) return true;
    return /^\s+only\b/iu.test(clause.slice(match.index! + match[0].length));
  }));
}
