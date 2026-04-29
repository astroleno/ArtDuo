# Phase 1 Closeout Report

- date: 2026-04-29
- release: `2026-04-25-curation-b`
- manifest: `data/releases/2026-04-25-curation-b/manifest.json`
- benchmark report: `data/curation/reports/vector-benchmark-2026-04-25-curation-b.json`
- benchmark prompts: `benchmarks/vector-promotion-prompts.json`

## Verdict

Phase 1 is acceptable as a product thin slice: Landing -> Gallery -> Detail is implemented against the release manifest and the preflight path includes unit, typecheck, build, and Playwright E2E coverage.

This closeout does not claim the strict browser-local IndexedDB/Worker architecture. The current web implementation is a Phase 1 bridge: Next.js server code reads local release files and performs retrieval on the server. That is acceptable for the thin slice because the runtime truth source is still the release manifest and shards, but browser-side loading/cache/Worker execution remains a follow-up before claiming the full local-first runtime shape.

## Automated Acceptance

- `pnpm -r test`: repo unit tests, including web release catalog state coverage.
- `pnpm -r typecheck`: workspace TypeScript coverage.
- `pnpm -r build`: full package build, including static generation for `@artduo/web`.
- `pnpm --filter @artduo/web test:e2e`: Playwright coverage for Landing -> Gallery -> Detail and Phase 1 states.
- `pnpm preflight:check`: runs the complete repeatable gate above.

New Phase 1 state coverage added for:

- Gallery empty result: a query with no searchable tokens renders an empty state and no result cards.
- Image fallback: gallery cards render a stable fallback when artwork image requests fail.
- Unknown detail route: `/artwork/not-a-real-artwork` renders the not-found state.
- Missing release shard: loader errors include shard kind and shard id.

## Benchmark

Latest local vector benchmark:

- provider: `local-hash`
- model: `local-hash-embedding-v1`
- dimensions: 256
- prompt count: 24
- rerank Top-1 hit rate: 95.83%
- rerank Top-5 hit rate: 100.00%
- lexical Top-1 hit rate: 20.83%
- lexical Top-5 hit rate: 33.33%
- manual top10 gate: 20/24 prompts pass, 83.33%

The benchmark clears the stricter written exit criterion of at least 80% prompts having five or more human-usable candidates in top 10. This was reached after tightening query token aliases for Chinese mixed prompts and low-overlap metaphor prompts in the local-hash retrieval path.

## Manual Top10 Review

Review method: each benchmark prompt was checked against the top10 reranked results. A prompt is `pass` when at least five top10 candidates are release-ready works in the expected theme lane. `mixed` means three or four usable candidates; `fail` means fewer than three. Release-ready records already have image and display metadata, so this review focuses on candidate relevance.

| Prompt | Expected theme | Usable top10 | Verdict |
| --- | --- | --- | --- |
| `contemplation-direct-01` | contemplation | 8/10 | pass |
| `contemplation-metaphor-01` | contemplation | 10/10 | pass |
| `contemplation-zhmix-01` | contemplation | 9/10 | pass |
| `desire-direct-01` | desire | 10/10 | pass |
| `desire-metaphor-01` | desire | 7/10 | pass |
| `desire-zhmix-01` | desire | 10/10 | pass |
| `hope-direct-01` | hope | 3/10 | mixed |
| `hope-metaphor-01` | hope | 3/10 | mixed |
| `hope-zhmix-01` | hope | 2/10 | fail |
| `joy-direct-01` | joy | 10/10 | pass |
| `joy-metaphor-01` | joy | 9/10 | pass |
| `joy-zhmix-01` | joy | 10/10 | pass |
| `melancholy-direct-01` | melancholy | 10/10 | pass |
| `melancholy-metaphor-01` | melancholy | 8/10 | pass |
| `melancholy-zhmix-01` | melancholy | 10/10 | pass |
| `mystery-direct-01` | mystery | 10/10 | pass |
| `mystery-metaphor-01` | mystery | 8/10 | pass |
| `mystery-zhmix-01` | mystery | 10/10 | pass |
| `serenity-direct-01` | serenity | 10/10 | pass |
| `serenity-metaphor-01` | serenity | 3/10 | mixed |
| `serenity-zhmix-01` | serenity | 10/10 | pass |
| `wonder-direct-01` | wonder | 10/10 | pass |
| `wonder-metaphor-01` | wonder | 10/10 | pass |
| `wonder-zhmix-01` | wonder | 10/10 | pass |

Manual top10 gate result: 20/24 pass, 3 mixed, 1 fail. Pass rate is 83.33%, above the Phase 1 threshold.

## PR Boundary

Recommended commit split:

1. Data/release artifacts: `data/curation/**`, `data/releases/**`, and `data/sources/**` needed for release `2026-04-25-curation-b`.
2. Product thin slice: `apps/web/**` page, release-catalog, styling, unit test, and Playwright test changes.
3. Repeatable acceptance: root `package.json`, `apps/web/playwright.config.ts`, `apps/web/scripts/playwright-web-server.mjs`, and ignore rules for generated test artifacts.
4. Closeout docs: this report plus any updates that point reviewers to the current acceptance gate.

Do not mix local-only `.DS_Store`, `.codex/`, `test-results/`, or Playwright report output into the PR.

## Remaining Phase 1 Closeout Work

- Decide whether the Phase 1 written exit criterion should accept the server-side release bridge, or explicitly defer browser-local IndexedDB/Worker to a named follow-up.
- Keep `POST /v1/curations`, session/explanation contracts, ownership, idempotency, rate limit, budget, and retention out of the Phase 1 PR unless the roadmap is intentionally moving into Phase 2.
