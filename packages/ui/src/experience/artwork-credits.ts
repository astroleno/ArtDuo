import type { ExperienceUnit } from "./types";

type ArtworkCredit = Pick<ExperienceUnit, "displayCredits"> & { artwork: { metadata: Pick<ExperienceUnit["artwork"]["metadata"], "artistDisplayName"> } };

function artistCredit(unit: ArtworkCredit): string | null | undefined {
  return unit.displayCredits ? unit.displayCredits.artistDisplayName : unit.artwork.metadata.artistDisplayName;
}

export function recordedArtistName(unit: ArtworkCredit): string | undefined {
  const name = artistCredit(unit);
  return name?.trim() ? name : undefined;
}

export function recordedArtworkCreditLines(unit: ArtworkCredit & { artwork: { metadata: Pick<ExperienceUnit["artwork"]["metadata"], "yearLabel" | "culture"> } }) {
  const { yearLabel, culture } = unit.artwork.metadata;
  const artistLine = [recordedArtistName(unit), yearLabel?.trim()].filter(Boolean).join(" · ");
  const publishers = unit.displayCredits?.publishers.filter(name => name.trim()).join("; ");
  const details = [publishers ? `出版：${publishers}` : undefined, culture?.trim() ? `馆方文化归属：${culture}` : undefined]
    .filter((value): value is string => Boolean(value));
  return { artistLine, details };
}
