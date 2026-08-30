import { buildMultitextPrompt } from "./deepseek-multitext-prompt.mjs";

const emotionOutput = {
  fields: ["emotion_read", "response", "boundary"],
  lengths: { emotion_read: [12, 45], response: [30, 95], boundary: [8, 50] },
};
const artworkOutput = {
  fields: ["introduction", "evidence_boundary"],
  lengths: { introduction: [80, 180], evidence_boundary: [10, 65] },
};
const framingOutput = {
  fields: ["text", "evidence_boundary"],
  lengths: { text: [80, 180], evidence_boundary: [10, 65] },
};
const curationOutput = {
  fields: ["curatorial_read", "selection_logic", "narrative_arc", "evidence_boundary"],
  lengths: {
    curatorial_read: [25, 80],
    selection_logic: [45, 130],
    narrative_arc: [30, 100],
    evidence_boundary: [15, 70],
  },
};

export const HOLDOUT_CASES = [
  {
    id: "holdout_emotion_praise_tears",
    category: "emotion",
    taskType: "emotion_response",
    task: "回应被肯定后想哭的状态，保留原因未知。",
    source: "今天收到导师肯定，我笑着道谢，回家后却一直想哭。别告诉我这是喜极而泣，也别问原因。",
    evidenceProfile: {
      explicit_states: ["收到导师肯定", "笑着道谢", "回家后想哭"],
      unknowns: ["想哭的原因"],
      boundaries: ["不解释为喜极而泣", "不追问"],
    },
    constraints: "承接肯定、道谢与想哭的并存，不给想哭命名或归因。",
    output: emotionOutput,
    requiredGroups: [["肯定"], ["想哭", "哭"], ["原因", "不知道", "不确定"]],
    forbidden: ["喜极而泣", "你其实", "为什么会哭"],
    unsupported: ["压力释放", "委屈", "压抑太久"],
  },
  {
    id: "holdout_emotion_silence_relief",
    category: "emotion",
    taskType: "emotion_response",
    task: "回应担心与轻松并存，不提供行动建议。",
    source: "朋友三天没回复，我一边担心，一边又因为不用马上回应而有点轻松。先别给我建议。",
    evidenceProfile: {
      explicit_states: ["朋友三天未回复", "担心", "不用马上回应带来轻松"],
      unknowns: ["朋友未回复的原因"],
      boundaries: ["不建议行动"],
    },
    constraints: "保留担心与轻松并存，不推断关系或失联原因。",
    output: emotionOutput,
    requiredGroups: [["三天", "没回复", "未回复"], ["担心"], ["轻松"]],
    forbidden: ["你应该联系", "再等等", "给他发消息"],
    unsupported: ["被冷落", "关系疏远", "逃避交流"],
  },
  {
    id: "holdout_emotion_calm_decision",
    category: "emotion",
    taskType: "emotion_response",
    task: "确认平静和已经作出的选择，不将平静问题化。",
    source: "我决定不参加聚会，现在很平静。别把平静解释成逃避，也不用鼓励我改变主意。",
    evidenceProfile: {
      explicit_states: ["决定不参加聚会", "现在平静"],
      unknowns: ["不参加的原因"],
      boundaries: ["不解释为逃避", "不劝改变决定"],
    },
    constraints: "简短确认决定与平静，不分析动机。",
    output: emotionOutput,
    requiredGroups: [["不参加", "聚会"], ["平静"]],
    forbidden: ["逃避", "再考虑", "改变主意"],
    unsupported: ["社交焦虑", "人际压力", "疲惫"],
  },
  {
    id: "holdout_emotion_result_privacy",
    category: "emotion",
    taskType: "emotion_response",
    task: "尊重结果内容的隐私，只承接看到通知时的紧张。",
    source: "检查结果出来了，我暂时不想说内容，只是看到通知就紧张。不要追问，也别保证一切都会好。",
    evidenceProfile: {
      explicit_states: ["检查结果已出", "看到通知紧张", "暂不说内容"],
      unknowns: ["结果内容", "紧张原因"],
      boundaries: ["不追问", "不保证结果"],
    },
    constraints: "不得猜测检查类型、结果或健康状况，不提供医疗判断。",
    output: emotionOutput,
    requiredGroups: [["结果", "通知"], ["紧张"], ["不说", "不追问", "隐私"]],
    forbidden: ["一切都会好", "没事的", "告诉我结果"],
    unsupported: ["疾病", "阳性", "阴性", "医生"],
  },
  {
    id: "holdout_art_known_description",
    category: "artwork_intro",
    taskType: "artwork_intro",
    task: "介绍作者、年代和画面均有记录的作品，不调用外部艺术史。",
    source: "馆藏记录：《雨棚下》，林遥，1998年，丙烯画。描述称画面有六把收拢的红伞靠在灰墙前，地面有水迹；未提供艺术家陈述。",
    evidenceProfile: {
      entity: "一件丙烯画",
      known: { title: "雨棚下", artist: "林遥", year: "1998", visible_description: "六把收拢的红伞、灰墙、地面水迹" },
      unknowns: ["艺术家陈述", "创作意图", "人物与地点"],
      statuses: { artist: "confirmed", year: "artwork_year", image_description: "provided" },
    },
    constraints: "80–180字；保留六把伞的数量，不补国籍、流派、天气、人物或象征。",
    output: artworkOutput,
    requiredGroups: [["雨棚下"], ["林遥"], ["1998"], ["六把", "6把"], ["红伞"], ["灰墙"], ["水迹"]],
    forbidden: ["象征", "艺术家试图", "雨天"],
    unsupported: ["中国艺术家", "写实主义", "行人", "刚下过雨", "孤独"],
  },
  {
    id: "holdout_art_sparse_label",
    category: "artwork_intro",
    taskType: "artwork_intro",
    task: "在记录稀少且无图像时介绍藏品。",
    source: "一块小木板，题为《编号七码》，媒介登记为蜡笔与石墨；作者、年代不详；无图像，背面残余标签只可读出‘仓库B’，标签日期缺失。",
    evidenceProfile: {
      entity: "一块小木板",
      known: { title: "编号七码", medium: "蜡笔与石墨", label_text: "仓库B" },
      unknowns: ["作者", "年代", "图像内容", "标签日期", "用途"],
      statuses: { title: "registered", label: "partial" },
    },
    constraints: "80–180字；不得把残余标签解释成来源、收藏地点或用途。",
    output: artworkOutput,
    requiredGroups: [["编号七码"], ["蜡笔", "石墨"], ["仓库B"], ["作者", "年代"], ["无图像", "图像"]],
    forbidden: ["收藏于仓库B", "来自仓库B", "用于编号"],
    unsupported: ["线条", "构图", "色彩", "工业用途", "档案编号"],
  },
  {
    id: "holdout_art_description_conflict",
    category: "artwork_intro",
    taskType: "artwork_intro",
    task: "并列标题与描述冲突，不替记录解释。",
    source: "馆藏标题为《午后花园》；描述仅写‘夜班工人在三台冲床旁交接’；无图像，作者和年代未登记，标题与描述的关系没有说明。",
    evidenceProfile: {
      entity: "一条馆藏记录",
      known: { title: "午后花园", description: "夜班工人在三台冲床旁交接" },
      unknowns: ["图像", "作者", "年代", "标题与描述的关系"],
      statuses: { title_description_relation: "unresolved_conflict" },
    },
    constraints: "80–180字；不得断言花园与工厂构成隐喻、反差或双重主题。",
    output: artworkOutput,
    requiredGroups: [["午后花园"], ["夜班工人"], ["三台", "3台"], ["冲床"], ["冲突", "关系", "无法"]],
    forbidden: ["象征", "隐喻", "形成反差"],
    unsupported: ["工厂花园", "工业化", "劳动者处境", "作者意图"],
  },
  {
    id: "holdout_art_uncertain_workshop",
    category: "artwork_intro",
    taskType: "artwork_intro",
    task: "介绍归属、日期性质与来源链均有限定的物件。",
    source: "一枚银质徽章，记录日期约1912–1916年，制作方栏为‘可能出自M. Osei工作室’；1930–1944年的来源记录缺失；正面刻‘North Quay’，无用途说明和照片。",
    evidenceProfile: {
      entity: "一枚银质徽章",
      known: { record_date: "约1912–1916", inscription: "North Quay" },
      unknowns: ["确切制作方", "制作年代", "1930–1944来源", "用途", "照片"],
      statuses: { maker: "possibly M. Osei workshop", date: "record_date", provenance: "gap" },
    },
    constraints: "80–180字；不得把工作室、记录日期或用途写成确定事实。",
    output: artworkOutput,
    requiredGroups: [["银质徽章"], ["1912", "1916"], ["可能", "M. Osei"], ["1930", "1944"], ["North Quay"]],
    forbidden: ["由M. Osei制作", "制作于1912", "用于港口"],
    unsupported: ["船员", "铁路", "纪念", "制服", "捐赠"],
  },
  {
    id: "holdout_preface_measurement_marks",
    category: "framing_text",
    taskType: "exhibition_preface",
    task: "为展览《尺痕》写前言。",
    source: "展览共8件：4把木尺与4件裁衣样板，年代为1890–1970年；6件带刻度磨损，2件状态未注明；没有使用者、使用地点或磨损原因记录。",
    evidenceProfile: {
      entity_unit: "展品/件",
      known: ["8件", "4把木尺", "4件裁衣样板", "1890–1970", "6件有刻度磨损", "2件状态未注明"],
      unknowns: ["使用者", "使用地点", "磨损原因"],
      function: "用已知物件与记录状态建立观看入口",
    },
    constraints: "80–180字；不把磨损解释成劳动、记忆、时间或身体经验。",
    output: framingOutput,
    requiredGroups: [["8件", "八件"], ["木尺"], ["裁衣样板"], ["1890", "1970"], ["6件", "六件"], ["未注明", "未记录"]],
    forbidden: ["时间留下", "劳动记忆", "身体尺度", "共同诉说"],
    unsupported: ["裁缝", "工厂", "家庭", "女性"],
  },
  {
    id: "holdout_preface_uncatalogued_index",
    category: "framing_text",
    taskType: "exhibition_preface",
    task: "为目录卡陈列《未归类的索引》写前言。",
    source: "陈列15张目录卡，记录日期从1910到1988年；5张作者栏空白，4张物件编号被覆盖；资料没有说明覆盖时间、原因或原编号。",
    evidenceProfile: {
      entity_unit: "目录卡/张",
      known: ["15张", "1910–1988", "5张作者栏空白", "4张物件编号被覆盖"],
      unknowns: ["覆盖时间", "覆盖原因", "原编号"],
      function: "说明记录状态并建立观看入口",
    },
    constraints: "80–180字；不把空白与覆盖解释为遗忘、审查或历史抹除。",
    output: framingOutput,
    requiredGroups: [["15张", "十五张"], ["1910"], ["1988"], ["5张", "五张", "作者"], ["4张", "四张", "编号"], ["未知", "未说明", "没有说明"]],
    forbidden: ["被抹去", "遗忘", "审查", "集体记忆"],
    unsupported: ["战争", "政治", "机构失误", "修复"],
  },
  {
    id: "holdout_closing_voice_fragments",
    category: "framing_text",
    taskType: "exhibition_closing",
    task: "为录音陈列《五段声音》写结语。",
    source: "陈列包含5段录音，录制于1956、1974、1999年；2段说话者身份可确认，3段身份未知；只有1段有完整转写，资料未记录录音场合与目的。",
    evidenceProfile: {
      entity_unit: "录音/段",
      known: ["5段", "1956、1974、1999", "2段身份确认", "3段身份未知", "1段完整转写"],
      unknowns: ["其余转写", "录音场合", "录音目的"],
      function: "收束已知声音记录与明确缺项",
    },
    constraints: "80–180字；不补说话内容、声音质感、人物经历或时代意义。",
    output: framingOutput,
    requiredGroups: [["5段", "五段"], ["1956"], ["1974"], ["1999"], ["2段", "两段"], ["3段", "三段"], ["转写"]],
    forbidden: ["穿越时间", "声音唤醒", "共同记忆", "倾听历史"],
    unsupported: ["访谈", "广播", "方言", "战争", "歌声"],
  },
  {
    id: "holdout_closing_graduation_textiles",
    category: "framing_text",
    taskType: "exhibition_closing",
    task: "为毕业纪念织物陈列写结语。",
    source: "陈列有6件登记为毕业纪念用途的织物，年代为1948–2006年，所属学校各异；资料未记录赠送者、收件者，也没有使用方式和观众反馈。",
    evidenceProfile: {
      entity_unit: "织物/件",
      known: ["6件", "毕业纪念用途", "1948–2006", "学校各异"],
      unknowns: ["赠送者", "收件者", "使用方式", "观众反馈"],
      function: "收束登记用途和记录缺项",
    },
    constraints: "80–180字；不补毕业故事、校园传统、祝福、怀念或观看效果。",
    output: framingOutput,
    requiredGroups: [["6件", "六件"], ["毕业纪念"], ["1948"], ["2006"], ["学校"], ["未记录", "没有"]],
    forbidden: ["青春", "祝福", "告别", "怀念", "共同成长"],
    unsupported: ["校服", "毕业生", "典礼", "家长", "捐赠"],
  },
  {
    id: "holdout_curation_quiet_visit",
    category: "curation_analysis",
    taskType: "curation_analysis",
    task: "把明确的观看偏好整理为克制的策展分析。",
    source: "我只有20分钟，想看节奏安静、没有人物形象的作品。不想被解释太多，也不想经历情绪高潮。媒介不限。",
    evidenceProfile: {
      explicit_needs: ["20分钟", "节奏安静", "没有人物形象", "少解释", "无情绪高潮", "媒介不限"],
      exclusions: ["人物形象", "高刺激叙事", "强解释"],
      unknowns: ["具体媒介偏好", "艺术家", "年代", "色彩偏好"],
    },
    constraints: "只形成选择原则和叙事节奏，不推荐具体作品、艺术家或风格。",
    output: curationOutput,
    requiredGroups: [["20分钟"], ["安静"], ["人物"], ["高潮", "平缓"], ["媒介不限", "媒介"]],
    forbidden: ["推荐莫奈", "极简主义", "冥想疗愈"],
    unsupported: ["喜欢抽象", "偏爱冷色", "焦虑", "注意力不足"],
  },
  {
    id: "holdout_curation_grief_no_resolution",
    category: "curation_analysis",
    taskType: "curation_analysis",
    task: "为不希望被引向疗愈结果的观看需求形成策展分析。",
    source: "我想看和失去有关的作品，但不要把展览做成走出悲伤或获得疗愈的过程。我可以接受沉重，但不想看真实遗体图像。",
    evidenceProfile: {
      explicit_needs: ["与失去有关", "可以沉重", "不预设走出悲伤", "不预设疗愈"],
      exclusions: ["真实遗体图像", "康复式情绪弧线"],
      unknowns: ["具体失去对象", "媒介", "年代", "观看时长"],
    },
    constraints: "策展弧线应允许停留在未解决状态，不保证情感转化。",
    output: curationOutput,
    requiredGroups: [["失去"], ["沉重"], ["疗愈", "走出悲伤"], ["遗体"]],
    forbidden: ["最终释然", "重新获得希望", "完成告别"],
    unsupported: ["亲人去世", "创伤", "抑郁", "宗教"],
  },
  {
    id: "holdout_curation_intergenerational_access",
    category: "curation_analysis",
    taskType: "curation_analysis",
    task: "整理跨年龄共同观看与可达性约束。",
    source: "我会和七岁的孩子、行动不便的外婆一起看。希望每一段都能坐着停留，不要闪烁影像，也不要靠大段文字才能理解。总时长四十分钟左右。",
    evidenceProfile: {
      explicit_needs: ["七岁孩子", "行动不便的外婆", "可坐着停留", "约40分钟"],
      exclusions: ["闪烁影像", "依赖大段文字"],
      unknowns: ["具体主题", "媒介偏好", "情绪目标"],
    },
    constraints: "只据此形成空间、节奏和信息负担原则，不推断疾病或儿童能力。",
    output: curationOutput,
    requiredGroups: [["孩子", "七岁"], ["外婆", "行动不便"], ["坐", "停留"], ["闪烁"], ["文字"], ["40分钟", "四十分钟"]],
    forbidden: ["轮椅", "视力障碍", "注意力短"],
    unsupported: ["认知障碍", "听力问题", "需要互动游戏", "家庭关系"],
  },
  {
    id: "holdout_curation_bright_low_contrast",
    category: "curation_analysis",
    taskType: "curation_analysis",
    task: "保留看似冲突但可以并存的视觉与节奏偏好。",
    source: "我喜欢明亮颜色，但强烈明暗对比会让我累。希望展览有变化但不要戏剧化；照片和绘画都可以，雕塑不方便看。",
    evidenceProfile: {
      explicit_needs: ["明亮颜色", "低明暗对比", "有变化", "不戏剧化", "照片和绘画均可"],
      exclusions: ["强烈明暗对比", "雕塑"],
      unknowns: ["主题", "年代", "艺术家", "观看时长"],
    },
    constraints: "不得把明亮与低对比改写成矛盾，也不解释雕塑为何不方便。",
    output: curationOutput,
    requiredGroups: [["明亮"], ["对比"], ["变化"], ["戏剧化"], ["照片"], ["绘画"], ["雕塑"]],
    forbidden: ["你的偏好矛盾", "视觉障碍", "改用装置"],
    unsupported: ["喜欢暖色", "畏光", "空间狭小", "无法行走"],
  },
];

function contractText(item) {
  const fields = item.output.fields.map((field) => {
    const [min, max] = item.output.lengths[field];
    return `- ${field}: ${min}–${max}个中文字符`;
  }).join("\n");
  return `只返回JSON对象，只含${item.output.fields.join("、")}字段，值均为字符串。\n${fields}`;
}

const routedRules = {
  emotion_response: "只承接 explicit_states 与用户边界；未知保持未知。不诊断、不新增情绪或经历、不建议、不追问。",
  artwork_intro: "逐项保持 known、unknowns 与 statuses 的字段角色；不使用外部知识，不补作者身份、流派、图像、意图、用途或历史。",
  exhibition_preface: "用 known 建立观看入口，unknowns 只作为记录状态；不解释缺失原因，不补共同主题、因果、象征或观看效果。",
  exhibition_closing: "收束 known 与 unknowns，最多一句开放式结束；不补故事、意义、情绪结果或观众反馈。",
  curation_analysis: "把 explicit_needs、exclusions 与 unknowns 转成选择原则和叙事节奏；区分明确要求与未知，不诊断用户，不推荐具体作品或艺术家。",
};

function buildGenericRoutedPrompt(item) {
  return `只完成当前task_type。source_evidence与evidence_profile是封闭信息源。\n${routedRules[item.taskType]}\n${contractText(item)}\n任务：${item.task}\n要求：${item.constraints}\n逐句反查输入，不能映射的事实、原因、身份和主题全部删除。只输出最终JSON。\n<input>\ncase_id="${item.id}"\ntask_type="${item.taskType}"\nsource_evidence=${JSON.stringify(item.source)}\nevidence_profile=${JSON.stringify(item.evidenceProfile)}\n</input>`;
}

function buildCurationBaselinePrompt(item) {
  return `你是专业艺术策展人。请分析用户需求并制定个性化策展方案，兼顾情绪、视觉特征、媒介、叙事语气和观看节奏。不要展示思考过程。\n${contractText(item)}\n任务：${item.task}\n要求：${item.constraints}\n用户输入：${JSON.stringify(item.source)}\n只返回最终JSON。`;
}

export function buildHoldoutPrompt(item, variant) {
  if (variant === "generic-task-routed-v5") return buildGenericRoutedPrompt(item);
  if (variant === "source-isolated-v3") {
    if (item.taskType === "curation_analysis") return buildCurationBaselinePrompt(item);
    return buildMultitextPrompt(item, "source-isolated-v3");
  }
  throw new Error(`Unknown holdout variant: ${variant}`);
}

export const NARRATION_PACKETS = [
  {
    id: "narration_navigation_tools",
    title: "偏差记录",
    source: "展览共6件导航工具：2件罗盘、2件六分仪、2张航线计算表，年代为1885–1962年；3件带修正刻痕，1张表缺少末页；资料没有使用者、航次和修正原因记录。",
    evidenceProfile: { entity_unit: "展品/件或张", known: ["6件", "2件罗盘", "2件六分仪", "2张航线计算表", "1885–1962", "3件修正刻痕", "1张缺末页"], unknowns: ["使用者", "航次", "修正原因"] },
  },
  {
    id: "narration_anonymous_postcards",
    title: "未寄出的地址",
    source: "陈列有9张未寄出的明信片，日期从1904到1978年；6张写有地址但无收件人姓名，3张背面空白；资料没有说明为何未寄出，也没有书写者信息。",
    evidenceProfile: { entity_unit: "明信片/张", known: ["9张", "1904–1978", "6张有地址无姓名", "3张背面空白"], unknowns: ["未寄原因", "书写者"] },
  },
  {
    id: "narration_field_recordings",
    title: "地点待定",
    source: "展览包含4段环境录音，录制年份为1961、1980、1997、2015；两段地点可确认，两段地点未知；资料只标注时长，没有声音内容说明和录制目的。",
    evidenceProfile: { entity_unit: "录音/段", known: ["4段", "1961、1980、1997、2015", "2段地点确认", "2段地点未知", "仅标时长"], unknowns: ["声音内容", "录制目的"] },
  },
  {
    id: "narration_printed_notices",
    title: "临时通知",
    source: "陈列有11张印刷通知，年代为1938–2001年；7张保留发布日期，4张日期缺失；8张有发布机构，3张机构未知；资料没有张贴地点和受众反馈。",
    evidenceProfile: { entity_unit: "通知/张", known: ["11张", "1938–2001", "7张有日期", "4张日期缺失", "8张有机构", "3张机构未知"], unknowns: ["张贴地点", "受众反馈"] },
  },
];

function narrationItem(packet, taskType) {
  const isPreface = taskType === "exhibition_preface";
  return {
    id: packet.id,
    taskType,
    task: `为展览《${packet.title}》写${isPreface ? "前言" : "结语"}。`,
    source: packet.source,
    evidenceProfile: { ...packet.evidenceProfile, function: isPreface ? "建立观看入口" : "收束已知与未知" },
    constraints: `${isPreface ? "100–180" : "90–160"}字；只依据记录，克制、自然。`,
    output: framingOutput,
  };
}

export function buildNarrationPrompts(packet) {
  const prefaceItem = narrationItem(packet, "exhibition_preface");
  const closingItem = narrationItem(packet, "exhibition_closing");
  const combined = `一次完成同一展览的前言与结语。source_evidence与evidence_profile是封闭信息源。前言建立观看入口，结语收束已知与未知；两段都不得补故事、原因、象征、观众体验或情绪结果。\n只返回JSON对象，只含preface、closing、preface_boundary、closing_boundary四个字符串字段。preface 100–180字；closing 90–160字；两个boundary各10–65字。\n<input>\ncase_id="${packet.id}"\ntask_type="combined_narration"\ntitle=${JSON.stringify(packet.title)}\nsource_evidence=${JSON.stringify(packet.source)}\nevidence_profile=${JSON.stringify(packet.evidenceProfile)}\n</input>`;
  return {
    combined,
    preface: buildGenericRoutedPrompt(prefaceItem),
    closing: buildGenericRoutedPrompt(closingItem),
  };
}

export function decideRoutingFramework(metrics) {
  const blockers = [];
  if (metrics.holdoutQualityDelta < -0.25) blockers.push("holdout_quality");
  if (metrics.holdoutSevereErrorDelta > 0) blockers.push("holdout_severe_errors");
  if (metrics.holdoutParseRate < 0.99) blockers.push("holdout_parse_rate");
  if (metrics.holdoutTtftImprovement < 0.1) blockers.push("holdout_ttft");
  const taskRouter = blockers.length === 0 ? "confirm" : "hold";

  const narrationBlockers = [];
  if (metrics.narrationQualityDelta < -0.25) narrationBlockers.push("narration_quality");
  if (metrics.narrationSevereErrorDelta > 0) narrationBlockers.push("narration_severe_errors");
  if (metrics.narrationAllCompleteImprovement < 0.05) narrationBlockers.push("narration_all_complete_time");
  blockers.push(...narrationBlockers);
  const splitNarration = narrationBlockers.length === 0 ? "confirm" : "hold";
  return { taskRouter, splitNarration, framework: taskRouter === "confirm" && splitNarration === "confirm" ? "confirm" : "hold", blockers };
}
