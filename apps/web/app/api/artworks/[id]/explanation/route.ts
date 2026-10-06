import { NextResponse } from "next/server";

import { getArtworkExplanationClient } from "../../../../../lib/explanation-client";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  const body = value as Record<string, unknown>;
  const releaseVersion = typeof body.releaseVersion === "string" ? body.releaseVersion : "";
  const query = typeof body.query === "string" ? body.query.slice(0, 1000) : "";
  const backgroundSceneId = typeof body.backgroundSceneId === "string" && body.backgroundSceneId ? body.backgroundSceneId : undefined;
  const retrievalScore = typeof body.retrievalScore === "number" && Number.isFinite(body.retrievalScore) ? body.retrievalScore : undefined;
  const matchedTokens = Array.isArray(body.matchedTokens)
    ? body.matchedTokens.filter((token): token is string => typeof token === "string").slice(0, 12).map((token) => token.slice(0, 80))
    : [];
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(releaseVersion)) return NextResponse.json({ message: "Invalid release version" }, { status: 400 });
  const explanation = await getArtworkExplanationClient({ artworkId: id, releaseVersion, contextText: query, backgroundSceneId, retrievalScore, matchedTokens });
  return NextResponse.json(explanation, { status: explanation.status === "failed" ? 503 : 200 });
}
