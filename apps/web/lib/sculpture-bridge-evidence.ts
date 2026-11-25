import type { SculptureBridgeTheme } from "@artduo/ui";
import type { WebArtwork } from "./release-catalog";

const THEME_EVIDENCE: Record<SculptureBridgeTheme, RegExp> = {
  music: /键盘乐器|弦乐器|管乐器|手鼓|持鼓|击鼓|弹奏|吹奏|(?:乐师|乐手)[^。；]{0,35}演奏|小提琴|钢琴|笛子|竖琴|\b(?:keyboard instruments?|stringed instruments?|violins?|pianos?|harps?|flutes?|trumpets?|drums?)\b/iu,
  drapery: /衣纹|衣褶|裙褶|袖褶|(?:衣服|衣袍|长袍|披风|衣袖|布料)[^，。；]{0,8}褶皱|\b(?:drapery|fabric folds?|cloth folds?|folds? (?:of|in) (?:the )?(?:fabric|cloth|robe|dress|garment))\b/iu,
};
const UNCERTAIN = /未见|不见|未看到|未发现|未画出|未描绘|并无|没有|不含|并非|不是|(?:画面|画中|图中|其中)无|(?:^|[，,\s])无|看不清|看不出|形似|仿佛|可能|疑似|似乎|(?:不|无法|未能|难以|不好)(?:可靠|清楚|准确)?(?:确认|辨认|判断|确定)|\b(?:no|not|without|cannot|can['’]t|unclear|unconfirmed|perhaps|possibly|appears? to)\b/iu;

/** Only observations already verified against the delivered artwork can open the side hall. */
export function sculptureBridgeThemes(artwork: WebArtwork): SculptureBridgeTheme[] {
  const review = artwork.visualEvidence;
  if (!review || artwork.visualEvidenceUnavailable || review.reviewer !== "local-image-review"
    || review.artworkId !== artwork.id || review.imagePath !== artwork.imageUrl || !/^sha256:[a-f0-9]{64}$/u.test(review.imageSha256)) return [];
  const observations = review.observation.split(/[。；;.!?]/u).filter(sentence => !UNCERTAIN.test(sentence));
  return (Object.keys(THEME_EVIDENCE) as SculptureBridgeTheme[]).filter(theme =>
    observations.some(sentence => THEME_EVIDENCE[theme].test(sentence)));
}
