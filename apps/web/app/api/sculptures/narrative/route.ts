import { getSculptureNarrative } from "../../../../lib/sculpture-narrative";
import { enforcePublicRequest, publicRequestError, readBoundedRequestJson, RuntimeLimitError } from "../../../../lib/public-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try { await enforcePublicRequest(request.headers, "narrative"); } catch (error) { return publicRequestError(error); }
  try {
    const input = await readBoundedRequestJson(request, 4096) as { id?: unknown; query?: unknown };
    if (!input || typeof input.id !== "string" || typeof input.query !== "string" || input.query.length > 512) throw new TypeError("Invalid sculpture input");
    return Response.json(await getSculptureNarrative(input.id, input.query), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RuntimeLimitError) return publicRequestError(error);
    return Response.json({ error: "这件雕塑的引导暂不可用，馆藏说明仍可阅读。" }, { status: error instanceof TypeError || error instanceof SyntaxError ? 400 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
