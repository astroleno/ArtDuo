/** Transcribed culture and official object URL from data/sources/open-collections/<sourceBatch>/records/<id>.json. */
export const MUSEUM_CULTURE_SUPPLEMENTS: Readonly<Record<string, { culture: string; objectUrl: string; sourceBatch: string }>> = {
  "cma-314236": {"culture": "Northern India, Pahari kingdoms", "objectUrl": "https://clevelandart.org/art/2018.104", "sourceBatch": "2026-11-17"},
  "cma-152014": {"culture": "Northwestern India, Rajasthan, Rajput Kingdom of Mewar", "objectUrl": "https://clevelandart.org/art/1984.65", "sourceBatch": "2026-11-17"},
  "cma-146193": {"culture": "Northwestern India, Rajasthan, Rajput Kingdom of Bikaner", "objectUrl": "https://clevelandart.org/art/1971.83", "sourceBatch": "2026-11-17"},
  "cma-146192": {"culture": "Northern India, Uttar Pradesh, Lucknow", "objectUrl": "https://clevelandart.org/art/1971.82", "sourceBatch": "2026-11-17"},
  "cma-146117": {"culture": "Northern India, Pahari kingdoms", "objectUrl": "https://clevelandart.org/art/1971.301", "sourceBatch": "2026-11-17"},
  "cma-164466": {"culture": "Eastern India, Bihar, Mithila region", "objectUrl": "https://clevelandart.org/art/2005.86", "sourceBatch": "2026-11-18"},
  "cma-314503": {"culture": "Northwestern India, Rajasthan, Marwar region, Rajput kingdom of Jodhpur, court of Abhai Singh (reigned 1702–49)", "objectUrl": "https://clevelandart.org/art/2018.197", "sourceBatch": "2026-11-18"},
  "cma-148378": {"culture": "Northern India, Pahari kingdoms", "objectUrl": "https://clevelandart.org/art/1975.9", "sourceBatch": "2026-11-18"},
  "cma-314436": {"culture": "Central India, Madhya Pradesh, Malwa", "objectUrl": "https://clevelandart.org/art/2018.131", "sourceBatch": "2026-11-18"},
  "met-50939": {"culture": "India (Rajasthan, Amber)", "objectUrl": "https://www.metmuseum.org/art/collection/search/50939", "sourceBatch": "2026-11-18"},
};

export function officialMuseumCulture(value: unknown): string | undefined {
  const parts = (Array.isArray(value) ? value : [value]).flatMap(part => typeof part === "string" && part.trim() ? [part.trim()] : []);
  return parts.length ? parts.join("; ") : undefined;
}

export function museumCultureForArtwork(artworkId: string, original?: string, objectUrl?: string): string | undefined {
  if (original?.trim()) return original;
  const supplement = MUSEUM_CULTURE_SUPPLEMENTS[artworkId];
  return supplement && supplement.objectUrl === objectUrl ? supplement.culture : undefined;
}
