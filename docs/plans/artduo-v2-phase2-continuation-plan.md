# ArtDuo V2 Phase 2 Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continue from the closed Phase 1 thin slice into Phase 2 by adding durable curation sessions, artwork explanations, and the required safety/cost boundaries without breaking the fast release-backed gallery path.

**Architecture:** Keep Phase 1's release-backed `Landing -> Gallery -> Detail` path as the fast path. Add `v0.2` contracts first, then pure API route helpers with in-memory adapters for tests, then connect the web app to session/explanation endpoints. SSE remains an enhancement; polling/status APIs must work without SSE.

**Tech Stack:** pnpm workspace, Next.js App Router in `apps/web`, TypeScript route/helper modules in `apps/api`, shared contracts in `packages/contracts`, release/corpus helpers in `packages/corpus`, Node test runner, Playwright.

---

## Resume Context

Read these first after any conversation break:

1. `README.md`
2. `docs/plans/artduo-v2-lightweight-rebuild-plan.md`
3. `data/curation/reports/phase1-closeout-report.md`
4. This file

Then run:

```bash
git status --short --branch
pnpm preflight:check
pnpm vector:benchmark -- --release-version 2026-04-25-curation-b --output /tmp/artduo-phase2-resume-vector-benchmark.json
```

Expected baseline:

- `pnpm preflight:check` passes.
- Playwright reports 4 passing E2E tests.
- Vector benchmark reports 24 prompts, rerank Top-1 `0.958333`, rerank Top-5 `1`.
- `http://127.0.0.1:3210` may already be running for manual debug; E2E defaults to 3211.

Do not start Phase 2 work by changing release data, curation reports, or old `frontend/` donor code.

## PR Boundary Before Phase 2

Phase 1 should be committed before Phase 2 feature work.

Recommended commit slices:

1. Data/release artifacts: `data/curation/**`, `data/releases/**`, `data/sources/**` for `2026-04-25-curation-b`.
2. Product thin slice: `apps/web/**`.
3. Repeatable acceptance: root `package.json`, `apps/web/playwright.config.ts`, `apps/web/scripts/playwright-web-server.mjs`, `.gitignore`.
4. Closeout docs: `README.md`, `docs/plans/artduo-v2-lightweight-rebuild-plan.md`, `data/curation/reports/phase1-closeout-report.md`, this continuation plan.

Keep `.DS_Store` deletion and `.gitignore` rules. Do not commit `.codex/`, `.next/`, `dist/`, `test-results/`, or `playwright-report/`.

## File Responsibility Map

Phase 2 should create or modify these files:

- `packages/contracts/src/curation-session.ts`: `CurationSession`, request/response, status, ownership token contracts.
- `packages/contracts/src/artwork-explanation.ts`: `ArtworkExplanation`, pending/ready/failed states, cache source metadata.
- `packages/contracts/src/curation-events.ts`: stream/poll event union, status event semantics.
- `packages/contracts/src/index.ts`: export v0.2 contracts.
- `packages/contracts/fixtures/*.json`: pending/ready/failed fixture examples for sessions and explanations.
- `apps/api/src/services/auth/session-token.ts`: signed or opaque ownership token helper.
- `apps/api/src/services/http/idempotency-store.ts`: deterministic create-session idempotency helper.
- `apps/api/src/services/http/rate-limit.ts`: per-token and per-IP budget guard primitive.
- `apps/api/src/services/privacy/request-redaction.ts`: user text redaction for logs.
- `apps/api/src/services/privacy/retention-policy.ts`: explicit retention windows for raw and redacted fields.
- `apps/api/src/services/curation/session-store.ts`: first in-memory session store for tests and local runtime.
- `apps/api/src/services/curation/budget-guard.ts`: explanation/session budget checks.
- `apps/api/src/services/explanations/explanation-cache.ts`: artwork explanation cache keyed by artwork/release/user context hash.
- `apps/api/src/services/explanations/get-artwork-explanation.ts`: explanation lookup/generation boundary.
- `apps/api/src/routes/curations.ts`: pure route helpers for create/read curation sessions.
- `apps/api/src/routes/curation-stream.ts`: optional event stream helper over the same event contract.
- `apps/api/src/routes/artworks.ts`: pure route helper for artwork explanation.
- `apps/api/test/**/*.test.ts`: route and service coverage.
- `apps/web/lib/curation-client.ts`: web client for session creation/status.
- `apps/web/lib/explanation-client.ts`: web client for artwork explanations.
- `apps/web/lib/session-state.ts`: mapping from local exhibition snapshot to server session state.
- `apps/web/app/artwork/[id]/page.tsx`: keep metadata-first rendering, add non-blocking explanation slot.
- `apps/web/e2e/*.spec.ts`: Phase 2 browser checks.

## Non-Negotiable Rules

- Do not block Gallery rendering on session creation or explanation generation.
- Do not require SSE for a successful user path.
- Do not write raw `userText` to ordinary logs.
- Do not let `GET /v1/background-scenes` become a runtime dependency.
- Do not introduce persistent storage until the in-memory contract and tests are stable.
- Do not change Phase 1 release artifacts while implementing session/explanation APIs.

## Task 0: Close Phase 1 PR Boundary

**Files:**

- Modify: `README.md`
- Modify: `docs/plans/artduo-v2-lightweight-rebuild-plan.md`
- Create: `docs/plans/artduo-v2-phase2-continuation-plan.md`
- Review: `data/curation/reports/phase1-closeout-report.md`

- [ ] **Step 1: Verify Phase 1 gate**

Run:

```bash
pnpm preflight:check
pnpm vector:benchmark -- --release-version 2026-04-25-curation-b --output /tmp/artduo-phase1-pr-vector-benchmark.json
```

Expected:

```text
4 passed
rerankTop1HitRate: 0.958333
rerankTop5HitRate: 1
```

- [ ] **Step 2: Inspect pending changes**

Run:

```bash
git status --short --branch
git diff --stat
```

Expected:

- `.DS_Store` appears only as a deletion.
- `.codex/`, `test-results/`, and `playwright-report/` do not appear.
- `apps/web/**`, `data/**`, root scripts, contracts/corpus changes, and docs are visible.

- [ ] **Step 3: Commit Phase 1 slices**

Use the split below if the branch is ready for review:

```bash
git add data/curation data/releases data/sources
git commit -m "data: add artduo v2 phase 1 release artifacts"

git add apps/web
git commit -m "feat(web): add release-backed phase 1 thin slice"

git add package.json .gitignore packages/corpus/src/query-embedding.ts packages/corpus/src/query-embedding.test.ts
git commit -m "test: add repeatable phase 1 acceptance gate"

git add README.md docs/plans/artduo-v2-lightweight-rebuild-plan.md docs/plans/artduo-v2-phase2-continuation-plan.md data/curation/reports/phase1-closeout-report.md .DS_Store
git commit -m "docs: close artduo v2 phase 1"
```

Expected:

- `git status --short` is clean except for intentionally uncommitted local work.
- Phase 2 starts from a reviewable baseline.

## Task 1: Freeze v0.2 Contracts

**Files:**

- Create: `packages/contracts/src/curation-session.ts`
- Create: `packages/contracts/src/artwork-explanation.ts`
- Create: `packages/contracts/src/curation-events.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/curation-session.test.ts`
- Create: `packages/contracts/src/artwork-explanation.test.ts`
- Create: `packages/contracts/src/curation-events.test.ts`
- Create: `packages/contracts/fixtures/curation-session-pending.json`
- Create: `packages/contracts/fixtures/curation-session-ready.json`
- Create: `packages/contracts/fixtures/artwork-explanation-pending.json`
- Create: `packages/contracts/fixtures/artwork-explanation-ready.json`

- [ ] **Step 1: Add failing contract tests**

Create tests that assert these exact states:

```ts
const sessionStatuses = ["pending", "partial", "ready", "failed"] as const;
const explanationStatuses = ["pending", "ready", "failed"] as const;
```

Required assertions:

- `CreateCurationRequest` carries `userText`, `releaseVersion`, and a local `exhibitionSnapshot`.
- `CurationSession` carries `id`, `status`, `releaseVersion`, `sourceVersions`, `unitIds`, `createdAt`, `updatedAt`, and `ownership`.
- `ArtworkExplanation` carries `artworkId`, `releaseVersion`, `status`, and either `content` or `error`.
- `CurationEvent` includes `session.created`, `session.updated`, `explanation.updated`, and `session.failed`.

Run:

```bash
pnpm --filter @artduo/contracts test
```

Expected:

```text
FAIL
```

because the new contract modules do not exist yet.

- [ ] **Step 2: Implement contract modules**

Use these core type names and keep them exported:

```ts
export type CurationSessionStatus = "pending" | "partial" | "ready" | "failed";

export interface SourceVersions {
  corpusVersion: string;
  backgroundCatalogVersion: string;
  contractsVersion: string;
}

export interface ExhibitionSnapshotUnit {
  unitId: string;
  artworkId: string;
  backgroundSceneId?: string;
  rank: number;
  score: number;
}

export interface CreateCurationRequest {
  userText: string;
  releaseVersion: string;
  sourceVersions: SourceVersions;
  exhibitionSnapshot: ExhibitionSnapshotUnit[];
}

export interface OwnershipToken {
  token: string;
  expiresAt: string;
}

export interface CurationSession {
  id: string;
  status: CurationSessionStatus;
  releaseVersion: string;
  sourceVersions: SourceVersions;
  unitIds: string[];
  ownership: OwnershipToken;
  createdAt: string;
  updatedAt: string;
  error?: string;
}
```

```ts
export type ArtworkExplanationStatus = "pending" | "ready" | "failed";

export interface ArtworkExplanationContent {
  title: string;
  shortText: string;
  detailText: string;
  generatedAt: string;
  model?: string;
}

export interface ArtworkExplanation {
  artworkId: string;
  releaseVersion: string;
  status: ArtworkExplanationStatus;
  content?: ArtworkExplanationContent;
  error?: string;
  cacheKey: string;
  updatedAt: string;
}
```

```ts
export type CurationEvent =
  | { type: "session.created"; session: CurationSession }
  | { type: "session.updated"; session: CurationSession }
  | { type: "explanation.updated"; explanation: ArtworkExplanation }
  | { type: "session.failed"; sessionId: string; error: string; occurredAt: string };
```

- [ ] **Step 3: Export contracts**

Modify `packages/contracts/src/index.ts`:

```ts
export * from "./curation-session";
export * from "./artwork-explanation";
export * from "./curation-events";
```

- [ ] **Step 4: Verify contracts**

Run:

```bash
pnpm --filter @artduo/contracts test
pnpm --filter @artduo/contracts typecheck
```

Expected:

```text
pass
```

- [ ] **Step 5: Commit**

```bash
git add packages/contracts
git commit -m "feat(contracts): freeze v0.2 curation session contracts"
```

## Task 2: Add Session Ownership, Idempotency, and Store Primitives

**Files:**

- Create: `apps/api/src/services/auth/session-token.ts`
- Create: `apps/api/src/services/http/idempotency-store.ts`
- Create: `apps/api/src/services/curation/session-store.ts`
- Create: `apps/api/test/services/session-token.test.ts`
- Create: `apps/api/test/services/idempotency-store.test.ts`
- Create: `apps/api/test/services/session-store.test.ts`

- [ ] **Step 1: Write failing service tests**

Required behavior:

- `createSessionToken(sessionId, now)` returns a non-empty token and ISO expiry.
- `verifySessionToken(token, sessionId, now)` accepts the token before expiry.
- `verifySessionToken(token, otherSessionId, now)` rejects cross-session access.
- `InMemoryIdempotencyStore` returns the same response for the same idempotency key.
- `InMemoryCurationSessionStore` creates and reads sessions by id.

Run:

```bash
pnpm --filter @artduo/api test
```

Expected:

```text
FAIL
```

because the service modules do not exist yet.

- [ ] **Step 2: Implement token helper**

Implement an opaque token format:

```ts
export interface SessionTokenRecord {
  token: string;
  expiresAt: string;
}

export function createSessionToken(sessionId: string, now = new Date()): SessionTokenRecord;
export function verifySessionToken(token: string, sessionId: string, now = new Date()): boolean;
```

Use deterministic HMAC if `ARTDUO_SESSION_TOKEN_SECRET` is set. Use a process-local random secret only for tests/local development.

- [ ] **Step 3: Implement idempotency store**

Implement:

```ts
export class InMemoryIdempotencyStore<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): T;
  getOrSet(key: string, build: () => T): T;
}
```

Reject empty keys with `TypeError("Idempotency key is required")`.

- [ ] **Step 4: Implement curation session store**

Implement:

```ts
export class InMemoryCurationSessionStore {
  create(session: CurationSession): CurationSession;
  get(id: string): CurationSession | undefined;
  update(id: string, patch: Partial<CurationSession>): CurationSession;
}
```

Throw `Error("Curation session not found: <id>")` for missing updates.

- [ ] **Step 5: Verify services**

Run:

```bash
pnpm --filter @artduo/api test
pnpm --filter @artduo/api typecheck
```

Expected:

```text
pass
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services apps/api/test/services
git commit -m "feat(api): add curation session primitives"
```

## Task 3: Add Curation Session Route Helpers

**Files:**

- Create: `apps/api/src/routes/curations.ts`
- Create: `apps/api/test/routes/curations.test.ts`

- [ ] **Step 1: Write failing route tests**

Required behavior:

- `createCurationSession(request, headers)` returns status `201`, a `CurationSession`, and ownership token.
- Repeating the same `Idempotency-Key` returns the same session id.
- `getCurationSession(id, ownershipToken)` returns status `200` for the owner.
- Missing or wrong token returns status `403`.
- Unknown session id returns status `404`.

Run:

```bash
pnpm --filter @artduo/api test
```

Expected:

```text
FAIL
```

- [ ] **Step 2: Implement pure route helper signatures**

Use pure functions instead of binding to an HTTP framework:

```ts
export interface ApiRouteResponse<T> {
  status: number;
  body: T;
  headers?: Record<string, string>;
}

export function createCurationSession(
  request: CreateCurationRequest,
  headers?: Record<string, string | undefined>,
): ApiRouteResponse<CurationSession>;

export function getCurationSession(
  sessionId: string,
  headers?: Record<string, string | undefined>,
): ApiRouteResponse<CurationSession | ApiError>;
```

Use `Idempotency-Key` from headers. Use `Authorization: Bearer <token>` for reads.

- [ ] **Step 3: Verify route helpers**

Run:

```bash
pnpm --filter @artduo/api test
pnpm preflight:check
```

Expected:

```text
pass
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/curations.ts apps/api/test/routes/curations.test.ts
git commit -m "feat(api): add curation session routes"
```

## Task 4: Add Artwork Explanation Contracts and API Helper

**Files:**

- Create: `apps/api/src/services/explanations/explanation-cache.ts`
- Create: `apps/api/src/services/explanations/get-artwork-explanation.ts`
- Create: `apps/api/src/routes/artworks.ts`
- Create: `apps/api/test/services/explanation-cache.test.ts`
- Create: `apps/api/test/routes/artworks.test.ts`

- [ ] **Step 1: Write failing explanation tests**

Required behavior:

- Cache key includes `releaseVersion`, `artworkId`, and a stable hash of context text.
- First lookup for a known artwork returns `pending` if generation is not available.
- Supplying a generator returns `ready` with `shortText` and `detailText`.
- Second lookup with the same cache key returns cached `ready` content.
- Unknown artwork returns status `404`.

Run:

```bash
pnpm --filter @artduo/api test
```

Expected:

```text
FAIL
```

- [ ] **Step 2: Implement cache**

Implement:

```ts
export class InMemoryExplanationCache {
  get(cacheKey: string): ArtworkExplanation | undefined;
  set(explanation: ArtworkExplanation): ArtworkExplanation;
}

export function buildExplanationCacheKey(input: {
  releaseVersion: string;
  artworkId: string;
  contextText?: string;
}): string;
```

- [ ] **Step 3: Implement explanation boundary**

Implement:

```ts
export interface ExplanationGenerator {
  generate(input: {
    artworkId: string;
    releaseVersion: string;
    title: string;
    contextText?: string;
  }): Promise<ArtworkExplanationContent>;
}

export async function getArtworkExplanation(input: {
  artworkId: string;
  releaseVersion: string;
  title: string;
  contextText?: string;
  generator?: ExplanationGenerator;
  now?: Date;
}): Promise<ArtworkExplanation>;
```

If no generator is provided, return `pending`. Do not call any real LLM in tests.

- [ ] **Step 4: Implement route helper**

Implement:

```ts
export async function getArtworkExplanationRoute(input: {
  artworkId: string;
  releaseVersion: string;
  title?: string;
  contextText?: string;
}): Promise<ApiRouteResponse<ArtworkExplanation | ApiError>>;
```

- [ ] **Step 5: Verify explanation path**

Run:

```bash
pnpm --filter @artduo/api test
pnpm preflight:check
```

Expected:

```text
pass
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/explanations apps/api/src/routes/artworks.ts apps/api/test
git commit -m "feat(api): add artwork explanation helper"
```

## Task 5: Add Privacy, Rate Limit, and Budget Guards

**Files:**

- Create: `apps/api/src/services/http/rate-limit.ts`
- Create: `apps/api/src/services/privacy/request-redaction.ts`
- Create: `apps/api/src/services/privacy/retention-policy.ts`
- Create: `apps/api/src/services/curation/budget-guard.ts`
- Create: `apps/api/test/services/rate-limit.test.ts`
- Create: `apps/api/test/services/request-redaction.test.ts`
- Create: `apps/api/test/services/retention-policy.test.ts`
- Create: `apps/api/test/services/budget-guard.test.ts`

- [ ] **Step 1: Write failing guard tests**

Required behavior:

- Rate limit allows the first N requests and rejects request N+1 in the same window.
- Redaction replaces raw user text with `[REDACTED_USER_TEXT]`.
- Retention policy returns a short raw-text TTL and longer redacted-log TTL.
- Budget guard rejects explanation generation when estimated cost exceeds configured budget.

Run:

```bash
pnpm --filter @artduo/api test
```

Expected:

```text
FAIL
```

- [ ] **Step 2: Implement guard helpers**

Use these exports:

```ts
export class InMemoryRateLimit {
  check(key: string, now?: Date): { allowed: boolean; remaining: number; resetAt: string };
}

export function redactUserText(input: unknown): unknown;

export const DEFAULT_RETENTION_POLICY = {
  rawUserTextTtlHours: 24,
  redactedLogTtlDays: 30,
} as const;

export function assertWithinBudget(input: {
  estimatedTokens: number;
  maxTokens: number;
}): void;
```

`assertWithinBudget` throws `Error("Budget exceeded")` when `estimatedTokens > maxTokens`.

- [ ] **Step 3: Wire guards into route helpers**

Update `apps/api/src/routes/curations.ts` and `apps/api/src/routes/artworks.ts` so tests can verify:

- create session applies rate limit by ownership or idempotency key
- explanation route applies budget guard
- route errors use `ApiError`

- [ ] **Step 4: Verify guard coverage**

Run:

```bash
pnpm --filter @artduo/api test
pnpm preflight:check
```

Expected:

```text
pass
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services apps/api/src/routes apps/api/test
git commit -m "feat(api): add curation safety guards"
```

## Task 6: Connect Web Detail to Non-Blocking Explanation State

**Files:**

- Create: `apps/web/lib/curation-client.ts`
- Create: `apps/web/lib/explanation-client.ts`
- Create: `apps/web/lib/session-state.ts`
- Modify: `apps/web/app/gallery/page.tsx`
- Modify: `apps/web/app/artwork/[id]/page.tsx`
- Create: `apps/web/test/lib/session-state.test.ts`
- Create: `apps/web/e2e/explanation-state.spec.ts`

- [ ] **Step 1: Write failing web tests**

Required behavior:

- `buildCreateCurationRequest(query, searchResult, catalog)` preserves release/source versions and selected unit ids.
- Detail page renders metadata immediately.
- Detail page shows an explanation placeholder when explanation is pending.
- Detail page shows ready explanation content when explanation client returns `ready`.

Run:

```bash
pnpm --filter @artduo/web test
pnpm --filter @artduo/web test:e2e
```

Expected:

```text
FAIL
```

- [ ] **Step 2: Implement web clients**

Use these signatures:

```ts
export async function createCurationSessionClient(input: CreateCurationRequest): Promise<CurationSession>;

export async function getArtworkExplanationClient(input: {
  artworkId: string;
  releaseVersion: string;
  contextText?: string;
}): Promise<ArtworkExplanation>;
```

For the first implementation, call the pure API helpers directly in server code. Do not add browser fetch routes until the helper contracts are stable.

- [ ] **Step 3: Add session snapshot helper**

Implement:

```ts
export function buildCreateCurationRequest(input: {
  query: string;
  catalog: WebReleaseCatalog;
  search: WebSearchResult;
}): CreateCurationRequest;
```

Use `catalog.manifest.release` for `sourceVersions`.

- [ ] **Step 4: Update pages**

Keep Gallery and Detail usable even when session/explanation helpers fail:

- Gallery still shows ranked cards from `searchReleaseCatalog`.
- Detail still shows metadata and image.
- Explanation slot displays one of:
  - `Explanation pending`
  - generated `shortText`
  - `Explanation unavailable`

- [ ] **Step 5: Verify web path**

Run:

```bash
pnpm --filter @artduo/web test
pnpm --filter @artduo/web test:e2e
pnpm preflight:check
```

Expected:

```text
pass
```

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): add non-blocking explanation state"
```

## Task 7: Optional Local-First Runtime Follow-Up

**Files:**

- Create: `packages/corpus/src/browser-release-loader.ts`
- Create: `packages/corpus/src/indexeddb-cache.ts`
- Create: `packages/corpus/src/search-worker.ts`
- Create: `packages/corpus/src/browser-release-loader.test.ts`
- Create: `apps/web/lib/browser-curation.ts`
- Create: `apps/web/e2e/browser-local-runtime.spec.ts`

This task is not required before starting Phase 2 contracts, but it is required before claiming strict browser-local Phase 1 runtime execution.

- [ ] **Step 1: Write failing browser-runtime tests**

Required behavior:

- Browser loader fetches manifest and only required shards.
- Second load uses IndexedDB cache when release fingerprint matches.
- Worker search returns the same top result as server-side `searchReleaseCatalog` for `I want a quiet moonlit room`.
- Worker failure falls back to server-side release bridge without blanking Gallery.

Run:

```bash
pnpm --filter @artduo/corpus test
pnpm --filter @artduo/web test:e2e
```

Expected:

```text
FAIL
```

- [ ] **Step 2: Implement browser release loader**

Keep exports separate from Node-only `fs` loaders so `apps/web` does not bundle server-only code into client components.

- [ ] **Step 3: Implement cache and worker**

Use release `corpusVersion` plus shard checksums as the cache key. Worker messages must include:

```ts
type SearchWorkerRequest = { type: "search"; query: string; limit: number };
type SearchWorkerResponse = { type: "result"; artworkIds: string[] } | { type: "error"; message: string };
```

- [ ] **Step 4: Verify local-first path**

Run:

```bash
pnpm preflight:check
pnpm vector:benchmark -- --release-version 2026-04-25-curation-b --output /tmp/artduo-local-first-vector-benchmark.json
```

Expected:

```text
pass
```

- [ ] **Step 5: Commit**

```bash
git add packages/corpus apps/web
git commit -m "feat(corpus): add browser-local release search"
```

## Phase 2 Completion Gate

Phase 2 can be considered complete when all are true:

- `v0.2` contract tests pass.
- `POST /v1/curations` equivalent helper works with ownership and idempotency.
- `GET /v1/curations/:id` equivalent helper enforces ownership.
- `GET /v1/artworks/:id/explanation` equivalent helper returns pending/ready/failed states and caches ready explanations.
- Web detail page renders metadata without waiting for explanation.
- Session/explanation route helpers apply rate limit, budget, retention, and redaction primitives.
- `pnpm preflight:check` passes.
- Phase 1 vector benchmark remains above the closeout baseline or any regression is explained in a report.

## Stop Conditions

Pause and update this plan before continuing if any of these happen:

- A task requires a persistent database.
- A task requires real LLM credentials in automated tests.
- A route helper needs a full HTTP server framework decision.
- Phase 1 release artifacts need regeneration.
- A proposed change makes Gallery depend on session creation before rendering.
