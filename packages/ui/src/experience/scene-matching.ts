import type { ExperienceSceneCandidate, ExperienceUnit, SceneMatchScore } from "./types";

const normalize = (value: string) => value.toLowerCase().replace(/[_-]+/g, " ").trim();
const round = (value: number) => Math.round(value * 100) / 100;
const matches = (values: string[], pattern: RegExp) => values.some((value) => pattern.test(normalize(value)));

export function artworkPaletteFamilies(unit: ExperienceUnit): string[] {
  const values = [...unit.artwork.metadata.colorTags, ...(unit.artwork.presentation.sceneAffinity?.paletteModes ?? [])];
  const balanced = matches(values, /balance|color pop|colour pop/);
  const rules: Array<[string, RegExp]> = [
    ["warm", /warm|amber|gold|ochre/], ["cool", /cool|blue|slate/],
    ["earth", /earth|umber|brown|terracotta/], ["muted", /muted|pastel|low saturation/],
    ["neutral", /neutral|beige|gray|grey/], ["monochrome", /monochrome|black and white|grayscale/],
    ["contrast", /contrast|color pop|colour pop/], ["luminous", /luminous|light|bright/], ["dark", /dark|black/],
  ];
  return [...(balanced ? ["balanced"] : []), ...rules.filter(([family, pattern]) =>
    !(balanced && (family === "warm" || family === "cool")) && matches(values, pattern)).map(([family]) => family)];
}

export function artworkAspectRatio(unit: ExperienceUnit): number {
  const measured = unit.artwork.media.visualPresentation?.contentAspectRatio;
  if (measured && Number.isFinite(measured) && measured > 0) return measured;
  const hint = unit.artwork.media.aspectRatioHint;
  if (hint === "portrait") return 0.72;
  if (hint === "square") return 1;
  if (hint === "landscape") return 1.52;
  return 1.2;
}

/** A bounded editorial fit score, not a probability or measured perceptual accuracy. */
export function scoreArtworkScene(unit: ExperienceUnit, candidate: ExperienceSceneCandidate): SceneMatchScore {
  const { scene } = candidate;
  const families = artworkPaletteFamilies(unit);
  const shared = families.filter((family) => candidate.paletteFamilies.includes(family));
  const palette = families.length ? 40 * shared.length / families.length : 20;
  const paper = /paper|woodblock|etching|engraving|lithograph|watercolou?r|ink|drawing|print/i.test(unit.artwork.metadata.medium ?? "");
  const soft = matches(scene.visual_profile.lighting, /soft|diffuse|wash|cove/);
  const materialAndLight = (soft ? 8 : 2) + (paper && soft ? 4 : 0);
  const artworkComposition = unit.artwork.metadata.compositionTags.map(normalize);
  const preferredComposition = (scene.curation_profile.artwork_composition_modes ?? []).map(normalize);
  const composition = 5 + Math.min(5, artworkComposition.filter((value) => preferredComposition.includes(value)).length * 2.5);
  const rect = scene.stage_profile?.primary_mount_zone?.rect;
  const wallAspect = rect ? (rect.width * (scene.image_info.width ?? 1600)) / (rect.height * (scene.image_info.height ?? 900)) : 1.5;
  const aspect = artworkAspectRatio(unit);
  const occupancy = Math.min(wallAspect / aspect, aspect / wallAspect);
  const wallSpace = Math.max(0, Math.min(20, 12 + occupancy * 8 - scene.ui_profile.visual_busyness * 8));
  const calm = /quiet|calm|seren|restful|contemplat/;
  const artCalm = matches(unit.artwork.metadata.moodTags, calm);
  const roomCalm = matches([...scene.visual_profile.mood, ...scene.curation_profile.emotion_ids], calm);
  const atmosphere = artCalm && roomCalm ? 6 : 3;
  const reasons = [
    shared.length ? `palette:${shared.join(",")}` : families.length ? "palette:no-shared-family" : "palette:unknown-neutral-fallback",
    soft ? "light:soft" : "light:limited-evidence", paper ? "material:paper" : "material:painting",
    `wall-occupancy:${round(occupancy)}`,
  ];
  return { sceneId: scene.id, total: round(palette + materialAndLight + composition + wallSpace + atmosphere),
    palette: round(palette), materialAndLight, composition, wallSpace: round(wallSpace), atmosphere, reasons };
}

/** Chapter boundaries depend on stable stage slots, never on the artworks' order. */
export function exhibitionChapters(units: ExperienceUnit[]): Array<{ start: number; end: number }> {
  if (units.length < 4) return units.length ? [{ start: 0, end: units.length }] : [];
  const solutions = new Map<number, { cost: number; chapters: Array<{ start: number; end: number }> }>();
  solutions.set(units.length, { cost: 0, chapters: [] });
  for (let start = units.length - 2; start >= 0; start--) {
    for (const size of [3, 2]) {
      const end = start + size;
      const tail = solutions.get(end);
      if (!tail) continue;
      const cutsStage = end < units.length && units[end - 1]!.stageId === units[end]!.stageId;
      const cost = tail.cost + (cutsStage ? 4 : 0) + 0.2 + (size === 2 ? 0.05 : 0);
      if (!solutions.has(start) || cost < solutions.get(start)!.cost) {
        solutions.set(start, { cost, chapters: [{ start, end }, ...tail.chapters] });
      }
    }
  }
  return solutions.get(0)!.chapters;
}

// A wall's temperature is context for a painting, not a requirement to copy its
// colors. Retain geometry, light and calmness while tempering broad color tags.
const roomFit = (score: SceneMatchScore) => score.total - score.palette * 0.55;

/** Choose at chapter entrances only. Later reordering cannot change a viewed room. */
export function matchArtworkScenes(units: ExperienceUnit[], candidates: ExperienceSceneCandidate[]): ExperienceUnit[] {
  if (!candidates.length) return units;
  const chapters = exhibitionChapters(units);
  if (new Set(candidates.map(candidate => candidate.scene.id)).size < chapters.length) {
    throw new RangeError("The exhibition requires one prepared room per chapter");
  }
  const matched: ExperienceUnit[] = [];
  const used = new Set<string>();
  let previousSceneId: string | undefined;
  for (const [chapterIndex, chapter] of chapters.entries()) {
    const anchor = units[chapter.start]!;
    const entranceScores = candidates.filter(candidate => !used.has(candidate.scene.id)).map((candidate) => scoreArtworkScene(anchor, candidate))
      .sort((a, b) => roomFit(b) - roomFit(a) || a.sceneId.localeCompare(b.sceneId));
    const selected = entranceScores[0]!;
    const candidate = candidates.find((item) => item.scene.id === selected.sceneId)!;
    const reason = chapterIndex === 0 ? "opening" : selected.sceneId === previousSceneId ? "only-suitable-room" : "chapter-change";
    for (let index = chapter.start; index < chapter.end; index++) {
      const unit = units[index]!;
      const scores = candidates.map((item) => scoreArtworkScene(unit, item)).sort((a, b) => b.total - a.total || a.sceneId.localeCompare(b.sceneId));
      matched.push({ ...unit, scene: candidate.scene,
        media: { ...unit.media, backgroundUrl: candidate.imageUrl, backgroundUrlSmall: candidate.imageUrlSmall, roomLightMaps: candidate.lightMaps },
        exhibition: { ...unit.exhibition, backgroundSceneId: candidate.scene.id },
        sceneMatch: { version: "chapter-wall-v3", selectedSceneId: candidate.scene.id, lightDirection: candidate.lightDirection,
          continuedRoom: candidate.scene.id === (matched.at(-1)?.scene?.id), candidates: scores,
          chapter: { index: chapterIndex, count: chapters.length, ...chapter, reason } } });
    }
    used.add(selected.sceneId);
    previousSceneId = selected.sceneId;
  }
  return matched;
}
