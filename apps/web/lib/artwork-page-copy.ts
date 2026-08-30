import type { ArtworkExplanation } from "@artduo/contracts";

export function buildRecommendationReason(explanation: ArtworkExplanation): string {
  if (explanation.status !== "ready" || !explanation.content?.evidence) {
    return "解释会在不阻塞作品阅读的前提下补全。";
  }

  const grounding = explanation.content.evidence.grounding;
  const sceneLabel = grounding.scene?.label ?? "当前展厅";
  const tokens = grounding.matchedTokens.slice(0, 3);
  const tokenText = tokens.length > 0 ? `；检索命中的公开线索包括「${tokens.join(" / ")}」` : "";

  return `这件作品进入路线，是因为检索记录与当前观看方向存在可见关联${tokenText}，并与「${sceneLabel}」组成当前展示。这里只说明选择依据，不把检索结果写成作品主题或作者意图。`;
}
