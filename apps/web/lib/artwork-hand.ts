import type { WebArtwork } from "./release-catalog";

/** One department of unknown hands fills at most this many places in an exhibition. */
export const DEPARTMENT_HAND_CAP = 2;

// Unknown hands from one museum department (for example Rajput albums) are
// spread like works by one artist, so one tradition cannot fill an exhibition.
export const handOf = (artwork: Pick<WebArtwork, "artistDisplayName" | "department">): string =>
  artwork.artistDisplayName?.trim() || (artwork.department ? `department:${artwork.department}` : "");
