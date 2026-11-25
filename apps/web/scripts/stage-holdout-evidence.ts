import { artworkMediumKinds } from "@artduo/contracts";
import { isGalleryArtwork } from "../lib/artwork-eligibility";
import type { WebArtwork } from "../lib/release-catalog";
import type { Clause } from "./stage-holdout-design";

const denied = /未见|没有|画面无|未画出|并非|不见|\b(?:no|without|not depicted)\b/iu;
const uncertain = /不确定|不能确认|无法确认|难以辨认|未能辨认|不明确|不清楚|可能|疑似|似乎|形似|\b(?:unclear|uncertain|possibly|perhaps|unconfirmed)\b/iu;
type Judgment = "positive" | "negative" | "unknown";
type Verdict = { label: Judgment; reason: string };

function evidence(artwork: WebArtwork, clause: Clause): Verdict {
  const check = (observed: boolean | undefined, reason: string): Verdict =>
    ({ label: observed === true ? "positive" : observed === false ? "negative" : "unknown", reason });
  if (clause.kind === "medium") {
    const media = artworkMediumKinds(artwork.medium);
    if (!clause.exclude && clause.value === "drawing" && media.includes("ink") && !media.includes("drawing")) {
      return check(undefined, `馆藏媒材 ${artwork.medium} 未说明墨线是素描还是其他技法`);
    }
    return check(media.length ? media.includes(clause.value) !== Boolean(clause.exclude) : undefined,
      `馆藏媒材 ${artwork.medium ?? "未记录"}；${clause.exclude ? "排除" : "要求"} ${clause.value}`);
  }
  if (clause.kind === "medium-detail") {
    if (new RegExp(clause.pattern, "iu").test(artwork.medium ?? "")) return check(true, `馆藏媒材明确记载 ${artwork.medium}`);
    return check(undefined, `馆藏媒材未明确记载 ${clause.pattern}`);
  }
  const review = artwork.visualEvidence!;
  if (clause.kind === "fact") {
    const state = review.facts[clause.subject];
    return check(state === "present" || state === "absent" ? state === clause.value : undefined,
      `核验事实 ${clause.subject}=${state ?? "unknown"}；要求 ${clause.value}`);
  }
  if (clause.kind === "space") {
    const space = review.spatialFraming;
    return check(space === "open" || space === "framed" || space === "enclosed" ? space === clause.value : undefined,
      `核验空间 ${space ?? "unknown"}；要求 ${clause.value}`);
  }
  const pattern = new RegExp(clause.pattern, "iu");
  const sentences = review.observation.split(/[。；;.!?]/u);
  const observed = sentences.find(text => pattern.test(text) && !denied.test(text) && !uncertain.test(text));
  const excluded = sentences.flatMap(text => text.split(/[，,]/u)).find(text => {
    const mention = text.match(pattern);
    if (!mention || uncertain.test(text)) return false;
    const prefix = text.slice(0, mention.index);
    const denial = prefix.match(denied);
    return denial !== null && !/左边有|右边有|一侧有|可见|绘有|出现|另有/u.test(prefix.slice(denial.index! + denial[0].length));
  });
  if (observed && excluded) return check(undefined, "同图观察中有相互不一致的描述");
  if (observed) return check(true, `同图观察「${observed.trim()}」`);
  if (excluded) return check(false, `同图观察明确排除该细节「${excluded.trim()}」`);
  return check(undefined, `同图观察未确认 ${clause.pattern}`);
}

export function judge(artwork: WebArtwork, criteria: Clause[]): Verdict {
  const checks = criteria.map(clause => evidence(artwork, clause));
  const negative = checks.find(check => check.label === "negative");
  if (negative) return negative;
  const unknown = checks.find(check => check.label === "unknown");
  return unknown ?? { label: "positive", reason: checks.map(check => check.reason).join("；") };
}

export function verifiedHoldoutArtwork(artwork: WebArtwork) {
  const review = artwork.visualEvidence;
  return isGalleryArtwork(artwork) && review?.reviewer === "local-image-review"
    && !artwork.visualEvidenceUnavailable && review.imagePath === artwork.imageUrl
    && review.artworkId === artwork.id && /^sha256:[a-f0-9]{64}$/u.test(review.imageSha256);
}
