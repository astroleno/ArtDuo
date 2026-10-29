import assert from "node:assert/strict";
import { test } from "node:test";
import { exhibitionNarrativeMessages, fallbackExhibitionNarrative, generateExhibitionNarrative, validateExhibitionNarrativePiece, validateGroundedArtworkText, type ExhibitionNarrativeInput } from "../../src/services/curation/exhibition-narrative";
import type { CurationIntentPlan } from "@artduo/contracts";

const input: ExhibitionNarrativeInput = { query: "想安静地停一会", plan: { stages: [{ label: "先停一会" }, { label: "看向远处" }, { label: "留一点光" }] } as CurationIntentPlan,
  artworks: [{ id: "work-1", title: "A Quiet View", stageIndex: 0, editorialMoods: ["quiet"], editorialPalette: [], editorialComposition: [] }] };

test("route claims use actual first and last works rather than pooled visual evidence", () => {
  const scene: ExhibitionNarrativeInput = { ...input, artworks: [
    { ...input.artworks[0]!, visualObservation: { text: "桌上摆放花朵。", imageSha256: "a", source: "local-image-review", facts: { flowers: "present", water: "absent" } as any } },
    { ...input.artworks[0]!, id: "work-2", title: "The Pond", visualObservation: { text: "池水映着枝叶。", imageSha256: "b", source: "local-image-review", facts: { flowers: "absent", water: "present" } as any } },
  ] };
  const piece = { kind: "preface", evidenceIds: ["work-1", "work-2"] };
  assert.throws(() => validateExhibitionNarrativePiece({ ...piece, text: "先看水面，最后看花朵。" }, scene), /visual evidence/);
  assert.doesNotThrow(() => validateExhibitionNarrativePiece({ ...piece, text: "先看花朵，最后看水面。" }, scene));
  assert.throws(() => validateExhibitionNarrativePiece({ ...piece, text: "第一幅是The Pond。" }, scene), /frozen artwork order/);
  assert.doesNotThrow(() => validateExhibitionNarrativePiece({ ...piece, text: "花朵的轮廓与水面的倒影形成对照。" }, scene));
  assert.doesNotThrow(() => validateExhibitionNarrativePiece({ ...piece, kind: "closing", text: "末幅的水面与开头的花朵相互呼应。" }, scene));
  const ledger = exhibitionNarrativeMessages(scene)[1]!.content.split("\n").find(line => line.startsWith("frozen_exhibition_fact_ledger="))!;
  const records = JSON.parse(ledger.slice(ledger.indexOf("=") + 1));
  assert.deepEqual(records.map((r: any) => [r.displayPosition, r.isFirst, r.isLast]), [[1, true, false], [2, false, true]]);
});

test("a shared exhibition claim must also hold for works omitted from its evidence IDs", () => {
  const open = { ...input.artworks[0]!, visualObservation: { text: "远山延向开阔天空。", source: "local-image-review" as const, imageSha256: "a", spatialFraming: "open" as const } };
  const enclosed = { ...open, id: "vase", title: "Vase", visualObservation: { ...open.visualObservation, text: "近景瓶花，未见远景。", spatialFraming: "enclosed" as const } };
  const scene = { ...input, artworks: [open, enclosed] };
  for (const text of ["两幅画都从开阔处展开。", "这组作品都有开阔的远景。"])
    assert.throws(() => validateExhibitionNarrativePiece({ kind: "preface", text, evidenceIds: [open.id] }, scene), /open vista/);
  assert.doesNotThrow(() => validateExhibitionNarrativePiece({ kind: "preface", text: "第一幅的远山延向开阔天空。", evidenceIds: [open.id] }, scene));
});

test("negation stays with its clause and a verified broad mat is not an open landscape", () => {
  const water = { ...input.artworks[0]!, visualObservation: { text: "池水映出枝叶，没有开放远景。", imageSha256: "fixture", source: "local-image-review" as const, facts: { water: "present" } as any, spatialFraming: "enclosed" as const } };
  assert.doesNotThrow(() => validateGroundedArtworkText("末幅没有远景，视线落在浮叶与倒影之间。", water));
  assert.throws(() => validateGroundedArtworkText("画面没有水面。", water), /contradicts visual evidence/);
  const portrait = { ...water, medium: "paper; chalk", visualObservation: { ...water.visualObservation, text: "灰蓝色画纸周围保留宽阔浅色装裱边。", spatialFraming: "not-applicable" as const } };
  assert.doesNotThrow(() => validateGroundedArtworkText("画纸周围保留宽阔的浅色装裱边。", portrait));
  assert.throws(() => validateGroundedArtworkText("宽阔的海天铺向远处。", portrait), /open vista/);
  assert.throws(() => validateGroundedArtworkText("这是一幅纸本粉彩。", portrait), /misstates artwork medium/);
});

test("adjacent observed objects do not license an invented separation", () => {
  const scene = { ...input.artworks[0]!, description: "成排深色树木前是草岸和宽水面，树间可见浅色屋舍。" };
  assert.throws(() => validateGroundedArtworkText("宽水面把树影与屋舍隔开。", scene), /spatial separation/);
  assert.doesNotThrow(() => validateGroundedArtworkText("树木前是草岸和宽水面。", scene));
});

test("a book in a portrait does not put the sitter's hand beside it", () => {
  const portrait = { ...input.artworks[0]!, description: "一手支在头侧，另一手低垂于身侧；桌上叠放书册。" };
  for (const text of ["一手在头侧，另一手靠近书册。", "从器皿旁的手到书册边的手。", "手放在桌上的书本旁。"])
    assert.throws(() => validateGroundedArtworkText(text, portrait), /hand position/);
  assert.doesNotThrow(() => validateGroundedArtworkText("一手支在头侧，另一手垂在身侧。", portrait));
  assert.doesNotThrow(() => validateGroundedArtworkText("一只手靠近书册。", { ...portrait, description: "一只手靠近桌上的书册。" }));
});

test("empty compositional contrasts are removed without accepting an invented visible person", () => {
  const scene = { ...input, artworks: [{ ...input.artworks[0]!, visualObservation: {
    text: "草岸前是宽水面，未见人物或船只。", imageSha256: "fixture", source: "local-image-review" as const,
    facts: { water: "present" as const, people: "absent" as const, boats: "absent" as const },
  } }] };
  const preface = { kind: "preface", evidenceIds: ["work-1"] };
  assert.equal(validateExhibitionNarrativePiece({ ...preface, text: "这幅画里，水面不靠人物或船只来交代。草岸前展开宽水面。" }, scene).text, "草岸前展开宽水面。");
  assert.throws(() => validateExhibitionNarrativePiece({ ...preface, text: "画面不靠人物撑起。人物坐在岸边。" }, scene), /visual evidence/);
});

test("repair ignores already completed keys and keeps all newly requested notes", async () => {
  const rows = [
    { kind: "preface", text: "先看这件作品。", evidenceIds: ["work-1"] },
    { kind: "note", artworkId: "work-1", text: "留意这件作品的媒材。", evidenceIds: ["work-1"] },
    { kind: "closing", text: "观看停在这件作品。", evidenceIds: ["work-1"] },
  ];
  const pieces = [];
  for await (const piece of generateExhibitionNarrative(input, async function* () { yield rows.map(row => JSON.stringify(row)).join("\n"); }, undefined, undefined, ["note:work-1"])) pieces.push(piece);
  assert.equal(pieces.length, 1); assert.equal(pieces[0]!.text, rows[1]!.text);
  const repair = exhibitionNarrativeMessages(input, ["closing"], [{ key: "closing", reason: "Narrative contradicts visual evidence: water" }, { key: "preface", reason: "irrelevant earlier failure" }])[1]!.content;
  const failures = repair.split("\n").find(line => line.startsWith("prior_rejections="))!;
  assert.ok(failures.includes("water")); assert.ok(!failures.includes("irrelevant"));
});

test("a hand-focused request cannot borrow a legacy description or generalize one supported hand to both portraits", () => {
  const focusInput: ExhibitionNarrativeInput = { ...input, viewingFocus: [{ topic: "hands", label: "手部与手势", evidenceIds: [] }] };
  assert.throws(() => validateExhibitionNarrativePiece({ kind: "preface", text: "手收在画面中。", evidenceIds: ["work-1"] }, focusInput), /unsupported viewing focus/);
  assert.doesNotThrow(() => validateExhibitionNarrativePiece({ kind: "preface", text: "手的姿态目前无法确认，可以先看面部的排线。", evidenceIds: ["work-1"] }, focusInput));
  const two = { ...focusInput, artworks: [...input.artworks, { ...input.artworks[0]!, id: "work-2" }], viewingFocus: [{ topic: "hands" as const, label: "手部与手势", evidenceIds: ["work-1"] }] };
  assert.throws(() => validateExhibitionNarrativePiece({ kind: "preface", text: "两幅肖像里，手都收在画面中。", evidenceIds: ["work-1", "work-2"] }, two), /generalizes a viewing focus/);
});

test("verified qualified absence does not erase people visible in a painting within the painting", () => {
  const scene: ExhibitionNarrativeInput = { ...input, artworks: [{ ...input.artworks[0]!, visualObservation: {
    text: "墙上有小幅人像画；没有站立人物，但画中画的人像仍可见。", imageSha256: "fixture", source: "local-image-review", facts: { people: "present" } as any,
  } }] };
  const note = { kind: "note", artworkId: "work-1", evidenceIds: ["work-1"] };
  assert.doesNotThrow(() => validateExhibitionNarrativePiece({ ...note, text: "没有站立人物，但画中画的人像仍可见。" }, scene));
  assert.throws(() => validateExhibitionNarrativePiece({ ...note, text: "画面没有人物。" }, scene), /contradicts visual evidence/);
  assert.throws(() => validateExhibitionNarrativePiece({ ...note, text: "没有行走人物。" }, scene), /contradicts visual evidence/);
});

test("fallback keeps complete observed clauses and never chops a foreign title or sentence into an ellipsis", () => {
  const scene: ExhibitionNarrativeInput = { ...input, artworks: [{ ...input.artworks[0]!, title: "A very long original collection title that must not be chopped", visualObservation: {
    text: "蓝色卧室内放着木床、两把椅子、桌和水罐，墙上悬挂小型人像画；没有站立人物，但画中画的人像仍可见。", imageSha256: "fixture", source: "local-image-review",
  } }] };
  const pieces = fallbackExhibitionNarrative(scene);
  assert.equal(pieces[1]!.text, "蓝色卧室内放着木床、两把椅子、桌和水罐。");
  assert.ok(pieces.every(piece => !/…|关于「|慢慢移动|感受不必/u.test(piece.text)));
});

test("fallback selects observed relations without converting audit uncertainty into a claim", () => {
  const text = "赭黄屋顶在前景叠置，蓝色海湾延向连绵山体；当前预览未见可辨认人物或花朵，远处水面桅杆状形不足以确认是否为船。";
  const reviewed: ExhibitionNarrativeInput = { ...input, query: "清晨河岸和树影", artworks: [{ ...input.artworks[0]!, visualObservation: {
    text, imageSha256: "fixture", source: "local-image-review", facts: { boats: "unknown", people: "unknown" } as any,
  } }] };
  const pieces = fallbackExhibitionNarrative(reviewed);
  assert.equal(pieces[0]!.text, "赭黄屋顶在前景叠置。");
  for (const piece of pieces) {
    assert.doesNotMatch(piece.text, /当前预览|未见|可辨认|不足以确认|桅杆|人物|花朵|清晨|河岸|树影/u);
    assert.deepEqual(piece.evidenceIds, ["work-1"]);
    assert.equal(piece.source, "fallback");
  }
  assert.equal(reviewed.artworks[0]!.visualObservation!.text, text, "the original evidence remains qualified");
  const list = { ...reviewed, artworks: [{ ...reviewed.artworks[0]!, visualObservation: { ...reviewed.artworks[0]!.visualObservation!,
    text: "未见可辨认人物，船只或鲜花；蓝色海湾延向连绵山体。",
  } }] };
  assert.equal(fallbackExhibitionNarrative(list)[0]!.text, "蓝色海湾延向连绵山体。");
});

test("uncertain-only fallback uses metadata and retains an explicitly missing viewing focus", () => {
  const reviewed: ExhibitionNarrativeInput = { ...input, viewingFocus: [{ topic: "hands", label: "手部与手势", evidenceIds: [] }],
    artworks: [{ ...input.artworks[0]!, date: "1889", medium: "Oil on canvas", visualObservation: {
      text: "无法确认手部的形状，未见可辨认的船只。", imageSha256: "fixture", source: "local-image-review",
    } }] };
  const pieces = fallbackExhibitionNarrative(reviewed);
  assert.match(pieces[0]!.text, /^手部与手势的细节目前无法确认。1889/u);
  assert.doesNotMatch(pieces[0]!.text, /手部的形状|船只/u);
  const unknown = fallbackExhibitionNarrative({ ...reviewed, viewingFocus: undefined, artworks: [{ ...reviewed.artworks[0]!, date: undefined, medium: undefined }] });
  assert.equal(unknown[0]!.text, "这件作品的更多资料暂未收录。");
  assert.equal(fallbackExhibitionNarrative({ ...input, artworks: [] })[0]!.text, "本次没有找到能确认符合这些条件的作品。");
});
test("narrative streams only complete validated lines in exhibition order", async () => {
  const source = fallbackExhibitionNarrative(input).map((piece) => JSON.stringify(piece)).join("\n");
  const result = [];
  for await (const piece of generateExhibitionNarrative(input, async function* () {
    for (let offset = 0; offset < source.length; offset += 7) yield source.slice(offset, offset + 7);
  })) result.push(piece);
  assert.deepEqual(result.map((piece) => piece.kind), ["preface", "note", "closing"]);
  assert.equal(result[1].artworkId, "work-1");
});

test("neutral single-work requests cannot invent a feeling or unvisited stages", () => {
  const neutral = { ...input, query: "The Bedroom" };
  const preface = { kind: "preface", evidenceIds: ["work-1"] };
  assert.throws(() => validateExhibitionNarrativePiece({ ...preface, text: "你提到疲惫，想在这个房间里被接住。" }, neutral), /invents a feeling/);
  assert.throws(() => validateExhibitionNarrativePiece({ ...preface, text: "从先停一会走到看向远处。" }, neutral), /stage without/);
  const ledger = exhibitionNarrativeMessages(neutral)[1].content.split("\n").find((line) => line.startsWith("viewing_plan="))!;
  assert.ok(!ledger.includes("看向远处"));
  const fallback = fallbackExhibitionNarrative(neutral);
  assert.ok(!fallback[0].text.includes("关于"));
  assert.ok(!fallback.some((piece) => /疲惫|看向远处|留一点光/.test(piece.text)));
});

test("Chinese denials do not license sadness attribution even without a no-comfort request", () => {
  const preface = { kind: "preface", evidenceIds: ["work-1"] };
  for (const query of ["我不难过也不累，想看明亮的颜色。", "我并不难过。", "我并非疲惫。", "我不是很低落。"]) {
    assert.throws(() => validateExhibitionNarrativePiece({ ...preface, text: "你今天有些难过，先在画前停一会。" }, { ...input, query }), /invents a feeling/, query);
  }
  assert.doesNotThrow(() => validateExhibitionNarrativePiece({ ...preface, text: "你并不难过，可以看看这件作品。" }, { ...input, query: "我并不难过。" }));
  assert.doesNotThrow(() => validateExhibitionNarrativePiece({ ...preface, text: "你今天有些难过，可以看看这件作品。" }, { ...input, query: "我不是不难过。" }));
  assert.doesNotThrow(() => validateExhibitionNarrativePiece({ ...preface, text: "你今天有些难过，可以看看这件作品。" }, { ...input, query: "我不是疲惫，而是难过。" }));
});

test("notes without a real description cannot add invented visual details", () => {
  assert.throws(() => validateExhibitionNarrativePiece({ kind: "note", artworkId: "work-1", text: "红色的船映着粉白倒影。", evidenceIds: ["work-1"] }, input), /visual details/);
  const richer = { ...input, artworks: [{ ...input.artworks[0], description: "蓝绿水面上散着粉白花朵。" }] };
  assert.equal(fallbackExhibitionNarrative(richer)[1].text, "蓝绿水面上散着粉白花朵。");
});

test("wet surfaces and umbrellas do not establish that rain has ended", () => {
  const wet = { ...input, artworks: [{ ...input.artworks[0], description: "撑伞行人位于湿润的石街上。" }] };
  const note = { kind: "note", artworkId: "work-1", evidenceIds: ["work-1"] };
  assert.throws(() => validateExhibitionNarrativePiece({ ...note, text: "雨后街面映出行人的身影。" }, wet), /rain has ended/);
  assert.doesNotThrow(() => validateExhibitionNarrativePiece({ ...note, text: "撑伞行人与湿润石街相互映照。" }, wet));
  assert.doesNotThrow(() => validateExhibitionNarrativePiece({ ...note, text: "雨后的石街还留着亮光。" }, { ...wet, artworks: [{ ...wet.artworks[0], description: "雨后的湿润石街。" }] }));
});

test("image review observations ground prose without masquerading as museum descriptions", () => {
  const reviewed = { ...input, artworks: [{ ...input.artworks[0], visualObservation: { text: "水面映出近岸树干，田野向远处展开。", imageSha256: "sha256:fixture", source: "local-image-review" as const } }] };
  assert.match(exhibitionNarrativeMessages(reviewed)[1].content, /local-image-review/);
  assert.match(exhibitionNarrativeMessages(reviewed)[1].content, /不是馆方文献/);
  assert.equal(fallbackExhibitionNarrative(reviewed)[1].text, "水面映出近岸树干，田野向远处展开。");
});

test("requested detail focus cannot be invented, substituted by metaphor or omitted when supported", () => {
  const note = { kind: "note", artworkId: "work-1", evidenceIds: ["work-1"] };
  const road = { ...input, viewingFocus: [{ topic: "roads" as const, label: "道路", evidenceIds: [] }] };
  for (const text of ["道路从树间向远处延伸。", "岸线如道路般引导目光。", "画中没有道路。"] ) {
    assert.throws(() => validateExhibitionNarrativePiece({ ...note, text }, road), /unsupported viewing focus/);
  }
  assert.doesNotThrow(() => validateExhibitionNarrativePiece({ ...note, text: "道路细节目前无法确认，可以先观察线条。" }, road));
  const hand = { ...input, artworks: [{ ...input.artworks[0], visualObservation: { text: "男子用手托着头，面部刻线密集。", imageSha256: "sha256:fixture", source: "local-image-review" as const } }],
    viewingFocus: [{ topic: "hands" as const, label: "手势", evidenceIds: ["work-1"] }] };
  assert.throws(() => validateExhibitionNarrativePiece({ ...note, text: "面部与衣领的排线形成深浅对照。" }, hand), /omits the evidenced viewing focus/);
  assert.doesNotThrow(() => validateExhibitionNarrativePiece({ ...note, text: "托着头的手与面部排线形成对照。" }, hand));
});

test("direct user attribution must quote the input and cannot add a viewing preference", () => {
  const sea = { ...input, query: "只看没有人物的海景，三幅就好。" };
  const preface = { kind: "preface", evidenceIds: ["work-1"] };
  assert.equal(validateExhibitionNarrativePiece({ ...preface, text: "你说只想看没有人物的海景，安静地看三幅。这次停在一件作品前。" }, sea).text, "这次停在一件作品前。");
  assert.equal(validateExhibitionNarrativePiece({ ...preface, text: "你说：‘只看没有人物的海景，三幅就好。’这次停在一件作品前。" }, sea).text, "这次停在一件作品前。");
  assert.throws(() => validateExhibitionNarrativePiece({ ...preface, text: "你说想安静地看三幅。" }, sea), /unsupported statement/);
  assert.equal(validateExhibitionNarrativePiece({ ...preface, text: "档案中这一阶段只有一件作品。" }, sea).text, "这次展览只有一件作品。");
});

test("one rejected note is replaced without erasing a valid closing", async () => {
  const pieces = fallbackExhibitionNarrative(input);
  const raw = pieces.map((piece) => JSON.stringify(piece.kind === "note" ? { ...piece, text: "红色的船映着粉白倒影。" } : piece)).join("\n");
  const received = [];
  for await (const piece of generateExhibitionNarrative(input, async function* () { yield raw; })) received.push(piece);
  assert.deepEqual(received.map((piece) => piece.kind), ["preface", "note", "closing"]);
  assert.equal(received[1].source, "fallback");
  assert.equal(received[2].source, undefined);
});

test("observation-only requests reject emotional endings and keep fallback prose factual", () => {
  const neutral = { ...input, query: "只看《A Quiet View》，不需要情绪引导。" };
  assert.throws(() => validateExhibitionNarrativePiece({ kind: "closing", text: "感受可以还未改变，只留一点轻的余韵。", evidenceIds: ["work-1"] }, neutral), /emotional framing/);
  assert.equal(validateExhibitionNarrativePiece({ kind: "closing", text: "回望这件作品的构图。感受可以仍按原样停留。", evidenceIds: ["work-1"] }, neutral).text, "回望这件作品的构图。");
  assert.ok(!fallbackExhibitionNarrative(neutral).some(piece => /感受|余韵|疗愈|安慰/.test(piece.text)));
  const note = fallbackExhibitionNarrative({ ...input, artworks: [{ ...input.artworks[0], medium: "Etching" }] })[1];
  assert.match(note.text, /版画/);
  assert.doesNotMatch(note.text, /先停一会/);
});

test("declined emotional framing drops a quoted feeling while retaining grounded exhibition prose", () => {
  const neutral = { ...input, query: "最近有些焦虑，想看建筑版画，不用安慰我。" };
  const preface = { kind: "preface", evidenceIds: ["work-1"] };
  assert.equal(validateExhibitionNarrativePiece({ ...preface, text: "你提到最近有些焦虑，想看建筑版画。这次找到一件符合条件的作品，可以观察线条和明暗。" }, neutral).text,
    "这次找到一件符合条件的作品，可以观察线条和明暗。");
  assert.throws(() => validateExhibitionNarrativePiece({ ...preface, text: "你提到最近有些焦虑。" }, neutral), /unsupported statement/);
  assert.throws(() => validateExhibitionNarrativePiece({ ...preface, text: "先观察线条。让画面安抚你的焦虑。" }, neutral), /invents a feeling/);
});

test("negated feelings cannot license emotional attribution in observation-only requests", () => {
  const neutral = { ...input, query: "I’m not sad or tired. I want spacious views, not comfort." };
  assert.throws(() => validateExhibitionNarrativePiece({ kind: "preface", text: "让这片水面接住你的疲惫。", evidenceIds: ["work-1"] }, neutral), /invents a feeling/);
  assert.match(exhibitionNarrativeMessages(neutral)[1].content, /观看愿望，不是画面事实/);
  assert.doesNotMatch(exhibitionNarrativeMessages(neutral)[1].content, /允许感受还未改变/);
  assert.throws(() => validateExhibitionNarrativePiece({ kind: "preface", text: "观看保持平稳，不把空间感写成安抚。", evidenceIds: ["work-1"] }, neutral), /writing instructions/);
});
test("wrong references and interrupted providers cannot substitute works or erase a delivered preface", async () => {
  const first = fallbackExhibitionNarrative(input)[0];
  const received = [];
  await assert.rejects(async () => {
    for await (const piece of generateExhibitionNarrative(input, async function* () {
      yield JSON.stringify(first) + "\n";
      yield JSON.stringify({ kind: "note", artworkId: "invented", text: "一个杜撰的细节", evidenceIds: ["invented"] });
    })) received.push(piece);
  }, /outside the frozen exhibition/);
  assert.equal(received.length, 1);
  await assert.rejects(async () => { for await (const _ of generateExhibitionNarrative(input, async function* () { yield JSON.stringify(first); })) { /* drain */ } }, /before all pieces/);
});

test("frozen image facts reject invented objects, false absences and unverified space", () => {
  const reviewed: ExhibitionNarrativeInput = { ...input, query: "water, no boats", artworks: [{ ...input.artworks[0], medium: "Etching", visualObservation: {
    text: "树干围合池水，未见人物、船只或花朵。", imageSha256: "sha256:fixture", source: "local-image-review",
    facts: { water: "present", people: "absent", boats: "absent", flowers: "absent", sea: "absent", mountain: "unknown" }, spatialFraming: "framed",
  } }] };
  const note = { kind: "note", artworkId: "work-1", evidenceIds: ["work-1"] };
  for (const text of ["一只小船穿过水面。", "花朵映在池水里。", "远山衬着水面。", "海面延向天际。", "开阔地平线给水面留下空间。", "油画以色块铺出池水。"]) {
    assert.throws(() => validateExhibitionNarrativePiece({ ...note, text }, reviewed), /visual evidence|open vista|medium/);
  }
  assert.equal(validateExhibitionNarrativePiece({ ...note, text: "树干与池水互相映照，未见人物或船只。" }, reviewed).text, "树干与池水互相映照，未见人物或船只。");
  const uncertain = { ...reviewed, artworks: [{ ...reviewed.artworks[0], visualObservation: { ...reviewed.artworks[0].visualObservation!, facts: { boats: "unknown" as const } } }] };
  assert.throws(() => validateExhibitionNarrativePiece({ ...note, text: "没有船只。" }, uncertain), /visual evidence/);
});

test("quoted exclusions remain negated without licensing an invented visible person", () => {
  const reviewed: ExhibitionNarrativeInput = { ...input, query: "给我水景，不要人物、船只和花卉。", artworks: [{ ...input.artworks[0],
    visualObservation: { text: "水面与天空相接。", imageSha256: "sha256:fixture", source: "local-image-review",
      facts: { water: "present", people: "absent", boats: "absent", flowers: "absent" }, spatialFraming: "open" } }] };
  const preface = { kind: "preface", evidenceIds: ["work-1"] };
  assert.match(validateExhibitionNarrativePiece({ ...preface, text: "你说“给我水景，不要人物、船只和花卉”。先看水面与天空。" }, reviewed).text, /先看水面/);
  assert.throws(() => validateExhibitionNarrativePiece({ ...preface, text: "人物站在水面旁。" }, reviewed), /visual evidence/);
});

test("declining comfort keeps factual closings and removes unrequested emotional codas", () => {
  const closing = { kind: "closing", evidenceIds: ["work-1"] };
  const tired = { ...input, query: "有些累但不难过，只聊颜色，不用安慰我。" };
  assert.doesNotThrow(() => validateExhibitionNarrativePiece({ kind: "preface", evidenceIds: ["work-1"],
    text: "你今天有些累，但并不难过。只看颜色的对照。" }, tired));
  assert.equal(validateExhibitionNarrativePiece({ ...closing, text: "两种颜色相互对照。累的感觉不必此刻改变，只让光线陪你停一会。" }, tired).text, "两种颜色相互对照。");
  const happy = { ...input, query: "心情很好，只看线条，不需要安慰。" };
  assert.equal(validateExhibitionNarrativePiece({ ...closing, text: "线条留下姿态的节奏。你带着好心情来看，这份明朗不必被改动。" }, happy).text, "线条留下姿态的节奏。");
  assert.match(exhibitionNarrativeMessages(tired)[1].content, /明确不要情绪引导或安慰/);
});

test("actual counts and own-work references cannot borrow the request or a neighbor's evidence", () => {
  const one = { ...input, plan: { ...input.plan, artworkCount: 3 } };
  for (const text of ["这次找到三件符合条件的作品。", "这两件作品相互照应。", "刚才看过的2幅画在这里结束。"]) {
    assert.throws(() => validateExhibitionNarrativePiece({ kind: "preface", text, evidenceIds: ["work-1"] }, one), /actual artwork count/);
  }
  const two = { ...input, artworks: [input.artworks[0], { ...input.artworks[0], id: "work-2" }] };
  assert.throws(() => validateExhibitionNarrativePiece({ kind: "note", artworkId: "work-1", text: "看这一件作品。", evidenceIds: ["work-1", "work-2"] }, two), /outside the frozen exhibition/);
  const empty = fallbackExhibitionNarrative({ ...input, artworks: [] });
  assert.deepEqual(empty.map(piece => piece.kind), ["preface", "closing"]);
  assert.ok(empty.every(piece => !piece.evidenceIds.length && !piece.text.includes("《")));
});

test("excitement needs no imposed transformation and writing constraints do not become quoted prose", () => {
  const excited = { ...input, query: "今天很兴奋，想看塞尚，不要把兴奋写成疲惫。" };
  assert.throws(() => validateExhibitionNarrativePiece({ kind: "preface", text: "让兴奋慢慢沉成专注的观看。", evidenceIds: ["work-1"] }, excited), /unrequested emotional transformation/);
  assert.throws(() => validateExhibitionNarrativePiece({ kind: "preface", text: "让水面接住你的疲惫。", evidenceIds: ["work-1"] }, excited), /invents a feeling/);
  const neutral = { ...input, query: "只看《A Quiet View》，不需要情绪引导，注脚只谈构图。" };
  assert.equal(validateExhibitionNarrativePiece({ kind: "preface", text: "你说‘只看《A Quiet View》，不需要情绪引导，注脚只谈构图’。这次停在这一件作品前。", evidenceIds: ["work-1"] }, neutral).text, "这次停在这一件作品前。");
});

test("a lowered head does not establish a bent torso; keep only independently grounded clauses", () => {
  const reviewed = { ...input, artworks: [{ ...input.artworks[0], visualObservation: {
    text: "中央男子低头而坐，两侧长者坐着，身后远山展开。", imageSha256: "sha256:fixture", source: "local-image-review" as const,
  } }] };
  const note = { kind: "note", artworkId: "work-1", evidenceIds: ["work-1"] };
  assert.equal(validateExhibitionNarrativePiece({ ...note, text: "中央男子低头而坐，两侧长者俯身，身后远山展开。" }, reviewed).text,
    "中央男子低头而坐，身后远山展开。");
  assert.throws(() => validateExhibitionNarrativePiece({ ...note, text: "两侧长者俯身。" }, reviewed), /evidenced body pose/);
  const bent = { ...reviewed, artworks: [{ ...reviewed.artworks[0], visualObservation: { ...reviewed.artworks[0].visualObservation, text: "两侧长者俯身而坐。" } }] };
  assert.equal(validateExhibitionNarrativePiece({ ...note, text: "两侧长者俯身。" }, bent).text, "两侧长者俯身。");
});
