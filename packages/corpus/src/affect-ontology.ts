import type { UserAffectAgent } from "@artduo/contracts";

const RESISTANCE_ALIASES: Record<string, readonly string[]> = {
  bright: ["bright", "light", "joy", "celebration", "cheerful", "gold", "golden"],
  loud: ["loud", "festival", "celebration", "active", "drama"],
  sadness: ["sadness", "sad", "melancholy", "sorrow", "grief", "despair", "heavy-grief"],
  "heavy-grief": ["heavy-grief", "grief", "despair"],
  "heavy-drama": ["heavy-drama", "drama", "dramatic", "despair", "grief", "high-contrast"],
};

export function normalizeAffectSignal(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s-]+/gu, "-");
}

export function affectResistanceAliases(value: string): readonly string[] {
  const normalized = normalizeAffectSignal(value);
  return RESISTANCE_ALIASES[normalized] ?? [normalized];
}

export function findAffectResistanceConflict(
  resistances: Iterable<string>,
  candidateSignals: Iterable<string>,
): string | undefined {
  const signals = new Set(Array.from(candidateSignals, normalizeAffectSignal));

  for (const resistance of resistances) {
    const normalized = normalizeAffectSignal(resistance);
    if (affectResistanceAliases(normalized).some((alias) => signals.has(alias))) {
      return normalized;
    }
  }

  return undefined;
}

export function hardResistanceSignals(agent: UserAffectAgent): string[] {
  return [...new Set([
    ...agent.resistances.map((entry) => normalizeAffectSignal(entry.value)),
    ...agent.visualConstraints
      .filter((entry) => entry.severity === "hard" && entry.polarity === "avoid")
      .map((entry) => normalizeAffectSignal(entry.value)),
  ])];
}
