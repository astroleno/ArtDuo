import { projectRootFromCwd } from "../../../../api/src/runtime/environment";
import { inspectReleaseReadiness } from "../../../lib/release-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  try {
    const result = inspectReleaseReadiness(projectRootFromCwd());
    return Response.json(result, { status: result.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
