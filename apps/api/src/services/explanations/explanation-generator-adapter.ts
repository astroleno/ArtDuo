import type { ArtworkExplanationContent, GroundingContext } from "@artduo/contracts";

import type { ArtworkExplanationGenerator } from "./get-artwork-explanation";

export interface ExplanationProviderEnv {
  ARTDUO_EXPLANATION_PROVIDER?: string;
  ARTDUO_EXPLANATION_ENDPOINT?: string;
  ARTDUO_EXPLANATION_MODEL?: string;
  ARTDUO_EXPLANATION_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
  DEEPSEEK_API_KEY?: string;
}

export interface ExplanationProviderAdapterOptions {
  env?: ExplanationProviderEnv;
  fetchImpl?: typeof fetch;
  now?: () => string;
}

function buildGroundedEvidence(grounding: GroundingContext) {
  return {
    grounding,
    citations: [
      {
        kind: "user-intent" as const,
        sourceId: "userText",
        label: "User intent",
        text: grounding.userText,
      },
      {
        kind: "artwork" as const,
        sourceId: grounding.artwork.id,
        label: grounding.artwork.title,
        text: [
          grounding.artwork.title,
          grounding.artwork.artistDisplayName,
          grounding.artwork.yearLabel,
          grounding.artwork.medium,
          grounding.artwork.department,
        ].filter(Boolean).join(", "),
        url: grounding.artwork.objectUrl ?? grounding.artwork.sourceApiUrl,
      },
      ...(grounding.scene
        ? [{
            kind: "scene" as const,
            sourceId: grounding.scene.id,
            label: grounding.scene.label,
            url: grounding.scene.imageUrl,
          }]
        : []),
      {
        kind: "release" as const,
        sourceId: grounding.releaseVersion,
        label: `Release ${grounding.releaseVersion}`,
        text: [
          `corpus=${grounding.sourceVersions.corpusVersion}`,
          `background=${grounding.sourceVersions.backgroundCatalogVersion}`,
          `contracts=${grounding.sourceVersions.contractsVersion}`,
        ].join("; "),
      },
      {
        kind: "retrieval" as const,
        sourceId: grounding.artwork.id,
        label: "Retrieval match",
        text: `score=${grounding.retrievalScore}; matchedTokens=${grounding.matchedTokens.join(", ")}`,
      },
    ],
  };
}

export function createDeterministicGroundedExplanationGenerator(input: {
  model?: string;
  now?: () => string;
} = {}): ArtworkExplanationGenerator {
  return ({ artworkId, contextText, grounding }) => {
    const userText = contextText.trim() || grounding.userText || "your curation intent";
    const title = grounding.artwork.title || artworkId;

    return {
      title: `Curation Note · ${title}`,
      shortText: `Curation note: ${userText.slice(0, 120)}`,
      detailText: [
        `${title} is explained from the release-grounded artwork metadata`,
        grounding.scene ? `and the matched scene "${grounding.scene.label}"` : "without requiring a scene match",
        `using retrieval score ${grounding.retrievalScore.toFixed(3)}.`,
      ].join(" "),
      generatedAt: input.now?.() ?? new Date().toISOString(),
      model: input.model ?? "deterministic-grounded-generator-v0",
      evidence: buildGroundedEvidence(grounding),
    };
  };
}

function readProviderConfig(env: ExplanationProviderEnv) {
  const explicitProvider = env.ARTDUO_EXPLANATION_PROVIDER?.trim();
  const hasDeepSeekConfig = Boolean(
    env.DEEPSEEK_BASE_URL?.trim()
    || env.DEEPSEEK_MODEL?.trim()
    || env.DEEPSEEK_API_KEY?.trim(),
  );
  if ((explicitProvider && explicitProvider !== "openai-compatible") || (!explicitProvider && !hasDeepSeekConfig)) {
    return undefined;
  }

  const endpoint = env.ARTDUO_EXPLANATION_ENDPOINT?.trim() || env.DEEPSEEK_BASE_URL?.trim();
  const model = env.ARTDUO_EXPLANATION_MODEL?.trim() || env.DEEPSEEK_MODEL?.trim();
  const apiKey = env.ARTDUO_EXPLANATION_API_KEY?.trim() || env.DEEPSEEK_API_KEY?.trim();

  if (!endpoint || !model || !apiKey) {
    return undefined;
  }

  const normalizedEndpoint = endpoint.replace(/\/+$/, "");
  return {
    endpoint: normalizedEndpoint.endsWith("/chat/completions")
      ? normalizedEndpoint
      : `${normalizedEndpoint}/chat/completions`,
    model,
    apiKey,
    disableThinking: hasDeepSeekConfig || normalizedEndpoint.includes("api.deepseek.com"),
  };
}

function buildGroundedArtworkMessages(grounding: GroundingContext) {
  const factLedger = {
    user_request: grounding.userText || null,
    artwork_record: {
      id: grounding.artwork.id,
      title: grounding.artwork.title,
      artist: grounding.artwork.artistDisplayName ?? null,
      year: grounding.artwork.yearLabel ?? null,
      medium: grounding.artwork.medium ?? null,
      department: grounding.artwork.department ?? null,
      recorded_description: grounding.artwork.description ?? null,
    },
  };

  return [
    {
      role: "system" as const,
      content: "你是艺术作品介绍编辑。只依据用户消息中的fact_ledger，不使用外部知识；只输出约定JSON。",
    },
    {
      role: "user" as const,
      content: [
        "task=artwork_intro",
        `fact_ledger=${JSON.stringify(factLedger)}`,
        "规则：字段不可互换；year不自动等于创作年代。null只能写成资料未提供，不能补成不存在、缺失、空白或确定事实。不得新增情绪、象征、地点、用途、因果、身份、历史意义或机构名称。",
        "正文不解释检索过程，不输出内部ID、URL、分数、匹配词或英文技术标签。user_request只作为观看方向；不得把它改写成作品的作者意图、主题或观众必然感受。",
        "只返回JSON对象，只含title、shortText、detailText三个非空字符串字段。title逐字复制原题；shortText目标45–80字，优先覆盖有值的artist、year、medium；detailText目标100–150字，以recorded_description为证据并保留用户明确边界。输出前删除无法映射的主张。不要输出Markdown或审计过程。",
      ].join("\n"),
    },
  ];
}

function parseJsonObjectText(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  const candidates = [
    trimmed,
    fenced,
    objectStart >= 0 && objectEnd > objectStart ? trimmed.slice(objectStart, objectEnd + 1) : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next bounded representation.
    }
  }

  throw new Error("Explanation provider returned invalid JSON");
}

function readRequiredProviderText(
  value: Record<string, unknown>,
  key: "title" | "shortText" | "detailText",
): string {
  const text = value[key];
  if (typeof text !== "string" || !text.trim()) {
    throw new Error(`Explanation provider omitted ${key}`);
  }
  return text.trim();
}

async function readOpenAICompatibleStream(response: Response): Promise<{ text: string; model?: string }> {
  if (!response.body) {
    throw new Error("Explanation provider returned an empty stream");
  }
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    throw new Error("Explanation provider did not return an SSE stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let model: string | undefined;

  const processFrame = (frame: string) => {
    const data = frame
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") {
      return;
    }

    const event = JSON.parse(data) as {
      model?: unknown;
      error?: { message?: unknown };
      choices?: Array<{ delta?: { content?: unknown } }>;
    };
    if (event.error) {
      throw new Error(String(event.error.message ?? "Explanation provider stream failed"));
    }
    if (typeof event.model === "string") {
      model = event.model;
    }
    const content = event.choices?.[0]?.delta?.content;
    if (typeof content === "string") {
      text += content;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replaceAll("\r\n", "\n");
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      processFrame(frame);
    }
  }
  buffer += decoder.decode();
  buffer = buffer.replaceAll("\r\n", "\n");
  if (buffer.trim()) {
    processFrame(buffer);
  }
  if (!text.trim()) {
    throw new Error("Explanation provider stream contained no text");
  }

  return { text, model };
}

export function createServerGroundedExplanationGeneratorFromEnv(
  options: ExplanationProviderAdapterOptions = {},
): ArtworkExplanationGenerator | undefined {
  const env = (options.env ?? process.env) as ExplanationProviderEnv;
  const config = readProviderConfig(env);
  if (!config) {
    return undefined;
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date().toISOString());

  return async ({ grounding }) => {
    const response = await fetchImpl(config.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        stream: true,
        stream_options: { include_usage: true },
        response_format: { type: "json_object" },
        ...(config.disableThinking ? { thinking: { type: "disabled" } } : {}),
        messages: buildGroundedArtworkMessages(grounding),
      }),
    });

    if (!response.ok) {
      throw new Error(`Explanation provider failed: ${response.status}`);
    }

    const streamed = await readOpenAICompatibleStream(response);
    const raw = parseJsonObjectText(streamed.text);

    return {
      title: readRequiredProviderText(raw, "title"),
      shortText: readRequiredProviderText(raw, "shortText"),
      detailText: readRequiredProviderText(raw, "detailText"),
      generatedAt: now(),
      model: streamed.model ?? config.model,
      evidence: buildGroundedEvidence(grounding),
    };
  };
}
