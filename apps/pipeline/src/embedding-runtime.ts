import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  createFallbackEmbeddingProvider,
  createLocalHashEmbeddingProvider,
  createRemoteOpenAICompatibleEmbeddingProvider,
  type EmbeddingProviderMode,
  type TextEmbeddingProvider,
} from "@artduo/corpus";

export interface EmbeddingRuntimeCliOptions {
  rootDir?: string;
  embeddingProviderMode?: string;
  embeddingEndpoint?: string;
  embeddingModel?: string;
  embeddingApiKey?: string;
  embeddingApiKeySlot?: number;
  embeddingTimeoutMs?: number;
  embeddingAllowFallback?: boolean;
  defaultProviderMode?: EmbeddingProviderMode;
  defaultAllowFallback?: boolean;
}

export interface ResolvedEmbeddingRuntime {
  provider: TextEmbeddingProvider;
  requestedProviderMode: EmbeddingProviderMode;
  summary: {
    requestedProviderMode: EmbeddingProviderMode;
    configuredProviderMode: EmbeddingProviderMode;
    endpoint?: string;
    model: string;
    apiKeySlot?: number;
    fallbackEnabled: boolean;
    envPaths: string[];
  };
}

type RuntimeEnv = Record<string, string>;

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function normalizeProviderMode(value: string | undefined): EmbeddingProviderMode {
  switch ((value ?? "").trim().toLowerCase()) {
    case "":
    case "local":
    case "local-hash":
      return "local-hash";
    case "remote":
    case "openai-compatible":
    case "remote-openai-compatible":
    case "bge":
      return "remote-openai-compatible";
    default:
      throw new Error(`Unsupported embedding provider mode: ${value}`);
  }
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  if (["1", "true", "yes", "on"].includes(value.trim().toLowerCase())) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value.trim().toLowerCase())) {
    return false;
  }

  return undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseEnvFile(content: string): RuntimeEnv {
  const result: RuntimeEnv = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");

    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function loadRuntimeEnv(rootDir: string): { env: RuntimeEnv; envPaths: string[] } {
  const candidates = [
    path.join(rootDir, ".env"),
    path.join(rootDir, ".env.local"),
  ];
  const loaded: RuntimeEnv = {};
  const envPaths: string[] = [];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) {
      continue;
    }

    Object.assign(loaded, parseEnvFile(readFileSync(filePath, "utf8")));
    envPaths.push(filePath);
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      loaded[key] = value;
    }
  }

  return { env: loaded, envPaths };
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim() !== "");
}

function resolveApiKey(env: RuntimeEnv, explicitApiKey: string | undefined, keySlot: number | undefined): string | undefined {
  if (explicitApiKey && explicitApiKey.trim() !== "") {
    return explicitApiKey.trim();
  }

  const slot = keySlot ?? 1;

  if (slot === 2) {
    return firstNonEmpty(
      env.EMBEDDING_API_KEY_2,
      env.OPENAI_API_KEY_2,
      env.EMBEDDING_API_KEY,
      env.OPENAI_API_KEY,
    );
  }

  return firstNonEmpty(
    env.EMBEDDING_API_KEY,
    env.OPENAI_API_KEY,
    env.EMBEDDING_API_KEY_2,
    env.OPENAI_API_KEY_2,
  );
}

export function resolveEmbeddingRuntime(
  options: EmbeddingRuntimeCliOptions = {},
): ResolvedEmbeddingRuntime {
  const rootDir = resolveRootDir(options.rootDir);
  const { env, envPaths } = loadRuntimeEnv(rootDir);
  const requestedProviderMode = normalizeProviderMode(
    firstNonEmpty(options.embeddingProviderMode, env.EMBEDDING_PROVIDER, options.defaultProviderMode),
  );

  if (requestedProviderMode === "local-hash") {
    return {
      provider: createLocalHashEmbeddingProvider(),
      requestedProviderMode,
      summary: {
        requestedProviderMode,
        configuredProviderMode: "local-hash",
        model: createLocalHashEmbeddingProvider().model,
        fallbackEnabled: false,
        envPaths,
      },
    };
  }

  const keySlot = options.embeddingApiKeySlot ?? parseNumber(env.EMBEDDING_API_KEY_SLOT);
  const endpoint = firstNonEmpty(options.embeddingEndpoint, env.EMBEDDING_BASE_URL, env.BGE_MODEL_PATH);
  const model = firstNonEmpty(options.embeddingModel, env.EMBEDDING_MODEL, env.BGE_MODEL_REPO);
  const apiKey = resolveApiKey(env, options.embeddingApiKey, keySlot);
  const timeoutMs = options.embeddingTimeoutMs ?? parseNumber(env.EMBEDDING_TIMEOUT_MS) ?? 30000;
  const fallbackEnabled = options.embeddingAllowFallback
    ?? parseBoolean(env.EMBEDDING_ALLOW_FALLBACK)
    ?? options.defaultAllowFallback
    ?? true;

  if (!endpoint || !model || !apiKey) {
    if (fallbackEnabled) {
      const provider = createLocalHashEmbeddingProvider();

      return {
        provider,
        requestedProviderMode,
        summary: {
          requestedProviderMode,
          configuredProviderMode: "local-hash",
          model: provider.model,
          apiKeySlot: keySlot,
          fallbackEnabled: true,
          envPaths,
        },
      };
    }

    throw new Error("Remote embedding provider is missing endpoint, model, or API key.");
  }

  const remoteProvider = createRemoteOpenAICompatibleEmbeddingProvider({
    endpoint,
    model,
    apiKey,
    timeoutMs,
  });
  const provider = fallbackEnabled
    ? createFallbackEmbeddingProvider(remoteProvider, createLocalHashEmbeddingProvider())
    : remoteProvider;

  return {
    provider,
    requestedProviderMode,
    summary: {
      requestedProviderMode,
      configuredProviderMode: requestedProviderMode,
      endpoint,
      model,
      apiKeySlot: keySlot,
      fallbackEnabled,
      envPaths,
    },
  };
}
