import type { ExperienceUnit } from "./types";

export function experienceArtistName(unit: Pick<ExperienceUnit, "displayCredits"> & { artwork: { metadata: Pick<ExperienceUnit["artwork"]["metadata"], "artistDisplayName"> } }): string {
  return (unit.displayCredits ? unit.displayCredits.artistDisplayName : unit.artwork.metadata.artistDisplayName)
    ?? "作者尚待核实";
}
