import { buildHoldoutPrompt, buildNarrationPrompts } from "./deepseek-routing-holdout.mjs";

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

export const HYBRID_CONFIRMATION_CASES = [
  {
    id: "confirm_emotion_relief_and_sadness",
    category: "emotion",
    taskType: "emotion_response",
    riskProfile: "explicit_state_whitelist",
    task: "承接晋级后的轻松与替同伴难受，不替用户命名或归因。",
    source: "晋级名单里有我，我松了一口气，也替没进的同伴难受。别说这是幸存者内疚，也不用安慰我。",
    evidenceProfile: {
      explicit_states: ["自己晋级", "松了一口气", "替未晋级同伴难受"],
      allowed_emotion_terms: ["轻松", "难受"],
      unknowns: ["两种感受的原因和关系"],
      boundaries: ["不命名为幸存者内疚", "不安慰"],
    },
    constraints: "只并列已明确的轻松与难受，不加入亏欠、庆幸、羞愧或责任感。",
    output: emotionOutput,
    requiredGroups: [["晋级"], ["松", "轻松"], ["同伴"], ["难受"]],
    forbidden: ["幸存者内疚", "你不必自责", "愧疚"],
    unsupported: ["亏欠", "羞愧", "竞争压力", "害怕庆祝"],
  },
  {
    id: "confirm_emotion_anger_and_missing",
    category: "emotion",
    taskType: "emotion_response",
    riskProfile: "explicit_state_whitelist",
    task: "保留生气与想念并存，不劝和解。",
    source: "刚和姐姐吵完，我很生气，也确实想她。先别劝我和好，更别说我只是嘴硬。",
    evidenceProfile: {
      explicit_states: ["和姐姐争吵", "生气", "想姐姐"],
      allowed_emotion_terms: ["生气", "想念"],
      unknowns: ["争吵原因", "关系走向"],
      boundaries: ["不劝和好", "不解释为嘴硬"],
    },
    constraints: "不把想念写成原谅、后悔或和解意愿，也不提供行动建议。",
    output: emotionOutput,
    requiredGroups: [["姐姐"], ["生气"], ["想"]],
    forbidden: ["嘴硬", "和好", "主动联系"],
    unsupported: ["后悔", "原谅", "害怕失去", "家庭矛盾"],
  },
  {
    id: "confirm_emotion_relief_and_emptiness",
    category: "emotion",
    taskType: "emotion_response",
    riskProfile: "explicit_state_whitelist",
    task: "回应项目交付后的轻松与空，不诊断也不规划。",
    source: "项目交付后我很轻松，可安静下来又觉得空。别把它叫职业倦怠，也别替我安排下一步。",
    evidenceProfile: {
      explicit_states: ["项目已经交付", "轻松", "安静下来觉得空"],
      allowed_emotion_terms: ["轻松", "空"],
      unknowns: ["觉得空的原因", "下一步"],
      boundaries: ["不判断职业倦怠", "不安排下一步"],
    },
    constraints: "不得扩写疲惫、失去目标、意义危机或工作压力。",
    output: emotionOutput,
    requiredGroups: [["项目", "交付"], ["轻松"], ["空"]],
    forbidden: ["职业倦怠", "下一步你可以", "重新找目标"],
    unsupported: ["疲惫", "失去意义", "高压", "透支"],
  },
  {
    id: "confirm_emotion_pleased_and_uncertain",
    category: "emotion",
    taskType: "emotion_response",
    riskProfile: "explicit_state_whitelist",
    task: "承接听到承诺时的高兴与暂不确信，不分析关系。",
    source: "朋友说相信我，我听了很高兴，但对这句承诺还不敢完全相信。别分析我们的关系。",
    evidenceProfile: {
      explicit_states: ["朋友说相信自己", "听后高兴", "暂不完全相信承诺"],
      allowed_emotion_terms: ["高兴", "不确定"],
      unknowns: ["不确信的原因", "关系状态", "朋友是否会履行承诺"],
      boundaries: ["不分析关系"],
    },
    constraints: "不得写成信任创伤、被背叛、戒备或关系修复。",
    output: emotionOutput,
    requiredGroups: [["朋友"], ["相信"], ["高兴"], ["承诺"]],
    forbidden: ["信任问题", "关系需要", "给他机会"],
    unsupported: ["背叛", "创伤", "戒备", "修复关系"],
  },
  {
    id: "confirm_art_blue_chairs",
    category: "artwork_intro",
    taskType: "artwork_intro",
    riskProfile: "artwork_evidence_state",
    task: "依据完整馆藏描述介绍作品，不扩写场景意义。",
    source: "馆藏记录：《候场》，周岚，2007年，纸本水粉。描述为七把蓝色折椅沿黄色地面排开，画面未见人物；未提供艺术家陈述与地点信息。",
    evidenceProfile: {
      entity: "一件纸本水粉",
      known: { title: "候场", artist: "周岚", year: "2007", visible_description: "七把蓝色折椅、黄色地面、未见人物" },
      unknowns: ["艺术家陈述", "地点", "创作意图"],
      statuses: { artist: "confirmed", year: "artwork_year", image_description: "provided" },
    },
    constraints: "80–180字；保留七把椅子的数量，不补等待者、剧场、孤独、秩序或象征。",
    output: artworkOutput,
    requiredGroups: [["候场"], ["周岚"], ["2007"], ["七把", "7把"], ["蓝色"], ["黄色"], ["人物"]],
    forbidden: ["象征", "等待的人", "孤独"],
    unsupported: ["剧场", "排练", "秩序感", "观众离场"],
  },
  {
    id: "confirm_art_sparse_fragment",
    category: "artwork_intro",
    taskType: "artwork_intro",
    riskProfile: "artwork_evidence_state",
    task: "介绍无图像且记录稀少的陶片。",
    source: "一块陶片，登记题名《样本十四》，材质栏写‘釉陶’；作者、年代与原器形不详。无图像，旧标签只可读出‘第三箱’，标签用途和日期未记录。",
    evidenceProfile: {
      entity: "一块陶片",
      known: { title: "样本十四", material: "釉陶", label_text: "第三箱" },
      unknowns: ["作者", "年代", "原器形", "图像", "标签用途", "标签日期"],
      statuses: { title: "registered", label: "partial", image: "unavailable" },
    },
    constraints: "80–180字；不把‘第三箱’解释成发现地点、收藏位置、分类或来源。",
    output: artworkOutput,
    requiredGroups: [["样本十四"], ["陶片"], ["釉陶"], ["第三箱"], ["作者", "年代"], ["无图像", "图像"]],
    forbidden: ["收藏于第三箱", "出土", "分类编号"],
    unsupported: ["器皿", "花纹", "颜色", "考古", "仓库位置"],
  },
  {
    id: "confirm_art_title_description_conflict",
    category: "artwork_intro",
    taskType: "artwork_intro",
    riskProfile: "artwork_evidence_state",
    task: "并列馆藏标题与描述冲突，不建立解释。",
    source: "馆藏标题为《静水》；文字描述仅写‘两名修理工站在拆开的发动机旁’。无图像，作者与年代均未登记，标题和描述的关系未说明。",
    evidenceProfile: {
      entity: "一条馆藏记录",
      known: { title: "静水", description: "两名修理工站在拆开的发动机旁" },
      unknowns: ["图像", "作者", "年代", "标题与描述的关系"],
      statuses: { title_description_relation: "unresolved_conflict" },
    },
    constraints: "80–180字；不得把静水与发动机解释为反差、隐喻、噪声或工业主题。",
    output: artworkOutput,
    requiredGroups: [["静水"], ["两名", "2名"], ["修理工"], ["发动机"], ["关系", "冲突", "未说明"]],
    forbidden: ["隐喻", "形成反差", "静与动"],
    unsupported: ["工业社会", "机器轰鸣", "环境污染", "作者批判"],
  },
  {
    id: "confirm_art_uncertain_textile",
    category: "artwork_intro",
    taskType: "artwork_intro",
    riskProfile: "artwork_evidence_state",
    task: "保持制作归属、登记日期和来源缺口的限定。",
    source: "一块染织拼片，记录日期约1924–1929年，制作方栏为‘或与N. Adu作坊有关’；1941–1950年的来源记录缺失。边缘缝有数字‘27’，无图像与用途说明。",
    evidenceProfile: {
      entity: "一块染织拼片",
      known: { record_date: "约1924–1929", sewn_number: "27" },
      unknowns: ["确切制作方", "制作年代", "1941–1950来源", "图像", "用途"],
      statuses: { maker: "possibly related to N. Adu workshop", date: "record_date", provenance: "gap" },
    },
    constraints: "80–180字；不得把作坊、记录日期、数字或用途写成确定来源与制作事实。",
    output: artworkOutput,
    requiredGroups: [["染织拼片"], ["1924", "1929"], ["可能", "或与", "N. Adu"], ["1941", "1950"], ["27"]],
    forbidden: ["由N. Adu制作", "制作于1924", "编号为第27件"],
    unsupported: ["服装", "仪式", "贸易", "捐赠", "几何图案"],
  },
  {
    id: "confirm_preface_repair_receipts",
    category: "framing_text",
    taskType: "exhibition_preface",
    riskProfile: "fact_ledger_unknown_state",
    task: "为修理收据陈列《改写的金额》写前言。",
    source: "陈列12张修理收据，日期为1922–1976年；7张金额被划改，3张盖有‘复核’章，2张状态未注明。资料没有维修物件、经手人及划改原因记录。",
    evidenceProfile: {
      entity_unit: "收据/张",
      known: ["12张", "1922–1976", "7张金额被划改", "3张有复核章", "2张状态未注明"],
      unknowns: ["维修物件", "经手人", "划改原因"],
      explicit_absences: [],
      function: "建立对记录状态的观看入口",
    },
    constraints: "80–180字；不把划改解释成欺诈、纠错、审查、劳动史或经济变化。",
    output: framingOutput,
    requiredGroups: [["12张", "十二张"], ["1922"], ["1976"], ["7张", "七张"], ["复核"], ["未注明", "没有记录"]],
    forbidden: ["造假", "错误被纠正", "经济变迁", "劳动痕迹"],
    unsupported: ["修表", "工厂", "账目审查", "价格上涨"],
  },
  {
    id: "confirm_preface_glass_negative_boxes",
    category: "framing_text",
    taskType: "exhibition_preface",
    riskProfile: "fact_ledger_unknown_state",
    task: "为玻璃底片盒陈列《标签栏》写前言。",
    source: "陈列7只玻璃底片盒，登记年代为1908–1965年；3只标签写有地点，4只标签栏未填。资料没有底片内容、拍摄者、拍摄日期或标签填写时间记录。",
    evidenceProfile: {
      entity_unit: "底片盒/只",
      known: ["7只", "1908–1965", "3只标签有地点", "4只标签栏未填"],
      unknowns: ["底片内容", "拍摄者", "拍摄日期", "标签填写时间"],
      explicit_absences: ["4只标签栏未填"],
      function: "说明盒与标签的已知状态并建立观看入口",
    },
    constraints: "80–180字；不把未填标签解释成遗忘、丢失、匿名、地点消失或底片空白。",
    output: framingOutput,
    requiredGroups: [["7只", "七只"], ["玻璃底片盒", "底片盒"], ["1908"], ["1965"], ["3只", "三只"], ["4只", "四只"], ["未填"]],
    forbidden: ["被遗忘", "地点消失", "匿名影像", "空白底片"],
    unsupported: ["家庭照片", "战争", "城市改造", "摄影师"],
  },
  {
    id: "confirm_closing_sealed_envelopes",
    category: "framing_text",
    taskType: "exhibition_closing",
    riskProfile: "fact_ledger_unknown_state",
    task: "为封存信封陈列《未开启》写结语。",
    source: "陈列8只封口信封，日期为1933–1991年；3只写有收件人姓名，5只收件人栏空白。信封均未开启，资料没有寄件人、内页内容或是否寄出记录。",
    evidenceProfile: {
      entity_unit: "信封/只",
      known: ["8只封口信封", "1933–1991", "3只有收件人姓名", "5只收件人栏空白", "均未开启"],
      unknowns: ["寄件人", "内页内容", "是否寄出"],
      explicit_absences: ["5只收件人栏空白"],
      function: "收束信封与记录状态",
    },
    constraints: "80–180字；不得说内页缺失、信件未写完、无人收到或承载秘密与等待。",
    output: framingOutput,
    requiredGroups: [["8只", "八只"], ["1933"], ["1991"], ["3只", "三只"], ["5只", "五只"], ["未开启"]],
    forbidden: ["内页缺失", "未写完", "无人收到", "等待", "秘密"],
    unsupported: ["退信", "情书", "家书", "邮戳", "失落"],
  },
  {
    id: "confirm_closing_seed_packets",
    category: "framing_text",
    taskType: "exhibition_closing",
    riskProfile: "fact_ledger_unknown_state",
    task: "为种子样本袋陈列写结语。",
    source: "陈列10只纸质种子样本袋，登记日期为1946–2004年；6只品种标签可读，4只标签字迹无法辨认。资料未记录种子是否仍在袋内，也没有播种地点、时间或发芽结果。",
    evidenceProfile: {
      entity_unit: "样本袋/只",
      known: ["10只", "1946–2004", "6只品种标签可读", "4只标签字迹无法辨认"],
      unknowns: ["种子是否仍在袋内", "播种地点", "播种时间", "发芽结果"],
      explicit_absences: [],
      function: "收束样本袋与记录缺项",
    },
    constraints: "80–180字；不得写成种子遗失、未能发芽、生命循环、希望或农业史。",
    output: framingOutput,
    requiredGroups: [["10只", "十只"], ["1946"], ["2004"], ["6只", "六只"], ["4只", "四只"], ["标签"]],
    forbidden: ["种子遗失", "未能发芽", "生命循环", "希望"],
    unsupported: ["农民", "饥荒", "实验失败", "地方品种"],
  },
  {
    id: "confirm_curation_family_access",
    category: "curation_analysis",
    taskType: "curation_analysis",
    riskProfile: "accessibility_no_capability_inference",
    task: "把跨年龄同行与环境可达要求整理为策展原则。",
    source: "我会和八岁的外甥、拄手杖的叔叔一起看。希望每十五分钟都有座位，不要闪烁影像，重点信息别全靠长文字。总时长四十五分钟左右。",
    evidenceProfile: {
      explicit_needs: ["八岁外甥", "拄手杖的叔叔", "每15分钟有座位", "约45分钟"],
      environmental_requirements: ["不闪烁", "重点信息不依赖长文字", "定期可坐"],
      exclusions: ["闪烁影像", "长文字作为唯一信息载体"],
      unknowns: ["理解能力", "注意力", "视听能力", "疾病", "具体媒介偏好", "主题"],
    },
    constraints: "只形成环境、节奏和信息呈现原则，不从年龄或手杖推断能力、疾病、辅具和家庭关系。",
    output: curationOutput,
    requiredGroups: [["八岁", "外甥"], ["手杖", "叔叔"], ["15分钟", "十五分钟"], ["座位"], ["闪烁"], ["文字"], ["45分钟", "四十五分钟"]],
    forbidden: ["注意力短", "理解能力有限", "轮椅", "视力障碍"],
    unsupported: ["认知困难", "听力问题", "儿童互动区", "家庭照护"],
  },
  {
    id: "confirm_curation_dark_colors_bright_space",
    category: "curation_analysis",
    taskType: "curation_analysis",
    riskProfile: "curation_explicit_constraints",
    task: "保留深色作品与明亮空间可以并存的观看偏好。",
    source: "我想看以深色为主的作品，但展厅本身不要太暗。文字说明短一些，节奏可以慢，不需要把深色解释成悲伤。照片、版画都可以。",
    evidenceProfile: {
      explicit_needs: ["深色作品", "展厅不要太暗", "短文字", "慢节奏", "照片和版画均可"],
      exclusions: ["把深色解释为悲伤", "低照度空间", "长说明"],
      unknowns: ["具体主题", "艺术家", "年代", "观看时长"],
    },
    constraints: "不得把作品色调与空间照度混为一项，也不推断情绪或视力状况。",
    output: curationOutput,
    requiredGroups: [["深色"], ["展厅", "空间"], ["暗", "明亮"], ["文字"], ["慢"], ["照片"], ["版画"]],
    forbidden: ["深色代表悲伤", "畏光", "抑郁"],
    unsupported: ["视力问题", "喜欢黑白", "情绪低落", "需要疗愈"],
  },
  {
    id: "confirm_curation_single_floor_pause",
    category: "curation_analysis",
    taskType: "curation_analysis",
    riskProfile: "accessibility_no_capability_inference",
    task: "把单层观看与停留需求转成空间节奏原则。",
    source: "我最近膝盖不舒服，想在同一层看完，走路段落短一些，中间可以停。大约半小时，不需要讲我的身体状况，也不要推荐具体作品。",
    evidenceProfile: {
      explicit_needs: ["膝盖不舒服", "同一层", "短步行段落", "可停留", "约30分钟"],
      environmental_requirements: ["单层动线", "缩短连续步行", "安排停留点"],
      exclusions: ["跨楼层动线", "长距离连续步行", "身体状况叙事化"],
      unknowns: ["疾病或诊断", "使用何种辅具", "主题", "媒介", "艺术家"],
    },
    constraints: "只转写用户明确的动线和时长要求，不诊断膝盖问题，不推断轮椅或长期行动能力。",
    output: curationOutput,
    requiredGroups: [["同一层", "单层"], ["走路", "步行"], ["停"], ["30分钟", "半小时"]],
    forbidden: ["关节炎", "轮椅", "行动障碍", "康复"],
    unsupported: ["受伤", "老年", "需要陪同", "疼痛管理"],
  },
  {
    id: "confirm_curation_anger_without_release",
    category: "curation_analysis",
    taskType: "curation_analysis",
    riskProfile: "curation_explicit_constraints",
    task: "形成不导向宣泄或和解的愤怒主题策展分析。",
    source: "我想看和愤怒有关的作品，可以尖锐，但不要把路线做成发泄后平静或最终和解。我不想看真实伤害画面，媒介不限。",
    evidenceProfile: {
      explicit_needs: ["与愤怒有关", "可以尖锐", "不导向发泄后平静", "不导向和解", "媒介不限"],
      exclusions: ["真实伤害画面", "宣泄式情绪弧线", "和解结局"],
      unknowns: ["愤怒对象", "个人经历", "年代", "观看时长"],
    },
    constraints: "允许情绪保持未解决，不推断创伤、暴力经历或疗愈需求。",
    output: curationOutput,
    requiredGroups: [["愤怒"], ["尖锐"], ["发泄", "平静"], ["和解"], ["伤害画面"], ["媒介不限", "媒介"]],
    forbidden: ["释放情绪", "最终平静", "走向和解", "疗愈"],
    unsupported: ["创伤", "暴力经历", "压抑", "心理问题"],
  },
];

export const HYBRID_NARRATION_PACKETS = [
  {
    id: "hybrid_narration_corrected_maps",
    title: "改线",
    source: "展览包含7张手绘地图，日期为1914–1982年；5张有红色改线，2张没有改线标记。资料未记录绘制者、改线时间、原因或地图实际用途。",
    evidenceProfile: {
      entity_unit: "地图/张",
      known: ["7张", "1914–1982", "5张有红色改线", "2张无改线标记"],
      unknowns: ["绘制者", "改线时间", "改线原因", "实际用途"],
      explicit_absences: ["2张无改线标记"],
    },
    forbiddenInterpretations: ["航行故事", "路线纠错", "边界争议", "时代变迁", "选择与命运"],
  },
  {
    id: "hybrid_narration_unsigned_receipts",
    title: "签名栏",
    source: "陈列有13张收据，日期为1930–1998年；8张有签名，5张签名栏空白；9张金额可读，4张金额被墨迹覆盖。资料没有交易物、付款人和覆盖原因记录。",
    evidenceProfile: {
      entity_unit: "收据/张",
      known: ["13张", "1930–1998", "8张有签名", "5张签名栏空白", "9张金额可读", "4张金额被覆盖"],
      unknowns: ["交易物", "付款人", "覆盖原因"],
      explicit_absences: ["5张签名栏空白"],
    },
    forbiddenInterpretations: ["匿名交易", "刻意隐瞒", "经济生活", "账目纠纷", "普通人的历史"],
  },
  {
    id: "hybrid_narration_lantern_slide_boxes",
    title: "投影记录未载",
    source: "展览包含6盒玻璃幻灯片，盒上日期为1920–1967年；4盒列有片数，2盒片数栏空白；3盒有地点标签，3盒地点未填。资料没有画面内容、制作者或是否曾投影的记录。",
    evidenceProfile: {
      entity_unit: "幻灯片盒/盒",
      known: ["6盒", "1920–1967", "4盒有片数", "2盒片数栏空白", "3盒有地点标签", "3盒地点未填"],
      unknowns: ["画面内容", "制作者", "是否曾投影"],
      explicit_absences: ["2盒片数栏空白", "3盒地点未填"],
    },
    forbiddenInterpretations: ["消失的影像", "无人观看", "教育用途", "旅行记忆", "光照亮历史"],
  },
  {
    id: "hybrid_narration_seed_catalogues",
    title: "发芽结果未记",
    source: "陈列有9本种子目录，出版于1941–2009年；6本附订购表，3本没有订购表；5本有手写圈记，4本无圈记。资料未记录持有人、订购行为、种植地点或发芽结果。",
    evidenceProfile: {
      entity_unit: "目录/本",
      known: ["9本", "1941–2009", "6本附订购表", "3本无订购表", "5本有圈记", "4本无圈记"],
      unknowns: ["持有人", "订购行为", "种植地点", "发芽结果"],
      explicit_absences: ["3本无订购表", "4本无圈记"],
    },
    forbiddenInterpretations: ["种植计划", "未实现的花园", "生长希望", "农业变迁", "私人愿望"],
  },
];

function contractText(item) {
  const fields = item.output.fields.map((field) => {
    const [min, max] = item.output.lengths[field];
    return `- ${field}: ${min}–${max}个中文字符`;
  }).join("\n");
  return `只返回JSON对象，只含${item.output.fields.join("、")}字段，值均为字符串。\n${fields}`;
}

const hybridTaskRules = {
  emotion_response: "explicit_states与allowed_emotion_terms构成可用情绪白名单。只并列用户明确表达的状态；不得新增情绪词，不得把同时出现写成因果、伪装、转折真相或心理机制。",
  artwork_intro: "known、unknowns、statuses的字段角色不可互换。描述字段只说明记录写了什么；记录日期不等于制作年代；可能归属不等于确定作者；标签文字不等于来源、用途或地点。",
  exhibition_preface: "只用immutable_fact_ledger建立观看入口。前言不承担历史解释、主题提炼或情绪预告；unknowns只说明资料边界。",
  exhibition_closing: "只用immutable_fact_ledger收束已知状态与尚未记录的信息。结语不把未知包装成缺失、沉默、等待、秘密、无法还原或留给想象。",
  curation_analysis: "只把explicit_needs、environmental_requirements、exclusions转成选择、空间和节奏原则。不得补具体作品、艺术家、媒介、主题、诊断或情绪结果。",
};

const riskRules = {
  explicit_state_whitelist: "风险规则：只能复用allowed_emotion_terms中的情绪词；unknowns不得被命名或解释。",
  artwork_evidence_state: "风险规则：先核对status再写句子；不调用艺术史常识，不从标题、残签、数字、媒介或画面细节推象征与意图。",
  fact_ledger_unknown_state: "风险规则：未知状态按unknowns原样表达。‘资料未提供/未记录’不等于对象不存在、内容缺失、空白、未完成、无法还原或被遗忘；只有explicit_absences可写成明确无/空白。",
  accessibility_no_capability_inference: "风险规则：座位、动线、时长、闪烁与文字负担都是环境要求，不是能力推断。不得从年龄、亲属关系、手杖或身体描述推断注意力、理解、认知、视听、疾病、轮椅或长期行动能力。",
  curation_explicit_constraints: "风险规则：保留看似并存的偏好，不把色调等同空间照度，不把主题需要等同个人诊断，不把未解决情绪改成疗愈弧线。",
};

function buildRecommendedHybridPrompt(item) {
  const ledger = {
    task: item.task,
    source_evidence: item.source,
    evidence_profile: item.evidenceProfile,
  };
  return `只完成当前task_type。immutable_fact_ledger是封闭且不可改写的唯一信息源。\n`
    + `${hybridTaskRules[item.taskType]}\n${riskRules[item.riskProfile]}\n`
    + `通用未知状态规则：不要把“未提供、未记录、未知、未确认”改写为“不存在、缺失、空白、未发生、无法还原、沉默或等待”。\n`
    + `${contractText(item)}\n要求：${item.constraints}\n`
    + `silent_claim_audit（只在内部执行，不得输出）：逐句拆成最小事实主张；每项必须能逐字映射到immutable_fact_ledger。删除无法映射的身份、原因、关系、主题、象征、场景、能力、诊断、体验和历史意义；再检查数字、否定词、可能性与记录状态未被强化。\n`
    + `只输出最终JSON，不输出分析、审计过程、Markdown或额外字段。\n<input>\ncase_id="${item.id}"\ntask_type="${item.taskType}"\nrisk_profile="${item.riskProfile}"\nimmutable_fact_ledger=${JSON.stringify(ledger)}\n</input>`;
}

export function buildHybridPrompt(item, variant) {
  if (variant === "generic-task-routed-v5") return buildHoldoutPrompt(item, variant);
  if (variant === "recommended-hybrid-v6") return buildRecommendedHybridPrompt(item);
  throw new Error(`Unknown hybrid variant: ${variant}`);
}

export function buildRecommendedNarrationPrompts(packet) {
  const baseline = buildNarrationPrompts(packet).combined;
  const ledger = {
    title: packet.title,
    source_evidence: packet.source,
    known: packet.evidenceProfile.known,
    unknowns: packet.evidenceProfile.unknowns,
    explicit_absences: packet.evidenceProfile.explicit_absences ?? [],
    forbidden_interpretations: packet.forbiddenInterpretations ?? [],
  };
  const candidate = `一次请求完成同一展览的前言与结语。immutable_fact_ledger是两段共享、封闭且不可改写的唯一信息源。\n`
    + `前言职责：用known建立观看入口，不提炼历史主题，不预告情绪或观众体验。\n`
    + `结语职责：收束known与unknowns，不把未知包装成缺失、沉默、等待、秘密、无法还原、留给想象或象征意义。\n`
    + `未知状态规则：‘资料未提供/未记录’不等于不存在、缺失、空白、未发生或被遗忘；只有explicit_absences可写成明确无/空白。\n`
    + `两段均不得补人物、地点、用途、原因、因果、故事、时代作用、共同主题、情绪结果或观众反馈。避免前言和结语逐句重复。\n`
    + `只返回JSON对象，只含preface、closing、preface_boundary、closing_boundary四个字符串字段。preface 100–180字；closing 90–160字；两个boundary各10–65字。\n`
    + `silent_claim_audit（只在内部执行，不得输出）：分别逐句拆解前言和结语，每个事实主张必须映射到immutable_fact_ledger；删除无法映射的解释，并联合检查两段没有互相放大推断。\n`
    + `只输出最终JSON，不输出分析、审计过程、Markdown或额外字段。\n<input>\ncase_id="${packet.id}"\ntask_type="combined_narration"\nimmutable_fact_ledger=${JSON.stringify(ledger)}\n</input>`;
  return { baseline, candidate };
}

export function decideHybridV6(metrics) {
  const blockers = [];
  if (metrics.holdoutQuality < 18) blockers.push("holdout_quality");
  if (metrics.holdoutQualityDelta < 0) blockers.push("holdout_quality_delta");
  if (metrics.holdoutSevereRate > 0.1) blockers.push("holdout_severe_rate");
  if (metrics.holdoutGapToK3 > 1) blockers.push("holdout_k3_gap");
  if (metrics.holdoutParseRate < 0.99) blockers.push("holdout_parse_rate");
  if (metrics.holdoutInputIncrease > 0.25) blockers.push("holdout_input_cost");
  if (metrics.holdoutTtftRegression > 0.2) blockers.push("holdout_ttft");
  if (metrics.narrationQuality < 17.5) blockers.push("narration_quality");
  if (metrics.narrationQualityDelta < 0.5) blockers.push("narration_quality_delta");
  if (metrics.narrationSevereRate > 0.2) blockers.push("narration_severe_rate");
  if (metrics.narrationSevereDelta > 0) blockers.push("narration_severe_delta");
  if (metrics.narrationInputIncrease > 0.25) blockers.push("narration_input_cost");
  if (metrics.narrationTotalRegression > 0.2) blockers.push("narration_total_time");
  return { framework: blockers.length === 0 ? "confirm" : "hold", blockers };
}
