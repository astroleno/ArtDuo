import { ImmersiveGallery, type ImmersiveGalleryUnit, type TransitionFamily } from "@artduo/ui";

import { artworkImageUrl } from "../../../../lib/artwork-image-url";
import { buildCurationNarrative, buildJourneyIntensities } from "../../../../lib/curation-narrative";
import { buildGallerySceneRoute, sceneRouteStopForIndex, type GallerySceneRouteStop } from "../../../../lib/gallery-route";
import { DEFAULT_CURATION_PROMPT } from "../../../../lib/prompts";
import { loadWebReleaseCatalog, searchBackgroundScenes, searchReleaseCatalog, type WebSearchResult } from "../../../../lib/release-catalog";

interface ImmersivePageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const TRANSITION_SEQUENCE: TransitionFamily[] = ["fade", "dissolve", "light-swell", "depth-push"];
const STAGE_BY_INDEX = ["Opening", "Opening", "Opening", "Opening", "Drift", "Drift", "Drift", "Drift", "Return", "Return", "Return", "Return"] as const;
const TOKEN_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "art",
  "for",
  "i",
  "in",
  "me",
  "of",
  "room",
  "the",
  "to",
  "want",
  "with",
]);
const MOOD_COPY: Record<string, string> = {
  admiration: "仰望感",
  anxiety: "微微收紧的情绪",
  awe: "敬畏感",
  contemplation: "凝视感",
  desire: "欲望的暗流",
  despair: "低沉的重量",
  drama: "戏剧性的张力",
  euphoria: "明亮的高点",
  fatigue: "缓慢的疲惫",
  grief: "哀悼的余波",
  hope: "向上的光",
  longing: "未抵达的想念",
  melancholy: "沉静的忧郁",
  mystery: "隐约的谜面",
  nostalgia: "回望的温度",
  serenity: "平静的呼吸",
  silence: "留白里的安静",
  tension: "悬而未落的张力",
  tranquility_deep: "深处的平静",
  wonder: "轻微的惊奇",
  yearning: "向远处延伸的渴望",
};
const COMPOSITION_COPY: Record<string, string> = {
  "centered": "主体留在中央，周围的静默慢慢靠近",
  "portrait-bias": "人物和身体先进入视线",
  "scene-bias": "空间先铺开，目光才有地方停下",
  "single-subject": "只剩一个身影在光里停住",
  "square-frame": "方形边界把时间轻轻收住",
  "wide-frame": "视线先留在边缘，远处的光慢慢打开画面",
};
const SUBJECT_COPY: Record<string, string> = {
  "Asian Art": "器物和身形都更克制",
  "Ceramics": "釉面把光压得很轻",
  "European Paintings": "油彩让暗部慢慢沉下去",
  "Paintings": "画面把停留感留在表层",
  "Photographs": "影像里的距离感更直接",
  "Sculpture": "体量让沉默变得更重",
  "contemplation": "凝视本身成了动作",
};
const COLOR_COPY: Record<string, string> = {
  "black": "黑色把边缘收得更紧",
  "blue": "蓝色让空气变冷",
  "brown": "棕色把时间压低",
  "gold": "金色只露出一点余温",
  "gray": "灰色把声音放轻",
  "green": "绿色让呼吸往外延伸",
  "marble": "石色让光停在表面",
  "red": "红色把情绪往前推了一步",
  "silver": "银色像一层很薄的雾",
  "white": "白色让空处变得更亮",
};
const CURATOR_NOTE_PATTERNS = [
  (detail: string, signal: string) => `${detail}。${signal}先停在边缘，远处的光会慢慢把画面打开。`,
  (detail: string, signal: string) => `${detail}，${signal}像从暗处浮上来。`,
  (detail: string, signal: string) => `${detail}。前景还在呼吸，背景里慢慢聚起${signal}。`,
  (detail: string, signal: string) => `光先落在最安静的位置。${detail}，${signal}也在那里停了一会儿。`,
];

function readSingle(params: Record<string, string | string[] | undefined> | undefined, key: string): string | undefined {
  const value = params?.[key];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function cleanCuratorialToken(token: string): string | undefined {
  const normalized = token.trim().toLowerCase();

  if (normalized.length <= 1 || TOKEN_STOPWORDS.has(normalized)) {
    return undefined;
  }

  return normalized;
}

function moodCopy(tag: string | undefined): string | undefined {
  if (!tag) {
    return undefined;
  }

  return MOOD_COPY[tag.toLowerCase().replaceAll(" ", "_")];
}

function buildCuratorialSignal(result: WebSearchResult["results"][number]): string {
  const moodSignal = [...result.artwork.moodTags, ...result.artwork.emotionLabels]
    .map(moodCopy)
    .find(Boolean);

  if (moodSignal) {
    return moodSignal;
  }

  const cleanToken = result.matchedTokens.map(cleanCuratorialToken).find(Boolean);

  return cleanToken ? `“${cleanToken}”的余韵` : "这一刻的余韵";
}

function firstMappedTag(tags: string[], copy: Record<string, string>): string | undefined {
  return tags.map((tag) => copy[tag]).find(Boolean);
}

function buildVisualDetail(result: WebSearchResult["results"][number]): string {
  const artwork = result.artwork;
  const composition = firstMappedTag(artwork.compositionTags, COMPOSITION_COPY);
  const subject = firstMappedTag(artwork.subjectTags, SUBJECT_COPY);
  const color = firstMappedTag(artwork.colorTags, COLOR_COPY);

  if (composition && color) {
    return `${composition}，${color}`;
  }
  if (composition && subject) {
    return `${composition}，${subject}`;
  }
  if (subject && color) {
    return `${subject}，${color}`;
  }

  return composition ?? subject ?? color ?? "画面先留出一点空处";
}

function notePatternIndex(id: string, title: string): number {
  const source = `${id}:${title}`;
  let hash = 0;

  for (const char of source) {
    hash = (hash + char.charCodeAt(0)) % CURATOR_NOTE_PATTERNS.length;
  }

  return hash;
}

function buildImmersiveCuratorNote(result: WebSearchResult["results"][number]): string {
  const signal = buildCuratorialSignal(result);
  const detail = buildVisualDetail(result);
  const pattern = CURATOR_NOTE_PATTERNS[notePatternIndex(result.artwork.id, result.artwork.title)] ?? CURATOR_NOTE_PATTERNS[0];

  return pattern(detail, signal);
}

function inferDisplayMode(artwork: WebSearchResult["results"][number]["artwork"]): ImmersiveGalleryUnit["displayMode"] {
  const source = [
    artwork.title,
    artwork.medium,
    artwork.department,
    ...artwork.subjectTags,
    ...artwork.compositionTags,
  ].filter(Boolean).join(" ").toLowerCase();

  if (/\b(architecture|architectural|building|chapter house|church|cathedral|interior|room|portal|cloister)\b/.test(source)) {
    return "architecture-flat";
  }

  if (/\b(painting|paintings|oil|canvas|panel|watercolor|drawing|print|photograph|albumen|gelatin silver)\b/.test(source)) {
    return "wall-painting";
  }

  if (/\b(ceramic|porcelain|glass|vase|bowl|cup|jar|bronze|silver|gold|wood|ivory|sculpture|statue|figurine|terracotta|stoneware|earthenware|textile)\b/.test(source)) {
    return "object-case";
  }

  return "wall-painting";
}

export default async function ImmersivePage({ params, searchParams }: ImmersivePageProps) {
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const query = readSingle(queryParams, "query") || DEFAULT_CURATION_PROMPT;
  const selectedUnitId = readSingle(queryParams, "unit");
  const catalog = loadWebReleaseCatalog();
  const search = searchReleaseCatalog(catalog, query, { limit: 12 });
  const narrative = buildCurationNarrative(search);
  const journeyIntensities = buildJourneyIntensities(search.results);
  const sceneSearch = searchBackgroundScenes(catalog, query, { limit: 12 });
  const sceneRoute = buildGallerySceneRoute(search, catalog.backgroundScenes, {
    sceneResults: sceneSearch.results,
    growthForm: narrative.growthForm,
  });
  const growthStageByArtworkId = new Map(
    narrative.growthForm.stages.flatMap((stage) => stage.artworkIds.map((artworkId) => [artworkId, stage] as const)),
  );
  const galleryHref = "/gallery";

  const units: ImmersiveGalleryUnit[] = search.results.map((result, index) => {
    const routeStop = sceneRouteStopForIndex(sceneRoute, index);
    const growthStage = growthStageByArtworkId.get(result.artwork.id);

    return {
      id: result.artwork.id,
      title: result.artwork.title,
      artistDisplayName: result.artwork.artistDisplayName,
      yearLabel: result.artwork.yearLabel,
      imageUrl: artworkImageUrl(result.artwork.id),
      imageUrlFull: artworkImageUrl(result.artwork.id, "full"),
      aspectRatioHint: result.artwork.aspectRatioHint,
      backgroundSceneUrl: routeStop?.scene.imageUrl ?? result.scene?.imageUrl,
      sceneLabel: routeStop?.scene.label ?? result.scene?.label ?? id,
      sceneMatchReason: undefined,
      sceneRouteLabel: routeStop?.stageTone,
      stageLabel: routeStop?.stageLabel ?? STAGE_BY_INDEX[index] ?? "Scene",
      stageTone: routeStop?.stageTone ?? growthStage?.signals[0]?.value ?? buildCuratorialSignal(result),
      emotionalIntensity: growthStage?.intensity ?? journeyIntensities[index] ?? result.combinedScore,
      growthStageId: growthStage?.id ?? routeStop?.growthStageId,
      growthStageRole: growthStage?.role,
      affectState: growthStage
        ? {
          valence: growthStage.valence,
          arousal: growthStage.arousal,
          tension: growthStage.tension,
          wonder: growthStage.wonder,
          intimacy: growthStage.intimacy,
        }
        : undefined,
      transitionIntent: routeStop?.transitionIntent ?? growthStage?.transitionIntent,
      curatorNote: buildImmersiveCuratorNote(result),
      displayMode: inferDisplayMode(result.artwork),
      visualPresentation: result.artwork.visualPresentation,
      transitionFamily: TRANSITION_SEQUENCE[index % TRANSITION_SEQUENCE.length],
    };
  });

  return (
    <ImmersiveGallery
      galleryHref={galleryHref}
      preface={narrative.preface}
      closing={narrative.closing}
      getSceneHref={(unit) => `/gallery/${encodeURIComponent(id)}/immersive?${new URLSearchParams({
        query,
        unit: unit.id,
      }).toString()}`}
      selectedUnitId={selectedUnitId}
      units={units}
    />
  );
}
