import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
let inMemorySecret: string | undefined;

export interface SessionTokenRecord {
  token: string;
  expiresAt: string;
}

function getSecret(): string {
  if (process.env.ARTDUO_SESSION_TOKEN_SECRET) {
    return process.env.ARTDUO_SESSION_TOKEN_SECRET;
  }

  if (!inMemorySecret) {
    inMemorySecret = randomBytes(32).toString("hex");
  }

  return inMemorySecret;
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionToken(sessionId: string, now = new Date()): SessionTokenRecord {
  const expiresAt = new Date(now.getTime() + DEFAULT_TTL_MS).toISOString();
  const payload = JSON.stringify({ sessionId, expiresAt });
  const payloadBase64 = Buffer.from(payload, "utf8").toString("base64url");
  const signature = signPayload(payloadBase64);

  return {
    token: `${payloadBase64}.${signature}`,
    expiresAt,
  };
}

export function verifySessionToken(token: string, sessionId: string, now = new Date()): boolean {
  try {
    const [payloadBase64, signature] = token.split(".");
    if (!payloadBase64 || !signature) {
      return false;
    }

    const expected = signPayload(payloadBase64);
    if (!timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"))) {
      return false;
    }

    const parsed = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8")) as {
      sessionId?: string;
      expiresAt?: string;
    };
    if (!parsed.sessionId || !parsed.expiresAt) {
      return false;
    }

    return parsed.sessionId === sessionId && new Date(parsed.expiresAt).getTime() > now.getTime();
  } catch {
    return false;
  }
}
