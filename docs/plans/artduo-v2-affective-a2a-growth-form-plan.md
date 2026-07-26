---
title: ArtDuo V2 Affective A2A Growth Form Implementation Plan
status: draft-ready-for-execution
created: 2026-06-11
updated: 2026-06-11
origin: user discussion: user input as affective agent, artworks as standardized artwork agents
method: superpowers-gsd-plan-phase-adapted
---

# ArtDuo V2 情绪 A2A 生长形式实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: use Superpowers/GSD plan execution discipline. Work task by task, update checkboxes, and do not jump to UI polish before contracts, parser tests, negotiation tests, and evaluation logs pass.

## Goal

把当前的 `用户输入 -> intentSignals -> 三段情绪曲线 -> 沉浸式路线` 升级为：

```text
User Affect Agent -> Artwork Agent Capsules -> Affective Negotiation -> Growth Form -> Gallery / Immersive Experience
```

核心目标不是增加几个情绪 preset，而是让用户输入被理解为一个带人格、情绪、抗拒和记忆线索的 agent；画作被封装为有证据约束的子 agent；情绪曲线、美学规则、场景路线从双方的对接中动态生长出来。

## Current Context

当前已存在的基础：

- `packages/corpus/src/query-embedding.ts` 已能把中英文输入归一化为检索 tokens。
- `apps/web/lib/curation-narrative.ts` 已输出 `intentSignals` 和三段 `curve`。
- `apps/web/lib/gallery-route.ts` 已用三段 `Opening / Drift / Return` 为场景路线选背景。
- `packages/ui/src/immersive/scene-orchestrator.ts` 已支持 unit-level 的 `stageLabel`、`stageTone`、`emotionalIntensity`。
- `scripts/evaluate-intent-immersion.ts` 已有 50 组输入、输出记录和评分回放。

这次升级应复用这些基础，不重写 release catalog，不改变当前检索主路径，不让 LLM 成为首屏必需依赖。

## Review Addendum: Execution Gaps Closed Before Build

Review date: 2026-06-11

Findings from the plan review:

- The target architecture is sound, but the original draft under-specified parser-level details for signal evidence, aesthetic rules, trace entries, and deterministic IDs. Task 1 now treats these as contract-owned public structures, not planner-local shapes.
- The web integration must adapt to the current `WebSearchResult["results"]` shape, where gallery-ready artwork fields are flattened for UI consumption. The planner should not assume raw `ArtworkRecord` objects are available in web search results.
- The existing worktree already contains user changes in several target files. Implementation must read the current file before editing and must not revert unrelated edits.
- The project does not currently expose a `.planning/` GSD workspace. For this phase, Superpowers/GSD is applied as execution discipline over this document: route as a complex architecture phase, work task-by-task, update checkboxes when completed, and keep verification gates intact.
- Multi-agent review/execution is not used unless the user explicitly authorizes sub-agents. The workflow remains GSD-shaped, but execution stays in the main thread.

Additional acceptance rules:

- All new contract parsers must reject unknown invalid enum values and out-of-range normalized affect numbers.
- Every `ArtworkAgentCapsule` derived from artwork data must include evidence on derived signals; planner-generated fallback capsules may only use evidence already exposed by web search results.
- `GrowthForm.id` must be deterministic for the same query and selected artwork ids.
- `GrowthForm.trace` must be non-empty whenever there are candidate artworks or hard rules.
- Backwards compatibility is mandatory: existing `curve`, gallery route fallback, and immersive unit rendering must still work when no growth form is supplied.

## Non-Goals

- 不把 `settle / rise / mystery / longing` 等 archetype 作为主生成入口。
- 不让画作 agent 凭空生成性格、情绪或解释。
- 不在 Phase 1 里引入在线多 agent runtime、远程 LLM 协商或持久记忆库。
- 不改变 release manifest 的 public shard 结构，除非有独立 contract 和迁移计划。
- 不阻塞现有 `Landing -> Gallery -> Immersive` 快路径。

## Product Principle

预设可以用于测试、兜底和诊断，但不能成为用户体验的主路径。

主路径要遵守规则：

- 用户明确说“不想要”的状态必须成为 hard boundary。
- 用户说出的阶段词必须影响曲线控制点。
- 色彩、空间、身体感和记忆线索不能只当标签，要进入美学规则。
- 每个画作 agent 的回应必须能追溯到 metadata、retrieval、presentation 或 scene affinity。
- 情绪曲线不能直接用检索相关性分数代替。
- 文案可以诗性，但机器可读结构必须稳定。

## Target Architecture

### 1. User Affect Agent

从原始输入生成一个轻量、可测试的用户 agent：

```ts
interface UserAffectAgent {
  sourceText: string;
  languageHints: string[];
  desires: AffectSignal[];
  resistances: AffectSignal[];
  memoryHints: MemoryHint[];
  visualConstraints: AestheticConstraint[];
  spatialNeeds: SpatialNeed[];
  temporalShape: TemporalShape;
  currentState: AffectState;
  desiredState?: AffectState;
  confidence: number;
}
```

示例：

```text
不要太明亮，想要暗红和深木色，像睡前，但不要悲伤
```

应生成：

- `resistances`: bright, loud, despair, heavy-grief
- `desires`: quiet, intimate, low-light, held
- `visualConstraints`: burgundy, walnut, muted, low-contrast
- `memoryHints`: bedtime
- `temporalShape`: settle, slow, single-peak max

### 2. Artwork Agent Capsule

每件画作只暴露一个标准 capsule，不直接把完整 artwork 对象丢进 planner：

```ts
interface ArtworkAgentCapsule {
  artworkId: string;
  identity: {
    title: string;
    artistDisplayName?: string;
    yearLabel?: string;
  };
  canOffer: AffectSignal[];
  boundaries: AffectSignal[];
  aesthetics: AestheticSignal[];
  sceneAffinity: SceneSignal[];
  motionAffinity: MotionSignal[];
  evidence: CapsuleEvidence[];
  confidence: number;
}
```

`canOffer` 和 `aesthetics` 可以来自 `moodTags`、`emotionLabels`、`colorTags`、`subjectTags`、`compositionTags`、`sceneAffinity`、`motionProfile`。

`boundaries` 用于表达“不适合承担的体验”，例如：高戏剧张力作品不适合作为“睡前但不要悲伤”的结尾。

### 3. Affective Negotiation

Negotiation 不是聊天，而是一个纯函数式 planner：

```text
UserAffectAgent + ArtworkAgentCapsule[] + BackgroundScene[] -> GrowthForm
```

它做四件事：

1. 过滤违反 user hard boundaries 的候选。
2. 为作品分配旅程角色：threshold、mirror、turn、release、afterglow。
3. 生成动态控制点：数量可为 3 到 5，不固定为三段。
4. 生成可解释的 negotiation trace，供评测和 debug 使用。

### 4. Growth Form

Growth Form 是输出给 narrative、gallery route、immersive 的统一结构：

```ts
interface GrowthForm {
  id: string;
  sourceText: string;
  stages: GrowthStage[];
  rules: AestheticRule[];
  supportingArtworkIds: string[];
  rejectedArtworkIds: string[];
  trace: NegotiationTrace[];
}

interface GrowthStage {
  id: string;
  label: string;
  role: "threshold" | "mirror" | "turn" | "release" | "afterglow";
  signals: AffectSignal[];
  valence: number;
  arousal: number;
  tension: number;
  wonder: number;
  intimacy: number;
  intensity: number;
  sceneIntent: string;
  transitionIntent: "fade" | "drift" | "push" | "hold" | "return";
  artworkIds: string[];
}
```

## File Responsibility Map

Create or modify these files:

- `packages/contracts/src/affective-agent.ts`: shared types and runtime parsers for User Affect Agent, Artwork Agent Capsule, Growth Form.
- `packages/contracts/src/affective-agent.test.ts`: parser and fixture coverage.
- `packages/contracts/src/index.ts`: export new contract module.
- `packages/corpus/src/affective-intent.ts`: deterministic query-to-user-agent extraction.
- `packages/corpus/src/affective-intent.test.ts`: multilingual, negative intent, stage-word, memory-hint tests.
- `packages/corpus/src/artwork-agent-capsule.ts`: derive artwork capsules from `ArtworkRecord`.
- `packages/corpus/src/artwork-agent-capsule.test.ts`: evidence and boundary coverage.
- `packages/corpus/src/index.ts`: export new corpus helpers.
- `apps/web/lib/affective-negotiation.ts`: build `GrowthForm` from web search results and background scenes.
- `apps/web/test/lib/affective-negotiation.test.ts`: planner behavior tests.
- `apps/web/lib/curation-narrative.ts`: consume `GrowthForm`, keep backwards-compatible `curve`.
- `apps/web/lib/gallery-route.ts`: allow scene route stages to follow `GrowthForm`.
- `packages/ui/src/immersive/scene-orchestrator.ts`: carry growth stage fields through immersive units.
- `packages/ui/src/immersive/immersive-gallery.tsx`: render growth-aware stage tone and intensity without layout shift.
- `scripts/evaluate-intent-immersion.ts`: record user agent, artwork capsules, growth form, rejection reasons, and curve metrics.
- `output/intent-immersion-eval/summary.md`: add growth-form iteration results after implementation.

## Implementation Tasks

## Task 0: Establish Baseline and Guardrails

**Files:**

- Read: `apps/web/lib/curation-narrative.ts`
- Read: `apps/web/lib/gallery-route.ts`
- Read: `scripts/evaluate-intent-immersion.ts`
- Read: `output/intent-immersion-eval/iteration-5.md`

- [ ] **Step 1: Run current verification**

```bash
pnpm --filter @artduo/contracts test
pnpm --filter @artduo/corpus test
pnpm --filter @artduo/web test
pnpm --filter @artduo/corpus typecheck
pnpm --filter @artduo/web typecheck
pnpm tsx scripts/evaluate-intent-immersion.ts growth-form-baseline
```

Acceptance criteria:

- All five package commands exit 0.
- `output/intent-immersion-eval/growth-form-baseline.json` exists.
- `growth-form-baseline.json` contains 50 results.
- Baseline average total score is recorded in `output/intent-immersion-eval/summary.md`.

## Task 1: Freeze Affective A2A Contracts

**Files:**

- Create: `packages/contracts/src/affective-agent.ts`
- Create: `packages/contracts/src/affective-agent.test.ts`
- Modify: `packages/contracts/src/index.ts`

- [x] **Step 1: Add contract tests first**

Tests must assert these exported names exist:

```ts
parseUserAffectAgent
parseArtworkAgentCapsule
parseGrowthForm
```

Tests must cover:

- `UserAffectAgent.desires` and `resistances` accept canonical signals.
- `ArtworkAgentCapsule.evidence` requires at least one source ref.
- `GrowthStage.valence`, `arousal`, `tension`, `wonder`, `intimacy`, and `intensity` are normalized numbers between 0 and 1.
- `GrowthForm.stages` accepts 3 to 5 stages.
- `GrowthForm.rules` preserves rule severity as `hard`, `soft`, or `diagnostic`.

- [x] **Step 2: Implement contracts and parsers**

Use these exact exported type names:

```ts
export type AffectSignalKind = "emotion" | "resistance" | "memory" | "visual" | "spatial" | "tempo";
export type GrowthStageRole = "threshold" | "mirror" | "turn" | "release" | "afterglow";
export type AestheticRuleSeverity = "hard" | "soft" | "diagnostic";

export interface AffectState {
  valence: number;
  arousal: number;
  tension: number;
  wonder: number;
  intimacy: number;
}
```

Acceptance criteria:

- `packages/contracts/src/affective-agent.ts` contains `export interface UserAffectAgent`.
- `packages/contracts/src/affective-agent.ts` contains `export interface ArtworkAgentCapsule`.
- `packages/contracts/src/affective-agent.ts` contains `export interface GrowthForm`.
- `packages/contracts/src/index.ts` exports `./affective-agent`.
- `pnpm --filter @artduo/contracts test` exits 0.

## Task 2: Build User Affect Agent Extraction

**Files:**

- Create: `packages/corpus/src/affective-intent.ts`
- Create: `packages/corpus/src/affective-intent.test.ts`
- Modify: `packages/corpus/src/index.ts`
- Read: `packages/corpus/src/query-embedding.ts`

- [x] **Step 1: Implement deterministic extraction**

Add:

```ts
export function buildUserAffectAgent(input: string): UserAffectAgent
```

The implementation must read from the same alias vocabulary patterns as `query-embedding.ts`, but produce structured dimensions instead of search tokens.

Required extraction behavior:

- `不要太明亮，想要暗红和深木色` sets `bright` as resistance and `burgundy`, `walnut`, `low-light` as visual constraints.
- `先安静，再惊叹，最后回到平静` creates at least three temporal stages.
- `像睡前，但不要悲伤` creates a `bedtime` memory hint and a `heavy-grief` resistance.
- `I want joy but not cartoonish happiness` keeps `joy` as desire and adds `cartoonish` as resistance.
- `desire in a quiet room, not loud romance` keeps `desire` and `quiet`, rejects `loud`.

Acceptance criteria:

- `packages/corpus/src/affective-intent.test.ts` includes the five inputs above.
- `pnpm --filter @artduo/corpus test` exits 0.
- `pnpm --filter @artduo/corpus typecheck` exits 0.

## Task 3: Build Artwork Agent Capsules

**Files:**

- Create: `packages/corpus/src/artwork-agent-capsule.ts`
- Create: `packages/corpus/src/artwork-agent-capsule.test.ts`
- Modify: `packages/corpus/src/index.ts`
- Read: `packages/contracts/src/artwork.ts`

- [x] **Step 1: Derive capsules from `ArtworkRecord`**

Add:

```ts
export function buildArtworkAgentCapsule(artwork: ArtworkRecord): ArtworkAgentCapsule
```

Rules:

- `moodTags` and `emotionLabels` become `canOffer`.
- `colorTags`, `compositionTags`, and `sceneAffinity.paletteModes` become `aesthetics`.
- `sceneAffinity.sceneTypes` and `sceneAffinity.spatialModes` become `sceneAffinity`.
- `motionProfile` becomes `motionAffinity`.
- Every derived signal must include `CapsuleEvidence`.
- `boundaries` must include at least:
  - `high-arousal` when `energyLevel` is `high`
  - `heavy-drama` when tags include `drama`, `despair`, or `grief`
  - `bright` when valence is `bright` or tags include `bright`

Acceptance criteria:

- Test fixtures prove an artwork with `moodTags: ["serenity"]` can offer `serenity`.
- Test fixtures prove an artwork with `colorTags: ["burgundy"]` exposes a visual/aesthetic `burgundy` signal.
- Test fixtures prove high-energy artwork creates a `high-arousal` boundary.
- `pnpm --filter @artduo/corpus test` exits 0.

## Task 4: Implement Affective Negotiation Planner

**Files:**

- Create: `apps/web/lib/affective-negotiation.ts`
- Create: `apps/web/test/lib/affective-negotiation.test.ts`
- Read: `apps/web/lib/release-catalog.ts`
- Read: `apps/web/lib/gallery-route.ts`

- [x] **Step 1: Build planner entrypoint**

Add:

```ts
export function buildAffectiveGrowthForm(input: {
  query: string;
  results: WebSearchResult["results"];
  backgroundScenes: WebBackgroundScene[];
}): GrowthForm
```

Planner rules:

- Hard resistances reduce or reject candidate roles.
- Stage words from `UserAffectAgent.temporalShape` decide stage count and endpoint.
- Without explicit stages, generate 3 stages.
- With explicit `先 / 再 / 最后` or `from / then / finally`, generate 3 to 5 stages.
- Each stage must have at least one artwork id when enough results exist.
- Intensity is derived from affect dimensions, not from `combinedScore` alone.
- Rejected artwork ids must include a trace reason.

Acceptance criteria:

- `不要太明亮，想要暗红和深木色` produces a hard rule that rejects or downranks `bright`.
- `先安静，再惊叹，最后回到平静` produces first and last stages with lower arousal than the middle stage.
- `开头孤独，中段有神秘，最后要有希望` produces stage signals containing melancholy, mystery, and hope in order.
- `pnpm --filter @artduo/web test` exits 0.

## Task 5: Wire Growth Form into Narrative and Route

**Files:**

- Modify: `apps/web/lib/curation-narrative.ts`
- Modify: `apps/web/lib/gallery-route.ts`
- Modify: `apps/web/app/gallery/page.tsx`
- Modify: `apps/web/test/lib/curation-narrative.test.ts`
- Modify: `apps/web/test/lib/gallery-route.test.ts`

- [x] **Step 1: Keep backwards compatibility**

`CurationNarrative` should add:

```ts
growthForm: GrowthForm;
```

Keep existing fields:

```ts
title
preface
closing
curve
intentSignals
```

`curve` should be derived from `growthForm.stages`, so existing UI still works.

- [x] **Step 2: Make route stage-aware**

`buildGallerySceneRoute` should accept optional `growthForm`.

Route behavior:

- If `growthForm` exists, use `GrowthStage.sceneIntent`, `signals`, `transitionIntent`, and stage artwork ranges.
- If `growthForm` is absent, keep current `ROUTE_STAGES` fallback.

Acceptance criteria:

- Existing gallery tests still pass without passing `growthForm`.
- New tests prove `growthForm.stages.length` drives route stop count when supplied.
- `apps/web/lib/curation-narrative.ts` no longer uses result `combinedScore` as the primary emotional intensity source.
- `pnpm --filter @artduo/web test` exits 0.

## Task 6: Carry Growth Form into Immersive Units

**Files:**

- Modify: `packages/ui/src/immersive/scene-orchestrator.ts`
- Modify: `packages/ui/src/immersive/immersive-gallery.tsx`
- Modify: `packages/ui/src/immersive/immersive-gallery.test.tsx`
- Modify: `apps/web/app/gallery/[id]/immersive/page.tsx`

- [x] **Step 1: Extend unit fields safely**

Add optional fields to `ImmersiveGalleryUnit`:

```ts
growthStageId?: string;
growthStageRole?: GrowthStageRole;
affectState?: AffectState;
transitionIntent?: "fade" | "drift" | "push" | "hold" | "return";
```

Rules:

- Optional only. Existing immersive data must still render.
- No UI text should overflow or shift layout when stage labels are longer.
- Transition family resolution must still use existing registry fallback.

Acceptance criteria:

- `packages/ui/src/immersive/scene-orchestrator.ts` contains `growthStageId?: string`.
- Existing immersive tests pass.
- `pnpm --filter @artduo/ui test` exits 0.

## Task 7: Upgrade Evaluation and Output Records

**Files:**

- Modify: `scripts/evaluate-intent-immersion.ts`
- Modify: `output/intent-immersion-eval/summary.md`

- [x] **Step 1: Log A2A structures**

Each evaluation result must record:

```ts
userAgent
growthForm
negotiationTrace
rejectedArtworkIds
curveMetrics
```

`curveMetrics` should include:

- `stageCount`
- `peakCount`
- `startsNearRequestedState`
- `endsNearRequestedState`
- `hardResistanceViolations`

- [x] **Step 2: Add growth-form scoring**

Add a score component that rewards:

- ordered stage intent match
- hard resistance compliance
- curve continuity
- evidence coverage
- route and scene agreement

Acceptance criteria:

- `pnpm tsx scripts/evaluate-intent-immersion.ts growth-form-v1` exits 0.
- `output/intent-immersion-eval/growth-form-v1.json` contains 50 results.
- Every result contains `output.growthForm`.
- `hardResistanceViolations` is 0 for T24, T36, T39, T46.
- `summary.md` records baseline and `growth-form-v1` metrics.

## Task 8: Verification Loop

**Files:**

- Read: all files modified in Tasks 1 to 7
- Modify: only targeted fixes from failures

- [x] **Step 1: Full verification**

Run:

```bash
pnpm --filter @artduo/contracts test
pnpm --filter @artduo/corpus test
pnpm --filter @artduo/web test
pnpm --filter @artduo/contracts typecheck
pnpm --filter @artduo/corpus typecheck
pnpm --filter @artduo/web typecheck
pnpm tsx scripts/evaluate-intent-immersion.ts growth-form-final
```

Acceptance criteria:

- All commands exit 0.
- `output/intent-immersion-eval/growth-form-final.json` contains 50 results.
- Average total score is not lower than `iteration-5`.
- Low intent cases remain 0.
- No case has hard resistance violations.
- At least 45 of 50 cases include non-empty `growthForm.trace`.

## Verification Matrix

| Capability | Test or Check |
| --- | --- |
| User input becomes affective agent | `affective-intent.test.ts` |
| Artwork becomes evidence-bound capsule | `artwork-agent-capsule.test.ts` |
| No preset main path | `affective-negotiation.test.ts` checks dynamic stages |
| Growth form drives curve | `curation-narrative.test.ts` |
| Growth form drives route | `gallery-route.test.ts` |
| Immersive can consume stage metadata | `immersive-gallery.test.tsx` |
| 50-case replay records outputs | `scripts/evaluate-intent-immersion.ts growth-form-final` |

## Rollout Strategy

1. Land contracts and parser tests first.
2. Land corpus capsule derivation second.
3. Land negotiation planner behind pure function tests.
4. Wire narrative and route with fallback behavior.
5. Wire immersive optional fields.
6. Run 50-case evaluation and compare against `iteration-5`.

This keeps the current product path intact while upgrading the semantic core.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Agent language becomes fictional | Require `CapsuleEvidence` on every artwork signal. |
| Rules become another hidden preset system | Store rules as constraints and traces, not route templates. |
| Curve gets unstable | Clamp dimensions, limit stage count to 3 to 5, enforce continuity. |
| Chinese poetic copy hides machine mismatch | Evaluate canonical `growthForm` signals separately from visible copy. |
| Existing gallery breaks | Keep `curve` and `buildGallerySceneRoute` fallback behavior. |

## Done Definition

The upgrade is done when:

- The A2A types are exported from `packages/contracts`.
- User input extraction returns structured desires, resistances, memory hints, visual constraints, and temporal shape.
- Artwork capsules expose evidence-bound offers, boundaries, and aesthetics.
- `buildAffectiveGrowthForm` creates dynamic stages without choosing a preset.
- Narrative, route, and immersive units consume `GrowthForm` while preserving backwards compatibility.
- The 50-case evaluation records `userAgent`, `growthForm`, `trace`, and resistance violations.
- All package tests and typechecks pass.
