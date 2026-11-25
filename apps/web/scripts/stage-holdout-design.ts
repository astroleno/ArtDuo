import type { AffectState, ArtworkMedium, CurationIntentPlan, SpatialFraming, VisualSubject } from "@artduo/contracts";

export type Clause =
  | { kind: "observation"; pattern: string }
  | { kind: "fact"; subject: VisualSubject; value: "present" | "absent" }
  | { kind: "medium"; value: ArtworkMedium; exclude?: boolean }
  | { kind: "medium-detail"; pattern: string }
  | { kind: "space"; value: SpatialFraming };
type Stratum = "subject" | "medium-exclusion" | "visual-detail" | "arousal" | "mixed" | "boundary";
const obs = (pattern: string): Clause => ({ kind: "observation", pattern });
const fact = (subject: VisualSubject, value: "present" | "absent" = "present"): Clause => ({ kind: "fact", subject, value });
const medium = (value: ArtworkMedium, exclude = false): Clause => ({ kind: "medium", value, ...(exclude && { exclude }) });
const subtype = (pattern: string): Clause => ({ kind: "medium-detail", pattern });
const space = (value: SpatialFraming): Clause => ({ kind: "space", value });
const register = (id: string, stratum: Stratum, query: string, topic: string, criteria: Clause[], pace: "slow" | "medium" | "active" = "medium", artworkCount = 6) =>
  ({ id, stratum, query, topic, criteria, pace, artworkCount });

// Synthetic scenarios start from distinct depicted motifs, combinations and
// logical edge cases, not from rewrites of the 25 tuned requests.
export const HOLDOUT_DESIGN = [
  register("subject-01", "subject", "想看有马车或牵马场景的画，两件。", "horse-drawn carts or horses being led", [obs("马车|牵马|拉车的马|驾马|马拉")], "medium", 2),
  register("subject-02", "subject", "挑六幅画，留意石桥或拱桥。", "stone bridges and arched crossings", [obs("石桥|拱桥|桥拱")]),
  register("subject-03", "subject", "想看看风车怎样立在地面和天空之间，六幅。", "windmills set against land and sky", [obs("风车")]),
  register("subject-04", "subject", "给我三幅有雪地或积雪的画，想看白色铺在哪里。", "snow lying on the ground or on winter trees", [obs("雪地|积雪|覆雪|薄雪|白雪")], "medium", 3),
  register("subject-05", "subject", "挑六件有牛群或牧牛人的画，我想看牛怎样分布。", "cattle and herders across the picture", [obs("牛群|水牛|牧牛|牛只|卧牛|群牛|奶牛")]),
  register("media-01", "medium-exclusion", "只想看水彩里的花朵，一件，不要水墨。", "watercolour work with visible flowers", [medium("watercolor"), medium("ink", true), fact("flowers")], "medium", 1),
  register("media-02", "medium-exclusion", "六幅油画，画里要看得到云层；不要水彩。", "oil paintings with visible clouds", [medium("oil"), medium("watercolor", true), obs("云层|多云|阴云|白云|厚云|乌云|云团")]),
  register("media-03", "medium-exclusion", "六件木版画，想看画里的山。", "woodblock prints depicting mountains", [medium("print"), subtype("woodblock|woodcut|木版"), fact("mountain")]),
  register("media-04", "medium-exclusion", "给我六幅纸上素描，纸上要能看见树木。", "drawings on paper with visible trees", [medium("drawing"), subtype("paper|纸"), obs("树干|树冠|树丛|树木|林木")]),
  register("media-05", "medium-exclusion", "我想看画里的室内陈设，六件；不要有人。", "interior furnishings without people", [fact("interior"), fact("people", "absent")]),
  register("detail-01", "visual-detail", "找六件看得见桅杆或船帆的画。", "visible masts or sails", [obs("桅杆|船帆|帆布|张帆|白帆|扬帆")]),
  register("detail-02", "visual-detail", "想看看画里的楼梯和台阶，选六件。", "visible stairways and steps", [obs("楼梯|阶梯|台阶|石阶")]),
  register("detail-03", "visual-detail", "请选六幅能看到衣服褶纹的画，看看褶皱怎么转。", "visible garment folds and drapery", [obs("衣纹|衣褶|裙褶|袖褶|衣袍.{0,8}褶皱|织物.{0,8}褶皱")]),
  register("detail-04", "visual-detail", "想看六幅里头能辨认木桶或陶罐的画。", "recognizable wooden barrels and ceramic jars", [obs("木桶|陶罐")]),
  register("detail-05", "visual-detail", "挑六件可以留意拱门、拱形门洞或拱窗的画。", "recognizable arched doors or windows", [obs("拱门|拱形门洞|拱窗|拱形窗")]),
  register("arousal-01", "arousal", "想在六幅画中沿开阔的地平线慢慢看，视线不要被围住。", "low-energy broad vistas with a visible horizon", [space("open"), obs("地平线|水平远景")], "slow"),
  register("arousal-02", "arousal", "想把节奏放慢，看看画里歇着、坐着或躺卧的身影，六件。", "figures visibly at rest, seated or reclining", [fact("people"), obs("躺卧|睡卧|伏睡|休息|坐姿|围坐|端坐|坐着|坐在")], "slow"),
  register("arousal-03", "arousal", "想看动作幅度大的画，六件，画中有人在奔跑、扭转或舞动。", "large bodily movement, running, twisting or dancing", [fact("people"), obs("奔跑|飞奔|扭转|舞动|起舞|疾驰|跳跃")], "active"),
  register("arousal-04", "arousal", "想看六幅波浪冲起来的画，看浪花和冲击感。", "active breaking waves and turbulent water", [fact("water"), obs("浪花|巨浪|波涛|翻涌|汹涌|拍岸|翻卷")], "active"),
  register("arousal-05", "arousal", "想看六幅适合停下来细看的画，留意摆放的物件。", "low-energy stationary objects and their arrangement", [fact("stillLife"), obs("摆放|摆着|放置|排列|静置|瓶器|桌面|并置|堆叠")], "slow"),
  register("mixed-01", "mixed", "选六幅纸本版画，人物手里要看得到扇子或卷纸。", "prints on paper with figures holding fans or sheets", [medium("print"), subtype("paper|纸"), fact("people"), obs("手.{0,8}(?:扇|卷纸|纸卷)|持扇|执扇|持卷")]),
  register("mixed-02", "mixed", "想看三幅开阔的画，画里有屋子和一大片天空。", "open views with houses and a broad sky", [space("open"), obs("房屋|房舍|屋舍|农舍|屋顶|民居|小屋|村舍"), obs("天空.{0,5}(?:大半|大部|大片)|大片天空|宽阔天空|天空占")], "medium", 3),
  register("mixed-03", "mixed", "六幅油画，想看有人在室内桌边坐着。", "oil interiors with a figure seated at a table", [medium("oil"), fact("interior"), fact("people"), obs("坐.{0,6}(?:桌边|桌旁|桌前|桌后)|围.{0,5}桌.{0,5}坐|桌.{0,5}(?:前|旁|边).{0,8}坐")]),
  register("mixed-04", "mixed", "想看六幅有树木和水面倒影的画，媒材不限。", "trees and visible reflections in water", [fact("water"), obs("树木|树干|树冠|树丛|高树|桦树|柏树|垂柳"),
    obs("(?:倒映|映出).{0,12}(?:树干|树影|树木|屋舍|建筑|桥|远山|山峰|帆船|人物|拱门)|(?:树影|树木|屋舍|山峰|建筑|拱门|船身)(?:的)?倒影|水中倒影")]),
  register("mixed-05", "mixed", "请找六幅画，花朵和户外环境都得能看清。", "flowers visibly depicted outdoors", [fact("flowers"), fact("outdoors")]),
  register("mixed-06", "mixed", "给六幅有人骑乘的画，不要战争，也不要死亡。", "riders without war or death in the image", [fact("people"), fact("war", "absent"), fact("death", "absent"), obs("骑乘|骑马|马背|骑手")]),
  register("edge-01", "boundary", "只看油画，但也不要任何油画，仍请保留这两个条件。", "contradictory oil-only and no-oil constraints", [medium("oil"), medium("oil", true)]),
  register("edge-02", "boundary", "必须看得见行人，同时整幅画不要任何人物，两条都保留。", "contradictory visible people and no people", [fact("people"), fact("people", "absent")]),
  register("edge-03", "boundary", "六幅纸上的铜版蚀刻，人物肩上要确实站着一只鹦鹉。", "etchings with a clearly observed parrot perched on a shoulder", [medium("print"), subtype("etching|蚀刻"), fact("people"), obs("鹦鹉.{0,7}(?:肩|肩头)|(?:肩|肩头).{0,7}鹦鹉|parrot.{0,20}shoulder")]),
  register("edge-04", "boundary", "给六幅画，要求画里能辨认用双手托着的透明玻璃杯，而且不要肖像。", "both hands visibly holding a transparent glass, without portraits", [fact("portrait", "absent"), obs("双手.{0,10}(?:玻璃杯|透明杯)|玻璃杯.{0,10}(?:双手|两手)")]),
];

const targets: Record<"slow" | "medium" | "active", AffectState[]> = {
  slow: [{ valence: .55, arousal: .25, tension: .14, wonder: .4, intimacy: .5 }, { valence: .58, arousal: .30, tension: .13, wonder: .46, intimacy: .5 },
    { valence: .56, arousal: .20, tension: .10, wonder: .4, intimacy: .55 }],
  medium: [{ valence: .55, arousal: .40, tension: .2, wonder: .46, intimacy: .45 }, { valence: .58, arousal: .48, tension: .2, wonder: .52, intimacy: .46 },
    { valence: .57, arousal: .38, tension: .18, wonder: .44, intimacy: .48 }],
  active: [{ valence: .63, arousal: .62, tension: .32, wonder: .5, intimacy: .35 }, { valence: .65, arousal: .76, tension: .38, wonder: .6, intimacy: .35 },
    { valence: .63, arousal: .58, tension: .28, wonder: .53, intimacy: .38 }],
};

export function holdoutPlan({ query, topic, pace, artworkCount }: typeof HOLDOUT_DESIGN[number]): CurationIntentPlan {
  return {
    schemaVersion: 1, currentFeeling: "未陈述个人状态", desiredExperience: query, wantsRelief: false, pace, artworkCount,
    stages: ([
      ["threshold", "进入画面", "fade", "introduce the motif clearly", "opening"],
      ["mirror", "停看细节", "drift", "observe the depicted details", "detail"],
      ["afterglow", "再看一眼", "return", "keep the motif clearly visible at the close", "closing"],
    ] as const).map(([role, label, transitionIntent, focus, signal], index) => ({
      role, label, transitionIntent, query: `${topic}; ${focus}`, signals: [signal], ...targets[pace][index]!,
    })),
  };
}
