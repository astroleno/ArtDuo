export type CurationMetricName =
  | "exhibition.create"
  | "retrieval.search"
  | "explanation.generate"
  | "degradation.trigger";

export interface MetricTags {
  [key: string]: string | undefined;
}

export interface MetricEvent {
  name: CurationMetricName;
  durationMs: number;
  tags: Record<string, string>;
  createdAt: string;
}

export interface MetricSummary {
  name: CurationMetricName;
  count: number;
  totalDurationMs: number;
  averageDurationMs: number;
}

function normalizeTags(tags: MetricTags = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tags).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== ""),
  );
}

export class InMemoryMetrics {
  private readonly events: MetricEvent[] = [];

  recordDuration(
    name: CurationMetricName,
    durationMs: number,
    tags: MetricTags = {},
    createdAt = new Date().toISOString(),
  ): MetricEvent {
    const event: MetricEvent = {
      name,
      durationMs: Math.max(0, Math.round(durationMs)),
      tags: normalizeTags(tags),
      createdAt,
    };

    this.events.push(event);
    return event;
  }

  recordDegradation(reason: string, tags: MetricTags = {}): MetricEvent {
    return this.recordDuration("degradation.trigger", 0, { ...tags, reason });
  }

  list(name?: CurationMetricName): MetricEvent[] {
    return name ? this.events.filter((event) => event.name === name) : [...this.events];
  }

  summary(name: CurationMetricName): MetricSummary {
    const events = this.list(name);
    const totalDurationMs = events.reduce((total, event) => total + event.durationMs, 0);

    return {
      name,
      count: events.length,
      totalDurationMs,
      averageDurationMs: events.length === 0 ? 0 : totalDurationMs / events.length,
    };
  }

  clear(): void {
    this.events.length = 0;
  }
}

export function createMetricTimer(
  metrics: InMemoryMetrics,
  name: CurationMetricName,
  tags: MetricTags = {},
  now: () => number = Date.now,
): (endNow?: () => number) => MetricEvent {
  const startedAt = now();

  return (endNow: () => number = Date.now) => metrics.recordDuration(name, endNow() - startedAt, tags);
}
