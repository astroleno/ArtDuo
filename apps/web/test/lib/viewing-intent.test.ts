import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesViewingIntent, parseViewingIntent, viewingIntentDecision, viewingFocusEvidence, viewingIntentConflictMessage } from "../../lib/viewing-intent";
import type { VisualSubject } from "@artduo/contracts";
import type { WebArtwork } from "../../lib/release-catalog";

const artwork = (title: string, subjectTags: string[] = []) => ({ title, subjectTags }) as WebArtwork;
const without = (work: WebArtwork, subjects: VisualSubject[], open = false) => ({ ...work, visualEvidence: {
  facts: Object.fromEntries(subjects.map(subject => [subject, "absent"])), ...(open ? { spatialFraming: "open" } : {}),
} }) as WebArtwork;

test("conflict feedback explains blocked requirements without rejecting remaining alternatives", () => {
  for (const [query, expected] of [
    ["只看莫奈，不要莫奈。", /同一位作者/u],
    ["只看油画，不要油画。", /媒材/u],
    ["只看森林，不要森林。", /题材/u],
    ["只看《Water Lilies》，不要《water lilies》。", /作品/u],
    ["想看森林和水景，不要森林。", /题材/u],
  ] as const) {
    const intent = parseViewingIntent(query), before = JSON.stringify(intent);
    assert.match(viewingIntentConflictMessage(intent) ?? "", expected, query);
    assert.equal(JSON.stringify(intent), before);
  }
  for (const query of [
    "只看莫奈或梵高，不要莫奈。",
    "只看版画或油画，不要油画。",
    "想看森林或者海景，不要森林。",
    "只看莫奈，不要人物、船只。",
    "想看《Water Lilies》或《The Beach》，不要《Water Lilies》。",
  ]) assert.equal(viewingIntentConflictMessage(parseViewingIntent(query)), undefined, query);
});

test("a named artist request does not silently include uncertain or reference authorship", () => {
  const intent = parseViewingIntent("只看莫奈");
  for (const artistDisplayName of ["Claude Monet (attributed to)", "Workshop of Claude Monet", "Claude Monet (copy after)", "Circle of Claude Monet"]) {
    assert.equal(matchesViewingIntent({ ...artwork("Landscape"), artistDisplayName }, intent), false, artistDisplayName);
  }
  assert.equal(matchesViewingIntent({ ...artwork("Landscape"), artistDisplayName: "Claude Monet" }, intent), true);
  assert.equal(matchesViewingIntent({ ...artwork("Landscape"), artistDisplayName: "Claude Monet; Anonymous (workshop of another artist)" }, intent), true);
  assert.equal(matchesViewingIntent({ ...artwork("Landscape"), artistDisplayName: "Workshop of Claude Monet" }, parseViewingIntent("不要莫奈")), false);
});

test("bare Chinese flower exclusions work without treating spending time or money as flowers", () => {
  for (const query of ["不要花", "只看梵高，不要花。", "不要人物、船只和花", "不要花和人物"]) {
    assert.ok(parseViewingIntent(query).excludedSubjects.includes("flowers"), query);
  }
  for (const query of ["不想花时间挑选，给我一幅画", "不要花钱，想看风景", "只看花鸟画"]) {
    assert.ok(!parseViewingIntent(query).subjects.includes("flowers"), query);
    assert.ok(!parseViewingIntent(query).excludedSubjects.includes("flowers"), query);
  }
});

test("fatigue seeks respite, not a disaster carrying a melancholy label", () => {
  const intent = parseViewingIntent("有点累，撑了很久");
  assert.equal(intent.rest, true);
  assert.equal(matchesViewingIntent(artwork("Burning of the Steamship"), intent), false);
  assert.equal(matchesViewingIntent(artwork("Water Lilies"), intent), true);
});

test("denied sadness or fatigue does not ask for rest, while a positive request still can", () => {
  for (const query of ["我不难过也不累，想看明亮的颜色。", "我并不疲惫。", "我不是很难过。", "我并非低落。"]) {
    const intent = parseViewingIntent(query);
    assert.equal(intent.rest, false, query);
    assert.doesNotMatch(intent.retrievalText, /quiet calm serenity restful/, query);
  }
  assert.equal(parseViewingIntent("我不难过，但有点累。").rest, true);
  assert.equal(parseViewingIntent("我不是不难过。").rest, true);
  assert.equal(parseViewingIntent("我并不难过，只想安静地看。").rest, true);
  assert.equal(parseViewingIntent("我并不开心。").bright, false);
});

test("declined encouragement is not a request for a cheerful or calm selection", () => {
  for (const query of ["有点失落，不用劝我开心起来。", "不必让我平静。", "无需劝我振作，只看树木。", "不需要开心，想看肖像。"] ) {
    const intent = parseViewingIntent(query);
    assert.equal(intent.bright, false, query);
    assert.equal(intent.rest, false, query);
    assert.doesNotMatch(intent.retrievalText, /bright joy lively|quiet calm serenity restful/, query);
  }
  assert.equal(parseViewingIntent("今天很开心，不用安慰。").bright, true);
});

test("still-life requests reject incidental portrait backgrounds and fine focus uses verified observations", () => {
  const portrait = { ...artwork("Woman in Front of a Still Life", ["portrait", "still life"]), medium: "Oil on canvas", visualEvidence: {
    facts: { stillLife: "present", flowers: "present", portrait: "present" }, observation: "女子坐在带花纹的椅中，身后有静物画。",
  } } as WebArtwork;
  assert.equal(matchesViewingIntent(portrait, parseViewingIntent("想看花卉静物油画")), false);
  assert.equal(matchesViewingIntent(portrait, parseViewingIntent("想看人物与静物油画")), true);
  const intent = parseViewingIntent("重点比较脸部和手势，留意道路。");
  assert.deepEqual(intent.focuses, ["hands", "roads"]);
  assert.deepEqual(parseViewingIntent("想看两幅人物肖像，重点看手的姿态。").focuses, ["hands"]);
  const hand = { ...portrait, visualEvidence: { ...portrait.visualEvidence!, observation: "人物用手托着头，脸部排线密集。道路无法确认。" } };
  assert.deepEqual(viewingFocusEvidence(hand, intent).map(item => item.topic), ["hands"]);
  assert.deepEqual(viewingFocusEvidence({ ...hand, visualEvidence: { ...hand.visualEvidence, observation: "手部被衣物遮挡，不能辨认姿态。" } }, intent), []);
  assert.deepEqual(viewingFocusEvidence({ ...hand, visualEvidence: undefined, description: "双手与小路" }, intent), []);
  assert.deepEqual(parseViewingIntent("不要谈手势，只看脸部。").focuses, []);
});

test("conflicting requirements cannot widen selection to unrelated works", () => {
  const sea = without({ ...artwork("Calm Sea"), artistDisplayName: "Paul Cézanne", medium: "Watercolor" }, ["water"]);
  for (const query of ["只看莫奈。不要莫奈。", "只看油画。不要油画。", "只看水景。不要水景。", "只看莫奈，但不要莫奈。", "只看油画但不要油画。"]) {
    assert.equal(matchesViewingIntent(sea, parseViewingIntent(query)), false, query);
  }
  const monet = { ...artwork("A Field"), artistDisplayName: "Claude Monet", medium: "Oil on canvas" };
  assert.equal(matchesViewingIntent(monet, parseViewingIntent("只看莫奈。不要莫奈。")), false);
  assert.equal(matchesViewingIntent(sea, parseViewingIntent("莫奈或者塞尚，不要莫奈。")), true);
  const paulsen = { ...sea, artistDisplayName: "Julius Paulsen" };
  assert.equal(matchesViewingIntent(paulsen, parseViewingIntent("只看 Julius Paulsen，但不要 Julius Paulsen。", ["Julius Paulsen"])), false);
  const intended = parseViewingIntent("不要油画。想看 Julius Paulsen 的水彩。", ["Julius Paulsen"]);
  assert.equal(matchesViewingIntent(paulsen, intended), true);
});

test("explicit war and death requests remain possible even when the visitor is sad", () => {
  for (const query of ["难过，想看战争绘画", "想看死亡题材", "tired, show me a battle"]) {
    const intent = parseViewingIntent(query);
    assert.equal(intent.rest, false);
    assert.equal(matchesViewingIntent(artwork("War and Death", ["battle"]), intent), true);
  }
});

test("subject exclusions have clause scope and never return as emotional aliases", () => {
  for (const query of ["不要森林，想看海", "不想看森林，想看海", "not forest but sea", "不要森林和树木，想看海边"]) {
    const intent = parseViewingIntent(query);
    assert.deepEqual(intent.subjects, ["sea"]);
    assert.deepEqual(intent.excludedSubjects, ["forest"]);
    assert.equal(matchesViewingIntent(artwork("Forest beside the Sea"), intent), false);
    assert.equal(matchesViewingIntent(artwork("Calm Ocean"), intent), false);
    assert.equal(matchesViewingIntent(without(artwork("Calm Ocean"), ["forest"]), intent), true);
    assert.equal(matchesViewingIntent(artwork("Quiet Portrait"), intent), false);
  }
});

test("a distressing current context is not mistaken for the requested subject", () => {
  const intent = parseViewingIntent("看了战争新闻很难过，想平静一下");
  assert.deepEqual(intent.subjects, []);
  assert.equal(intent.rest, true);
  assert.equal(matchesViewingIntent(artwork("A Battle"), intent), false);
});

test("bilingual artist names constrain authorship and preserve exclusions", () => {
  const monet = { ...artwork("Water Lilies"), artistDisplayName: "Claude Monet" };
  const cezanne = { ...artwork("Apples"), artistDisplayName: "Paul Cézanne" };
  assert.equal(matchesViewingIntent(monet, parseViewingIntent("想看莫奈")), true);
  assert.equal(matchesViewingIntent(cezanne, parseViewingIntent("想看莫奈")), false);
  assert.equal(matchesViewingIntent(cezanne, parseViewingIntent("塞尚")), true);
  assert.equal(matchesViewingIntent(monet, parseViewingIntent("不要莫奈")), false);
});

test("Chinese and English subjects use catalog evidence, not medium or affect", () => {
  const intent = parseViewingIntent("想看静物 still life");
  assert.equal(matchesViewingIntent(artwork("Still Life with Apples"), intent), true);
  assert.equal(matchesViewingIntent(artwork("The Old Man", ["quiet", "still"]), intent), false);
  assert.equal(parseViewingIntent("不要明亮，想安静").bright, false);
  assert.equal(parseViewingIntent("今天挺难过，但不想被鼓励。想在低落里待着，别强行变开心。").bright, false);
});

test("an attributive no-people exclusion does not negate the requested seascape", () => {
  const intent = parseViewingIntent("只看没有人物的海景，三幅就好。");
  assert.deepEqual(intent.subjects, ["sea"]);
  assert.deepEqual(intent.excludedSubjects, ["people"]);
  assert.equal(matchesViewingIntent(without({ ...artwork("Calm Ocean"), description: "开阔海面伸向天际。" }, ["people"]), intent), true);
  assert.equal(matchesViewingIntent(artwork("Beach", ["people"]), intent), false);
  assert.equal(matchesViewingIntent(artwork("Sailing Boats at Sea"), intent), false);
  assert.equal(matchesViewingIntent(artwork("Water Lilies"), intent), false);
});

test("gentle seascapes cannot admit explicit war, death or trees through a negative clause", () => {
  const intent = parseViewingIntent("不要森林和树木，只想看平静的海边，别有战争和死亡。");
  assert.deepEqual(intent.subjects, ["sea"]);
  assert.equal(intent.allowIntense, false);
  assert.equal(matchesViewingIntent(artwork("Dead Child"), intent), false);
  assert.equal(matchesViewingIntent(artwork("Battle at Sea"), intent), false);
  assert.equal(matchesViewingIntent(artwork("Calm Ocean", ["trees"]), intent), false);
  assert.equal(matchesViewingIntent(without(artwork("Calm Ocean"), ["forest", "war", "death"]), intent), true);
});

test("unknown author requests stay empty instead of selecting unrelated artists", () => {
  const monet = { ...artwork("Water Lilies"), artistDisplayName: "Claude Monet" };
  for (const query of ["只看毕加索的画，不要其他画家的作品。", "只看若尘的作品。", "只要若尘的油画。", "only paintings by Aster Example", "only prints by Aster Example"]) {
    assert.equal(matchesViewingIntent(monet, parseViewingIntent(query, ["Claude Monet"])), false);
  }
  const author = { ...artwork("A View"), artistDisplayName: "Aster Example" };
  assert.equal(matchesViewingIntent(author, parseViewingIntent("paintings by Aster Example", ["Aster Example"])), true);
});

test("all requested subjects need evidence, while explicit alternatives remain alternatives", () => {
  assert.equal(matchesViewingIntent(artwork("Calm Sea"), parseViewingIntent("想看海边和森林")), false);
  assert.equal(matchesViewingIntent(artwork("Calm Sea"), parseViewingIntent("想看海边或者森林")), true);
  const intent = parseViewingIntent("I want a quiet interior with soft daylight, no portraits and no flowers.");
  assert.equal(matchesViewingIntent(without(artwork("A Quiet Interior"), ["portrait", "flowers"]), intent), true);
  assert.equal(matchesViewingIntent(artwork("Train Station"), intent), false);
  assert.equal(matchesViewingIntent({ ...artwork("Interior"), description: "房间中摆放鲜花。" }, intent), false);
});

test("English negative lists retain scope across commas without turning exclusions into alternatives", () => {
  const intent = parseViewingIntent("I’m not sad or tired. Give me two paintings of water, but no boats, people, or flowers. I want spacious views, not comfort.");
  assert.deepEqual(intent.subjects, ["water"]);
  assert.deepEqual(intent.excludedSubjects.sort(), ["boats", "flowers", "people"]);
  assert.equal(intent.alternativeSubjects, false);
  assert.equal(intent.rest, false);
  assert.equal(matchesViewingIntent(artwork("Calm Water", ["boats"]), intent), false);
  assert.equal(matchesViewingIntent(artwork("Water Lily Pond"), intent), false);
  assert.equal(matchesViewingIntent(without({ ...artwork("Calm Sea"), description: "海面与山体在远处展开。" }, ["people", "boats", "flowers"], true), intent), true);
  assert.equal(matchesViewingIntent({ ...artwork("The Bay of Marseille"), description: "暖色屋顶与蓝色海湾向远山展开。" }, intent), false);
});

test("specific work exclusions do not become a ban on all water or flower subjects", () => {
  const intent = parseViewingIntent("只看莫奈，给我两幅户外风景，排除《睡莲》和《睡莲池》，不要人物。");
  assert.deepEqual(intent.excludedArtworkTitles, ["睡莲", "睡莲池"]);
  assert.ok(!intent.excludedSubjects.includes("water") && !intent.excludedSubjects.includes("flowers"));
  const lily = { ...artwork("Water Lilies", ["pond"]), artistDisplayName: "Claude Monet", keywordBoosts: ["睡莲"] };
  const field = { ...artwork("Stacks of Wheat", ["field"]), artistDisplayName: "Claude Monet", description: "麦垛与浅色田野在暖光里展开。" };
  assert.equal(matchesViewingIntent(lily, intent), false);
  assert.equal(matchesViewingIntent(without(field, ["people"]), intent), true);
});

test("a bare catalog record cannot certify that a waterscape contains no small figures", () => {
  const intent = parseViewingIntent("water, no boats, people, or flowers");
  const lagoon = { ...artwork("A Lock, a Column, and a Church beside a Lagoon"), description: "A Lock, a Column, and a Church beside a Lagoon. Canaletto. Oil on canvas." };
  assert.equal(matchesViewingIntent(lagoon, intent), false);
});

test("quoted exact works preserve internal punctuation and religious exclusions use subject evidence", () => {
  const intent = parseViewingIntent("只看 Gustave Caillebotte 的《Paris Street; Rainy Day》，不需要情绪引导。");
  const street = { ...artwork("Paris Street; Rainy Day"), artistDisplayName: "Gustave Caillebotte" };
  assert.equal(matchesViewingIntent(street, intent), true);
  assert.equal(matchesViewingIntent({ ...street, title: "Another Street" }, intent), false);
  const secular = parseViewingIntent("不要宗教和战争");
  assert.equal(matchesViewingIntent(artwork("Interior of Saint Peter's, Rome", ["church"]), secular), false);
  assert.equal(matchesViewingIntent(without(artwork("Quiet Field"), ["religion", "war"]), secular), true);
});

test("rich prose cannot certify absence, and every strict exclusion needs its own evidence", () => {
  const view = { ...artwork("Calm Water"), description: "A wide river winds into the pale blue distance under a clear sky." };
  assert.equal(matchesViewingIntent(view, parseViewingIntent("water, no people")), false);
  const partlyReviewed = without(view, ["people"]);
  assert.equal(matchesViewingIntent(partlyReviewed, parseViewingIntent("water, no boats or people")), false);
  assert.ok(viewingIntentDecision(partlyReviewed, parseViewingIntent("water, no boats or people")).reasons.includes("excluded-subject:boats:unknown"));
});

test("short Chinese water and boat nouns preserve strict requirements", () => {
  const intent = parseViewingIntent("想看三幅有水的画，不要人物，也不要船。");
  assert.deepEqual(intent.subjects, ["water"]);
  assert.deepEqual(intent.excludedSubjects.sort(), ["boats", "people"]);
  const bay = without(artwork("Water in a Bay"), ["people"]);
  assert.ok(viewingIntentDecision(bay, intent).reasons.includes("excluded-subject:boats:unknown"));
  assert.equal(matchesViewingIntent(without(artwork("Water Lilies"), ["people", "boats"]), intent), true);
  assert.equal(matchesViewingIntent(without(artwork("Quiet Field"), ["people", "boats"]), intent), false);
  assert.deepEqual(parseViewingIntent("只看水彩").subjects, []);
  assert.deepEqual(parseViewingIntent("想看船厂建筑").subjects, ["architecture"]);
});

test("medium requests use original media, and inclusion permission does not impose a medium", () => {
  const print = { ...artwork("A Pond"), medium: "Etching" };
  const oil = { ...artwork("A Pond"), medium: "Oil on canvas" };
  const watercolor = { ...artwork("A Pond"), medium: "Pen and black ink, watercolor washes" };
  assert.equal(matchesViewingIntent(print, parseViewingIntent("只要油画")), false);
  assert.equal(matchesViewingIntent(oil, parseViewingIntent("只要油画")), true);
  assert.equal(matchesViewingIntent(watercolor, parseViewingIntent("只看水彩")), true);
  assert.equal(matchesViewingIntent(print, parseViewingIntent("water paintings")), true);
  assert.deepEqual(parseViewingIntent("想看水景，版画也可以。").media, []);
  assert.deepEqual(parseViewingIntent("版画、水彩都可以，想看水景。").media, []);
  assert.deepEqual(parseViewingIntent("show water, prints are also fine").media, []);
  assert.equal(matchesViewingIntent(oil, parseViewingIntent("oil or watercolor")), true);
  assert.equal(matchesViewingIntent(print, parseViewingIntent("oil or watercolor")), false);
  assert.equal(matchesViewingIntent(print, parseViewingIntent("no prints")), false);
  assert.equal(matchesViewingIntent(artwork("A View"), parseViewingIntent("no prints")), false);
});

test("Chinese attributive exclusions preserve the requested water and space", () => {
  for (const query of ["无人无船的开阔水景", "没有人物和船只的开阔水景"]) {
    const intent = parseViewingIntent(query);
    assert.deepEqual(intent.subjects, ["water"]);
    assert.deepEqual(intent.excludedSubjects.sort(), ["boats", "people"]);
    assert.equal(intent.spacious, true);
    const view = without(artwork("A Pond"), ["people", "boats"], true);
    assert.equal(matchesViewingIntent(view, intent), true);
    assert.equal(matchesViewingIntent({ ...view, visualEvidence: { ...view.visualEvidence!, spatialFraming: "framed" } }, intent), false);
  }
  const falls = parseViewingIntent("只看瀑布");
  assert.ok(falls.subjects.includes("waterfall"));
  assert.equal(matchesViewingIntent(artwork("A Pond"), falls), false);
});

test("a fresh observation request ends an exclusion list without erasing its exclusions", () => {
  for (const focus of ["只聊", "只谈", "只观察", "只比较", "重点看", "留意", "关注"]) {
    const intent = parseViewingIntent(`想看花卉静物油画，不要人物，${focus}花与瓶器的构图。`);
    assert.deepEqual(intent.excludedSubjects, ["people"], focus);
    assert.ok(intent.subjects.includes("flowers"), focus);
    const still = without({ ...artwork("Flowers"), medium: "Oil on canvas", subjectTags: ["still life"] }, ["people"]);
    assert.equal(matchesViewingIntent(still, intent), true, focus);
    assert.equal(matchesViewingIntent(artwork("Portrait", ["flowers", "still life"]), intent), false, focus);
  }
  const list = parseViewingIntent("不要人物，船只和花卉。");
  assert.deepEqual(list.excludedSubjects.sort(), ["boats", "flowers", "people"]);
});

test("Chinese mountain views cannot silently select unrelated ink subjects", () => {
  const intent = parseViewingIntent("想看山景水墨，不要人物和船只。");
  assert.deepEqual(intent.subjects, ["mountain"]);
  const quail = without({ ...artwork("Quail and Millet"), medium: "Ink on silk" }, ["people", "boats"]);
  assert.equal(matchesViewingIntent(quail, intent), false);
  const mountain = without({ ...artwork("A Mountain View"), medium: "Ink on paper" }, ["people", "boats"]);
  assert.equal(matchesViewingIntent(mountain, intent), true);
});
