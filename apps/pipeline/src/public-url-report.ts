import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ImportDecision, PublicReviewedImportArtwork } from "./verified-partial-import";
import { formatCatalogDimensions, publicImportHash, writePublicImportJson, type PublicIntake, type PublicVisualReview } from "./public-url-intake";

const reasons: Record<string, string> = {
  "publication-image-fetch-failed": "发布处理时图片传输失败；未自动重试，原失败保留",
  "round-capacity-deferred": "已通过资料与预览检查；本轮数量已足够，未继续生成发布素材",
  "missing-title": "缺作品名", "missing-creator-name": "缺可用作者姓名（空白或只有编号不算姓名）", "missing-current-creator": "只有旧归属或原作参照作者，缺当前作者或明确的佚名记录", "missing-date": "缺年代", "missing-medium": "缺媒材", "missing-object-type": "缺作品类型",
  "metadata-rights-unconfirmed": "元数据复用许可尚未确认", "no-bound-licensed-public-image": "缺与该作品绑定且许可明确的可用公网图",
  "no-supported-public-image-url": "缺当前支持的馆方图像地址", "not-ready-for-current-gallery": "作品类型不属于当前默认平面画廊",
  "public-image-not-validated": "公网图片尚未完成本次取图验收", "visual-review-pending": "整幅视觉验收待完成",
  "image-resolution-insufficient": "图像清晰度不足（短边至少320、长边至少1600像素）", "image-body-too-large": "源响应超过读取上限，需核实可用的整幅尺寸版本",
  "image-transfer-timeout": "本次取图或图片信息读取超时", "source-host-stopped": "来源已在本批停止请求（拒绝访问、限流或连续超时）",
  "source-access-stopped": "来源拒绝访问或限流，已停止该域名", "invalid-image-response": "响应不是可直接验收的图像或图片信息",
  "unapproved-public-image-url": "图像或重定向地址未通过馆源检查", "bounded-whole-image-service-unconfirmed": "缺可核实的同图整幅尺寸服务",
  "duplicate-image": "与已入库图片重复，需核对作品身份", "visual-review-unconfirmed": "当前图像未通过完整独立正面验收",
  "public-image-evidence-changed": "图片与接入证据不一致", "editorial-evidence-missing": "缺对应当前图片的观察与文字依据",
  "already-in-release": "此前已在画廊记录中", "source-adapter-required": "需要对应馆源接入支持",
};
const explanation = (value: string) => value.startsWith("unsupported-presentation:") ? `当前呈现类型不适用：${value.split(":")[1]}`
  : (reasons[value.split(":")[0]] ?? value) + (value.includes(":HTTP-") ? `（${value.split(":").slice(1).join("，")}）` : "");
const cell = (value: unknown) => {
  let text = String(value ?? "");
  if (/^[=+@\t\r]/u.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
};

export function writePublicUrlGapReport(options: { workDir: string; intake: PublicIntake; decisions: ImportDecision[]; reviews: PublicVisualReview[]; activated: boolean }) {
  const byId = new Map(options.decisions.map(row => [row.candidateId, row])), reviews = new Map(options.reviews.map(row => [row.candidateId, row]));
  const header = ["候选ID", "馆源", "作品名原记录", "作者原记录", "年代原记录", "媒材原记录", "当前状态", "未接入原因", "验图说明", "已有成功URL数", "本次选用图片URL", "其他资料缺项", "原因代码"];
  const rows = options.intake.candidates.map(candidate => {
    const decision = byId.get(candidate.candidateId)!;
    const already = decision.reasons.includes("already-in-release");
    const status = already ? "此前已接入" : decision.status === "admitted" ? options.activated ? "本次已接入" : "验收通过，待发布" : "未接入";
    const optional = [];
    if (!formatCatalogDimensions(candidate.facts.dimensionsRaw)) optional.push("缺可展示的物理尺寸（不以像素替代）");
    if (!candidate.identity.canonicalObjectUrl) optional.push("未提供作品公开详情页");
    if (candidate.facts.creators?.some((creator: any) => creator.attributionStatus === "not-expressed-in-harvested-edm; verify-before-publication")) optional.push("当前EDM作者关联未表达归属限定；不据此证明亲笔或排除工作室归属");
    if (candidate.facts.creators?.some((creator: any) => {
      const fields = creator.sourceProductionFields;
      return fields && Number(String(fields.creator_date_of_birth ?? "").slice(0, 4)) === candidate.facts.dateStart
        && Number(String(fields.creator_date_of_death ?? "").slice(0, 4)) === candidate.facts.dateEnd;
    })) optional.push("馆方宽泛定年与作者生卒区间相同，具体创作年代待核");
    const review = reviews.get(candidate.candidateId);
    return [candidate.candidateId, candidate.institutionKey, candidate.facts.titleOriginal,
      candidate.facts.creators?.map((creator: any) => String(creator.nameOriginal ?? "").trim()).filter(Boolean).join("; "),
      candidate.facts.dateDisplay, candidate.facts.medium, status, already ? "" : decision.reasons.map(explanation).join("；"),
      decision.status === "held" && review ? `${review.view}：${review.observation}` : "", decision.successfulUrlCount, decision.sourceImageUrl ?? "", optional.join("；"), decision.reasons.join(" | ")];
  });
  mkdirSync(options.workDir, { recursive: true });
  const write = (name: string, data: unknown[][]) => writeFileSync(path.join(options.workDir, name), "\ufeff" + [header, ...data].map(row => row.map(cell).join(",")).join("\n") + "\n");
  write("全部候选状态_3274.csv", rows);
  write("未接入与资料缺项.csv", rows.filter(row => row[6] === "未接入"));
  const pendingOnly = (row: unknown[]) => String(row[12]).split(" | ").every(reason => ["public-image-not-validated", "visual-review-pending", "round-capacity-deferred"].includes(reason));
  write("待取图或验图队列.csv", rows.filter(row => row[6] === "未接入" && pendingOnly(row)));
  write("资料与图像缺项.csv", rows.filter(row => row[6] === "未接入" && !pendingOnly(row)));
  const visualGaps = options.reviews.filter(review => byId.get(review.candidateId)?.status === "admitted")
    .map(review => [review.candidateId, byId.get(review.candidateId)?.sourceImageUrl ?? "", review.sourceImageSha256,
      Object.entries(review.facts).filter(([, state]) => state === "unknown").map(([subject]) => subject).join(" | "),
      Object.entries(review.facts).filter(([, state]) => state === "present").map(([subject]) => subject).join(" | "),
      Object.entries(review.facts).filter(([, state]) => state === "absent").map(([subject]) => subject).join(" | ")]);
  writeFileSync(path.join(options.workDir, "已接入作品_视觉事实待核.csv"), "\ufeff" +
    [["候选ID", "已验图片URL", "图片SHA256", "仍未知的视觉事实", "已见到", "已确认没有"], ...visualGaps]
      .map(row => row.map(cell).join(",")).join("\n") + "\n");
  const admitted = options.decisions.filter(row => row.status === "admitted").length;
  const already = options.decisions.filter(row => row.reasons.includes("already-in-release")).length;
  const summary = { candidateCount: rows.length, admitted, alreadyInRelease: already, held: rows.length - admitted - already, activated: options.activated,
    byInstitution: Object.fromEntries([...new Set(options.intake.candidates.map(row => row.institutionKey))].map(source => [source, {
      candidates: options.intake.candidates.filter(row => row.institutionKey === source).length,
      admitted: options.decisions.filter(row => row.institutionKey === source && row.status === "admitted").length,
    }])) };
  writePublicImportJson(path.join(options.workDir, "summary.json"), summary);
  return summary;
}

/** Keep the admitted evidence usable without the temporary extraction directory. */
export function archivePublicSourceEvidence(input: { rootDir: string; inputDir: string; catalogDir: string; accepted: PublicReviewedImportArtwork[] }) {
  const directory = path.join(input.catalogDir, "evidence"); mkdirSync(directory, { recursive: true });
  const archived = new Map<string, string>();
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const object = value as Record<string, any>;
    if (typeof object.localRelativePath === "string" && /^[a-f0-9]{64}$/u.test(object.fileSha256 ?? "")) {
      const source = path.resolve(input.inputDir, object.localRelativePath);
      if (!source.startsWith(path.resolve(input.inputDir) + path.sep)) throw new TypeError("Source evidence path escapes input");
      const body = readFileSync(source);
      if (publicImportHash(body) !== `sha256:${object.fileSha256}`) throw new TypeError("Admitted source evidence changed");
      const destination = path.join(directory, object.fileSha256 + path.extname(source));
      if (!existsSync(destination)) cpSync(source, destination, { force: false, errorOnExist: true });
      archived.set(object.fileSha256, path.relative(input.rootDir, destination));
    }
    Object.values(object).forEach(visit);
  }
  for (const item of input.accepted) visit(JSON.parse(readFileSync(path.join(input.rootDir, item.catalogPath), "utf8")));
  writePublicImportJson(path.join(input.catalogDir, "source-evidence-index.json"), { schemaVersion: 1,
    files: [...archived].map(([sha256, file]) => ({ sha256, file })) });
}
