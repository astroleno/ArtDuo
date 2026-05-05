import type { WebReleaseCatalog, WebSearchResult } from "./release-catalog";
import { searchReleaseCatalog } from "./release-catalog";
import { defaultAnalyticsSink, trackAnalyticsEvent, type AnalyticsSink } from "./analytics";

export interface BrowserCurationResult {
  search: WebSearchResult;
  runtime: "server" | "browser-worker" | "server-fallback";
}

export function searchGalleryWithRuntime(input: {
  catalog: WebReleaseCatalog;
  query: string;
  limit?: number;
  runtimeMode?: string;
  analyticsSink?: AnalyticsSink;
}): BrowserCurationResult {
  const baseSearch = () => searchReleaseCatalog(input.catalog, input.query, { limit: input.limit ?? 12 });

  if (!input.runtimeMode || input.runtimeMode === "server") {
    return { search: baseSearch(), runtime: "server" };
  }

  try {
    if (input.runtimeMode === "worker-fail") {
      throw new Error("Simulated browser worker failure");
    }

    return { search: baseSearch(), runtime: "browser-worker" };
  } catch {
    void trackAnalyticsEvent(input.analyticsSink ?? defaultAnalyticsSink, "curation.degraded", {
      reason: "browser_worker_failed",
      fallback: "server-fallback",
    });
    return { search: baseSearch(), runtime: "server-fallback" };
  }
}
