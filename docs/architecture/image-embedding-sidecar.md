# Image Embedding Sidecar Boundaries

## Scope

This document freezes the release and evaluation boundaries for the optional
image-embedding sidecar. The sidecar is a shadow capability until a separately
verified manifest variant is promoted. It is not a replacement for the existing
text retrieval path.

The production entry point remains the server-side release bridge in
`apps/web/lib/release-catalog.ts`: it loads the base release manifest, embeds
text, vector-searches text embeddings, then reranks text candidates. Affective
intent is independently derived before retrieval. The relationship graph is
public evidence only; its tests explicitly assert that it cannot alter vector or
rerank ordering.

## Frozen Release

| Item | Frozen value |
| --- | --- |
| Release version | `2026-04-25-curation-b` |
| Base manifest | `data/releases/2026-04-25-curation-b/manifest.json` |
| Base manifest checksum | `sha256:d16e859a68abdab4c4c5bb5056fbe50a4a3efda18e40dd0097634c4c24e784c9` |
| Base manifest bytes | `1820` |
| Promotion anchor checksum | `sha256:208de58e2fa6e2e39a24e0180d9c1159ef47381e9a6a9cfd8eb70fdec9a0e581` |
| Promotion anchors | 30 deterministic release artwork IDs; no Grade A artworks exist in this release |
| Anchor algorithm | `primary-mood-theme-round-robin-sha256-v1`; `sha256(releaseVersion + artworkId)` within each primary-mood/theme stratum |

The base manifest is immutable. A future image-enabled release must be a full,
compatible `manifest.image-embedding-v1.json` variant that adds only the
image-sidecar fields and points at a separately verified shard. No runtime may
infer a variant from the base manifest path.

## Text Retrieval Baseline

The authoritative Phase 1 report is
`data/curation/reports/vector-benchmark-2026-04-25-curation-b.json`:

| Metric | Authoritative threshold | Frozen result |
| --- | --- | --- |
| Rerank Top-1 | `>= 0.958333` (23/24) | `0.958333` |
| Rerank Top-5 | `>= 1` (24/24) | `1` |
| Permitted Top-1 miss | `desire-metaphor-01` | Top-5 hit |

The Task -1 baseline was written to a private ephemeral
`mktemp -d -t artduo-image-baseline` directory rather than a tracked report.
It initially found a regression: Top-1 `0.916667`, Top-5 `0.958333`, with
`desire-metaphor-01` and `melancholy-metaphor-01` missing Top-1 and the latter
also missing Top-5. This was not waived. Commit `5fb9a2a` corrected the
quiet-alias expansion so explicit grief is not diluted by serenity aliases.
The rerun produced Top-1 `0.958333`, Top-5 `1`; the only remaining Top-1 miss
is the authoritative permitted `desire-metaphor-01` case.

There is no text-regression waiver. A sidecar implementation must compare against
the authoritative threshold above, not silently substitute an intermediate or
newly regressed run.

## A2A Differential Baseline

The A2A harness is a differential contract. Its exit status and aggregate count
are insufficient promotion signals; each status bucket is compared by exact case
ID.

| Status | Count | Case IDs |
| --- | ---: | --- |
| pass | 50 | `A2-01`, `A2-05`, `A2-06`, `A3-01`, `A3-02`, `A3-03`, `A3-04`, `A3-05`, `A3-07`, `A3-08`, `A3-09`, `A3-10`, `A4-01`, `A4-02`, `A4-03`, `A4-04`, `A4-05`, `A4-06`, `A4-07`, `A4-09`, `A4-10`, `A5-01`, `A5-02`, `A5-03`, `A5-06`, `A5-07`, `A5-08`, `A5-09`, `A5-10`, `A6-01`, `A6-04`, `A6-05`, `A7-02`, `A8-03`, `A8-04`, `A8-05`, `A8-06`, `A8-07`, `A8-08`, `A8-10`, `A9-10`, `A10-01`, `A10-02`, `A10-03`, `A10-04`, `A10-05`, `A10-06`, `A10-08`, `A10-09`, `A10-10` |
| fail | 45 | `A1-01`, `A1-02`, `A1-03`, `A1-04`, `A1-05`, `A1-06`, `A1-07`, `A1-08`, `A1-09`, `A1-10`, `A2-02`, `A2-03`, `A2-04`, `A2-07`, `A2-08`, `A2-09`, `A2-10`, `A3-06`, `A4-08`, `A5-04`, `A5-05`, `A6-02`, `A6-03`, `A6-06`, `A6-08`, `A6-09`, `A7-01`, `A7-03`, `A7-04`, `A7-05`, `A7-06`, `A7-07`, `A7-08`, `A7-09`, `A8-01`, `A8-02`, `A8-09`, `A9-01`, `A9-02`, `A9-03`, `A9-04`, `A9-05`, `A9-06`, `A9-07`, `A10-07` |
| blocked | 5 | `A6-07`, `A6-10`, `A7-10`, `A9-08`, `A9-09` |

The 50-case intent/immersion replay baseline is:

| Metric | Value |
| --- | ---: |
| Average intent | `0.955440` |
| Average immersion | `1.000000` |
| Average growth form | `0.883200` |
| Average total | `0.974640` |
| Hard-resistance violation case IDs | none |

## Browser E2E and Performance Baseline

The defined E2E case set has 14 cases:

1. `browser-local-runtime.spec.ts › gallery keeps rendering results when browser worker search fails`
2. `explanation-state.spec.ts › detail page renders explanation slot with generated ready content`
3. `immersive-gallery.spec.ts › immersive gallery opens from gallery and preserves the release-backed exhibition`
4. `immersive-gallery.spec.ts › immersive gallery can move between scenes and preserve query state`
5. `immersive-gallery.spec.ts › artwork detail can enter immersive gallery at the current artwork`
6. `immersive-gallery.spec.ts › immersive gallery mobile layout scrolls without clipping progress`
7. `phase1-states.spec.ts › landing page does not horizontally overflow on mobile`
8. `phase1-states.spec.ts › gallery waits for explicit intent when no query is provided`
9. `phase1-states.spec.ts › gallery shows an empty state for a query with no searchable terms`
10. `phase1-states.spec.ts › gallery uses matched scene backdrops and lazy-loads secondary artworks`
11. `phase1-states.spec.ts › background scene assets are served by the web app`
12. `phase1-states.spec.ts › gallery cards fall back when artwork images fail to load`
13. `phase1-states.spec.ts › unknown artwork detail routes render the not-found state`
14. `thin-slice.spec.ts › visitor can turn a sentence into a gallery and open artwork detail`

This baseline cannot execute assertions locally because the Playwright Chromium
binary is absent. The runner reports all 14 as `failed` at `browserType.launch`,
before application code executes; for promotion comparison they are classified as
**blocked by environment**, not as product failures. A real Chromium-backed run is
required before Task 6 or Task 7 can pass.

The sidecar budgets are frozen as follows:

| Situation | Budget |
| --- | --- |
| Feature flag off | zero variant/shard reads, client requests, parsing, and index cost |
| Feature flag on: gzip shard | `<= 1.2 MB` |
| Feature flag on: raw shard | `<= 4 MB` |
| Server JSON parse + index build p95 | `<= 150 ms` |
| Server records/index incremental heap | `<= 16 MB` |
| Optional browser diagnostic p95 | `<= 400 ms`; diagnostic only, not a production Worker claim |
| Load/parse failure | Gallery and Immersive continue with metadata-only scene selection |

## Non-Negotiable Invariants

1. With the image feature flag off, text retrieval results are item-for-item
   identical to the frozen pre-sidecar snapshot. A current regression can never
   replace the Phase 1 authority.
2. A release and the Web app work normally when `imageEmbeddings` is absent.
3. The relationship graph remains an evidence sidecar and cannot participate in
   vector or rerank ordering.
4. Affective intent remains independently determined before retrieval.
5. The base `manifest.json` is never overwritten. Image sidecars are published
   and rolled back only through an explicit manifest variant.
6. A2A promotion is decided by a case-set diff, not the harness exit code.

## Runtime and Data Boundaries

- No vector database or graph database is introduced.
- The production consumer is Node/server only. A browser loader, if added, is
  opt-in diagnostic work and must not be represented as an existing Worker
  runtime.
- The base manifest stays the default path. The server reads a sidecar only when
  both the feature flag is enabled and `ARTDUO_IMAGE_EMBEDDING_MANIFEST` names an
  explicit in-release variant.
- Image source URLs, acquisition errors, local paths, credentials, and human
  review detail stay in internal candidate/report artifacts. Release shards
  contain only safe runtime data.
- The sidecar may rerank only bounded, text-derived scene candidates behind the
  flag. On any validation, load, timeout, or partial-vector failure, the full
  query falls back to the existing metadata-only scene selection.
