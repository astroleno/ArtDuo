import {
  DEFAULT_EMBEDDING_DIMENSIONS,
  LOCAL_EMBEDDING_MODEL_ID,
  embedText,
  normalizeQueryText,
  tokenizeQueryText,
} from "./query-embedding";

export type EmbeddingProviderMode = "local-hash" | "remote-openai-compatible";

export interface EmbeddedTextVector {
  provider: EmbeddingProviderMode;
  model: string;
  dimensions: number;
  normalizedText: string;
  tokens: string[];
  vector: number[];
}

export interface EmbedTextsOptions {
  dimensions?: number;
}

export interface TextEmbeddingProvider {
  mode: EmbeddingProviderMode;
  model: string;
  embedText(value: string, options?: EmbedTextsOptions): Promise<EmbeddedTextVector>;
  embedTexts(values: string[], options?: EmbedTextsOptions): Promise<EmbeddedTextVector[]>;
}

export interface RemoteOpenAICompatibleEmbeddingProviderOptions {
  endpoint: string;
  model: string;
  apiKey: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

interface OpenAICompatibleEmbeddingResponse {
  model?: unknown;
  data?: Array<{
    index?: unknown;
    embedding?: unknown;
  }>;
}

function expectNumberArray(value: unknown, path: string): number[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${path}: expected number array`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== "number" || Number.isNaN(entry)) {
      throw new TypeError(`${path}[${index}]: expected number`);
    }

    return entry;
  });
}

function readModel(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

export function createLocalHashEmbeddingProvider(): TextEmbeddingProvider {
  return {
    mode: "local-hash",
    model: LOCAL_EMBEDDING_MODEL_ID,
    async embedText(value: string, options: EmbedTextsOptions = {}): Promise<EmbeddedTextVector> {
      const embedded = embedText(value, { dimensions: options.dimensions });

      return {
        provider: "local-hash",
        model: embedded.model,
        dimensions: embedded.dimensions,
        normalizedText: embedded.normalizedText,
        tokens: embedded.tokens,
        vector: embedded.vector,
      };
    },
    async embedTexts(values: string[], options: EmbedTextsOptions = {}): Promise<EmbeddedTextVector[]> {
      return Promise.all(values.map((value) => this.embedText(value, options)));
    },
  };
}

export function createRemoteOpenAICompatibleEmbeddingProvider(
  options: RemoteOpenAICompatibleEmbeddingProviderOptions,
): TextEmbeddingProvider {
  const endpoint = options.endpoint.trim();
  const model = options.model.trim();
  const apiKey = options.apiKey.trim();
  const timeoutMs = options.timeoutMs ?? 30000;

  if (!endpoint) {
    throw new Error("Remote embedding provider requires a non-empty endpoint.");
  }

  if (!model) {
    throw new Error("Remote embedding provider requires a non-empty model.");
  }

  if (!apiKey) {
    throw new Error("Remote embedding provider requires a non-empty API key.");
  }

  return {
    mode: "remote-openai-compatible",
    model,
    async embedText(value: string, embedOptions: EmbedTextsOptions = {}): Promise<EmbeddedTextVector> {
      const [embedded] = await this.embedTexts([value], embedOptions);

      if (!embedded) {
        throw new Error("Remote embedding provider returned an empty response for a single input.");
      }

      return embedded;
    },
    async embedTexts(values: string[], embedOptions: EmbedTextsOptions = {}): Promise<EmbeddedTextVector[]> {
      if (values.length === 0) {
        return [];
      }

      const normalizedTexts = values.map((value) => normalizeQueryText(value));
      const tokens = values.map((value) => tokenizeQueryText(value));
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const body: Record<string, unknown> = {
          model,
          input: normalizedTexts,
          encoding_format: "float",
        };

        if (typeof embedOptions.dimensions === "number" && Number.isFinite(embedOptions.dimensions)) {
          body.dimensions = embedOptions.dimensions;
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...options.headers,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const responseText = await response.text();

        if (!response.ok) {
          throw new Error(`Remote embedding provider error ${response.status}: ${responseText.slice(0, 400)}`);
        }

        const parsed = JSON.parse(responseText) as OpenAICompatibleEmbeddingResponse;
        const data = parsed.data;

        if (!Array.isArray(data)) {
          throw new TypeError("Remote embedding provider response is missing data[].");
        }

        if (data.length !== values.length) {
          throw new Error(`Remote embedding provider returned ${data.length} embeddings for ${values.length} inputs.`);
        }

        const resolvedModel = readModel(parsed.model, model);

        return data.map((entry, index) => {
          const vector = expectNumberArray(entry.embedding, `embedding.data[${index}].embedding`);

          return {
            provider: "remote-openai-compatible",
            model: resolvedModel,
            dimensions: vector.length || embedOptions.dimensions || DEFAULT_EMBEDDING_DIMENSIONS,
            normalizedText: normalizedTexts[index] ?? "",
            tokens: tokens[index] ?? [],
            vector,
          };
        });
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}

export function createFallbackEmbeddingProvider(
  primary: TextEmbeddingProvider,
  fallback: TextEmbeddingProvider,
): TextEmbeddingProvider {
  return {
    mode: primary.mode,
    model: primary.model,
    async embedText(value: string, options: EmbedTextsOptions = {}): Promise<EmbeddedTextVector> {
      try {
        return await primary.embedText(value, options);
      } catch {
        return fallback.embedText(value, options);
      }
    },
    async embedTexts(values: string[], options: EmbedTextsOptions = {}): Promise<EmbeddedTextVector[]> {
      try {
        return await primary.embedTexts(values, options);
      } catch {
        return fallback.embedTexts(values, options);
      }
    },
  };
}
