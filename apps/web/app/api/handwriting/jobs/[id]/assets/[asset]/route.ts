import { getHandwritingAsset } from "../../../../../../../lib/handwriting/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string; asset: string }> }) {
  const params = await context.params; return getHandwritingAsset(request, params.id, params.asset);
}
