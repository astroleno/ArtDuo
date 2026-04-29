import type { CurationSession } from "@artduo/contracts";

export class InMemoryCurationSessionStore {
  private readonly sessions = new Map<string, CurationSession>();

  create(session: CurationSession): CurationSession {
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): CurationSession | undefined {
    return this.sessions.get(id);
  }

  update(id: string, patch: Partial<CurationSession>): CurationSession {
    const existing = this.sessions.get(id);
    if (!existing) {
      throw new Error(`Curation session not found: ${id}`);
    }

    const merged: CurationSession = { ...existing, ...patch, id: existing.id };
    this.sessions.set(id, merged);
    return merged;
  }

  clear(): void {
    this.sessions.clear();
  }
}
