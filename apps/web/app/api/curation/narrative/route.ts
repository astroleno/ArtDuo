import { loadWebReleaseCatalog } from "../../../../lib/release-catalog";
import { readSavedCuration } from "../../../../lib/semantic-curator";
import { getExhibitionNarrative } from "../../../../lib/exhibition-narrative-server";
import { enforcePublicRequest, publicRequestError } from "../../../../lib/public-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try { await enforcePublicRequest(request.headers, "narrative"); } catch (error) { return publicRequestError(error); }
  const params = new URL(request.url).searchParams;
  const curationId = params.get("curationId") ?? "";
  const releaseVersion = params.get("releaseVersion") ?? "";
  let catalog, curation;
  try {
    if (!releaseVersion) throw new Error("Missing release");
    catalog = loadWebReleaseCatalog({ releaseVersion });
    curation = readSavedCuration(catalog, curationId);
  } catch { return Response.json({ error: "This saved exhibition is unavailable." }, { status: 404 }); }
  const run = getExhibitionNarrative(catalog, curation);
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let active = true;
      let sequence = 0;
      const send = (event: string, value: unknown) => {
        if (active) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify({ schemaVersion: 1, curationId, sequence: sequence++, ...value as object })}\n\n`));
      };
      const listener = (piece: typeof run.pieces[number]) => send("piece", { piece });
      cleanup = () => { active = false; run.listeners.delete(listener); request.signal.removeEventListener("abort", cleanup); };
      if (request.signal.aborted) { cleanup(); controller.close(); return; }
      for (const piece of run.pieces) listener(piece);
      run.listeners.add(listener);
      request.signal.addEventListener("abort", cleanup, { once: true });
      void run.complete.then(() => { if (active) { send("complete", {}); controller.close(); } cleanup(); });
    },
    cancel() { cleanup(); },
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
