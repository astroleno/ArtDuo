# ArtDuo

ArtDuo is an AI-assisted emotional art curation project. The current active work is the V2 rebuild: a release-backed, contract-driven application that turns a short visitor intent into a browsable artwork gallery and detail pages.

The legacy `frontend/` app is kept as donor/reference material. New runtime work lives under `apps/` and shared packages live under `packages/`.

## Current Status

V2 Phase 1 is closed as a product thin slice. Phase 2 curation capabilities are implemented, but their formal closeout remains pending.

- `apps/web` is a real Next App Router application.
- Landing -> Gallery -> Detail works against release artifacts.
- Runtime truth source is `data/releases/2026-04-25-curation-b/manifest.json`.
- The web thin slice currently uses a server-side release bridge: Next.js reads local release shards and runs retrieval on the server.
- Browser-local IndexedDB/Worker retrieval is explicitly deferred; it is not claimed as complete.
- Repeatable acceptance is wired through `pnpm preflight:check`.
- The image-embedding sidecar is currently shadow-only: it is not a required release shard, does not change production ranking, and does not alter the base manifest.

Phase 1 closeout evidence:

- Closeout report: `data/curation/reports/phase1-closeout-report.md`
- Release: `data/releases/2026-04-25-curation-b/`
- Benchmark prompts: `benchmarks/vector-promotion-prompts.json`
- Current benchmark gate: rerank Top-1 `95.83%`, rerank Top-5 `100%`, manual top10 pass rate `83.33%`
- Readiness recheck (2026-07-26): an alias-expansion regression was corrected; the current local benchmark is again Top-1 `95.83%` and Top-5 `100%`. The remaining permitted Top-1 miss is `desire-metaphor-01`.
- A2A is a differential baseline, not an all-green certification. The authoritative case set is `55 pass / 40 fail / 5 blocked`, and the current reproducible capture matches it exactly. The older source-less `50/45/5` capture and the temporary `51/44/5` capture are regressions, not replacement baselines. Promotion compares pass/fail/blocked case IDs, not just totals or the harness exit code.
- Browser E2E has 14 defined cases. The current local baseline is blocked until the Playwright Chromium artifact is available; this is an environment prerequisite, not an application assertion result.

## Active Commands

Install dependencies:

```bash
pnpm install
```

Run the V2 web app:

```bash
pnpm --filter @artduo/web dev -- -p 3210 -H 127.0.0.1
```

Open:

```text
http://127.0.0.1:3210
```

Run the full Phase 1 gate:

```bash
pnpm preflight:check
```

Run only the local vector benchmark:

```bash
pnpm vector:benchmark -- --release-version 2026-04-25-curation-b
```

Run only web E2E:

```bash
pnpm --filter @artduo/web test:e2e
```

By default, Playwright uses port `3211` so it does not collide with manual debugging on `3210`. To explicitly reuse another port:

```bash
ARTDUO_WEB_E2E_PORT=3210 pnpm --filter @artduo/web test:e2e
```

## Workspace Layout

```text
apps/
  web/        Next App Router product thin slice
  api/        API route helpers and tests
  pipeline/   Release artifact, curation, embedding, and benchmark builders
packages/
  contracts/  Shared v0.1 display/data contracts
  corpus/     Release loading, embedding, vector search, rerank
  ui/         Scaffold for shared UI extraction
data/
  releases/   Runtime release artifacts
  curation/   Curation reports, review outputs, closeout evidence
  sources/    Source collection artifacts
docs/
  plans/      Current implementation and continuation plans
  specs/      Shared contracts, UX, corpus, and scene specs
frontend/     Legacy donor/reference app
reference/    External and donor references
```

## Key V2 Files

- `apps/web/app/page.tsx`: Landing page and intent form.
- `apps/web/app/gallery/page.tsx`: Ranked gallery results.
- `apps/web/app/artwork/[id]/page.tsx`: Release-backed artwork detail page.
- `apps/web/components/artwork-image.tsx`: Image fallback handling.
- `apps/web/lib/release-catalog.ts`: Web release loading, hydration, scene selection, and search.
- `packages/corpus/src/query-embedding.ts`: Local query tokenization and alias expansion.
- `packages/corpus/src/vector-search.ts`: Vector search.
- `packages/corpus/src/rerank.ts`: Vector/lexical/grade reranking.
- `apps/web/e2e/`: Playwright E2E coverage for the thin slice and Phase 1 states.

## Planning Documents

- Main V2 plan: `docs/plans/artduo-v2-lightweight-rebuild-plan.md`
- Collection runbook: `docs/plans/artduo-v2-artwork-collection-runbook.md`
- Next continuation plan: `docs/plans/artduo-v2-phase2-continuation-plan.md`
- Roadmap: `docs/roadmaps/artduo-v2-three-phase-roadmap.md`
- Shared contracts/API spec: `docs/specs/artduo-v2-shared-contracts-and-api.md`
- UX state matrix: `docs/specs/artduo-v2-ux-flow-and-state-matrix.md`
- Local corpus/media schema: `docs/specs/artduo-v2-local-corpus-and-media-schema.md`
- Background scene schema: `docs/specs/artduo-v2-background-scene-schema.md`

## Phase Summary

### Phase 1: Foundation Thin Slice

Status: closed.

Delivered:

- Workspace bootstrap under `apps/` and `packages/`.
- `v0.1` display/data contracts.
- Release manifest and shards for metadata, search, media, background scenes, and embeddings.
- Release-backed Landing -> Gallery -> Detail product path.
- Web state coverage for empty results, bad image fallback, unknown detail route, and missing shard diagnostics.
- Repeatable preflight and Playwright E2E.
- Benchmark and manual top10 gate above the written Phase 1 threshold.

Known deferral:

- Browser-local IndexedDB/Worker retrieval remains a named follow-up.

### Phase 2: Curation Core Experience

Status: implemented, closeout pending.

Goal:

- Add `v0.2` session, explanation, and event contracts.
- Add curation session APIs and artwork explanation APIs.
- Preserve the Phase 1 fast gallery path while explanations are generated and cached asynchronously.
- Add ownership, idempotency, rate limit, budget, retention, and request redaction boundaries.

See `docs/plans/artduo-v2-phase2-continuation-plan.md` before closeout or follow-up work.

### Phase 3: Immersive Productization

Status: planned.

Goal:

- Restore immersive gallery routes and transitions after Phase 2 state/session contracts are stable.
- Add dynamic media, transition registry, SSE enhancement, metrics, and fallback behavior.

## Git Hygiene

The current Phase 1 closeout should be committed as reviewable slices:

1. Data/release artifacts for `2026-04-25-curation-b`.
2. Product thin slice under `apps/web`.
3. Repeatable acceptance scripts/config.
4. Closeout docs and main plan updates.

Do not commit local-only output such as `.codex/`, `test-results/`, `playwright-report/`, or `.DS_Store`.
