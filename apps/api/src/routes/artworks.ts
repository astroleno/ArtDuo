import { readFileSync } from "node:fs";
import path from "node:path";

import type {
  ApiError,
  ArtworkExplanation,
  GroundingContext,
  GroundingScene,
  SourceVersions,
} from "@artduo/contracts";
import { parseReleaseManifest } from "@artduo/contracts";

import { resolveCorpusManifestPath } from "./corpus";
import { buildExplanationCacheKey, InMemoryExplanationCache } from "../services/explanations/explanation-cache";
import { getArtworkExplanation, type ArtworkExplanationGenerator } from "../services/explanations/get-artwork-explanation";
import {
  createServerGroundedExplanationGeneratorFromEnv,
  type ExplanationProviderEnv,
} from "../services/explanations/explanation-generator-adapter";
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
  backgroundSceneId?: string;
  retrievalScore?: number;
  matchedTokens?: string[];
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
  enableServerProvider?: boolean;
  providerEnv?: ExplanationProviderEnv;
  providerFetch?: typeof fetch;
}

function apiError(status: number, code: string, message: string): ApiRouteResponse<ApiError> {
  return { status, body: { code, message } };
}

interface ReleaseGroundingData {
  artworks: Map<string, GroundingContext["artwork"]>;
  scenes: Map<string, GroundingScene>;
  sourceVersions: SourceVersions;
}

function readNestedString(source: Record<string, unknown>, keys: string[]): string | undefined {
  let current: unknown = source;

  for (const key of keys) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" && current.trim() !== "" ? current : undefined;
}

function loadReleaseGroundingData(
  options: ArtworkExplanationRouteOptions,
  releaseVersion: string,
): ReleaseGroundingData {
  const manifestPath = resolveCorpusManifestPath({
    rootDir: options.rootDir,
    releasesRoot: options.releasesRoot,
    releaseVersion,
  });
  const releaseDir = path.dirname(manifestPath);
  const manifest = parseReleaseManifest(JSON.parse(readFileSync(manifestPath, "utf8")) as unknown);

  const artworks = new Map<string, GroundingContext["artwork"]>();
  for (const shard of manifest.shards.metadata) {
    const shardPath = path.resolve(releaseDir, shard.url);
    const records = JSON.parse(readFileSync(shardPath, "utf8")) as Array<Record<string, unknown>>;
    for (const record of records) {
      if (typeof record.id === "string" && record.id) {
        const title = readNestedString(record, ["metadata", "title"]) ?? record.id;
        artworks.set(record.id, {
          id: record.id,
          title,
          artistDisplayName: readNestedString(record, ["metadata", "artistDisplayName"]),
          yearLabel: readNestedString(record, ["metadata", "yearLabel"]),
          medium: readNestedString(record, ["metadata", "medium"]),
          department: readNestedString(record, ["metadata", "department"]),
          description: readNestedString(record, ["metadata", "descriptionClean"])
            ?? readNestedString(record, ["metadata", "descriptionRaw"]),
          objectUrl: readNestedString(record, ["metadata", "objectUrl"]),
          sourceApiUrl: readNestedString(record, ["metadata", "sourceApiUrl"]),
        });
      }
    }
  }

  const scenes = new Map<string, GroundingScene>();
  for (const shard of manifest.shards.backgroundScenes) {
    const shardPath = path.resolve(releaseDir, shard.url);
    const records = JSON.parse(readFileSync(shardPath, "utf8")) as Array<Record<string, unknown>>;
    for (const record of records) {
      if (typeof record.id === "string" && record.id) {
        scenes.set(record.id, {
          id: record.id,
          label: readNestedString(record, ["asset", "label_en"])
            ?? readNestedString(record, ["asset", "label_cn"])
            ?? record.id,
          imageUrl: readNestedString(record, ["asset", "local_public_path"]),
        });
      }
    }
  }

  return {
    artworks,
    scenes,
    sourceVersions: {
      corpusVersion: manifest.release.corpusVersion,
      backgroundCatalogVersion: manifest.release.backgroundCatalogVersion,
      contractsVersion: manifest.release.contractsVersion,
    },
  };
}

function buildGroundingContext(
  request: ArtworkExplanationRouteRequest,
  releaseData: ReleaseGroundingData,
): GroundingContext | undefined {
  const artwork = releaseData.artworks.get(request.artworkId);
  if (!artwork) {
    return undefined;
  }
  const scene = request.backgroundSceneId ? releaseData.scenes.get(request.backgroundSceneId) : undefined;

  return {
    userText: request.contextText,
    releaseVersion: request.releaseVersion,
    artwork,
    scene,
    retrievalScore: request.retrievalScore ?? 0,
    matchedTokens: request.matchedTokens ?? [],
    sourceVersions: releaseData.sourceVersions,
  };
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
  const generator = options.generator ?? (options.enableServerProvider
    ? createServerGroundedExplanationGeneratorFromEnv({
        env: options.providerEnv,
        fetchImpl: options.providerFetch,
      })
    : undefined);

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
      const releaseData = loadReleaseGroundingData(options, request.releaseVersion);
      const grounding = buildGroundingContext(request, releaseData);
      if (!grounding) {
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

      if (budget && generator) {
        try {
          assertWithinBudget(budget);
        } catch (error) {
          return finish(apiError(429, "budget_exceeded", (error as Error).message), "budget_exceeded");
        }
      }

      let explanation: ArtworkExplanation;
      try {
        explanation = await getArtworkExplanation(
          cache,
          {
            artworkId: request.artworkId,
            releaseVersion: request.releaseVersion,
            contextText: request.contextText,
            grounding,
          },
          generator,
        );
      } catch {
        return finish(
          apiError(502, "explanation_provider_failed", "Artwork explanation provider failed"),
          "provider_failed",
        );
      }

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
