import { parseCurationNarrativePiece, type CurationNarrativePiece } from "@artduo/contracts";

export interface NarrativeDelivery extends CurationNarrativePiece { source: "grounded" | "fallback" }
export async function* readCurationNarrativeStream(response: Response, curationId: string, artworkIds: string[]): AsyncGenerator<NarrativeDelivery> {
  if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/event-stream")) throw new Error("Narrative is unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const allowed = new Set(artworkIds);
  const delivered = new Set<string>();
  let buffer = "", sequence = 0, received = 0, complete = false;
  const parse = (frame: string): NarrativeDelivery | undefined => {
    const event = frame.split(/\r?\n/u).find((line) => line.startsWith("event:"))?.slice(6).trim();
    const data = frame.split(/\r?\n/u).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
    if (!data) return;
    const message = JSON.parse(data);
    if (message.schemaVersion !== 1 || message.curationId !== curationId || message.sequence !== sequence++) throw new TypeError("Narrative belongs to another exhibition or sequence");
    if (event === "complete") {
      if (delivered.size !== artworkIds.length + 2) throw new TypeError("Narrative is incomplete");
      complete = true; return;
    }
    if (event !== "piece") throw new TypeError("Unknown narrative event");
    const piece = parseCurationNarrativePiece(message.piece);
    const key = piece.kind === "note" ? `note:${piece.artworkId}` : piece.kind;
    if (delivered.has(key) || !["grounded", "fallback"].includes(message.piece.source)
      || piece.evidenceIds.some((id) => !allowed.has(id))
      || piece.kind === "note" && (!allowed.has(piece.artworkId!) || !piece.evidenceIds.includes(piece.artworkId!))) throw new TypeError("Invalid narrative identity or evidence");
    delivered.add(key);
    return { ...piece, source: message.piece.source };
  };
  try {
    while (!complete) {
      const { value, done } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > 100_000) throw new TypeError("Narrative is too large");
      buffer += decoder.decode(value, { stream: true });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/u.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const piece = parse(frame);
        if (piece) yield piece;
        if (complete) break;
      }
    }
    if (!complete) throw new Error("Narrative stream interrupted");
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
