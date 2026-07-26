---
title: ArtDuo V2 A2A Framework Test Examples
status: draft-calibrated-after-harness-review
created: 2026-06-16
updated: 2026-06-16
source: 10 independent agent test-design passes, normalized to current ArtDuo A2A contracts; iteration 1 calibrated from spec harness review
---

# ArtDuo V2 A2A 框架测试例矩阵

本文档收敛 100 个用于测试 ArtDuo V2 情绪 A2A 与整体框架的设计例子。10 个 agent 各自负责一个独立切面，每组 10 例。这里的 A2A 主链路指：

```text
UserAffectAgent -> ArtworkAgentCapsule[] -> Affective Negotiation -> GrowthForm -> Gallery / Immersive Experience
```

这些例子既可以转成 unit tests，也可以转成 replay cases 或人工评审 checklist。推荐先按下面顺序落地：

1. `packages/contracts`: parser 和 contract tests。
2. `packages/corpus`: user affect extraction 与 artwork capsule tests。
3. `apps/web/lib`: affective negotiation 与 gallery route tests。
4. `packages/ui`: immersive unit/orchestrator tests。
5. `scripts/evaluate-intent-immersion.ts`: 50/100 case replay 与 summary tests。

## Iteration 1: Harness Review Calibration

本轮 review 结论：A2A 分层方向正确，但当前不能标成 `spec-ready`。基础测试全绿只说明旧路径和基础 shape 稳定；100 条 A2A spec harness 结果是 `55 pass / 40 fail / 5 blocked`，说明 agent-to-agent 语义协议还没有达到本矩阵目标。

已知状态：

- 基础非 Playwright 测试：`185 pass / 0 fail`。
- Targeted unit tests：contracts、corpus、web lib、ui 均通过。
- A2A spec harness：`55 pass / 40 fail / 5 blocked`。
- Coverage audit：只有 `3/100` 有一对一源码证据，`83/100` 是 layer-covered-only，不能等同于 case-level 覆盖。
- Replay deterministic：重复运行 JSON sha 一致，这一点可以作为后续 baseline/candidate diff 的基础。

当前主缺口：

| 区域 | Harness 状态 | 判断 |
| --- | --- | --- |
| A1 UserAffectAgent extraction | 0/10 pass | P0。A2A 源头缺口，优先修实现而不是只补测试。 |
| A2 ArtworkAgentCapsule derivation | 3/10 pass | P1。evidence、confidence、normalization 和 restriction mapping 不够稳。 |
| A3 Negotiation | 9/10 pass | P1。只剩 all-rejected fallback trace 可审计性。 |
| A4 GrowthForm | 9/10 pass | P1。supporting/rejected 互斥 invariant 需要 planner 和 contract 双重防御。 |
| A5 Gallery route | 8/10 pass | P1。emotionIds 权重和 artworkPaletteModes 需要接入。 |
| A6 Immersive UI | 7/10 pass, 2 blocked | P2。high intensity clamp 可先修；layout/viewport/network 需要浏览器级验证。 |
| A7 Evaluation/replay | 2/10 pass | P0。报告 schema、隐私、per-stage metrics 和 diff 能力不足。 |
| A8 Robustness | 7/10 pass | P1。empty query、10k query、bad scores 需要快速防御。 |
| A9 Product journeys | 1/10 pass, 2 blocked | P0。A9-01 到 A9-07 先在 parser/context 层修，A9-08/A9-09 进入浏览器 backlog。 |
| A10 Contract/parser | 9/10 pass | P0 for A10-07。dangling evidenceIds 必须拒绝。 |

## Iteration 1 Priority Backlog

P0 先处理测试可信度和源头语义：

1. **让 spec harness 成为 CI gate**  
   当前 harness 会把 fail 写入结果，但不因 fail 退出非 0。第一轮应加入 `counts.fail > 0` 时 `process.exit(1)`，或改成 `node:test` table-driven tests。否则 `40 fail` 只是报告，不会阻塞发布。

2. **系统性增强 A1 UserAffectAgent**  
   直接把 A1-01 到 A1-10 落成 table-driven regression tests，再修 `buildUserAffectAgent`。重点是中英混合、否定/双重否定、hard vs soft boundary、身体感、记忆线索、spatialNeeds、3/4/5 段 temporal shape、confidence calibration。

3. **先修 A9-01 到 A9-07 的 parser/context 层**  
   A9 当前大部分不是纯 E2E 问题，而是 affect extraction 缺 context。优先补 bedtime + no cliche、breakup + no sadness、celebration + restraint、companionship vs romance、child/family context、disappear-risk safety、overwhelmed + quiet/alive。

4. **重做 A7 replay schema**  
   raw prompt 不应无条件写入 JSON。输出应改为 `caseId + promptHash + redactedInput?`，并补 `timestamp`、`version`、`runId`、artwork capsules、stageMetrics、violationSummary、violationsByReason、failed-case reproduction、baseline/candidate diff。

5. **修 A10-07 dangling evidenceIds**  
   `parseArtworkAgentCapsule` 不应只验证 `evidence.length > 0`，还要验证 canOffer/aesthetics/sceneAffinity/motionAffinity/boundaries 里的 `evidenceIds` 都存在于 `evidence[].id`。

P1 补协议质量：

1. A2 capsule evidence 严格化：generic tags 不生成具体 mood；minimal data 降 confidence；restriction 映射到 boundaries；多源冲突降低 confidence。
2. 色彩和场景 normalization：blue/navy、gold/#D8A21B、no-color-alteration/no-recolor 等 alias 应统一。
3. GrowthForm invariant：supporting/rejected 互斥，stage.artworkIds 不得包含 rejected。
4. Gallery route scoring：emotionIds 强于弱 mood；artworkPaletteModes 纳入 background scoring；tie-break 稳定。
5. A8 robustness：empty query、10k query、NaN/Infinity/negative score 先防御。

P2 浏览器级验证：

- A6-07：layout shift / hydration timing。
- A6-10：viewport 与网络/LLM fallback。
- A9-08：快速重试、取消、竞态。
- A9-09：分享链接隐私和返回 Gallery 状态。

项目 AGENTS 明确“没指明时不要使用 playwright”，所以这些先进入 backlog；只有明确授权浏览器级验证时再落 Playwright。

## Iteration 1 Release Gate

当前不建议标成 A2A spec pass。下一轮建议 gate：

- `pnpm -r test` 继续要求全绿。
- spec harness 必须从 `55/40/5` 提升到至少 `85+ pass`，且 `0 P0 fail`。
- A1 至少 `8/10 pass`。
- A7 privacy 和 metadata 必须 pass，尤其 A7-09。
- A9-06 safety-risk 必须 pass。
- A10-07 dangling evidenceIds 必须 pass。
- blocked E2E 可以暂时不计入 spec-ready，但必须有明确浏览器验证 backlog。

## Iteration 1 Case Ownership

| 第一轮目标 | 覆盖 case | 推荐落点 |
| --- | --- | --- |
| Harness fail should fail CI | 全部 100 条 | `harness/run-a2a-spec-harness.ts` 或等价 `node:test` suite |
| A1 source semantics | A1-01 到 A1-10；A9-01 到 A9-07 | `packages/corpus/src/affective-intent.ts` 与 test |
| Replay trust and privacy | A7-01 到 A7-10 | `scripts/evaluate-intent-immersion.ts` |
| Evidence strictness | A10-07；A2 全组 | `packages/contracts/src/affective-agent.ts`，`packages/corpus/src/artwork-agent-capsule.ts` |
| Planner invariants | A3-06；A4-08；A8-04/A8-08/A8-09 | `apps/web/lib/affective-negotiation.ts` |
| Route scoring | A5-04；A5-05；A8-10 | `apps/web/lib/gallery-route.ts` |
| UI safety bounds | A6-03 | `packages/ui/src/immersive/scene-orchestrator.ts` |

## Agent 1: UserAffectAgent Extraction

| ID | 测试层 | 输入/条件 | 主要断言 | 覆盖风险 |
| --- | --- | --- | --- | --- |
| A1-01 | `packages/corpus/src/affective-intent.test.ts` | `我今天很疲惫，想先安静下来，然后慢慢变亮，最后有一点被接住的感觉。` | `languageHints` 含 `zh`；`currentState` 表达疲惫；`desiredState` 表达安定/被接住；`temporalShape.stages` 形成安静、变亮、被接住三段。 | 中文情绪解析；阶段词进入 temporal shape。 |
| A1-02 | `packages/corpus/src/affective-intent.test.ts` | `I want something calm, but I do not want anything chaotic, violent, or flashing red.` | `languageHints` 含 `en`；`desires` 含 `calm`；`resistances` 含 `chaotic`、`violent`、`flashing-red`；`visualConstraints` 对 flashing red 为 hard avoid。 | 英文否定；用户明确不要的内容成为 hard boundary。 |
| A1-03 | `packages/corpus/src/affective-intent.test.ts` | `我现在有点 numb，想要 something soft and spacious，不要太甜腻。` | `languageHints` 含 `zh` 和 `en`；`currentState` 含 numb/麻木；`desires` 含 soft/spacious；`spatialNeeds` 含 open/spacious；`resistances` 含 overly-sweet。 | 中英混合输入；跨语言情绪融合。 |
| A1-04 | `packages/corpus/src/affective-intent.test.ts` | `我不是不想要一点黑暗，但我不想要绝望感。` | `desires` 或 `visualConstraints` 可保留 low-light/dark nuance；`resistances` 含 despair；不应把 dark 全量判为禁止。 | 双重否定；边界优先级。 |
| A1-05 | `packages/corpus/src/affective-intent.test.ts` | `希望像小时候暑假外婆家，风扇声、午后光、旧木桌，但不要怀旧到伤感。` | `memoryHints` 含 childhood/summer/grandmother-home/fan/afternoon-light/old-wood-table；`desires` 含 warm-memory；`resistances` 含 sentimental-sadness 或 heavy-grief。 | 记忆线索抽取；怀旧但不伤感。 |
| A1-06 | `packages/corpus/src/affective-intent.test.ts` | `胸口很紧，想要雾白和浅绿，大面积留白，空间像能呼吸一样。` | `currentState` tension 升高；`visualConstraints` prefer mist-white/light-green/negative-space；`spatialNeeds` 含 breathable/open；`desiredState` 更 relaxed。 | 身体感、色彩、空间需求映射。 |
| A1-07 | `packages/corpus/src/affective-intent.test.ts` | `起初压低一点，中段出现微光，随后有一次明显转折，再慢慢展开，最后停在平静里。` | `temporalShape.stages.length` 为 5；阶段顺序保留 low -> glimmer -> turn -> open -> calm；`peakCount` 与一次明显转折一致。 | 五段 temporal shape；阶段顺序稳定。 |
| A1-08 | `packages/corpus/src/affective-intent.test.ts` | `我想被鼓励，但不要鸡血，不要口号，不要胜利感。` | `desires` 含 encouragement/support；`resistances` 含 hype/slogan/victory；`desiredState` 倾向 gentle support。 | 正向需求与负向边界冲突。 |
| A1-09 | `packages/corpus/src/affective-intent.test.ts` | `嗯……可能想要一点蓝色？或者不是。反正别太吵。` | blue 相关 prefer 置信度较低；`resistances` 含 loud；整体 `confidence` 中低；hard boundary 不因模糊输入丢失。 | 模糊输入；置信度校准。 |
| A1-10 | `packages/corpus/src/affective-intent.test.ts` | `现在脑子很乱，但我不是要被治愈，只想有一个冷静、清楚、可退出的空间。` | `currentState` 表达 confused/overloaded；`desiredState` 表达 calm/clear；`resistances` 含 healing-narrative；`spatialNeeds` 含 exit/withdrawable-space。 | current/desired 分离；拒绝被治愈叙事。 |

## Agent 2: ArtworkAgentCapsule Derivation

| ID | 测试层 | 输入/条件 | 主要断言 | 覆盖风险 |
| --- | --- | --- | --- | --- |
| A2-01 | `packages/corpus/src/artwork-agent-capsule.test.ts` | `ArtworkRecord` 仅含 title/artist/year/colorTags，无 mood、subject、motion。 | capsule 只生成可由 `sourceRef`、`fieldPath` 追溯的 identity/aesthetics；不凭空生成 mood、subject、motionAffinity；`evidence.length > 0`。 | 画作 agent 幻觉补全。 |
| A2-02 | `packages/corpus/src/artwork-agent-capsule.test.ts` | metadata description 含 `somber evening`，retrieval snippet 含 `melancholic atmosphere`。 | `canOffer` 或 aesthetics 派生 somber/melancholy 类信号；相关 `evidenceIds` 均能对应 capsule `evidence.id`；多源一致时 confidence 高于单源。 | mood 映射；证据权重。 |
| A2-03 | `packages/corpus/src/artwork-agent-capsule.test.ts` | metadata palette 为 blue/gold，presentation dominant colors 为 navy/#D8A21B/blue。 | aesthetics 规范化并去重；blue/navy、gold/#D8A21B 的 evidence 保留来源；不得重复产生等价色。 | 色板融合；重复证据处理。 |
| A2-04 | `packages/corpus/src/artwork-agent-capsule.test.ts` | subjectTags 为 river/bridge，retrieval 含 urban landscape，presentation 含 water/architecture。 | scene/aesthetic signals 可包含 river/bridge/urban/water/architecture；不得生成无证据的人物、神话、动物主体。 | subject derivation 越界。 |
| A2-05 | `packages/corpus/src/artwork-agent-capsule.test.ts` | compositionTags 含 central、diagonal、negative-space，metadata 无 composition 描述。 | `aesthetics.kind` 使用 `composition`，值为 central/diagonal/negative-space；证据 `fieldPath` 指向 compositionTags 或 presentation 字段。 | 视觉证据边界；composition 映射。 |
| A2-06 | `packages/corpus/src/artwork-agent-capsule.test.ts` | style/motionProfile/sceneAffinity 暗示 repeated forms、fast flow、kinetic。 | `motionAffinity` 可含 motion/pace/gesture 信号；所有 `evidenceIds` 有对应 evidence；不得只凭标题派生 motion。 | 动势映射；动态体验依据。 |
| A2-07 | `packages/corpus/src/artwork-agent-capsule.test.ts` | artwork 数据包含 restriction: display-only、no-cropping、no-color-alteration。 | `boundaries` 含 display-only/no-cropping/no-recolor；`canOffer` 不包含裁切、强变色类能力；boundary 有 evidence。 | 边界与能力冲突。 |
| A2-08 | `packages/corpus/src/artwork-agent-capsule.test.ts` | 仅有 artworkId/title/imageUrl，artist/year/tags 均缺失。 | 生成最小 capsule；identity.title 保留；缺失字段为空；confidence 偏低；仍满足 parser 最低 evidence 要求。 | 缺字段降级；最小可用 capsule。 |
| A2-09 | `packages/corpus/src/artwork-agent-capsule.test.ts` | description 为 `beautiful nice art good`，tags 泛化，presentation 有清晰 color/composition。 | 泛化文本不生成具体 mood；color/composition 可从可靠字段生成；字段级 confidence 区分噪声。 | 低质量 metadata 污染。 |
| A2-10 | `packages/corpus/src/artwork-agent-capsule.test.ts` | metadata palette 为 red/orange，presentation/retrieval 指向 blue/gray/cool tonality。 | 保留冲突 evidence；合并色彩信号降低 confidence 或分开 declared/observed 来源；不因暖色 metadata 强行输出 energetic mood。 | 多来源冲突；单源覆盖。 |

## Agent 3: Affective Negotiation Reject And Assign

| ID | 测试层 | 输入/条件 | 主要断言 | 覆盖风险 |
| --- | --- | --- | --- | --- |
| A3-01 | `apps/web/test/lib/affective-negotiation.test.ts` | query 表达 `不要太明亮`；候选含 bright/light/joy/celebration/gold 与低亮候选。 | bright alias 候选进入 `rejectedArtworkIds`；未拒候选可分配 stage；trace 标明 hard resistance `bright`。 | bright 别名漏拦。 |
| A3-02 | `apps/web/test/lib/affective-negotiation.test.ts` | query 表达 `不要吵`；候选含 loud/festival/celebration/active/drama 与 calm。 | loud alias 候选被拒；calm 候选保留；stage.artworkIds 不含被拒作品。 | 感官噪声边界失效。 |
| A3-03 | `apps/web/test/lib/affective-negotiation.test.ts` | query 表达 `不要沉重悲伤`；候选含 grief/despair/sorrow/heavy-grief。 | grief alias 候选被拒；trace.signal 标注命中别名或 canonical resistance。 | 创伤性情绪误入。 |
| A3-04 | `apps/web/test/lib/affective-negotiation.test.ts` | query 表达 `不要剧情太满/不要 heavy drama`；候选含 drama/despair/grief/high-contrast 与轻 tension 候选。 | heavy-drama 候选被拒；轻 tension 候选不因相关但不等价的标签被误杀。 | 拒绝边界过宽或过窄。 |
| A3-05 | `apps/web/test/lib/affective-negotiation.test.ts` | 用户 soft prefer muted，无 hard avoid saturated；候选含 saturated 与 muted。 | saturated 可降分但不进 rejected；planner 仍可在综合分更高时选入非结尾 stage。 | 软偏好被错当硬边界。 |
| A3-06 | `apps/web/test/lib/affective-negotiation.test.ts` | hard boundaries 覆盖全部候选。 | GrowthForm 仍有 3 到 5 个 stages；`rejectedArtworkIds` 去重保留；trace 明确 all candidates rejected 或 fallback reason；不崩溃。 | 全拒绝空输出。 |
| A3-07 | `apps/web/test/lib/affective-negotiation.test.ts` | 多个候选分别因 bright、loud、heavy-grief 被拒。 | 每个 rejected candidate 有 trace 记录 `artworkId`、`signal`、message；未拒候选不出现 reject trace。 | trace 不可审计。 |
| A3-08 | `apps/web/test/lib/affective-negotiation.test.ts` | 相同 query、results、backgroundScenes 连续调用 3 次。 | stage roles、stage labels、artwork assignment、trace 顺序完全一致。 | 非确定性导致 replay 不可比。 |
| A3-09 | `apps/web/test/lib/affective-negotiation.test.ts` | 两个安全候选 `combinedScore` 相同，rank/id 不同。 | tie-break 使用稳定规则，重复调用选同一候选；trace 或测试 fixture 可说明依据。 | 同分随机排序。 |
| A3-10 | `apps/web/test/lib/affective-negotiation.test.ts` | 最高分候选命中 hard boundary，低分候选安全。 | 高分被拒候选不得出现在任何 stage.artworkIds；role assignment 只来自 surviving candidates 或明确 fallback。 | 先打分后忽略硬拒。 |

## Agent 4: GrowthForm And GrowthStage Contract

| ID | 测试层 | 输入/条件 | 主要断言 | 覆盖风险 |
| --- | --- | --- | --- | --- |
| A4-01 | `packages/contracts/src/affective-agent.test.ts` | 合法 3-stage GrowthForm fixture。 | `parseGrowthForm` 成功；必填字段完整；stage 含 id/label/role/signals/五个 normalized affect 值/intensity/sceneIntent/transitionIntent/artworkIds。 | 基础 shape 漏字段。 |
| A4-02 | `packages/contracts/src/affective-agent.test.ts` | 合法 4-stage fixture，roles 为 threshold/mirror/turn/afterglow。 | 解析成功；stage ids 唯一；roles 均来自 `GROWTH_STAGE_ROLES`。 | 4 阶段角色序列与枚举。 |
| A4-03 | `packages/contracts/src/affective-agent.test.ts` | 合法 5-stage fixture，roles 为 threshold/mirror/turn/release/afterglow。 | 解析成功；每个 stage 都有 `transitionIntent`，最后一段使用 `return` 或约定 transition，而不是 null。 | 最大阶段数；尾段转场语义。 |
| A4-04 | `packages/contracts/src/affective-agent.test.ts` | 2 stages 与 6 stages 两组 fixture。 | `parseGrowthForm` 均抛错，错误路径指向 `GrowthForm.stages`。 | 阶段数 contract 被破坏。 |
| A4-05 | `packages/contracts/src/affective-agent.test.ts` | stage 数值含 valence=-0.1、arousal=1.2、wonder=null、intimacy=`"0.7"`、intensity=99。 | parser 拒绝越界、null、字符串类型；只接受 number 且范围 `[0, 1]`。 | LLM 数值漂移；类型污染。 |
| A4-06 | `apps/web/test/lib/affective-negotiation.test.ts` | 同 query 与同 supporting/rejected artwork ids 重复构建。 | `GrowthForm.id` deterministic；相同输入输出相同 id、stage id、supporting ids。 | 缓存 key 与 replay 不稳定。 |
| A4-07 | `apps/web/test/lib/affective-negotiation.test.ts` | 同 query，不同 selected/supporting artwork ids。 | GrowthForm id 改变；不会把上一组 stage assignment 串线。 | id 碰撞；跨选择结果串线。 |
| A4-08 | `apps/web/test/lib/affective-negotiation.test.ts` | supportingArtworkIds 与 rejectedArtworkIds 含重复和交叉 id。 | planner 输出应去重；同一 id 不应同时在 supporting/rejected；若输入 parser 只做形状校验，planner 层必须覆盖互斥。 | 重复引用；矛盾归因。 |
| A4-09 | `apps/web/test/lib/affective-negotiation.test.ts` | 有候选或 hard rules 的构建结果。 | `trace.length > 0`，且至少含 user-agent 与 stage trace；当前 parser 可只校验形状，planner test 负责非空语义。 | 不可审计生成。 |
| A4-10 | `apps/web/test/lib/affective-negotiation.test.ts` | temporal stage label 为空或为 `先/再/最后/from/then/finally`。 | build stage label fallback 为 Opening/Turn/Return 或 `Stage N`；输出能被 `parseGrowthForm` 接受。 | 展示标签为空；阶段标签污染。 |

## Agent 5: Gallery Route And BackgroundScene Matching

| ID | 测试层 | 输入/条件 | 主要断言 | 覆盖风险 |
| --- | --- | --- | --- | --- |
| A5-01 | `apps/web/test/lib/gallery-route.test.ts` | stage.signals 含 scene-like value，backgroundScenes 有唯一 matching `sceneType`。 | route/sceneIntent 使用匹配背景，不强制回到 Opening/Drift/Return。 | GrowthForm scene intent 未被消费。 |
| A5-02 | `apps/web/test/lib/gallery-route.test.ts` | stage.signals 含 calm/reflective，backgroundScenes.moods 有对应值。 | 基于 moods 命中背景；多次运行选中结果稳定。 | 只匹配 sceneType，忽略 mood。 |
| A5-03 | `apps/web/test/lib/gallery-route.test.ts` | stage.signals 或 artwork palette 指向 muted-blue/warm-gold，backgroundScenes.palette 重叠。 | 选中 palette 最相关背景；传给 UI 的 route 保留背景 id 与 stage 关系。 | 色彩匹配失效。 |
| A5-04 | `apps/web/test/lib/gallery-route.test.ts` | 一个候选只 mood 弱匹配，另一个 emotionIds 强匹配。 | 按约定权重优先 emotionIds 强相关背景，或在测试中固定 tie-break 说明。 | 情绪意图被弱标签覆盖。 |
| A5-05 | `apps/web/test/lib/gallery-route.test.ts` | artworkPaletteModes 含 dominant/accent，背景支持同样 palette mode。 | 背景选择考虑 artworkPaletteModes；没有该字段时不崩溃。 | 作品色板模式未接入。 |
| A5-06 | `apps/web/test/lib/gallery-route.test.ts` | sceneIntent 与所有 backgroundScenes 不匹配，stage label 对应 Opening/Turn/Return。 | 使用旧 fallback 背景；页面不空白；route shape 与旧逻辑兼容。 | 新 matching 破坏历史兼容。 |
| A5-07 | `apps/web/test/lib/gallery-route.test.ts` | 多个 backgroundScenes 匹配分相同。 | 按固定 id/order/rank tie-break；SSR/CSR 结果一致。 | 背景随机闪烁。 |
| A5-08 | `apps/web/test/lib/gallery-route.test.ts` | GrowthForm 含 4 个 stages，每段 signals/sceneIntent 不同。 | route 生成 4 个节点，不压缩成三段；每段独立匹配背景。 | 路线仍硬编码三段。 |
| A5-09 | `apps/web/test/lib/gallery-route.test.ts` | 无 GrowthForm，仅 legacy curve/Opening/Drift/Return。 | route fallback 完整渲染；旧数据能打开；不访问 growth-only 字段。 | 历史内容损坏。 |
| A5-10 | `apps/web/test/lib/gallery-route.test.ts` | background asset 加载慢或为空，Gallery 首屏需要先渲染 artwork list。 | route 构建不阻塞主内容；可用默认背景或空态；无布局大跳动。 | 背景资源阻塞首屏。 |

## Agent 6: Immersive UI And Scene Orchestrator

| ID | 测试层 | 输入/条件 | 主要断言 | 覆盖风险 |
| --- | --- | --- | --- | --- |
| A6-01 | `packages/ui/src/immersive/scene-orchestrator.test.ts` | GrowthStage label/tone/intensity 映射进 ExhibitionUnit。 | unit 的 `stageLabel`、`stageTone`、`emotionalIntensity` 来自 GrowthForm，不被默认值覆盖。 | 阶段调性丢失。 |
| A6-02 | `packages/ui/src/immersive/scene-orchestrator.test.ts` | `intensity=0`。 | 动画/光效降至最小但关键 artwork 仍显示；无 NaN、无异常样式值。 | 低强度导致空场景。 |
| A6-03 | `packages/ui/src/immersive/scene-orchestrator.test.ts` | `intensity=1`，stage tone 高张力。 | 强度被 clamp 到安全范围；不遮挡 artwork；不产生溢出布局参数。 | 高强度视觉失控。 |
| A6-04 | `packages/ui/src/immersive/scene-orchestrator.test.ts` | 从 stage A 切到 stage B，transitionIntent 从 drift 到 return。 | orchestrator 保留语义化过渡；不重置整个 immersive container；stage 顺序稳定。 | 转场状态错乱。 |
| A6-05 | `packages/ui/src/immersive/immersive-gallery.test.tsx` | stage.artworkIds 为空。 | UI 渲染空态或背景舞台；不请求 undefined artwork；stage label/tone 仍可表达。 | 空数组崩溃。 |
| A6-06 | `packages/ui/src/immersive/immersive-gallery.test.tsx` | stage.artworkIds 为 `["a1", "a1", "a2"]`。 | 去重或稳定处理重复 id；不出现 duplicate key 警告；渲染顺序 deterministic。 | React key 冲突；重复资源加载。 |
| A6-07 | `packages/ui/src/immersive/immersive-gallery.test.tsx` | GrowthForm 数据异步到达，先渲染旧 unit/skeleton 再更新。 | 主容器尺寸稳定；stage metadata 注入不改变首屏结构高度。 | layout shift。 |
| A6-08 | `packages/ui/src/immersive/immersive-gallery.test.tsx` | route 不提供 growthForm，仅 legacy unit。 | 走旧 unit rendering；不访问空 growth 字段；旧体验完整。 | 向后兼容回归。 |
| A6-09 | `packages/ui/src/immersive/immersive-gallery.test.tsx` | stage.label 为超长中文/英文长词。 | label 截断、换行或自适应；不挤压 artwork；小 viewport 不溢出。 | 长文案破坏布局。 |
| A6-10 | `packages/ui/src/immersive/immersive-gallery.test.tsx` | 桌面/平板/手机尺寸，在线 LLM 增强失败或超时。 | 首屏使用本地 GrowthForm/route 数据渲染；LLM 失败不阻塞；各 viewport stage 映射一致。 | 网络依赖阻塞首屏。 |

## Agent 7: Evaluation, Logging, Replay Metrics

| ID | 测试层 | 输入/条件 | 主要断言 | 覆盖风险 |
| --- | --- | --- | --- | --- |
| A7-01 | `scripts/evaluate-intent-immersion.ts` | 运行 50 case replay，开启标准 logging。 | 每条记录包含 caseId、userAgent、artwork capsules、growthForm、rejection reasons、curve metrics、timestamp、version/runId。 | 评测只记总分，缺诊断字段。 |
| A7-02 | `scripts/evaluate-intent-immersion.ts` | 同代码版本、同 seed、同 100 case 输入集连续运行两次。 | intent、rejection reasons、stage metrics、summary 指标完全一致。 | 非确定性 replay。 |
| A7-03 | `scripts/evaluate-intent-immersion.ts` | 构造明确 resistance violation、boundary violation、无 violation 的混合样本。 | violation count/rate 与按 reason/stage 分组统计准确；不重复计数。 | 违规统计偏差。 |
| A7-04 | `scripts/evaluate-intent-immersion.ts` | 运行多 stage growth progression 样本。 | 每个 stage 均记录 curve metric；stage 顺序、id、分数变化可追溯。 | 只能看到最终分，无法定位曲线失真。 |
| A7-05 | `scripts/evaluate-intent-immersion.ts` | case fixture 含 reviewer verdict/notes/severity/expected behavior。 | 输出日志和 summary 保留人工评审字段；不覆盖、不自动改写。 | 人工评审无法与机器评测对齐。 |
| A7-06 | `scripts/evaluate-intent-immersion.ts` | 运行含失败 case 的 replay。 | summary 列出 failed caseId、失败原因、关键字段快照、回放定位信息。 | 只有总通过率，无法复现。 |
| A7-07 | `scripts/evaluate-intent-immersion.ts` | 同一 100 case 输入集分别跑 baseline 与 candidate。 | 输出 per-case diff、总体 delta、regression/improvement count、关键 metric 差值。 | 不能比较迭代结果。 |
| A7-08 | `scripts/evaluate-intent-immersion.ts` | 完整 replay 后生成 summary。 | summary 含 total cases、pass/fail、rejection 分布、resistance violation rate、curve metric 聚合、run metadata。 | 报告缺趋势判断指标。 |
| A7-09 | `scripts/evaluate-intent-immersion.ts` | case 输入含长原始 prompt 或疑似个人信息。 | 日志保留必要 userAgent/case reference；原文按策略脱敏或只存 hash/reference；不无意复制敏感数据。 | 评测日志成为敏感数据副本。 |
| A7-10 | `scripts/evaluate-intent-immersion.ts` | 输入缺 artwork capsules、growthForm 异常、rejection reason 格式错误。 | case 标记 invalid/error；记录缺失字段与 caseId；replay 继续执行并进入 summary。 | 单个坏样本中断整体 replay。 |

## Agent 8: Robustness, Failure, Malformed Data

| ID | 测试层 | 输入/条件 | 主要断言 | 覆盖风险 |
| --- | --- | --- | --- | --- |
| A8-01 | `packages/corpus` / `apps/web` | query 为空字符串或 whitespace only。 | 不崩溃；不触发无意义远端请求；返回空态或默认本地结果；快路径保持可用。 | 空输入。 |
| A8-02 | `packages/corpus` / `apps/web` | 10k+ 字符 query。 | 被截断、拒绝或安全处理；无卡死；渐进加载状态可恢复。 | 性能退化；解析溢出。 |
| A8-03 | `packages/corpus` / `apps/web` | query 为 emoji、HTML、SQL-like、URL 符号混合。 | 搜索和解析流程正常完成；展示不乱码；无注入副作用。 | 特殊字符与编码。 |
| A8-04 | `apps/web/test/lib/affective-negotiation.test.ts` | `results=[]`。 | GrowthForm 或空态按约定返回；不误报系统失败；backgroundScenes 可独立加载。 | 空结果。 |
| A8-05 | `packages/contracts` / `apps/web` | result 或 artwork 关键字段全缺。 | parser 拒绝或 planner 过滤该条；不产生 undefined artwork；错误隔离到单条数据。 | 脏数据污染。 |
| A8-06 | `packages/contracts/src/affective-agent.test.ts` | normalized 字段为 -0.1、1.2、字符串 `"0.5"`。 | parser 拒绝越界或类型错误；不写入可用结构。 | 数值边界失效。 |
| A8-07 | `packages/contracts/src/affective-agent.test.ts` | `AffectSignal.kind="alien"`、`GrowthStage.role="opening"`、`transitionIntent="warp"`。 | runtime parser 拒绝未知 enum；不静默 fallback。 | enum 扩展误入。 |
| A8-08 | `apps/web/test/lib/affective-negotiation.test.ts` | results 中多个候选 artwork.id 相同但分数/字段不同。 | 去重策略稳定；不重复展示；assignment deterministic。 | 重复数据与排序抖动。 |
| A8-09 | `apps/web/test/lib/affective-negotiation.test.ts` | score/combinedScore 为 NaN、Infinity、负数。 | 非有限分数被拒绝或默认安全值；负分不污染排名；整体不中断。 | 异常分数污染。 |
| A8-10 | `apps/web/test/lib/gallery-route.test.ts` | `backgroundScenes=[]` 或缺失。 | 不阻塞 search/manifest；使用默认背景或无背景空态；快路径继续。 | 背景资源缺失。 |

## Agent 9: End-To-End Product Journeys

| ID | 测试层 | 输入/条件 | 主要断言 | 覆盖风险 |
| --- | --- | --- | --- | --- |
| A9-01 | E2E/replay case | Landing 输入 `睡前想平静一点，但不要空灵鸡汤`，进入 Gallery，再进入 Immersive。 | 识别 bedtime/restful 但 hard avoid empty-cliche；Gallery 低刺激；Immersive 节奏安静。 | preset 化；过度兴奋。 |
| A9-02 | E2E/replay case | `刚分手，但我不想看悲伤的东西`。 | 同时理解 breakup memory/current state 与 no-sad hard boundary；推荐恢复感、非恋爱中心作品；文案不煽情。 | 情绪误读；推悲伤内容。 |
| A9-03 | E2E/replay case | `今天拿到 offer，想庆祝，但要高级克制`。 | celebration 作为 desire；俗套烟花/金色/party 作为 soft/hard avoid；输出明亮但克制。 | celebration preset 化。 |
| A9-04 | E2E/replay case | `想和很亲近的人一起看点温柔的，但不要太恋爱脑`。 | intimate/companionship 与 romance-overload 区分；避免情话式输出。 | 亲密被单一路径解释成 romance。 |
| A9-05 | E2E/replay case | `和 7 岁孩子睡前一起看，有趣但别吓人`。 | family/child context 进入 memory/spatial/tone；scary/adult/heavy-drama 被拒；解释语言更清楚。 | 家庭场景与儿童安全。 |
| A9-06 | E2E/replay case | `我想看让我消失的画`。 | 识别潜在风险；不强化自伤意象；进入稳定、陪伴、求助导向或安全降级体验；主链路不崩溃。 | 危机输入与产品体验兼容。 |
| A9-07 | E2E/replay case | `有点 overwhelmed，想看 something quiet but alive`。 | 中英混合解析；quiet 与 alive 同时进入 desires；输出语言风格跟随用户。 | 双语 NLU 退化。 |
| A9-08 | E2E/replay case | 用户快速改写三次：`想平静` -> `不要太冷` -> `更有人味一点`。 | 最终 Gallery 只反映最新输入；旧请求不会覆盖新结果；loading/cancel/retry 状态清晰。 | 并发竞态；陈旧结果覆盖。 |
| A9-09 | E2E/replay case | Immersive 分享当前体验链接，接收者打开后返回 Gallery。 | 分享状态保留必要 personalization，不暴露敏感原文；返回 Gallery 状态一致；不强制走 preset 流。 | 分享恢复；隐私泄露。 |
| A9-10 | E2E/replay case | Landing 输入后网络断开或画作数据超时。 | 不依赖在线 multi-agent runtime；使用本地/缓存数据或明确降级；用户仍能进入可用体验。 | 离线与慢数据。 |

## Agent 10: Contract, Parser, Backwards Compatibility

| ID | 测试层 | 输入/条件 | 主要断言 | 覆盖风险 |
| --- | --- | --- | --- | --- |
| A10-01 | `packages/contracts/src/affective-agent.test.ts` | 合法 `UserAffectAgent`、`ArtworkAgentCapsule`、`GrowthForm` fixture，normalized 值含 0 和 1。 | 三个 parser 均成功；返回结构字段名、层级、数组形态与 contract 快照一致。 | contract shape 漂移。 |
| A10-02 | `packages/contracts/src/affective-agent.test.ts` | 分别删除 root 必填字段与关键 nested 必填字段。 | parser 抛 schema error；错误路径指向缺失字段。 | 必填字段被意外 optional 化。 |
| A10-03 | `packages/contracts/src/affective-agent.test.ts` | 任一 enum 字段改为 `unknown_value` 或 `__future__`。 | runtime parser 拒绝；不静默 fallback。 | 未知协议版本被错误接受。 |
| A10-04 | `packages/contracts/src/affective-agent.test.ts` | `AestheticConstraint.polarity="mixedish"`、`severity="criticalish"`。 | `parseUserAffectAgent` 失败。 | 情绪判断维度污染。 |
| A10-05 | `packages/contracts/src/affective-agent.test.ts` | `AestheticRule.action="teleport"`、`GrowthStage.role="super_admin"`。 | `parseGrowthForm` 失败；不得映射到默认 action/role。 | planner 权限/角色语义漂移。 |
| A10-06 | `packages/contracts/src/affective-agent.test.ts` | `transitionIntent="warp"`。 | `parseGrowthForm` 失败。 | 非法转场状态污染。 |
| A10-07 | `packages/contracts/src/affective-agent.test.ts` | `ArtworkAgentCapsule.evidence=[]`、字符串、缺失三组。 | 空 evidence 与错误类型被拒；缺失 evidence 报明确路径；信号 `evidenceIds` 必须能对应 evidence。 | 无证据推断进入下游。 |
| A10-08 | `packages/contracts/src/affective-agent.test.ts` | normalized 字段设为 -0.01、1.01、NaN、字符串 `"0.5"`。 | parser 只接受 number 且范围 `[0, 1]`；越界与非数值拒绝。 | 评分归一化失效。 |
| A10-09 | `packages/contracts/src/affective-agent.test.ts` | root 与 nested object 注入 `extraField`。 | 按当前 validation 策略固定行为：若允许 extra，则返回值不应泄漏未声明字段；若改为 strict，应全量更新 fixture。 | 隐式扩展字段泄漏。 |
| A10-10 | `packages/contracts/src/index.ts` / legacy consumers | 从 package index 导入三个 parser 与相关类型；旧 curve/gallery fallback fixture 仍存在。 | public exports 可用；没有 GrowthForm 时旧 curve/gallery fallback 仍工作。 | 对外导出断裂；旧消费方回归。 |
