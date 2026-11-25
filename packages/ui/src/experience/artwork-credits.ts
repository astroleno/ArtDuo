import type { ExperienceUnit } from "./types";

type ArtworkCredit = Pick<ExperienceUnit, "displayCredits"> & { artwork: { metadata: Pick<ExperienceUnit["artwork"]["metadata"], "artistDisplayName"> } };

function artistCredit(unit: ArtworkCredit): string | null | undefined {
  return unit.displayCredits ? unit.displayCredits.artistDisplayName : unit.artwork.metadata.artistDisplayName;
}

export function recordedArtistName(unit: ArtworkCredit): string | undefined {
  const name = artistCredit(unit);
  return name?.trim() ? name : undefined;
}

export function experienceArtistName(unit: ArtworkCredit): string {
  return artistCredit(unit) ?? "作者尚待核实";
}
