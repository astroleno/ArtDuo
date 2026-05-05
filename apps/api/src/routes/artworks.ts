import { readFileSync } from "node:fs";
import path from "node:path";

import type { ApiError, ArtworkExplanation, ArtworkExplanationContent } from "@artduo/contracts";
import { parseReleaseManifest } from "@artduo/contracts";

import { resolveCorpusManifestPath } from "./corpus";
import { buildExplanationCacheKey, InMemoryExplanationCache } from "../services/explanations/explanation-cache";
import { getArtworkExplanation, type ArtworkExplanationGenerator } from "../services/explanations/get-artwork-explanation";
import { assertWithinBudget } from "../services/curation/budget-guard";
import { defaultCurationMetrics, type InMemoryMetrics } from "../observability/metrics";
import { defaultCurationRequestLog, type InMemoryRequestLog } from "../observability/request-log";

export interface ApiRouteResponse<T> {
  status: number;
  body: T;
  headers?: Record<string, string>;
}

export interface ArtworkExplanationRouteRequest {
  artworkId: string;
  releaseVersion: string;
  contextText: string;
}

export interface ArtworkExplanationBudgetInput {
  estimatedTokens: number;
  maxTokens: number;
}

export interface ArtworkExplanationRouteOptions {
  rootDir?: string;
  releasesRoot?: string;
  generator?: ArtworkExplanationGenerator;
  cache?: InMemoryExplanationCache;
  metrics?: InMemoryMetrics;
  requestLog?: InMemoryRequestLog;
}

function apiError(status: number, code: string, message: string): ApiRouteResponse<ApiError> {
  return { status, body: { code, message } };
}

function loadArtworkIds(options: ArtworkExplanationRouteOptions, releaseVersion: string): Set<string> {
  const manifestPath = resolveCorpusManifestPath({
    rootDir: options.rootDir,
    releasesRoot: options.releasesRoot,
    releaseVersion,
  });
  const releaseDir = path.dirname(manifestPath);
  const manifest = parseReleaseManifest(JSON.parse(readFileSync(manifestPath, "utf8")) as unknown);

  const ids = new Set<string>();
  for (const shard of manifest.shards.metadata) {
    const shardPath = path.resolve(releaseDir, shard.url);
    const records = JSON.parse(readFileSync(shardPath, "utf8")) as Array<{ id?: string }>;
    for (const record of records) {
      if (typeof record.id === "string" && record.id) {
        ids.add(record.id);
      }
    }
  }

  return ids;
}

export function createArtworkExplanationRoute(options: ArtworkExplanationRouteOptions = {}): {
  getArtworkExplanation: (
    request: ArtworkExplanationRouteRequest,
    budget?: ArtworkExplanationBudgetInput,
  ) => Promise<ApiRouteResponse<ArtworkExplanation | ApiError>> | ApiRouteResponse<ArtworkExplanation | ApiError>;
} {
  const cache = options.cache ?? new InMemoryExplanationCache();
  const metrics = options.metrics ?? defaultCurationMetrics;
  const requestLog = options.requestLog ?? defaultCurationRequestLog;

  return {
    async getArtworkExplanation(
      request: ArtworkExplanationRouteRequest,
      budget?: ArtworkExplanationBudgetInput,
    ): Promise<ApiRouteResponse<ArtworkExplanation | ApiError>> {
      const startedAt = Date.now();
      const finish = (
        response: ApiRouteResponse<ArtworkExplanation | ApiError>,
        result: string,
      ): ApiRouteResponse<ArtworkExplanation | ApiError> => {
        const durationMs = Date.now() - startedAt;
        metrics.recordDuration("explanation.generate", durationMs, {
          artworkId: request.artworkId,
          releaseVersion: request.releaseVersion,
          result,
        });
        requestLog.append({
          requestId: `artwork-explanation-${request.releaseVersion}-${request.artworkId}`,
          method: "GET",
          route: "/v1/artworks/:id/explanation",
          status: response.status,
          durationMs,
          tags: {
            artworkId: request.artworkId,
            releaseVersion: request.releaseVersion,
            result,
          },
        });

        return response;
      };
      const ids = loadArtworkIds(options, request.releaseVersion);
      if (!ids.has(request.artworkId)) {
        return finish(apiError(404, "artwork_not_found", `Artwork not found: ${request.artworkId}`), "not_found");
      }

      const cacheKey = buildExplanationCacheKey({
        releaseVersion: request.releaseVersion,
        artworkId: request.artworkId,
        contextText: request.contextText,
      });
      const cached = cache.get(cacheKey);
      if (cached) {
        return finish(
          {
            status: 200,
            body: {
              artworkId: request.artworkId,
              releaseVersion: request.releaseVersion,
              status: "ready",
              content: cached,
              cacheKey,
              updatedAt: cached.generatedAt,
            },
            headers: {
              "Cache-Control": "no-store",
            },
          },
          "cache_hit",
        );
      }

      if (budget && options.generator) {
        try {
          assertWithinBudget(budget);
        } catch (error) {
          return finish(apiError(429, "budget_exceeded", (error as Error).message), "budget_exceeded");
        }
      }

      const explanation = await getArtworkExplanation(
        cache,
        {
          artworkId: request.artworkId,
          releaseVersion: request.releaseVersion,
          contextText: request.contextText,
        },
        options.generator as ((input: {
          artworkId: string;
          releaseVersion: string;
          contextText: string;
        }) => ArtworkExplanationContent | Promise<ArtworkExplanationContent>) | undefined,
      );

      return finish(
        {
          status: 200,
          body: explanation,
          headers: {
            "Cache-Control": "no-store",
          },
        },
        explanation.status,
      );
    },
  };
}
