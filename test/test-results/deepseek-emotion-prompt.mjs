export const PROMPT_VARIANTS = ["baseline", "contract-first", "evidence-led", "golden-aligned-v1", "golden-aligned-v2", "golden-aligned-v3"];
export const RECOMMENDED_PROMPT_VARIANT = "golden-aligned-v3";

const commonContract = `只返回一个 JSON 对象，不要 Markdown、代码围栏、解释、前言或思考过程。对象只能包含 emotion_read、reply、art_connection、boundary 四个字符串字段。
emotion_read：15–45 个中文字符，准确说明情绪核心；保留否定、转折和混合情绪，不诊断，不把推断写成事实。
reply：45–90 个中文字符，先回应感受；不鸡汤、不强行积极、不替用户决定，不绕到童年或成长，遵守用户明确禁令。
art_connection：45–100 个中文字符，只能使用给定 artwork_evidence；必须使用“像、或许、可以让人想到、可能让人想到”之一表达联想。不得补人物、动作、表情、天气、构图、颜色或作者意图。
boundary：0–45 个中文字符；证据稀疏、冲突、记录残缺、无法诊断或用户情况不明时，简短说明不能确定什么。
不要把用户经历写成作品事实，不要把作品或历史人物心理直接套到用户身上。`;

const variantInstructions = {
  baseline: `完成一次中文情感回应。不要输出思考过程，直接按字段要求作答。`,
  "contract-first": `完成一次中文情感回应。不要输出思考过程。作答前只在内部依次检查：
1. 用户真正表达了什么，尤其注意“不是、但、只是、不要、别、仍然”等限定。
2. 用户明确禁止什么；禁止项优先于安慰冲动。
3. artwork_evidence 明确写了什么；没有写出的内容一律视为未知。
4. reply 是否先承认具体感受，同时把诊断权、决定权和事实边界留给用户。
5. 四个字段是否满足长度、证据与不确定措辞要求。
检查一次后立即输出最终 JSON，不复述规则。`,
  "evidence-led": `这是一次受证据约束的中文情感回应。不要输出思考过程。
先在内部建立两张极短清单：用户已明确表达的内容、作品资料已明确提供的内容。所有未进入清单的细节都不得写入最终答案。
情绪层面允许克制推断，但使用“像、听起来、似乎”等语言；作品层面只允许基于原文做联想，并明确资料边界。
用户的禁止项、隐私和决定权属于最高优先级。完成一次字段检查后直接输出最终 JSON。`,
  "golden-aligned-v1": `完成一次克制、具体、受证据约束的中文情感回应。不要输出思考过程。

内部只做一次短检查：
1. 用户事实白名单：保留用户原句中的否定、转折、并存情绪、明确禁令和所求形式。先回应这些内容；不得擅加孤独、创伤、压抑、矛盾、释然等未表达状态。用户要一句话、判断或选择边界时，要直接满足可满足的部分。
2. 作品事实白名单：art_connection 中每个关于作品的名词、形容词、动作和因果都必须能逐字回指 artwork_evidence。先写已知事实，再用“或许可以让人想到”作低强度联想，最后写未知边界。
3. 无画面资料时，禁止任何视觉或过程补写，包括人物、动作、表情、颜色、光影、氛围、构图、线条、笔触、质地、留白、显影、静默地呈现，以及作者意图。只能使用标题、作者、年份、媒介、分类与“没有具体内容”本身。
4. 物件结构不能被直接等同为用户心理：例如“有锁”最多联想到设置边界，不能断言锁着秘密；标题与描述冲突时只说资料冲突，不能据此给用户添加复杂或相反情绪。
5. reply 先承接一个具体细节，再回应用户目标；避免“温柔、珍贵、力量、疗愈、我会一直陪着你”等套话。建议只能是可选的，且不得覆盖用户明确要求。
6. 以区间中部为目标：emotion_read 22–38 字、reply 55–80 字、art_connection 60–85 字、boundary 18–35 字。生成后数一次字符；过短或过长只改一次。

反例：资料只有标题时，不能写“画面留白/光影/人物”；应写“资料只有标题，因此只能把标题作为命名入口，不能作视觉联想”。直接输出最终 JSON。`,
  "golden-aligned-v2": `完成一次自然、克制的中文情感回应。不要输出思考过程。内部检查一次后直接给 JSON。

用户源与作品源隔离：
- emotion_read 与 reply 只能依据 user。保留“不是、但、同时、不要、只想”等限定，不添加用户没说的情绪、经历或动机。作品的标题、冲突和情绪不得回写为用户的情绪。
- art_connection 只能依据 artwork_evidence。作品事实只能原样复述或缩写；任何新增内容只能是带“或许可以让人想到”的联想，不能伪装成作品事实。
- “资料未提供人物/画面/用途”不等于“作品中不存在人物/画面/内容”。缺什么就只说资料未提供什么，不用想象补齐。
- 不把标题当画面，不把媒介写出质感，不把物件用途映射为用户经历，不把历史人物心理套给用户。

回应纪律：先准确承接用户的一处具体表达，再满足其明确请求。不得诊断、强行积极、替用户决定；不得承诺他人反应、未来结果、信息不会泄露或自己会一直陪伴。少用抽象表扬和治疗套话。

句式骨架：
- emotion_read：一句，22–38 字。
- reply：恰好两句，每句约 25–38 字；第一句承接具体感受，第二句回应请求或给不越权的可选空间。
- art_connection：恰好两句；第一句只写已知作品事实，第二句才作克制联想并指出资料限制；总计 60–85 字。
- boundary：一句，18–35 字，只写本案例真正未知的内容。
输出前检查字段、句数与长度一次。`,
  "golden-aligned-v3": `完成一次自然、具体、克制的中文情感回应。不要输出思考过程。把 user 与 artwork_evidence 当作两个互不补写的封闭信息源。

先遵守四条：
1. emotion_read、reply 只从 user 取材，保留否定、转折、并存情绪、禁令与请求；作品信息不得进入这两个字段，也不得否认用户明说的情绪。
2. art_connection 只从 artwork_evidence 取材。evidence_mode=metadata_limited 时，只能用原文明确给出的题名、作者、年代、媒介、分类、对象、动作或工艺；缺失项只能表述为“资料未提供”，不得生成任何画面、氛围、质感、内容或作者意图。evidence_mode=record_conflict 时，只陈述冲突及认识边界，不把任一含义映射给用户。
3. 不诊断、不保证结果或他人反应、不替用户决定、不假装持续陪伴。先承接一个原句细节，再满足用户真正请求；如需建议，只给一个可选且低风险的动作。
4. emotion_read 一句 22–38 字；reply：恰好三句，总计 55–80 字；art_connection：恰好两句，总计 60–85 字；boundary 一句 18–35 字。长度不合格就改写一次。

高质量示例一：
user="我明天要等检查结果。别告诉我‘都会好的’，我现在就是害怕。"
artwork_evidence="十九世纪候诊室照片；资料只记录地点与年份，没有人物状态说明。"
输出={"emotion_read":"你正悬在结果揭晓前的未知里，害怕本身已经很难熬。","reply":"等检查结果前的害怕，确实会把时间拉得很长。我不会说“都会好的”，也不会替你压下这种恐惧。今晚可以只处理眼前这段等待，按你能承受的方式待着。","art_connection":"资料只确认这是一张十九世纪候诊室照片，并记录地点与年份。它或许可以让人想到等待中的不确定，但人物状态未被提供，不能替照片里的人填写害怕。","boundary":"不了解检查项目与实际风险，只能回应此刻的害怕。"}

高质量示例二：
user="我今天赢了一场很重要的比赛，想要一句不过分煽情的庆祝。"
artwork_evidence="作品标题为《欢乐》；描述却只说明它记录一场葬礼队伍。标题与描述存在明显冲突，没有更多资料。"
输出={"emotion_read":"你想承认这场胜利的分量，同时保持庆祝克制自然。","reply":"赢下这么重要的一场，确实值得认真承认。可以简单庆祝：今天这一场，赢得很开心，也很珍惜。高兴不必被说得盛大，照你的分寸留下就好。","art_connection":"资料把标题记为《欢乐》，描述却只说葬礼队伍，两者明确冲突。这或许提醒人单一标题不足以规定理解；资料不足以确认作品含义，也不应用它改写你的喜悦。","boundary":"标题与描述冲突且资料有限，无法确定作品含义。"}

只学习示例的边界与密度，不复制其中事实或措辞。输出前做一次四字段检查，然后只返回 JSON。`,
};

function classifyArtworkEvidence(artworkEvidence) {
  if (/(明显)?冲突|相互矛盾|相矛盾/.test(artworkEvidence)) return "record_conflict";
  if (/(没有|未提供|无)(具体)?(画面|影像|描述|标签|人物|场景|叙事|用途)|(?:只|仅)(?:记录|说明|可确认|有)/.test(artworkEvidence)) {
    return "metadata_limited";
  }
  return "described";
}

export function buildSingleCasePrompt(goldenCase, variant = "contract-first") {
  if (!PROMPT_VARIANTS.includes(variant)) throw new Error(`Unknown prompt variant: ${variant}`);
  const user = goldenCase?.input?.user;
  const artworkEvidence = goldenCase?.input?.artwork_evidence;
  if (typeof user !== "string" || typeof artworkEvidence !== "string") {
    throw new Error("Golden case must provide input.user and input.artwork_evidence");
  }
  const evidenceMode = classifyArtworkEvidence(artworkEvidence);
  const evidenceModeLine = variant === "golden-aligned-v3" ? `\nevidence_mode="${evidenceMode}"` : "";
  return `${variantInstructions[variant]}\n\n${commonContract}\n\n<input>\nuser=${JSON.stringify(user)}\nartwork_evidence=${JSON.stringify(artworkEvidence)}${evidenceModeLine}\n</input>`;
}

export function parseSingleOutput(text) {
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

export function extractOpenAIStreamDelta(event) {
  const choice = event?.choices?.[0] ?? {};
  const delta = choice.delta ?? {};
  const usage = event?.usage && typeof event.usage === "object"
    ? {
      ...(Number.isFinite(event.usage.prompt_tokens) ? { input_tokens: event.usage.prompt_tokens } : {}),
      ...(Number.isFinite(event.usage.completion_tokens) ? { output_tokens: event.usage.completion_tokens } : {}),
    }
    : {};
  return {
    text: typeof delta.content === "string" ? delta.content : "",
    thinking: typeof delta.reasoning_content === "string"
      ? delta.reasoning_content
      : (typeof delta.reasoning === "string" ? delta.reasoning : ""),
    finishReason: choice.finish_reason ?? null,
    model: event?.model ?? null,
    usage,
  };
}

const chars = (value) => [...String(value ?? "")].length;
const cautionPattern = /(像|或许|可以让人想到|可能让人想到)/;

function containsUnnegated(text, term) {
  const value = String(text ?? "");
  let index = value.indexOf(term);
  while (index >= 0) {
    const prefix = value.slice(Math.max(0, index - 18), index);
    const negated = /(?:不(?:会|能|应|该|必|要|是)?|无需|无法|未曾|没有|避免|拒绝|禁止|不足以)(?:再|去|直接|轻易|简单地|随意地|替你|向你|对你)?(?:保证|承诺|断言|判断|诊断|分析|要求|需要|把|说|用|告诉)?[^，。！？；\n]{0,6}$/.test(prefix);
    if (!negated) return true;
    index = value.indexOf(term, index + term.length);
  }
  return false;
}

export function gradeSingleOutput(goldenCase, row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return { passed: false, coreCoverage: 0, failures: [{ type: "missing_or_invalid_object" }] };
  }
  const failures = [];
  const expectedFields = ["emotion_read", "reply", "art_connection", "boundary"].sort();
  const actualFields = Object.keys(row).sort();
  if (JSON.stringify(actualFields) !== JSON.stringify(expectedFields)) {
    failures.push({ type: "exact_fields", actualFields });
  }
  const lengths = {
    emotion_read: chars(row.emotion_read),
    reply: chars(row.reply),
    art_connection: chars(row.art_connection),
    boundary: chars(row.boundary),
  };
  if (lengths.emotion_read < 15 || lengths.emotion_read > 45) failures.push({ type: "emotion_length", actual: lengths.emotion_read });
  if (lengths.reply < 45 || lengths.reply > 90) failures.push({ type: "reply_length", actual: lengths.reply });
  if (lengths.art_connection < 45 || lengths.art_connection > 100) failures.push({ type: "art_length", actual: lengths.art_connection });
  if (lengths.boundary > 45) failures.push({ type: "boundary_length", actual: lengths.boundary });
  if (!cautionPattern.test(String(row.art_connection))) failures.push({ type: "missing_caution_language" });

  const expected = goldenCase.expected ?? {};
  if (expected.explicit_boundary_required && !String(row.boundary ?? "").trim()) {
    failures.push({ type: "missing_boundary" });
  }
  const allText = `${row.emotion_read}\n${row.reply}\n${row.art_connection}\n${row.boundary}`;
  for (const term of expected.forbidden_phrases ?? []) {
    if (containsUnnegated(allText, term)) failures.push({ type: "forbidden", term });
  }
  for (const term of expected.unsupported_art_details ?? []) {
    if (String(row.art_connection ?? "").includes(term)) failures.push({ type: "unsupported_art_detail", term });
  }
  const coreHits = (expected.semantic_core_groups ?? []).map((group) => ({
    group,
    hit: group.some((term) => `${row.emotion_read}\n${row.reply}`.includes(term)),
  }));
  const coreCoverage = coreHits.length
    ? coreHits.filter((item) => item.hit).length / coreHits.length
    : 1;
  return { passed: failures.length === 0, coreCoverage, coreHits, lengths, failures };
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function average(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

export function summarizeVariantRuns(runs) {
  const groups = new Map();
  for (const run of runs) {
    if (!groups.has(run.variant)) groups.set(run.variant, []);
    groups.get(run.variant).push(run);
  }
  return [...groups.entries()].map(([variant, group]) => ({
    variant,
    samples: group.length,
    usable: group.filter((run) => Boolean(run.parsed)).length,
    hardPasses: group.filter((run) => run.grade?.passed).length,
    hardPassRate: group.filter((run) => run.grade?.passed).length / group.length,
    coreCoverageAverage: average(group.map((run) => run.grade?.coreCoverage ?? 0)),
    firstTextMedianMs: median(group.map((run) => run.firstTextMs)),
    totalMedianMs: median(group.map((run) => run.totalMs)),
    outputTokensAverage: average(group.map((run) => run.usage?.output_tokens)),
  }));
}
