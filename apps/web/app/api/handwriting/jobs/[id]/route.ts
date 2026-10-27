import { getHandwritingJob } from "../../../../../lib/handwriting/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { return getHandwritingJob(request, (await context.params).id); }
