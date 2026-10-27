import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { appPath } from "@artduo/contracts";
import type { SculptureRoomScene, SculptureWork } from "@artduo/ui";
import { projectRootFromCwd } from "../../api/src/runtime/environment";
import { mediaSha256, parsePublicMediaManifest, staticMediaId } from "./public-media-manifest";
import { publicMediaOrigin } from "./public-media";

const SCULPTURE_RIGHTS = new Map([
  ["PDM 1.0", "https://creativecommons.org/publicdomain/mark/1.0/"],
  ["CC0 1.0", "https://creativecommons.org/publicdomain/zero/1.0/"],
  ["CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"],
  ["CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"],
  ["CC BY-NC 4.0", "https://creativecommons.org/licenses/by-nc/4.0/"],
  ["CC BY-NC-SA 4.0", "https://creativecommons.org/licenses/by-nc-sa/4.0/"],
]);

export function getSculptureCollection(options: { rootDir?: string; mode?: "local" | "cdn" } = {}): { works: SculptureWork[]; scenes: SculptureRoomScene[] } {
  const root = options.rootDir ?? projectRootFromCwd(), directory = path.join(root, "apps/web/public/artduo-sculptures");
  const sourceBytes = readFileSync(path.join(directory, "sources.json"));
  const source = JSON.parse(sourceBytes.toString()) as { models: Array<{
    id: string; title: string; artist: string; yearLabel: string; height: number; pedestalHeight: number; pedestalWidth: number; pedestalDepth: number;
    rotation: number; tags: string[]; summary: string; viewingNote: string; source: string; museumId?: string; rights: string; rightsUrl: string;
    catalogId?: string; sourceCredit?: string; collection?: string; displayMedium?: string; provenance?: string; factSources?: string[];
    referenceBounds: { min: number[]; max: number[] };
    museum?: { materials?: string[]; dimensions?: Array<{ type: string; value: string; unit: string }> };
    objectMetadata?: { materials?: string[]; dimensions?: Array<{ type: string; value: string; unit: string }> };
  }> };
  const deliveryFile = path.join(directory, "delivery.json");
  const delivery = existsSync(deliveryFile) ? JSON.parse(readFileSync(deliveryFile, "utf8")) as { origin: string; manifestSha256: string; verifiedAt: string } : undefined;
  const mode = options.mode ?? process.env.ARTDUO_SCULPTURE_MEDIA_MODE ?? (delivery ? "cdn" : "local");
  if (mode !== "local" && mode !== "cdn") throw new TypeError("Invalid sculpture delivery mode");
  const manifest = mode === "cdn" ? parsePublicMediaManifest(JSON.parse(readFileSync(path.join(directory, "media-manifest.json"), "utf8"))) : undefined;
  if (manifest && (!delivery || !Number.isFinite(Date.parse(delivery.verifiedAt)) || manifest.manifestSha256 !== delivery.manifestSha256
    || manifest.sourceManifestSha256 !== mediaSha256(sourceBytes))) throw new TypeError("Sculpture CDN publication is not verified against this catalog");
  const origin = manifest ? publicMediaOrigin(delivery!.origin) : undefined;
  const url = (local: string) => {
    if (!manifest) return appPath(local);
    const asset = manifest.assets.find(asset => asset.id === staticMediaId(local));
    if (!asset) throw new TypeError("Missing verified sculpture dependency");
    return `${origin}/${asset.objectKey}`;
  };
  const works: SculptureWork[] = source.models.map(model => {
    const grant = SCULPTURE_RIGHTS.get(model.rights);
    if (!grant || grant !== model.rightsUrl || (!model.museumId && (!model.catalogId || !model.sourceCredit || !model.collection || !model.displayMedium))
      || (model.rights.startsWith("CC BY") && !model.sourceCredit)) throw new TypeError("Sculpture source grant or attribution is incomplete");
    const objectMetadata = model.objectMetadata ?? model.museum ?? {};
    const plaster = objectMetadata.materials?.includes("plaster");
    const credit = model.sourceCredit ?? `SMK — Statens Museum for Kunst · ${model.museumId}\nSMK Open / Scan the World`;
    return {
      id: model.id, title: model.title, height: model.height,
      width: model.referenceBounds.max[0]! - model.referenceBounds.min[0]!, depth: model.referenceBounds.max[2]! - model.referenceBounds.min[2]!,
      pedestalHeight: model.pedestalHeight, pedestalWidth: model.pedestalWidth, pedestalDepth: model.pedestalDepth,
      compactUrl: url(`/artduo-sculptures/${model.id}-compact.glb`), referenceUrl: url(`/artduo-sculptures/${model.id}-reference.glb`),
      posterUrl: url(`/artduo-sculptures/${model.id}-poster.png`), initialRotation: model.rotation, tags: model.tags,
      reading: { artwork: { id: model.catalogId ?? `smk-sculpture-${model.museumId}`, metadata: {
        title: model.title, artistDisplayName: model.artist, yearLabel: model.yearLabel,
        medium: model.displayMedium ?? (plaster ? "石膏翻模扫描；数字石膏材质" : "馆藏雕塑扫描；数字石膏材质"),
        department: model.collection ?? (plaster ? "SMK 石膏翻模收藏" : "SMK 雕塑收藏"),
        objectUrl: model.source, dimensions: objectMetadata.dimensions?.map(size => `${size.type} ${size.value} ${size.unit}`).join("；") || undefined,
        creditLine: `${credit}\n${model.rights} · ${model.rightsUrl}${model.rights.includes("-SA") ? `\n处理后的模型及其渲染图按 ${model.rights} 提供。` : ""}${model.rights.includes("-NC") ? "\n非商业使用；保留来源署名及原授权条件。" : ""}\n${model.provenance ?? "馆藏说明依据 SMK 记录整理；馆藏材质、原作与翻模信息分别标注。"}${model.factSources?.length ? `\n作品资料：${model.factSources.join("；")}` : ""}\n展示处理：扫描清理、朝向与比例调整、网格简化、压缩、数字石膏材质与独立展台。`,
        moodTags: model.tags, colorTags: [], subjectTags: ["sculpture"], compositionTags: [],
      } }, caption: { text: model.summary, source: "grounded" }, curatorNote: { text: model.viewingNote, source: "fallback" } },
    };
  });
  const scenes: SculptureRoomScene[] = [
    { id: "bg-022", label: "临窗展厅", light: "right" as const, tone: "warm" as const },
    { id: "bg-034", label: "柔光展厅", light: "top" as const, tone: "neutral" as const },
  ].map(room => ({ ...room, imageUrl: url(`/artduo-gallery/lighting/v2/${room.id}-1600.webp`), smallImageUrl: url(`/artduo-gallery/lighting/v2/${room.id}-960.webp`),
    depthUrl: url(`/artduo-gallery/lighting/v2/${room.id}-depth.png`), normalUrl: url(`/artduo-gallery/lighting/v2/${room.id}-normal.png`) }));
  return { works, scenes };
}

/** A missing or mismatched optional publication must not take paintings down. */
export function getExhibitionSculptures(options?: Parameters<typeof getSculptureCollection>[0]) {
  try { return getSculptureCollection(options); }
  catch { return { works: [] as SculptureWork[], scenes: [] as SculptureRoomScene[] }; }
}
