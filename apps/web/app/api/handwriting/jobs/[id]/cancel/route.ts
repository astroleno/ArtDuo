import { cancelHandwritingJob } from "../../../../../../lib/handwriting/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { return cancelHandwritingJob(request, (await context.params).id); }
