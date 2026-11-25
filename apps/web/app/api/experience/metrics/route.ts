import { publicOrigins } from "../../../../../api/src/runtime/environment";
import { experienceObservability } from "../../../../lib/experience-observability";
import { parseClientExperienceSample } from "../../../../lib/experience-observability-contract";
import { limitExperienceMetrics } from "../../../../lib/experience-metrics-limit";
import { readBoundedRequestJson, RuntimeLimitError } from "../../../../lib/public-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (!origin || site && site !== "same-origin") return false;
  try {
    const page = new URL(origin), internal = new URL(request.url);
    if (page.origin !== origin || page.host !== (request.headers.get("host") ?? internal.host).toLowerCase()) return false;
    if (process.env.ARTDUO_PUBLIC_MODE === "1") return publicOrigins(process.env).includes(origin);
    return page.protocol === internal.protocol && ["127.0.0.1", "localhost", "[::1]"].includes(page.hostname);
  } catch { return false; }
}

const respond = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const store = experienceObservability();
  if (!store) return respond(404);
  if (!sameOrigin(request)) return respond(403);
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return respond(415);
  const retryAfter = limitExperienceMetrics(request.headers);
  if (retryAfter !== undefined) return new Response(null, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfter) } });
  try {
    const sample = parseClientExperienceSample(await readBoundedRequestJson(request, 128));
    if (!sample) return respond(400);
    store.duration(sample.phase, sample.bucket);
    return respond(204);
  } catch (error) {
    return respond(error instanceof RuntimeLimitError && error.status === 413 ? 413 : 400);
  }
}
