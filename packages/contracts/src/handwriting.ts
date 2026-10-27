export const HANDWRITING_CARD_VERSION = "keepsake-v1" as const;
export const HANDWRITING_STATES = ["queued", "running", "preparing", "ready", "failed", "canceled", "expired"] as const;
export type HandwritingState = typeof HANDWRITING_STATES[number];

export interface ExhibitionKeepsakeDraft {
  exhibitionId: string;
  artworkId: string;
  releaseVersion: string;
  closingText: string;
  viewerSignature?: string;
  styleCode: string;
  cardVersion: typeof HANDWRITING_CARD_VERSION;
  contentDigest: string;
}

export interface HandwritingStyle { code: string; name: string; previewUrl?: string }
export interface HandwritingLayer {
  url: string;
  width: number;
  height: number;
  aigc: Record<string, string>;
  label: "AI生成 · Inko";
  upstreamId: string;
  sourceProduceIds?: string[];
}
export interface HandwritingJob {
  id: string;
  contentDigest: string;
  state: HandwritingState;
  createdAt: string;
  updatedAt: string;
  retryAfterMs: number;
  message?: string;
  errorCode?: string;
  layer?: HandwritingLayer;
}
export interface HandwritingOptions {
  available: boolean;
  message?: string;
  styles: HandwritingStyle[];
}
export interface HandwritingFailure { code: string; message: string; retryAfterMs?: number }
export interface CreateHandwritingJob {
  requestId: string;
  confirmed: true;
  draft: ExhibitionKeepsakeDraft;
  curationId?: string;
}

/** The same exact text and field order are hashed in the browser and server. */
export function keepsakeDraftIdentity(draft: Omit<ExhibitionKeepsakeDraft, "contentDigest">): string {
  return JSON.stringify([draft.exhibitionId, draft.artworkId, draft.releaseVersion, draft.closingText,
    draft.viewerSignature ?? "", draft.styleCode, draft.cardVersion]);
}

export function keepsakeWritingText(draft: Pick<ExhibitionKeepsakeDraft, "closingText" | "viewerSignature">): string {
  return draft.closingText + (draft.viewerSignature ? `\n${draft.viewerSignature}` : "");
}

export function parseKeepsakeDraft(value: unknown): ExhibitionKeepsakeDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Invalid keepsake draft");
  const d = value as Record<string, unknown>;
  const text = (key: string, max: number, pattern?: RegExp): string => {
    const v = d[key];
    if (typeof v !== "string" || !v.trim() || Array.from(v).length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v) || pattern && !pattern.test(v)) throw new TypeError(`Invalid ${key}`);
    return v;
  };
  if (d.cardVersion !== HANDWRITING_CARD_VERSION) throw new TypeError("Unsupported keepsake card version");
  const signature = d.viewerSignature;
  if (signature !== undefined && (typeof signature !== "string" || Array.from(signature).length > 40 || /[\r\n\u0000-\u001f]/u.test(signature))) throw new TypeError("Invalid viewer signature");
  return { exhibitionId: text("exhibitionId", 100, /^ex-[a-zA-Z0-9_-]+$/u), artworkId: text("artworkId", 160, /^[\w.-]+$/u),
    releaseVersion: text("releaseVersion", 120, /^[\w.-]+$/u), closingText: text("closingText", 2000),
    ...(signature ? { viewerSignature: signature as string } : {}), styleCode: text("styleCode", 80, /^[\w-]+$/u),
    cardVersion: HANDWRITING_CARD_VERSION, contentDigest: text("contentDigest", 64, /^[a-f0-9]{64}$/u) };
}
