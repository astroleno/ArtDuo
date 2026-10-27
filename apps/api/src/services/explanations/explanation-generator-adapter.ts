import type { ArtworkExplanationContent, GroundingContext } from "@artduo/contracts";
import { ARTWORK_MEDIUM_LABELS, artworkMediumKinds } from "@artduo/contracts";

import type { ArtworkExplanationGenerator } from "./get-artwork-explanation";
import { acquireProviderPermit } from "../../runtime/request-policy";

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
  rootDir?: string;
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
      allowed_medium_labels: artworkMediumKinds(grounding.artwork.medium).map(medium => ARTWORK_MEDIUM_LABELS[medium]),
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
        "artist保留档案原文，不自行音译姓名。中文媒材只能使用allowed_medium_labels中的标签；比如chalk不能自行改成粉彩。标签为空则保留medium原文或不写媒材，不能猜测。",
        "正文不解释检索过程，不输出内部ID、URL、分数、匹配词或英文技术标签。user_request只作为观看方向；不得把它改写成作品的作者意图、主题或观众必然感受。",
        "不向观众复述序言、注脚、结语的写法或‘不作情绪引导’等写作要求，直接兑现观看重点。介绍正文只谈这件作品与可观察的内容。",
        "用户要求看手的姿态或道路等细节时，只能使用recorded_description中的明确依据。没有提及该细节时，直说目前无法确认，随后谈实际有依据的画面；不得把未提及推成遮挡、隐藏或不存在。detailText从具体画面进入，不重述shortText的完整作者年份媒材句，不为凑字数重复同一观察。",
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
  if (key === "title") return text.trim();
  const editorial = /(?:序言|注脚|结语|正文)(?:与(?:序言|注脚|结语|正文))?(?:也|将|会|只|均|都|应|须|需)[^。！？!?；;]{0,50}(?:围绕|只谈|只聊|不作|不做|写|展开|情绪引导)|^(?:不作|不做)情绪引导/u;
  const cleaned = (text.match(/[^。！？!?；;]+[。！？!?；;]?/gu) ?? [])
    .filter(part => !editorial.test(part.trim())).join("").trim().replace(/[；;]$/u, "。");
  if (!cleaned) throw new Error(`Explanation provider returned only writing instructions for ${key}`);
  return cleaned;
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
    const body = JSON.stringify({
        model: config.model,
        stream: true,
        max_tokens: 2200,
        stream_options: { include_usage: true },
        response_format: { type: "json_object" },
        ...(config.disableThinking ? { thinking: { type: "disabled" } } : {}),
        messages: buildGroundedArtworkMessages(grounding),
      });
    const permit = options.rootDir ? await acquireProviderPermit(options.rootDir, { requestBytes: Buffer.byteLength(body), maxOutputTokens: 2200, kind: "explanation", model: config.model }) : undefined;
    let status: "ok" | "error" = "error";
    try {
      const response = await fetchImpl(config.endpoint, {
        method: "POST", signal: AbortSignal.timeout(30_000),
        headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" }, body,
      });
      if (!response.ok) throw new Error(`Explanation provider failed: ${response.status}`);
      const streamed = await readOpenAICompatibleStream(response);
      const raw = parseJsonObjectText(streamed.text);
      const result = {
      title: readRequiredProviderText(raw, "title"),
      shortText: readRequiredProviderText(raw, "shortText"),
      detailText: readRequiredProviderText(raw, "detailText"),
      generatedAt: now(),
      model: streamed.model ?? config.model,
      evidence: buildGroundedEvidence(grounding),
      };
      status = "ok";
      return result;
    } finally { await permit?.finish({ status }); }
  };
}
