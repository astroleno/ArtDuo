import { randomUUID } from "node:crypto";

import type { ApiError, CreateCurationRequest, CurationSession } from "@artduo/contracts";

import { InMemoryIdempotencyStore } from "../services/http/idempotency-store";
import { InMemoryCurationSessionStore } from "../services/curation/session-store";
import { createSessionToken, verifySessionToken } from "../services/auth/session-token";

export interface ApiRouteResponse<T> {
  status: number;
  body: T;
  headers?: Record<string, string>;
}

const sessionStore = new InMemoryCurationSessionStore();
const idempotencyStore = new InMemoryIdempotencyStore<CurationSession>();

function readHeader(headers: Record<string, string | undefined> | undefined, key: string): string | undefined {
  if (!headers) {
    return undefined;
  }

  const hit = Object.entries(headers).find(([name]) => name.toLowerCase() === key.toLowerCase());
  return hit?.[1];
}

function parseBearerToken(authorizationHeader?: string): string | undefined {
  if (!authorizationHeader) {
    return undefined;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return undefined;
  }

  return token;
}

function buildSession(request: CreateCurationRequest, now = new Date()): CurationSession {
  const id = `cur_${randomUUID()}`;
  const tokenRecord = createSessionToken(id, now);
  const nowIso = now.toISOString();

  return {
    id,
    status: "pending",
    releaseVersion: request.releaseVersion,
    sourceVersions: request.sourceVersions,
    unitIds: request.exhibitionSnapshot.map((unit) => unit.unitId),
    ownership: {
      token: tokenRecord.token,
      expiresAt: tokenRecord.expiresAt,
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function apiError(status: number, code: string, message: string): ApiRouteResponse<ApiError> {
  return { status, body: { code, message } };
}

export function createCurationSession(
  request: CreateCurationRequest,
  headers?: Record<string, string | undefined>,
): ApiRouteResponse<CurationSession> {
  const idempotencyKey = readHeader(headers, "Idempotency-Key");
  const session = idempotencyKey
    ? idempotencyStore.getOrSet(idempotencyKey, () => sessionStore.create(buildSession(request)))
    : sessionStore.create(buildSession(request));

  return {
    status: 201,
    body: session,
    headers: {
      "Cache-Control": "no-store",
    },
  };
}

export function getCurationSession(
  sessionId: string,
  headers?: Record<string, string | undefined>,
): ApiRouteResponse<CurationSession | ApiError> {
  const session = sessionStore.get(sessionId);
  if (!session) {
    return apiError(404, "session_not_found", `Curation session not found: ${sessionId}`);
  }

  const authorization = readHeader(headers, "Authorization");
  const token = parseBearerToken(authorization);
  if (!token || !verifySessionToken(token, sessionId)) {
    return apiError(403, "forbidden", "Ownership token is missing or invalid");
  }

  return {
    status: 200,
    body: session,
    headers: {
      "Cache-Control": "no-store",
    },
  };
}

export function resetCurationRouteState(): void {
  sessionStore.clear();
  idempotencyStore.clear();
}
