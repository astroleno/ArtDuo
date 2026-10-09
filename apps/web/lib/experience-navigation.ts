import type { ExperiencePosition, ExperiencePhase } from "@artduo/ui";
import { EXPERIENCE_RECIPE_VERSION, type ExhibitionSnapshot } from "@artduo/ui";

export interface ExperienceRouteParams {
  query: string;
  releaseVersion: string;
  phase: ExperiencePhase;
  artworkId?: string;
  recipeVersion?: string;
  routeOrder?: string[];
}

export function buildExperienceHref(input: ExperienceRouteParams): string {
  const params = new URLSearchParams({
    query: input.query,
    view: "experience",
    releaseVersion: input.releaseVersion,
    recipeVersion: input.recipeVersion ?? EXPERIENCE_RECIPE_VERSION,
    phase: input.phase,
  });
  if (input.artworkId) params.set("artworkId", input.artworkId);
  if (input.routeOrder?.length) params.set("route", input.routeOrder.join(","));
  return `/gallery/local/immersive?${params.toString()}`;
}

export function resolveExperiencePosition(
  params: Record<string, string | string[] | undefined> | undefined,
  snapshot: ExhibitionSnapshot,
): { position: ExperiencePosition; corrected: boolean } {
  const read = (key: string) => {
    const value = params?.[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const phase = read("phase");
  const artworkId = read("artworkId");

  if (phase === "closing") {
    const lastUnit = artworkId ? snapshot.units.find((unit) => unit.artwork.id === artworkId) : snapshot.units.at(-1);
    return { position: { phase: "closing", lastUnitId: lastUnit?.exhibition.unitId }, corrected: Boolean(artworkId && !lastUnit) };
  }
  if (phase !== "preface") {
    const unit = artworkId ? snapshot.units.find((candidate) => candidate.artwork.id === artworkId) : snapshot.units[0];
    if (unit) return { position: { phase: "walk", unitId: unit.exhibition.unitId }, corrected: phase !== "walk" || Boolean(artworkId && artworkId !== unit.artwork.id) };
    if (snapshot.units.length === 0) return { position: { phase: "preface" }, corrected: true };
    return { position: { phase: "walk", unitId: snapshot.units[0]!.exhibition.unitId }, corrected: true };
  }
  return { position: { phase: "preface" }, corrected: false };
}

export function experienceHrefForPosition(snapshot: ExhibitionSnapshot, position: ExperiencePosition): string {
  const unitId = position.phase === "walk" ? position.unitId : position.phase === "closing" ? position.lastUnitId : undefined;
  const artworkId = unitId ? snapshot.units.find((unit) => unit.exhibition.unitId === unitId)?.artwork.id : undefined;
  return buildExperienceHref({
    query: snapshot.query,
    releaseVersion: snapshot.releaseVersion,
    phase: position.phase,
    artworkId,
    routeOrder: snapshot.routeOrder,
  });
}

export function sanitizeReturnTo(value: string | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const parsed = new URL(value, "https://artduo.invalid");
    const allowed = parsed.origin === "https://artduo.invalid"
      && (parsed.pathname === "/gallery" || parsed.pathname.startsWith("/gallery/"));
    return allowed ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch {
    return fallback;
  }
}
