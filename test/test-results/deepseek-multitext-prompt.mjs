export const MULTITEXT_PROMPT_VARIANTS = ["plain", "source-isolated-v1", "source-isolated-v2", "source-isolated-v3", "source-isolated-v3.1", "task-routed-v4", "task-routed-v4.1", "task-routed-v4.2"];

const emotionOutput = {
  fields: ["emotion_read", "response", "boundary"],
  lengths: { emotion_read: [18, 45], response: [55, 100], boundary: [0, 45] },
};
const neutralEmotionOutput = {
  fields: ["emotion_read", "response", "boundary"],
  lengths: { emotion_read: [10, 30], response: [10, 40], boundary: [0, 45] },
};
const artworkOutput = {
  fields: ["introduction", "evidence_boundary"],
  lengths: { introduction: [100, 180], evidence_boundary: [15, 55] },
};
const framingOutput = (min, max) => ({
  fields: ["text", "evidence_boundary"],
  lengths: { text: [min, max], evidence_boundary: [15, 55] },
});

export const MULTITEXT_CASES = [
  {
    id: "emotion_relief_guilt",
    category: "emotion",
    task: "理解并回应用户的混合情绪，不给作品联想。",
    source: "项目今天被取消了。我松了一口气，但想到团队之前投入那么多，又觉得很愧疚。不要劝我看开。",
    constraints: "承认轻松与愧疚并存；不得强行积极或要求看开。",
    output: emotionOutput,
    requiredGroups: [["松", "轻松", "松口气"], ["愧疚", "内疚"], ["团队", "投入", "项目"]],
    forbidden: ["看开", "这是好事", "都是最好的安排"],
    unsupported: ["逃避责任", "不在乎团队", "一直压抑"],
  },
  {
    id: "emotion_apology_anger",
    category: "emotion",
    task: "直接回应收到道歉后更生气的感受，同时保留原因未知。",
    source: "他终于道歉了，我却比之前更生气。别替我编原因，也别劝我原谅。",
    constraints: "确认生气和道歉后的转折；不得推断愤怒原因，不得劝原谅。",
    output: emotionOutput,
    requiredGroups: [["道歉"], ["生气", "愤怒"], ["原因", "无法确定", "不知道"]],
    forbidden: ["原谅他", "你其实是因为", "你真正气的是", "积蓄", "委屈"],
    unsupported: ["背叛", "操控", "敷衍道歉"],
  },
  {
    id: "emotion_neutral_now",
    category: "emotion",
    task: "回应中性状态，不把没有特别情绪解释成问题。",
    source: "今天没什么特别情绪，只想安静吃完饭。不要分析我。",
    constraints: "保持平淡、简短、尊重不分析要求。",
    output: neutralEmotionOutput,
    requiredGroups: [["没有特别", "平静", "平淡", "中性"], ["安静", "吃饭"]],
    forbidden: ["压抑", "麻木", "低落", "逃避", "内心深处"],
    unsupported: ["需要陪伴", "害怕交流"],
  },
  {
    id: "emotion_privacy_boundary",
    category: "emotion",
    task: "回应用户对隐私暴露的紧张，明确不追问。",
    source: "我不想说具体发生了什么。只是想到别人可能知道，就觉得很紧张。请别追问。",
    constraints: "尊重隐私与不追问；不得承诺信息永不泄露或猜测事件。",
    output: emotionOutput,
    requiredGroups: [["紧张", "担心", "害怕"], ["不说", "隐私", "不追问", "边界"]],
    forbidden: ["告诉我发生了什么", "绝对保密", "不会有人知道", "创伤"],
    unsupported: ["羞耻", "犯罪", "家庭"],
  },
  {
    id: "art_rich_contrast",
    category: "artwork_intro",
    task: "为普通观众写一段克制、清晰的中文作品介绍。",
    source: "北斋约1835年木版画；题诗写山村冬日孤独加深、人与草木凋零；画中猎人在雪地围着大火，动作热闹，文字与画面构成反差。",
    constraints: "100–180字；可描述已知反差，不得补作者意图或人物心理。",
    output: artworkOutput,
    requiredGroups: [["北斋"], ["冬日", "孤独", "凋零"], ["猎人", "大火", "热闹"], ["反差"]],
    forbidden: ["北斋想要", "作者意在", "猎人感到"],
    unsupported: ["黄昏", "蓝色", "归家", "饥饿"],
  },
  {
    id: "art_sparse_untitled",
    category: "artwork_intro",
    task: "在资料极少时写一段诚实的中文作品介绍。",
    source: "作品题为《无题》，纸上墨水，作者与年代不详；无描述、无标签、无图像可用。",
    constraints: "100–180字；只能介绍登记事实与资料边界，不得想象画面或主题。",
    output: artworkOutput,
    requiredGroups: [["无题"], ["纸上墨水", "墨水"], ["作者", "年代"], ["资料", "无法", "未提供"]],
    forbidden: ["表达了", "象征", "作者试图", "画面中"],
    unsupported: ["线条", "黑色", "留白", "构图", "笔触", "氛围", "安静", "孤独"],
  },
  {
    id: "art_record_conflict",
    category: "artwork_intro",
    task: "介绍一条标题与描述冲突的馆藏记录，不替资料消解冲突。",
    source: "馆藏标题为《欢乐》；描述只写‘一支葬礼队伍经过石桥’。标题与描述明显冲突，无图像、作者和年代资料。",
    constraints: "100–180字；必须明确冲突和未知，不得断言作品表现欢乐与悲伤并存。",
    output: artworkOutput,
    requiredGroups: [["欢乐"], ["葬礼队伍", "石桥"], ["冲突", "矛盾"], ["无法", "未知", "未提供"]],
    forbidden: ["表现了欢乐与悲伤", "作者通过", "寓意", "象征"],
    unsupported: ["人物表情", "雨天", "送葬者", "欢笑"],
  },
  {
    id: "art_uncertain_attribution",
    category: "artwork_intro",
    task: "介绍归属和来源链不完整的藏品记录。",
    source: "一块黄铜铭牌；馆藏记录日期约1900–1910年，作者栏写‘可能归于E. Hart’，来源链缺少1924–1951年；表面刻有港口名称‘Dunhaven’，无照片或用途说明。",
    constraints: "100–180字；保留年代、归属和来源不确定性，不得发明用途或历史事件。",
    output: artworkOutput,
    requiredGroups: [["黄铜铭牌"], ["1900", "1910"], ["可能", "归于", "E. Hart"], ["1924", "1951", "来源链"], ["Dunhaven"]],
    forbidden: ["由E. Hart创作", "确定制作于", "用于纪念"],
    unsupported: ["船舶", "车站", "战争", "开幕", "捐赠"],
  },
  {
    id: "preface_repair",
    category: "framing_text",
    task: "写展览《修补之后》的中文前言。",
    source: "展览共5件作品：3件带可见修补痕迹的陶器、2件补缀纺织品；年代跨度1750–1950年；没有艺术家陈述，也不知道每次损坏和修补原因。",
    constraints: "130–180字；克制、具体，不把修补写成疗愈，不发明艺术家共同主张。",
    output: framingOutput(130, 180),
    requiredGroups: [["5件", "五件"], ["陶器"], ["纺织"], ["1750", "1950"], ["未知", "不知道", "未记录"]],
    forbidden: ["疗愈", "重生", "共同诉说", "艺术家们希望"],
    unsupported: ["战争创伤", "家族传承", "女性劳动"],
  },
  {
    id: "closing_night_photos",
    category: "framing_text",
    task: "为夜间街景摄影小展写中文结语。",
    source: "展览有3张夜间街景照片，拍摄年份为1931、1968、2004；两张地点可确认，一张地点未知；资料没有人物身份或拍摄动机。",
    constraints: "100–150字；开放、克制，不作口号式总结，不发明城市或人物故事。",
    output: framingOutput(100, 150),
    requiredGroups: [["3张", "三张"], ["1931"], ["1968"], ["2004"], ["地点", "未知"]],
    forbidden: ["穿越时空", "城市永不眠", "每个人都有故事", "摄影师想要"],
    unsupported: ["纽约", "上海", "工人", "恋人", "霓虹"],
  },
  {
    id: "preface_incomplete_archive",
    category: "framing_text",
    task: "为档案残片陈列写中文前言。",
    source: "陈列包含12条馆藏记录；其中4条作者缺失，3条描述在句中截断；可确认的年代从1880到1972年，媒介包括油画、照片和印刷品。",
    constraints: "120–180字；把缺失作为资料状态说明，不宣称它们代表集体记忆或被抹去的历史。",
    output: framingOutput(120, 180),
    requiredGroups: [["12条", "十二条"], ["4条", "四条", "作者"], ["3条", "三条", "截断"], ["1880"], ["1972"]],
    forbidden: ["集体记忆", "被抹去的历史", "沉默发声", "共同命运"],
    unsupported: ["殖民", "战争", "审查", "遗忘"],
  },
  {
    id: "closing_memorial_objects",
    category: "framing_text",
    task: "为纪念物件陈列写中文结语。",
    source: "陈列包含7件被登记为纪念用途的物件，年代与对象各异；资料只确认纪念用途，没有记录原持有者如何哀悼，也没有观众反馈。",
    constraints: "110–160字；允许停留与不确定，不保证观看带来疗愈、告别或释然。",
    output: framingOutput(110, 160),
    requiredGroups: [["7件", "七件"], ["纪念"], ["未记录", "没有记录", "未知"], ["观看", "观众", "停留"]],
    forbidden: ["得到疗愈", "完成告别", "终将释然", "带走希望", "治愈"],
    unsupported: ["战争死者", "亲人遗物", "宗教仪式"],
  },
];

function classifyEvidence(source) {
  if (/冲突|矛盾/.test(source)) return "record_conflict";
  if (/(没有|未知|不详|未提供|无)(?:图像|照片|描述|标签|人物|用途|作者|年代|资料)?|只确认|只记录|缺少|截断/.test(source)) {
    return "metadata_limited";
  }
  return "described";
}

export function classifyMultitextTask(item) {
  if (item.category === "emotion") return "emotion_response";
  if (item.category === "artwork_intro") return "artwork_intro";
  if (item.category === "framing_text" && /前言/.test(item.task)) return "exhibition_preface";
  if (item.category === "framing_text" && /结语/.test(item.task)) return "exhibition_closing";
  throw new Error(`Cannot classify multitext task: ${item.id ?? item.task ?? "unknown"}`);
}

export function classifyMultitextRiskProfile(item) {
  if (item.category === "emotion" && /别替我编原因|原因未知|无法确定原因/.test(item.source)) return "explicit_emotions_only";
  if (item.category === "artwork_intro" && /可能归于|归属.*不确定|作者.*存疑/.test(item.source)) return "uncertain_attribution";
  if (item.category === "artwork_intro" && /画中|题诗|描述.*写/.test(item.source) && !/作者.*(?:不详|未知|未提供)/.test(item.source)) return "described_artwork";
  if (item.category === "framing_text" && /馆藏记录|条记录/.test(item.source)) return "archive_record_fragments";
  return "standard";
}

function contractText(item) {
  const fieldLines = item.output.fields.map((field) => {
    const [min, max] = item.output.lengths[field];
    return `- ${field}: ${min}–${max} 个中文字符`;
  }).join("\n");
  return `只返回一个 JSON 对象，不要 Markdown、代码围栏、解释、前言或思考过程。对象只能包含 ${item.output.fields.join("、")} 字段，所有值都是字符串。\n${fieldLines}`;
}

const categoryInstructions = {
  emotion: `情感理解只依据用户原话：保留否定、转折和并存情绪；不诊断、不推断原因、不强行积极、不越过隐私和决定边界。response 先承接一个具体细节，再回应用户明确请求。`,
  artwork_intro: `作品介绍只依据 source_evidence：作品事实必须能逐字回指原文。资料未提供不等于作品中不存在；不得把标题当画面、把媒介写成质感，或补作者意图、人物心理、历史事件。`,
  framing_text: `前言或结语只依据 source_evidence 与 task：不得发明艺术家共同主张、作品之间的因果、观众体验或策展结论。避免“穿越时空、共同诉说、疗愈、重生、带走希望”等空泛套语。`,
};

const strictCategoryInstructions = {
  emotion: `逐句只承接用户明说的状态、对象与请求。不新增现场动作、物品、他人在场、提问、建议或替用户决定；原因未知时只说未知。若用户要求中性、简短或不分析，只确认该状态与选择，并用同义承接满足字段长度，不用服务提议或心理分析填充。`,
  artwork_intro: `逐项保持 source_evidence 中信息的语义角色，不把登记字段升级为作品事实：记录日期不等于制作日期，“可能归于”不等于作者确定，来源链缺口不等于仅存实物。不得补用途、存世状态、收藏地点、视觉细节、意图或历史背景。`,
  framing_text: `每个事实性分句都必须能直接回指 source_evidence；没有回指的具体名词、动作、因果、物理细节或观众效果一律删除。不得说缺失由保存或流转造成、并非刻意遮掩或属于自然缺损；不得把修补扩写成使用史、恢复效果或器物历史；不得给照片补街灯、建筑、人物、暗处；不得给物件补秘密、故事、记忆、疗愈或告别。`,
};

const framingLedgerInstructions = `只在内部按“事实清单 → 未知清单 → 正文”起草，不输出清单：
1. 事实清单逐项照录 source_evidence 的数量、类型、日期和状态，不改变字段含义。
2. 未知清单只收录 source_evidence 明说未提供或未知的内容，不解释为何未知。
3. 正文至少八成用于自然串联上述两份清单；观看引导最多一句，且不得引入输入中没有的实体、画面元素、因果或抽象主题。
4. 写完后逐个名词和主题反查 source_evidence。无法直接映射的内容全部删除；为了守住证据边界，宁可少写，也不用联想补足字数。

合格示例（仅示范方法，不得复用示例事实）：
source_evidence="陈列4张活动单，年份为1978、1986、1991、2003；其中2张地点未知；无组织者和活动目的记录。"
text="本陈列包括四张活动单，年份分别为1978、1986、1991与2003。其中两张的地点尚未确认，资料也没有记录组织者与活动目的。陈列按现有信息呈现这些材料，并保留记录中的未知部分。"
这个示例只写输入事实与明确缺项，没有补现场、人物、时代意义或观看效果。`;

const framingV31CaseRule = {
  preface_repair: "修补只作为可见的登记状态，不解释它的形成原因、实际效果、经历或象征。",
  closing_night_photos: "没有图像可供补写，只陈述照片数量、年份、地点确认状态及资料缺项。",
  preface_incomplete_archive: "缺失只作为记录状态，不解释其形成原因，也不扩展成历史判断。",
  closing_memorial_objects: "结尾只允许说明观众可以停留或离开；不预测观看后的心理或精神结果，也不解释这些物件对观众代表什么。",
};

const framingV31SentencePlan = {
  preface_repair: "目标145–165字。句1写5件作品与1750–1950年；句2分别写3件陶器的可见修补和2件纺织品的补缀；句3写未提供艺术家陈述；句4写损坏与修补原因未记录；句5只邀请观察已知痕迹。",
  closing_night_photos: "目标115–135字。句1写3张照片及1931、1968、2004年；句2写两张地点可确认、一张未知；句3原样写“资料未提供照片中人物的身份，也未提供拍摄动机”；句4原样写“观众可自行观看这些照片”。",
  preface_incomplete_archive: "目标135–160字。句1写12条记录、1880–1972年与三类媒介；句2写4条作者缺失；句3写3条描述截断；句4说明这些是现有资料状态；句5只允许观看现有记录。",
  closing_memorial_objects: "目标125–145字。句1写7件及登记用途；句2写年代与对象各异；句3写资料只确认用途；句4写哀悼方式与观众反馈未记录；句5只允许停留或离开。",
};

const framingV31Example = `合格示例：source="4张活动单，年份为1978、1986、1991、2003；2张地点未知；没有组织者和活动目的记录。" text="本陈列包括四张活动单，年份分别为1978、1986、1991与2003。其中两张的地点尚未确认，资料也没有记录组织者与活动目的。现有陈列仅依据这些登记内容，并保留其中尚未确认与未被记录的部分。观众可以查看这些现有材料。" 示例只复述输入事实和缺项。`;

const v31Constraints = {
  emotion_neutral_now: "保持平淡、简短；确认不分析与安静吃饭，不增加行动或建议。",
  preface_repair: "130–180字；具体陈述数量、类型、年代、可见状态及未记录信息。",
  closing_night_photos: "100–150字；陈述数量、年份、地点状态与资料缺项，结尾保持开放。",
  preface_incomplete_archive: "120–180字；说明条目、缺失、年代与媒介，把缺失保留为资料状态。",
  closing_memorial_objects: "110–160字；只陈述数量、登记用途、年代对象差异及未记录信息，结尾允许停留或离开。",
};

const v31SemanticRiskPatterns = {
  preface_repair: /故事|岁月|时间留下|使用与维护|见证|静默诉说|自行感受/,
  closing_night_photos: /想象|谜题|答案|意味|时间痕迹|时代印记|街灯|建筑|光影|夜色中|静候/,
  preface_incomplete_archive: /等待补充|历史判断|原貌|残片性质|集体记忆|被抹去/,
  closing_memorial_objects: /故事|安慰|意义|情感|疗愈|治愈|释然|告别|个人记忆|静默|无声/,
};

function v31CategoryRule(item) {
  if (item.category === "emotion") {
    const neutralGuard = item.id === "emotion_neutral_now"
      ? "本例只确认中性状态、安静吃饭和不分析；不新增现场动作、物品或服务提议，也不安排之后做什么。"
      : "只承接原话中的情绪、对象和请求；不诊断、不编原因、不强行积极、不替用户决定。";
    return `情感回应以用户原话为封闭信息源。${neutralGuard}`;
  }
  if (item.category === "artwork_intro") return categoryInstructions.artwork_intro;
  return `内部先列已知事实和明确缺项，再写正文；清单不要输出。${framingV31SentencePlan[item.id] ?? ""}观看引导最多一句，不能引入新实体、画面、因果、历史或观众感受。补足字数只能复述、拆分或重组输入事实，不得增加主题和意象。逐个名词反查 source_evidence，无法映射就删除。${framingV31CaseRule[item.id] ?? ""}${framingV31Example}`;
}

const routedTaskRules = {
  emotion_response: `情感回应规则：只承接原话中的情绪、对象、转折与明确请求；不诊断、不编原因、不强行积极、不提问、不建议、不替用户决定。原因未知就保持未知。`,
  artwork_intro: `作品介绍规则：只写 source_evidence 可直接支持的事实与明确缺项。保留字段角色和不确定性；记录日期不是制作日期，“可能归于”不是确定作者。不得补画面、用途、意图、心理或历史。`,
  exhibition_preface: `前言规则：建立观看入口，但正文只串联已知事实与明确缺项。不得解释缺失或修补原因，不得发明共同主张、因果、历史、意象或观看效果。`,
  exhibition_closing: `结语规则：收束已知事实与明确缺项，最多一句开放式离场提示。不得补人物、画面、故事、意义或观看后的情绪与精神结果。`,
};

const routedRiskRules = {
  explicit_emotions_only: `语义白名单只允许：道歉发生、道歉后更生气、原因未知，以及不编原因和不劝原谅的请求。不得增加委屈、不甘、困惑、等待、平复；用户请求不能改成助手意愿。`,
  described_artwork: `作者状态=已知：北斋；约1835年=作品年代；题诗、画面与反差=输入已描述。不得降级成归属存疑或登记日期。`,
  uncertain_attribution: `字段状态：物件=黄铜铭牌；作者归属=可能归于E. Hart；日期=馆藏记录日期；来源链=1924–1951缺失。不得升级任何不确定字段。`,
  archive_record_fragments: `实体单位=馆藏记录；数量=12条；作者缺失=4条；描述截断=3条；作品是否存世或可见=未知。只写“记录/条”，不改成作品/件或可观看。`,
};

const routedFramingLengthPlans = {
  preface_repair: "text 写155–170字、五句",
  closing_night_photos: "text 写130–145字、五句",
  preface_incomplete_archive: "text 写155–170字、五句",
  closing_memorial_objects: "text 写140–155字、五句",
};

function routedLengthPlan(item) {
  if (item.id === "emotion_neutral_now") return "emotion_read 写12–20字；response 写14–28字";
  if (item.category === "emotion") return "emotion_read 写22–38字；response 写65–85字、两句";
  if (item.category === "artwork_intro") return "introduction 写125–160字、四句";
  return routedFramingLengthPlans[item.id];
}

function buildTaskRoutedPrompt(item, { includeLengthPlan = false, includeRiskProfile = false } = {}) {
  const route = classifyMultitextTask(item);
  const riskProfile = classifyMultitextRiskProfile(item);
  const constraints = v31Constraints[item.id] ?? item.constraints;
  const neutralRule = item.id === "emotion_neutral_now"
    ? "本例只确认中性状态与安静吃饭；不分析，不添加陪伴或后续安排。"
    : "";
  const framingPlan = item.category === "framing_text"
    ? `${framingV31SentencePlan[item.id] ?? ""}${framingV31CaseRule[item.id] ?? ""}`
    : "";
  const lengthPlan = includeLengthPlan ? `长度硬约束：${routedLengthPlan(item)}；不得少于下限。` : "";
  const riskRule = includeRiskProfile && riskProfile !== "standard" ? routedRiskRules[riskProfile] : "";
  const riskProfileLine = includeRiskProfile ? `\nrisk_profile="${riskProfile}"` : "";
  const contract = contractText(item);
  return `只完成当前 task_type；source_evidence 是封闭信息源，不使用外部知识。\n${routedTaskRules[route]}${neutralRule}${framingPlan}${lengthPlan}${riskRule}\n${contract}\n任务：${item.task}\n要求：${constraints}\n写完逐句反查 source_evidence，删掉不能映射的事实、因果和意象；只返回最终 JSON。\n<input>\ntask_type="${route}"${riskProfileLine}\nsource_evidence=${JSON.stringify(item.source)}\nevidence_mode="${classifyEvidence(item.source)}"\n</input>`;
}

export function buildMultitextPrompt(item, variant = "source-isolated-v1") {
  if (!MULTITEXT_PROMPT_VARIANTS.includes(variant)) throw new Error(`Unknown prompt variant: ${variant}`);
  if (variant === "task-routed-v4") return buildTaskRoutedPrompt(item);
  if (variant === "task-routed-v4.1") return buildTaskRoutedPrompt(item, { includeLengthPlan: true });
  if (variant === "task-routed-v4.2") return buildTaskRoutedPrompt(item, { includeRiskProfile: true });
  const constraints = variant === "source-isolated-v3.1" ? v31Constraints[item.id] ?? item.constraints : item.constraints;
  const base = `${contractText(item)}\n任务：${item.task}\n要求：${constraints}`;
  const input = `<input>\ncategory=${JSON.stringify(item.category)}\nsource_evidence=${JSON.stringify(item.source)}\nevidence_mode="${classifyEvidence(item.source)}"\n</input>`;
  if (variant === "plain") return `请完成下面的中文写作任务。${base}\n${input}`;
  const categoryRule = variant === "source-isolated-v3.1"
    ? v31CategoryRule(item)
    : variant === "source-isolated-v2"
    ? `${categoryInstructions[item.category]}\n${strictCategoryInstructions[item.category]}`
    : variant === "source-isolated-v3" && item.category === "framing_text"
      ? `${categoryInstructions[item.category]}\n${strictCategoryInstructions[item.category]}\n${framingLedgerInstructions}`
      : categoryInstructions[item.category];
  const finalCheck = variant === "source-isolated-v3.1"
    ? "只返回最终 JSON；不输出清单或检查过程。"
    : variant === "source-isolated-v2" || variant === "source-isolated-v3"
    ? "逐句检查：先删除不能回指输入的事实、因果和意象，再检查字段、字符范围、用户禁令与未知边界。不要展示检查过程，只返回最终 JSON。"
    : "输出前检查一次：字段、字符范围、用户禁令、事实来源和未知边界。检查后只返回最终 JSON。";
  return `完成一次自然、具体、克制的中文写作。把任务要求与 source_evidence 当作封闭信息源，不使用外部知识，也不把缺失内容补成事实。\n\n${categoryRule}\n\n${base}\n${finalCheck}\n\n${input}`;
}

export function collectV31GuardIssues(item, row) {
  const issues = [...(gradeMultitextOutput(item, row).failures ?? [])];
  const allText = item.output.fields.map((field) => String(row?.[field] ?? "")).join("\n");
  const semanticPattern = v31SemanticRiskPatterns[item.id];
  if (semanticPattern?.test(allText)) issues.push({ type: "semantic_guard", rule: item.id });
  if (item.id === "emotion_neutral_now" && /我在|陪你|等你|需要时|慢慢吃|之后|吃完再/.test(allText)) {
    issues.push({ type: "invented_presence", rule: item.id });
  }
  return issues;
}

export function buildMultitextRepairPrompt(item, issues) {
  const targetLines = item.output.fields.map((field) => {
    const [min, max] = item.output.lengths[field];
    const innerMin = min ? Math.min(max, min + Math.max(2, Math.round((max - min) * 0.2))) : min;
    const innerMax = max - Math.max(2, Math.round((max - min) * 0.2));
    return `- ${field}: 目标${innerMin}–${Math.max(innerMin, innerMax)}字`;
  }).join("\n");
  const issueTypes = [...new Set((issues ?? []).map((issue) => issue.type))].join("、") || "边界检查未通过";
  const constraints = v31Constraints[item.id] ?? item.constraints;
  return `上一次输出未通过 ${issueTypes} 检查。请从零重新生成，不要解释失败原因，也不要复用上一次措辞。\n\n${v31CategoryRule(item)}\n\n只返回一个 JSON 对象，只含 ${item.output.fields.join("、")} 字段：\n${targetLines}\n任务：${item.task}\n要求：${constraints}\n\n<input>\ncategory=${JSON.stringify(item.category)}\nsource_evidence=${JSON.stringify(item.source)}\nevidence_mode="${classifyEvidence(item.source)}"\n</input>`;
}

export function parseMultitextOutput(text) {
  const trimmed = String(text ?? "").trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) candidates.push(fenced);
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(trimmed.slice(start, end + 1));
  let lastError = null;
  for (const candidate of candidates) {
    try {
      return { parsed: JSON.parse(candidate), parseError: null };
    } catch (error) {
      lastError = error;
    }
  }
  return { parsed: null, parseError: String(lastError?.message ?? "No JSON object found") };
}

const chars = (value) => [...String(value ?? "")].length;

function containsUnnegated(text, phrase) {
  const value = String(text ?? "");
  let index = value.indexOf(phrase);
  while (index >= 0) {
    const prefix = value.slice(Math.max(0, index - 22), index);
    const negated = /(?:不(?:会|再|要|必|应|该|去|把|将)?|无需|无意|避免|拒绝|禁止|未曾|没有|无法)[^，。！？；\n]{0,16}$/.test(prefix);
    if (!negated) return true;
    index = value.indexOf(phrase, index + phrase.length);
  }
  return false;
}

export function gradeMultitextOutput(item, row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return { passed: false, failures: [{ type: "invalid_object" }], coreCoverage: 0 };
  }
  const failures = [];
  const actualFields = Object.keys(row).sort();
  const expectedFields = [...item.output.fields].sort();
  if (JSON.stringify(actualFields) !== JSON.stringify(expectedFields)) {
    failures.push({ type: "exact_fields", actualFields });
  }
  const lengths = {};
  for (const field of item.output.fields) {
    const length = chars(row[field]);
    lengths[field] = length;
    const [min, max] = item.output.lengths[field];
    if (length < min || length > max) failures.push({ type: "length", field, actual: length, expected: [min, max] });
  }
  const allText = item.output.fields.map((field) => String(row[field] ?? "")).join("\n");
  for (const phrase of item.forbidden) {
    if (containsUnnegated(allText, phrase)) failures.push({ type: "forbidden", phrase });
  }
  for (const claim of item.unsupported) {
    if (containsUnnegated(allText, claim)) failures.push({ type: "unsupported_claim", claim });
  }
  const coreHits = item.requiredGroups.map((group) => ({ group, hit: group.some((term) => allText.includes(term)) }));
  const coreCoverage = coreHits.filter((entry) => entry.hit).length / item.requiredGroups.length;
  return { passed: failures.length === 0, failures, lengths, coreCoverage, coreHits };
}

function average(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function median(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return null;
  const middle = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[middle] : (finite[middle - 1] + finite[middle]) / 2;
}

function summarizeGroup(group) {
  return {
    samples: group.length,
    usable: group.filter((run) => Boolean(run.parsed)).length,
    hardPasses: group.filter((run) => run.grade?.passed).length,
    hardPassRate: group.filter((run) => run.grade?.passed).length / group.length,
    coreCoverageAverage: average(group.map((run) => run.grade?.coreCoverage ?? 0)),
  };
}

export function summarizeMultitextRuns(runs) {
  const variants = new Map();
  for (const run of runs) {
    if (!variants.has(run.variant)) variants.set(run.variant, []);
    variants.get(run.variant).push(run);
  }
  return [...variants.entries()].map(([variant, group]) => {
    const categories = {};
    for (const category of new Set(group.map((run) => run.category))) {
      categories[category] = summarizeGroup(group.filter((run) => run.category === category));
    }
    return {
      variant,
      ...summarizeGroup(group),
      firstTextMedianMs: median(group.map((run) => run.firstTextMs)),
      totalMedianMs: median(group.map((run) => run.totalMs)),
      inputTokensAverage: average(group.map((run) => run.usage?.input_tokens)),
      outputTokensAverage: average(group.map((run) => run.usage?.output_tokens)),
      categories,
    };
  });
}
