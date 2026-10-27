import type { ArtworkExplanation } from "@artduo/contracts";
import { sameReadingText } from "@artduo/ui";

export function buildArtworkReadingCopy(input: { curatorNote?: string; storySnippet?: string; description?: string }): { primary?: string; description?: string } {
  const clean = (text?: string) => text?.trim() && !/Strong\s+.+\s+fit with usable image and title signal/iu.test(text) ? text.trim() : undefined;
  const description = clean(input.description);
  const primary = clean(input.curatorNote) ?? clean(input.storySnippet) ?? description;
  return { primary, description: sameReadingText(primary, description) ? undefined : description };
}

export function buildRecommendationReason(explanation: ArtworkExplanation): string {
  if (explanation.status !== "ready" || !explanation.content?.evidence) {
    return "作品讲解尚未就绪，可以先查看馆藏资料。";
  }

  const grounding = explanation.content.evidence.grounding;
  const labels: Record<string, string> = { interior: "室内空间", architecture: "建筑与空间", sea: "海边", water: "水面", forest: "树木", mountain: "山景", moon: "月光", moonlight: "月光", flowers: "花卉", stillLife: "静物", portrait: "肖像", war: "战争题材", death: "死亡题材", name: "指定的作品或作者" };
  const features = [...new Set(grounding.matchedTokens.map((token) => labels[token.split(":").at(-1)!]).filter(Boolean))].slice(0, 3);
  return features.length ? `这件作品与本次观看中的「${features.join("、")}」线索相连。可以从画面与馆藏资料开始，决定在哪里多停留一会。`
    : "这件作品是本次选集中的一个停留点。可以从画面与馆藏资料开始，再决定停留多久。";
}
