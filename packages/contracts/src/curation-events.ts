import { expectObject, readLiteral, readString } from "./internal/validation";

import { ArtworkExplanation, parseArtworkExplanation } from "./artwork-explanation";
import { CurationSession, parseCurationSession } from "./curation-session";

export type CurationEvent =
  | { type: "session.created"; session: CurationSession }
  | { type: "session.updated"; session: CurationSession }
  | { type: "explanation.updated"; explanation: ArtworkExplanation }
  | { type: "session.failed"; sessionId: string; error: string; occurredAt: string };

const CURATION_EVENT_TYPES = ["session.created", "session.updated", "explanation.updated", "session.failed"] as const;

export function parseCurationEvent(value: unknown, path = "CurationEvent"): CurationEvent {
  const event = expectObject(value, path);
  const type = readLiteral(event, "type", CURATION_EVENT_TYPES, path);

  if (type === "session.created" || type === "session.updated") {
    return {
      type,
      session: parseCurationSession(event.session, `${path}.session`),
    };
  }

  if (type === "explanation.updated") {
    return {
      type,
      explanation: parseArtworkExplanation(event.explanation, `${path}.explanation`),
    };
  }

  return {
    type,
    sessionId: readString(event, "sessionId", path),
    error: readString(event, "error", path),
    occurredAt: readString(event, "occurredAt", path),
  };
}
