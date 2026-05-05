export interface RequestLogInput {
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  tags?: Record<string, string | undefined>;
}

export interface RequestLogEntry extends RequestLogInput {
  tags: Record<string, string>;
  createdAt: string;
}

function normalizeTags(tags: Record<string, string | undefined> = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tags).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== ""),
  );
}

export class InMemoryRequestLog {
  private readonly entries: RequestLogEntry[] = [];

  append(input: RequestLogInput, createdAt = new Date().toISOString()): RequestLogEntry {
    const entry: RequestLogEntry = {
      ...input,
      durationMs: Math.max(0, Math.round(input.durationMs)),
      tags: normalizeTags(input.tags),
      createdAt,
    };

    this.entries.push(entry);
    return entry;
  }

  list(): RequestLogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries.length = 0;
  }
}
