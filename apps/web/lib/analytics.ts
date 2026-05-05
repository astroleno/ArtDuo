export type CurationFallbackMode = "stream" | "polling" | "local-state";
export type AnalyticsEventName = "curation.created" | "curation.explanation_ready" | "curation.degraded";

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  properties: Record<string, string>;
  createdAt: string;
}

export interface AnalyticsSink {
  track(event: AnalyticsEvent): void | Promise<void>;
}

export class InMemoryAnalyticsSink implements AnalyticsSink {
  readonly events: AnalyticsEvent[] = [];

  track(event: AnalyticsEvent): void {
    this.events.push(event);
  }
}

function normalizeProperties(properties: Record<string, string | undefined> = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(properties).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== ""),
  );
}

export function chooseCurationFallbackMode(input: {
  streamAvailable: boolean;
  pollingAvailable: boolean;
}): CurationFallbackMode {
  if (input.streamAvailable) {
    return "stream";
  }

  return input.pollingAvailable ? "polling" : "local-state";
}

export async function trackAnalyticsEvent(
  sink: AnalyticsSink,
  name: AnalyticsEventName,
  properties: Record<string, string | undefined> = {},
  createdAt = new Date().toISOString(),
): Promise<AnalyticsEvent> {
  const event: AnalyticsEvent = {
    name,
    properties: normalizeProperties(properties),
    createdAt,
  };

  await sink.track(event);
  return event;
}
