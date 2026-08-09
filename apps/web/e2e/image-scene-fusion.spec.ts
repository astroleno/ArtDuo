import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

interface FusionBaseline {
  query: string;
  candidateLimit: number;
  metadataArtworkIds: string[];
  metadataSceneIds: string[];
  fallbackReasons: string[];
  budgets: {
    parseAndIndexP95MillisecondsMaximum: number;
    incrementalHeapBytesMaximum: number;
  };
}

const baseline = JSON.parse(readFileSync(
  new URL("./fixtures/image-scene-fusion-baseline.v1.json", import.meta.url),
  "utf8",
)) as FusionBaseline;
const basePort = Number(process.env.ARTDUO_FUSION_E2E_BASE_PORT ?? "43221");
const urls = {
  disabled: `http://127.0.0.1:${basePort}`,
  valid: `http://127.0.0.1:${basePort + 1}`,
  missing: `http://127.0.0.1:${basePort + 2}`,
  checksum: `http://127.0.0.1:${basePort + 3}`,
  missingEntity: `http://127.0.0.1:${basePort + 4}`,
  timeout: `http://127.0.0.1:${basePort + 5}`,
};

function galleryUrl(baseURL: string, query = baseline.query): string {
  return `${baseURL}/gallery?${new URLSearchParams({ query }).toString()}`;
}

function status(page: Page) {
  return page.getByTestId("image-scene-fusion-status");
}

function csv(value: string | null): string[] {
  return value?.split(",").filter(Boolean) ?? [];
}

async function sidecarBrowserRequests(page: Page): Promise<string[]> {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/image-embeddings|image-embedding-v1/u.test(request.url())) {
      requests.push(request.url());
    }
  });
  return requests;
}

test("image sidecar stays unread when fusion is disabled", async ({ page }) => {
  const requests = await sidecarBrowserRequests(page);
  await page.goto(galleryUrl(urls.disabled), { waitUntil: "domcontentloaded" });

  await expect(status(page)).toHaveAttribute("data-state", "disabled");
  await expect(status(page)).toHaveAttribute("data-variant-reads", "0");
  await expect(status(page)).toHaveAttribute("data-shard-reads", "0");
  expect(csv(await status(page).getAttribute("data-scene-ids"))).toEqual(baseline.metadataSceneIds);
  expect(requests).toEqual([]);
});

test("image sidecar is not read before a query yields artwork candidates", async ({ page }) => {
  const requests = await sidecarBrowserRequests(page);
  await page.goto(galleryUrl(urls.valid, "!!!"), { waitUntil: "domcontentloaded" });

  await expect(status(page)).toHaveAttribute("data-state", "idle");
  await expect(status(page)).toHaveAttribute("data-candidate-count", "0");
  await expect(status(page)).toHaveAttribute("data-variant-reads", "0");
  await expect(status(page)).toHaveAttribute("data-shard-reads", "0");

  await page.goto(galleryUrl(urls.valid), { waitUntil: "domcontentloaded" });
  await expect(status(page)).toHaveAttribute("data-state", "applied");
  expect(Number(await status(page).getAttribute("data-candidate-count"))).toBeGreaterThan(0);
  expect(requests).toEqual([]);
});

test("image sidecar checksum failures fall back to metadata scene order", async ({ page }) => {
  const fallbacks = [
    [urls.missing, "manifest-not-found"],
    [urls.checksum, "checksum-mismatch"],
    [urls.missingEntity, "missing-entity"],
    [urls.timeout, "timeout"],
  ] as const;
  expect(fallbacks.map(([, reason]) => reason)).toEqual(baseline.fallbackReasons);

  for (const [baseURL, reason] of fallbacks) {
    await page.goto(galleryUrl(baseURL), { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("gallery-route")).toBeVisible();
    await expect(status(page)).toHaveAttribute("data-state", "fallback");
    await expect(status(page)).toHaveAttribute("data-fallback-reason", reason);
    expect(csv(await status(page).getAttribute("data-scene-ids"))).toEqual(baseline.metadataSceneIds);
  }
});

test("image sidecar reranks only bounded eligible scene candidates", async ({ page }) => {
  await page.goto(galleryUrl(urls.valid), { waitUntil: "domcontentloaded" });

  await expect(status(page)).toHaveAttribute("data-state", "applied");
  const rerankedCount = Number(await status(page).getAttribute("data-reranked-candidate-count"));
  expect(rerankedCount).toBeGreaterThan(0);
  expect(rerankedCount).toBeLessThanOrEqual(baseline.candidateLimit);
  expect(csv(await status(page).getAttribute("data-artwork-ids"))).toEqual(baseline.metadataArtworkIds);
  await expect(status(page)).toHaveAttribute("data-promotion-binding-checksum", /^sha256:[a-f0-9]{64}$/u);
  await expect(status(page)).toHaveAttribute("data-visual-weight", /^(0|0\.\d+|1)$/u);
  await expect(status(page)).toHaveAttribute("data-calibration", /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/u);
});

test("image sidecar loader meets parse and heap budgets", async ({ page }) => {
  await page.goto(galleryUrl(urls.valid), { waitUntil: "domcontentloaded" });

  const parseAndIndexP95Ms = Number(await status(page).getAttribute("data-parse-index-p95-ms"));
  const incrementalHeapBytes = Number(await status(page).getAttribute("data-incremental-heap-bytes"));
  expect(parseAndIndexP95Ms).toBeGreaterThanOrEqual(0);
  expect(parseAndIndexP95Ms).toBeLessThanOrEqual(baseline.budgets.parseAndIndexP95MillisecondsMaximum);
  expect(incrementalHeapBytes).toBeGreaterThanOrEqual(0);
  expect(incrementalHeapBytes).toBeLessThanOrEqual(baseline.budgets.incrementalHeapBytesMaximum);
});
