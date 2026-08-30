import assert from "node:assert/strict";
import { test } from "node:test";

import type { GroundingContext } from "@artduo/contracts";

import {
  createDeterministicGroundedExplanationGenerator,
  createServerGroundedExplanationGeneratorFromEnv,
} from "../../src/services/explanations/explanation-generator-adapter";

const grounding: GroundingContext = {
  userText: "quiet meditative reflection",
  releaseVersion: "2026-04-25-curation-b",
  artwork: {
    id: "met-474091",
    title: "Cloister",
    artistDisplayName: "Unknown Artist",
    medium: "Limestone",
    department: "Medieval Art",
    description: "A release-grounded architectural fragment with carved stone details.",
    objectUrl: "https://www.metmuseum.org/art/collection/search/474091",
  },
  scene: {
    id: "bg-quiet-cloister",
    label: "Quiet cloister wall",
    imageUrl: "/artduo-gallery/bg-classical-museum-color-midnight-blue-007.png",
  },
  retrievalScore: 0.308327,
  matchedTokens: ["quiet", "meditative", "cloister"],
  sourceVersions: {
    corpusVersion: "2026-04-25-curation-b",
    backgroundCatalogVersion: "2026-04-25-curation-b",
    contractsVersion: "0.2.0",
  },
};

function openAiSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

test("deterministic generator returns grounded evidence without real LLM credentials", async () => {
  const generator = createDeterministicGroundedExplanationGenerator({
    now: () => "2026-05-08T00:00:00.000Z",
  });

  const content = await generator({
    artworkId: "met-474091",
    releaseVersion: "2026-04-25-curation-b",
    contextText: "quiet meditative reflection",
    grounding,
  });

  assert.equal(content.evidence.grounding.artwork.id, "met-474091");
  assert.equal(content.evidence.grounding.scene?.id, "bg-quiet-cloister");
  assert.ok(content.evidence.citations.some((citation) => citation.kind === "artwork"));
  assert.ok(content.evidence.citations.some((citation) => citation.kind === "release"));
  assert.ok(content.evidence.citations.some((citation) => citation.kind === "retrieval"));
});

test("server provider adapter is disabled unless server env is explicitly configured", () => {
  const generator = createServerGroundedExplanationGeneratorFromEnv({
    env: {
      ARTDUO_EXPLANATION_PROVIDER: "openai-compatible",
      ARTDUO_EXPLANATION_ENDPOINT: "https://example.com/v1/explanations",
      ARTDUO_EXPLANATION_MODEL: "test-model",
    },
  });

  assert.equal(generator, undefined);
});

test("server provider adapter accepts the configured DeepSeek environment aliases", async () => {
  let requestUrl = "";
  const generator = createServerGroundedExplanationGeneratorFromEnv({
    env: {
      ARTDUO_EXPLANATION_PROVIDER: "openai-compatible",
      ARTDUO_EXPLANATION_ENDPOINT: "   ",
      ARTDUO_EXPLANATION_MODEL: "",
      ARTDUO_EXPLANATION_API_KEY: "",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com/",
      DEEPSEEK_MODEL: "deepseek-v4-flash",
      DEEPSEEK_API_KEY: "deepseek-test-key",
    },
    fetchImpl: async (url) => {
      requestUrl = String(url);
      return openAiSseResponse([
        'data: {"model":"deepseek-v4-flash","choices":[{"delta":{"content":"{\\"title\\":\\"Cloister\\",\\"shortText\\":\\"Grounded note.\\",\\"detailText\\":\\"Grounded detail.\\"}"}}]}\n\n',
        "data: [DONE]\n\n",
      ]);
    },
  });

  assert.ok(generator);
  const content = await generator({
    artworkId: "met-474091",
    releaseVersion: "2026-04-25-curation-b",
    contextText: "quiet meditative reflection",
    grounding,
  });

  assert.equal(requestUrl, "https://api.deepseek.com/chat/completions");
  assert.equal(content.model, "deepseek-v4-flash");
});

test("server provider adapter streams an OpenAI-compatible grounded artwork prompt", async () => {
  let requestUrl = "";
  let requestHeaders: RequestInit["headers"];
  let requestBody: Record<string, unknown> | undefined;
  const generator = createServerGroundedExplanationGeneratorFromEnv({
    env: {
      ARTDUO_EXPLANATION_PROVIDER: "openai-compatible",
      ARTDUO_EXPLANATION_ENDPOINT: "https://api.deepseek.com",
      ARTDUO_EXPLANATION_MODEL: "deepseek-v4-flash",
      ARTDUO_EXPLANATION_API_KEY: "server-only-test-key",
    },
    now: () => "2026-05-08T00:00:00.000Z",
    fetchImpl: async (url, init) => {
      requestUrl = String(url);
      requestHeaders = init?.headers;
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return openAiSseResponse([
        'data: {"model":"deepseek-v4-flash","choices":[{"delta":{"content":"{\\"title\\":\\"Grounded Cloister\\",\\"shortText\\":\\"A grounded note.\\","}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"\\"detailText\\":\\"A grounded detail.\\"}"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":210,"completion_tokens":44}}\n\n',
        "data: [DONE]\n\n",
      ]);
    },
  });

  assert.ok(generator);
  const content = await generator({
    artworkId: "met-474091",
    releaseVersion: "2026-04-25-curation-b",
    contextText: "quiet meditative reflection",
    grounding,
  });

  assert.equal(requestUrl, "https://api.deepseek.com/chat/completions");
  assert.equal(new Headers(requestHeaders).get("authorization"), "Bearer server-only-test-key");
  assert.equal(requestBody?.model, "deepseek-v4-flash");
  assert.equal(requestBody?.stream, true);
  assert.deepEqual(requestBody?.stream_options, { include_usage: true });
  assert.deepEqual(requestBody?.response_format, { type: "json_object" });
  assert.deepEqual(requestBody?.thinking, { type: "disabled" });
  const messages = requestBody?.messages as Array<{ role: string; content: string }>;
  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.role, "system");
  assert.equal(messages[1]?.role, "user");
  assert.match(messages[1]?.content ?? "", /quiet meditative reflection/);
  assert.match(messages[1]?.content ?? "", /met-474091/);
  assert.match(messages[1]?.content ?? "", /Limestone/);
  assert.match(messages[1]?.content ?? "", /Medieval Art/);
  assert.match(messages[1]?.content ?? "", /carved stone details/);
  assert.match(messages[1]?.content ?? "", /未提供|未记录/);
  assert.doesNotMatch(messages[1]?.content ?? "", /object_url|source_api_url|retrieval|release_version/);
  assert.doesNotMatch(messages[1]?.content ?? "", /metmuseum\.org|0\.308327|matched_tokens/);
  assert.equal("grounding" in (requestBody ?? {}), false);
  assert.equal(content.title, "Grounded Cloister");
  assert.equal(content.shortText, "A grounded note.");
  assert.equal(content.detailText, "A grounded detail.");
  assert.equal(content.model, "deepseek-v4-flash");
  assert.equal(content.evidence.grounding.releaseVersion, "2026-04-25-curation-b");
  assert.ok(content.evidence.citations.some((citation) => citation.kind === "scene"));
});

test("server provider adapter handles CRLF frame boundaries split across network chunks", async () => {
  const payload = JSON.stringify({
    choices: [{
      delta: {
        content: JSON.stringify({
          title: "Chunked Cloister",
          shortText: "Grounded note.",
          detailText: "Grounded detail.",
        }),
      },
    }],
  });
  const generator = createServerGroundedExplanationGeneratorFromEnv({
    env: {
      ARTDUO_EXPLANATION_PROVIDER: "openai-compatible",
      ARTDUO_EXPLANATION_ENDPOINT: "https://api.deepseek.com",
      ARTDUO_EXPLANATION_MODEL: "deepseek-v4-flash",
      ARTDUO_EXPLANATION_API_KEY: "server-only-test-key",
    },
    fetchImpl: async () => openAiSseResponse([
      `data: ${payload}\r`,
      "\n\r",
      "\ndata: [DONE]\r",
      "\n\r\n",
    ]),
  });

  assert.ok(generator);
  const content = await generator({
    artworkId: "met-474091",
    releaseVersion: "2026-04-25-curation-b",
    contextText: "quiet meditative reflection",
    grounding,
  });

  assert.equal(content.title, "Chunked Cloister");
});

test("server provider adapter rejects a streamed response that omits a required field", async () => {
  const generator = createServerGroundedExplanationGeneratorFromEnv({
    env: {
      ARTDUO_EXPLANATION_PROVIDER: "openai-compatible",
      ARTDUO_EXPLANATION_ENDPOINT: "https://api.deepseek.com/chat/completions",
      ARTDUO_EXPLANATION_MODEL: "deepseek-v4-flash",
      ARTDUO_EXPLANATION_API_KEY: "server-only-test-key",
    },
    fetchImpl: async () => openAiSseResponse([
      'data: {"choices":[{"delta":{"content":"{\\"title\\":\\"Cloister\\",\\"shortText\\":\\"Grounded note.\\"}"}}]}\n\n',
      "data: [DONE]\n\n",
    ]),
  });

  assert.ok(generator);
  await assert.rejects(
    async () => generator({
      artworkId: "met-474091",
      releaseVersion: "2026-04-25-curation-b",
      contextText: "quiet meditative reflection",
      grounding,
    }),
    /omitted detailText/,
  );
});
