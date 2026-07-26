# Graphify-Inspired Retrieval Sidecar Implementation Plan

Status: Draft, revised after document review
Created: 2026-05-13
Last updated: 2026-05-14
Scope: ArtDuo release-scoped retrieval explanation, debug evidence, and adjacent artwork exploration

## Goal

Build a small, optional release-scoped relationship sidecar that can explain and inspect curatorial relationships without changing the current retrieval ranking path.

The work should answer two separate questions:

- Product value: do relationship reasons improve explanation, adjacent-artwork exploration, or curator/debug review beyond a metadata-only baseline?
- Engineering fit: can ArtDuo safely load an optional graph artifact without increasing runtime fragility, leaking internal evidence, or drifting from the release manifest contract?

The sidecar is not the search engine. The current `embedText -> searchVectorIndex -> rerankVectorResults` path remains the source of search result ordering until a separate value gate proves otherwise.

## Non-Goals

- Do not replace vector search or reranking.
- Do not ship repository-level `graphify-out/graph.json` to runtime.
- Do not expose code-symbol graph nodes as product relationships.
- Do not introduce Neo4j, an online graph service, or a required runtime dependency.
- Do not add dynamic explanation citations to v1 graph artifacts.
- Do not render user-facing related-artwork UI until the value gate passes.
- Do not make `relationshipGraph` mandatory in `ReleaseManifest`.
- Do not mix external prompt or inspiration-case registries into `relationshipGraph`; model them as a separate optional artifact if they survive planning.

## Current Context

ArtDuo already has a working release retrieval path:

- `packages/contracts/src/corpus.ts` defines release manifest shards for metadata, search, media index, background scenes, and optional embeddings.
- `apps/pipeline/src/embedding-shards.ts` builds embedding records from curated artwork corpus records and updates the release manifest.
- `apps/web/lib/release-catalog.ts` hydrates metadata, search, media, background scenes, and embeddings into the web runtime catalog.
- `packages/corpus/src/query-embedding.ts`, `vector-search.ts`, and `rerank.ts` implement local query embedding, linear vector search, and reranking.

Graphify is useful as a design reference because it separates graph extraction, graph build, clustering, analysis, report generation, confidence tags, and query traversal. For ArtDuo, the repository graph points at release and embedding boundaries such as `parseReleaseManifest()` and `buildEmbeddingShardsWithProvider()` as natural integration points. Those are engineering-map signals, not product graph artifacts.

## Decision Summary

Adopt the Graphify pattern, not the Graphify artifact.

- Build a release-scoped relationship artifact from release shards only.
- Start with deterministic `EXTRACTED` edges.
- Keep internal reports physically separate from public runtime data.
- Use metadata-only related-artwork selection as the baseline.
- Version the taxonomy and alias normalization used to produce signal nodes.
- Record builder provenance and release input fingerprints so graph artifacts are reproducible.
- Measure current-release payload size and degree distribution before locking v1 limits.
- Add inferred related-artwork edges only after value and safety gates pass.
- Treat external prompt/case registry support as a later sibling sidecar, not part of the relationship graph.

## Proposed Artifacts

```text
data/releases/<release-version>/
  relationship-graph-01.json

data/curation/reports/relationship-graph/<release-version>/
  metadata-baseline-report.json
  relationship-graph-report.json
  payload-measurement.json
  evaluation-fixture.json
  evaluation-report.json
  phase0-report.json
```

`relationship-graph-01.json` is the only release artifact in v1. It is optional, manifest-referenced, and public-safe. It must contain public relationship data only.

`metadata-baseline-report.json`, `relationship-graph-report.json`, `payload-measurement.json`, `evaluation-fixture.json`, `evaluation-report.json`, and `phase0-report.json` are internal reports. They may contain builder diagnostics, rejected records, score distributions, source paths, and evaluation information, so they must live outside `data/releases/<release-version>/`.

Do not follow the existing `embedding-report.json` release-directory precedent for graph sidecar reports. The relationship graph introduces explicit public/internal separation, and internal reports must not sit beside runtime shards.

### Release Publish Allowlist and Blocking Test

Release publication should default to an allowlist, not a denylist. Public release directories may include only:

- `manifest.json`
- Manifest-referenced public shard files for metadata, search, media index, background scenes, embeddings, and the later approved relationship graph shard
- Static media assets that are already part of the public app surface

Any release packaging, static hosting, or runtime catalog step must fail a blocking test if it finds:

- `data/curation/reports/**`
- `data/releases/**/relationship-graph-report*.json`
- `data/releases/**/*payload-measurement*.json`
- `data/releases/**/*evaluation-report*.json`
- Any artifact containing local absolute paths, rejected-record diagnostics, prompt text, debug traces, or review-only scores

The blocking test belongs with the first publish/package path that can copy release artifacts. Until that exists, Phase 0 and Phase 1 reports must remain under `data/curation/reports/**` and must not be referenced by any manifest.

The builder may use a versioned relationship taxonomy. The taxonomy can live as code or as a small release-adjacent data file, but its version must be recorded in both the public graph shard and the internal report.

The sidecar should be generated from release artifacts only:

- Allowed v1 inputs: manifest, metadata shard, search shard, media index shard, background scene shard.
- Deferred inputs: dynamic explanation citations, runtime cache data, debug CLI output.
- Forbidden inputs: source-code graph output, repository-level `graphify-out`, screenshots, local absolute paths in public data.

## Runtime JSON Shape

The graph shard is an object, not an array shard:

```json
{
  "schemaVersion": "relationship-graph.v1",
  "releaseVersion": "2026-04-25-curation-b",
  "generatedAt": "2026-05-13T00:00:00.000Z",
  "build": {
    "builderName": "@artduo/pipeline/relationship-graph",
    "builderVersion": "relationship-graph-builder.v1",
    "taxonomyVersion": "relationship-taxonomy.v1",
    "inputFingerprints": []
  },
  "stats": {
    "nodeCount": 0,
    "edgeCount": 0
  },
  "limits": {
    "maxNodes": "TBD_BY_PHASE_0",
    "maxEdges": "TBD_BY_PHASE_0",
    "maxDegreePerNode": "TBD_BY_PHASE_0",
    "maxReasonLength": 160
  },
  "nodes": [],
  "edges": []
}
```

The planning example uses `TBD_BY_PHASE_0` placeholders only to show where measured limits belong. Emitted artifacts and parser fixtures must contain numeric limit values.

### Node Shape

```ts
interface RelationshipGraphNode {
  id: string;
  type: "artwork" | "emotion" | "subject" | "palette";
  label: string;
  sourceRefs: SourceRef[];
}
```

The public runtime shard must not contain `visibility`, `sensitivity`, `release`, `provenance`, or other internal/debug node types. Internal diagnostics belong in `relationship-graph-report.json`.

### Edge Shape

```ts
interface RelationshipGraphEdge {
  id: string;
  source: string;
  target: string;
  relation:
    | "has_emotion"
    | "has_subject"
    | "has_palette";
  direction: "directed";
  symmetric: false;
  confidence: "EXTRACTED";
  confidenceScore: number;
  relationshipScore?: number;
  sourceQuality: "release-field";
  reasonCode: string;
  reasonLabel?: string;
  sourceRefs: SourceRef[];
}
```

The public runtime shard must contain only public `EXTRACTED` edges. Internal/debug edges, inferred edges, ambiguous edges, scene diagnostics, release grouping, and static provenance diagnostics belong in `relationship-graph-report.json`.

### SourceRef Shape

```ts
type SourceRef =
  | ManifestSourceRef
  | ShardSourceRef;

interface ManifestSourceRef {
  artifact: "manifest";
  releaseVersion: string;
  fieldPath: string;
}

interface ShardSourceRef {
  artifact: "metadata" | "search" | "mediaIndex" | "backgroundScenes";
  shardId: string;
  recordId: string;
  fieldPath: string;
  releaseVersion: string;
}
```

If an implementation chooses not to use a union, it must use the fixed manifest convention `shardId: "manifest"` and `recordId: releaseVersion`, with parser fixtures covering the convention. The union is preferred because `ReleaseManifest.release` is not a shard record.

### Build Info Shape

```ts
interface RelationshipGraphBuildInfo {
  builderName: "@artduo/pipeline/relationship-graph";
  builderVersion: string;
  taxonomyVersion: string;
  inputFingerprints: InputFingerprint[];
}

type InputFingerprint =
  | ManifestFingerprint
  | ShardFingerprint;

interface ManifestFingerprint {
  artifact: "manifest";
  checksum?: string;
  sizeBytes?: number;
}

interface ShardFingerprint {
  artifact: "metadata" | "search" | "mediaIndex" | "backgroundScenes";
  shardId: string;
  checksum?: string;
  recordCount?: number;
  sizeBytes?: number;
}
```

Public build info must not contain local absolute paths, command-line secrets, remote credentials, or internal source file names. Internal reports may include source paths only if they stay out of runtime shards.

### Direction Policy

- All v1 edges are directed.
- Artwork-to-signal edges use `artwork:* -> emotion:*`, `artwork:* -> subject:*`, and `artwork:* -> palette:*`.
- Release membership is report-only in v1.
- Scene match edges are report-only in v1.
- v1 does not emit `related_artwork`.
- A later `related_artwork` edge must either emit two directed edges or declare a separate consumer-level undirected projection. That policy must be decided before adding the relation.

### Empty Graph Semantics

An empty graph is valid only when:

- `nodes` and `edges` are empty arrays.
- `relationship-graph-report.json` explains why no public relationships were emitted.
- Runtime treats the sidecar as present but non-contributory.

Malformed graphs, over-limit graphs, duplicate node IDs, duplicate edge IDs, self-loops, unknown relations, unknown node references, and public edges pointing to internal nodes must be rejected by the parser.

## Node Types

Public runtime shard:

| Type | ID pattern | Source |
|------|------------|--------|
| `artwork` | `artwork:<artworkId>` | metadata/search/media shards |
| `emotion` | `emotion:<normalizedLabel>` | `retrieval.emotionLabels`, mood tags |
| `subject` | `subject:<normalizedTag>` | subject tags |
| `palette` | `palette:<normalizedTag>` | color tags, palette modes |

Internal report only:

| Type | ID pattern | Source |
|------|------------|--------|
| `scene` | `scene:<backgroundSceneId>` | background scene shard |
| `release` | `release:<version>` | manifest |
| `provenance` | `provenance:<kind>:<key>` | static provenance |

## Taxonomy and Normalization Policy

The graph should prevent node fragmentation before it tries to add smarter traversal.

- Normalize signal labels with one shared helper: NFKC, lowercase, trimmed whitespace, punctuation stripped where safe, and stable ASCII slugs for node IDs.
- Use a versioned taxonomy for emotion, subject, and palette aliases. Example: `calm`, `quiet`, `stillness`, and `serenity` may map to one canonical emotion only if the taxonomy says so.
- Record `taxonomyVersion` in the graph `build` object and in `relationship-graph-report.json`.
- Preserve source evidence through `SourceRef`; do not hide the original release field that produced a canonical node.
- Report unmapped labels, merged aliases, and high-degree canonical nodes in the internal report.
- Changing taxonomy behavior requires regenerating the graph and updating the version. Silent taxonomy drift is not allowed.

## Edge Types

Public runtime shard:

| Relation | Source | Confidence | Notes |
|----------|--------|------------|-------|
| `has_emotion` | exact release field | `EXTRACTED` | Safe explanation reason |
| `has_subject` | exact release field | `EXTRACTED` | Safe explanation reason |
| `has_palette` | exact release field | `EXTRACTED` | Safe explanation reason |

Internal report only:

| Relation | Source | Confidence | Notes |
|----------|--------|------------|-------|
| `matches_scene` | scene diagnostics scorer | `EXTRACTED` or `INFERRED` | Must not be public until scorer is shared with runtime |
| `same_release` | manifest membership | `EXTRACTED` | Grouping/debug only |
| `has_static_provenance` | static source URL or source ID | `EXTRACTED` | Not dynamic citation evidence |

Deferred relations:

- `related_artwork`: add only after metadata-only baseline and value gate pass.
- `supports_citation`: add only after citations become static release artifacts or a public citation contract exists.

## Confidence, Score, and Visibility

Keep these concepts distinct:

| Field | Meaning |
|-------|---------|
| `confidence` | Whether the relationship is extracted, inferred, or ambiguous |
| `confidenceScore` | Numeric certainty in that confidence class, 0-1 |
| `relationshipScore` | Strength of the relationship for sorting/debugging, 0-1 |
| `sourceQuality` | Why the source should be trusted |

Confidence invariants:

| Confidence | Required `confidenceScore` range |
|------------|----------------------------------|
| `EXTRACTED` | Exactly `1.0` |
| `INFERRED` | `0.41` to `0.89`, with builder-defined bands in the internal report |
| `AMBIGUOUS` | `0.0` to `0.4` |

`relationshipScore` is ArtDuo's relationship-strength score. It is equivalent in spirit to Graphify's edge `weight`, but it should remain domain-specific and should not be used as a proxy for confidence.

Visibility matrix:

| Confidence | Internal report | Internal debug selector | Public runtime selector |
|------------|-----------------|-------------------------|------------------------|
| `EXTRACTED` | Allowed | Allowed | Allowed only when physically present in the public shard |
| `INFERRED` | Allowed | Allowed behind config | Blocked in v1 |
| `AMBIGUOUS` | Allowed for review only | Blocked | Blocked |

No selector used by detail pages may return internal report fields, debug diagnostics, `INFERRED`, or `AMBIGUOUS` data. The public runtime shard itself should make that impossible by excluding internal data physically.

## Size and Parser Limits

Phase 0 must measure the current release before Phase 1 freezes parser limits. Until that measurement exists, limits in examples are placeholders and final schema fixtures must use numeric values.

| Limit | Value | Behavior |
|-------|-------|----------|
| Max pre-parse bytes | `TBD_BY_PHASE_0` | Loader rejects artifacts before `JSON.parse` if the raw byte size exceeds the approved cap |
| Max shard size | `TBD_BY_PHASE_0` | Parser rejects artifacts above the approved cap |
| Max nodes | `TBD_BY_PHASE_0` | Parser rejects artifacts above the approved cap |
| Max edges | `TBD_BY_PHASE_0` | Parser rejects artifacts above the approved cap |
| Max degree per node | `TBD_BY_PHASE_0` | Builder trims before publish; parser rejects untrimmed artifacts |
| Max sourceRefs per node | `TBD_BY_PHASE_0` | Builder trims or summarizes high-fanout signal provenance before publish |
| Max sourceRefs per edge | `TBD_BY_PHASE_0` | Parser rejects edges carrying excessive provenance payload |
| Max `SourceRef.fieldPath` bytes | `TBD_BY_PHASE_0` | Parser rejects oversized field paths before exposing the graph to selectors |
| Max generic public string bytes | `TBD_BY_PHASE_0` | Parser rejects oversized labels, IDs, reason strings, and other public strings |
| Max reason label bytes | 160 bytes | Reject public graph |
| Duplicate node or edge ID | 0 allowed | Reject |
| Self-loop | 0 allowed | Reject |
| Unknown node reference | 0 allowed | Reject |

Phase 0 should propose concrete caps with a 20-30% buffer over the measured extracted-only public graph. A cap that the current release already exceeds is not acceptable.

Before Phase 1 hardens the limits, run a payload measurement against the current release and record:

- Estimated JSON size for extracted-only public graph.
- Node and edge counts by type.
- Average and max degree by node type.
- Top high-degree signal nodes.
- Browser catalog load delta if the sidecar is present.
- Maximum `sourceRefs` per node and edge.
- Maximum `SourceRef.fieldPath`, reason label, and generic public string byte lengths.
- Raw pre-parse byte size using the same JSON formatting the release builder would emit.

The measurement report should propose numeric size, count, degree, provenance, field path, string, and pre-parse byte caps. Phase 1 must not freeze a cap that the current extracted-only public graph already exceeds.

## Runtime Contract

Keep the manifest field optional:

This contract work starts in PR2 / Phase 1. PR1 must not add `relationshipGraph` to `ReleaseManifest`, update existing manifests, or write any release-directory relationship graph artifact.

```ts
shards: {
  metadata: ShardInfo[];
  search: ShardInfo[];
  mediaIndex: ShardInfo[];
  backgroundScenes: ShardInfo[];
  embeddings?: ShardInfo[];
  relationshipGraph?: ShardInfo[];
}
```

Runtime behavior:

- If `relationshipGraph` is absent, current retrieval and detail pages continue unchanged.
- If present and valid, the catalog may load a public adjacency index using a dedicated object-shard loader.
- If present and invalid, fail closed in build/test contexts; runtime should avoid taking down gallery search unless the release is explicitly configured to require the sidecar.
- Search result ordering stays unchanged in v1.
- Public detail selectors may return only public extracted evidence.

Object-shard loader requirements:

- Do not reuse array-only shard helpers such as `readShardArrays()`.
- Add `readJsonObject()` or `loadRelationshipGraphShard()` for object shards.
- For `ShardInfo.recordCount`, use `nodes.length` for `relationshipGraph` shards.
- The object shard must also include `stats.edgeCount`; parser verifies `stats.nodeCount === nodes.length` and `stats.edgeCount === edges.length`.

PR boundary:

- PR1: no manifest field, parser, object-shard loader, or runtime catalog changes.
- PR2 / Phase 1: define the object-shard contract and parser fixtures; add manifest parsing only after numeric Phase 0 limits are available.
- PR4 / Phase 3: wire the actual optional loader into catalog/debug paths, after the parser and public/internal selector contract exist.

## Scene Matching Policy

Do not emit public `matches_scene` edges until the scene scorer is shared.

The current plan needs one of these implementation paths before public scene graph evidence:

1. Extract scene scoring into a shared module consumed by both pipeline builder and web runtime.
2. Keep scene edges internal and use them only in `relationship-graph-report.json`.
3. Do not emit scene edges in v1.

Recommended v1 path: option 2. This preserves debug value while avoiding mismatch between generated graph evidence and the actual selected scene.

For v1 internal diagnostics, use the pipeline-side scene scorer and label the output `reportOnlySceneDiagnostics`. The report must state that these diagnostics are not runtime evidence and may differ from `selectBackgroundScene()` until the scorer is shared.

## Prompt and Inspiration Registry Policy

The external prompt-picker pattern is useful, but it should not become part of the relationship graph.

If ArtDuo later needs public prompt, style, or inspiration-case browsing, create a sibling artifact such as:

```text
data/releases/<release-version>/
  prompt-candidates-01.json

data/curation/reports/prompt-candidates/<release-version>/
  prompt-candidates-report.json
```

That artifact may borrow the prompt-picker ideas of multi-source adapters, partial source loading, local override metadata, hidden remote IDs, update signatures, and export formats. It must have its own schema, provenance, rights review, and value gate. The relationship graph may reference approved prompt/case IDs only after those records become release-scoped artifacts with public-safe provenance.

## Shared Release Reader Decision

Before Phase 2 starts, choose one path:

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| Move release hydration into `packages/corpus` | One source of truth for pipeline and web | Larger refactor | Best long-term |
| Add a pipeline-only release artifact reader | Fastest builder path | Duplicates web hydration rules | Acceptable for v1 builder |
| Reuse `apps/web/lib/release-catalog.ts` | Avoids duplication | Crosses app/package boundary awkwardly | Avoid |

Recommended v1 path: add a pipeline-only reader, then plan a later consolidation into `packages/corpus` if the sidecar survives evaluation.

## Milestones

| # | Milestone | Target | Success Criteria |
|---|-----------|--------|------------------|
| 0 | Metadata-only baseline and payload measurement | Day 1 | Baseline related selector, metrics, and current-release graph size estimates exist without graph artifact |
| 1 | Contract, limits, visibility | Days 2-3 | Full schema, parser behavior, and public/internal matrix are testable |
| 2 | Extracted-only sidecar builder | Days 4-5 | Generates public-safe extracted edges and internal report |
| 3 | Optional loader and internal selectors | Day 6 | Missing sidecar is safe; public selector returns only public extracted evidence |
| 4 | Evaluation gate | Day 7 | Value is measured against baseline; decision is keep, iterate, or discard |
| 5 | Deferred product surface | Later | User-facing related UI only after gate passes |

## Phase 0: Metadata-Only Baseline and Payload Measurement

| Task | Effort | Depends On | Done Criteria |
|------|--------|------------|---------------|
| Define baseline related selector from existing metadata | 4h | None | Returns related artwork candidates using emotion, subject, palette, grade, and scene-affinity fields without graph artifact |
| Add baseline metrics fixture | 3h | Selector | Captures top K related pairs for representative artworks |
| Add negative sample set | 3h | Selector | Includes intentionally unrelated artwork pairs |
| Measure extracted-only graph payload | 3h | Selector | Reports estimated size, node/edge counts, degree distribution, and top high-degree signals |
| Freeze value thresholds and parser limits | 3h | Metrics + payload reports | Precision@K margin, negative tolerance, reason helpfulness rubric, and proposed numeric limits are written down before schema work starts |

Done means the team can compare graph output against a known metadata-only baseline and judge graph cost before committing to a runtime artifact.

Phase 0 threshold defaults:

- Sample at least 30 anchor artworks, stratified across primary emotion, grade, and subject diversity.
- Include at least 60 negative anchor/candidate pairs selected to look superficially plausible but curatorially wrong.
- Require sidecar precision@5 to beat metadata-only baseline by at least 10 absolute percentage points and reach at least 0.70 precision@5.
- Allow at most 5% of negative pairs to appear in any anchor's top 5.
- Blind-review at least 50 reason strings. Average helpfulness must be at least 2.4 on a 1-3 scale, with at least 70% scoring 2 or higher.
- If Phase 0 data shows these defaults are impossible or inappropriate, revise the plan before implementing the builder.

## Phase 1: Contract, Limits, Visibility

| Task | Effort | Depends On | Done Criteria |
|------|--------|------------|---------------|
| Define `RelationshipGraphShard` object schema | 4h | Phase 0 thresholds | Parser validates schema version, object shape, nodes, edges, limits, and empty graph semantics |
| Define node, edge, `SourceRef`, build info, score, and public-only contracts | 5h | Schema draft | Direction, symmetry, edge ID, reason payload, build provenance, and internal-report boundaries are explicit |
| Define taxonomy and alias normalization contract | 4h | Schema draft | Canonical labels, alias merges, taxonomy versioning, and unmapped-label reporting are testable |
| Add optional `relationshipGraph?: ShardInfo[]` to release manifest contract | 2h | Schema draft | Existing manifests parse; new manifests can reference sidecar |
| Add parser limits and fail-closed behavior | 4h | Schema draft | Oversized, duplicate, unknown, self-loop, and public/internal leaks are rejected |
| Add fixture JSON for valid, empty, malformed, and over-limit graphs | 4h | Parser | Unit tests cover all parser outcomes |

Suggested files:

- `packages/contracts/src/corpus.ts`
- `packages/contracts/src/relationship-graph.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/test/relationship-graph.test.ts`

## Phase 2: Extracted-Only Offline Builder

| Task | Effort | Depends On | Done Criteria |
|------|--------|------------|---------------|
| Choose and implement release artifact reader path | 4h | Phase 1 | Builder can load manifest, metadata, search, media, and background shards without importing web code |
| Create builder entry point | 3h | Reader | Pipeline command targets latest or named release |
| Generate public artwork and signal nodes | 4h | Reader | Every public artwork has an `artwork:` node; release and provenance diagnostics stay report-only |
| Apply taxonomy normalization and alias merging | 4h | Node generation | Canonical signal nodes are stable, original fields remain traceable through `SourceRef`, and unmapped labels are reported |
| Generate deterministic extracted edges | 5h | Node generation | Emotion, subject, and palette edges emit `EXTRACTED` confidence in the public shard |
| Generate internal scene diagnostics only | 3h | Reader | Scene info is report-only until scorer is shared |
| Write graph JSON, internal report JSON, build fingerprints, checksums, and optional manifest update | 5h | Edge generation | Public sidecar writes only public-safe extracted edges; internal report writes outside `data/releases` |

Suggested files:

- `apps/pipeline/src/relationship-graph.ts`
- `apps/pipeline/src/build-relationship-graph.ts`
- `apps/pipeline/package.json`
- `data/releases/<release-version>/relationship-graph-01.json`
- `data/curation/reports/relationship-graph/<release-version>/relationship-graph-report.json`

## Phase 3: Optional Loader and Selectors

| Task | Effort | Depends On | Done Criteria |
|------|--------|------------|---------------|
| Add object-shard JSON loader | 3h | Phase 1 | `readJsonObject()` or `loadRelationshipGraphShard()` reads object shards without using array-only helpers |
| Add optional graph shard loader | 4h | Object loader | Missing sidecar returns `undefined`, not an error; `ShardInfo.recordCount` is verified against `nodes.length` |
| Build public adjacency maps by artwork ID | 4h | Loader | Lookup is O(1), degree-limited, and public-only |
| Add internal debug join for vector retrieval | 4h | Loader | Debug CLI can join vector retrieval results with public sidecar evidence and separately read internal reports from `data/curation/reports` |
| Add public evidence selector | 4h | Loader | Selector returns only public nodes and `EXTRACTED` public edges |
| Keep search path unchanged | 2h | Selectors | `searchReleaseCatalog()` result order is identical with and without sidecar |

Suggested files:

- `packages/corpus/src/release-loader.ts`
- `packages/corpus/src/relationship-graph.ts`
- `apps/web/lib/release-catalog.ts`

### Traversal and Selector Contract Gate

Before Phase 3 implementation starts, write a traversal/selector contract that fixes:

- Input shape: artwork ID, optional relation allowlist, max result count, and debug/internal mode flag.
- Output shape: public selectors return only artwork IDs, public signal labels, public `EXTRACTED` edge summaries, reason codes, and bounded source references.
- Ordering policy: selector order is local to related-evidence display and must not change `searchReleaseCatalog()` or vector/rerank ordering.
- Traversal bounds: max depth, max fanout per node, max returned evidence items, and deterministic tie-breaks.
- Missing/invalid sidecar semantics: absent sidecar returns no evidence; invalid sidecar fails closed in build/test and is non-contributory in runtime unless explicitly required.
- Internal mode: debug selectors may join internal reports only from `data/curation/reports/**`; no detail-page selector may return internal report fields.

Phase 3 should not start until this contract is reviewed against the measured Phase 0 limits and Phase 1 parser behavior.

### Traversal and Selector Contract v1

Phase 3 selectors are public evidence selectors, not search rankers.

Inputs:

- `graph`: an already parsed `RelationshipGraphShard`, or no graph.
- `artworkId`: release artwork ID without the `artwork:` prefix.
- `relationAllowlist`: optional subset of `has_emotion`, `has_subject`, and `has_palette`.
- `maxResults`: bounded positive integer; default `10`.
- `maxFanoutPerNode`: bounded positive integer; default `32`.
- `maxDepth`: fixed to one public hop from artwork to signal node.
- `maxSourceRefsPerEvidence`: bounded positive integer; default `3`.

Outputs:

- Public evidence items only.
- Each item includes artwork ID, signal node ID/type/label, relation, reason code, optional reason label, edge ID, and bounded public `sourceRefs`.
- Items never expose internal report fields, full provenance maps, rejected records, score traces, prompt text, local paths, source-code graph paths, or hidden diagnostics.
- Items never include inferred or ambiguous edges; v1 accepts only `EXTRACTED` release-field edges from `artwork:` nodes to signal nodes.

Ordering:

- Selector ordering is local to related-evidence display.
- Deterministic sort order is relation priority (`has_emotion`, `has_subject`, `has_palette`), then signal label, target ID, edge ID.
- Selectors must not mutate graph input, release catalog records, vector results, rerank results, or web search ordering.

Bounds and failure semantics:

- Missing graph returns an unavailable index and empty evidence.
- Invalid graph is fail-closed: it returns an unavailable index and contributes no evidence unless a build/test path explicitly requires a thrown parser error before selector creation.
- Traversal depth is one hop. No recursive expansion, scene traversal, inferred-neighbor traversal, or graph-boost scoring is allowed in v1.
- Public selector code must not read `data/curation/reports/**`. Internal debug joins may do so later through a separate debug-only path.

## Phase 4: Evaluation Gate

| Task | Effort | Depends On | Done Criteria |
|------|--------|------------|---------------|
| Compare sidecar evidence to metadata-only baseline | 4h | Phase 3 | Report includes precision@K and reason overlap/delta |
| Run existing vector benchmark | 2h | Phase 3 | Ranking benchmark is unchanged |
| Review related-pair precision with negative samples | 4h | Phase 3 | False-positive cases are documented |
| Score reason helpfulness | 4h | Phase 3 | Human review uses a simple pass/fail rubric |
| Evaluate graph-boost experiment offline only | 4h | Phase 3 | Optional report tests a tiny graph score feature without changing runtime ranking |
| Produce acceptance report | 3h | All phases | Decision is keep internal, expose later, iterate, or discard |

Minimum pass gate:

- Existing vector benchmark does not regress.
- Public selector leaks zero internal/debug/ambiguous fields.
- Public graph payload stays within measured and approved size/degree limits.
- Related-pair precision@5 beats metadata-only baseline by at least 10 absolute percentage points and reaches at least 0.70 precision@5.
- No more than 5% of negative pairs appear in any anchor's top 5.
- Blind-reviewed reason helpfulness averages at least 2.4 on a 1-3 scale, with at least 70% of reasons scoring 2 or higher.
- Any graph-boost experiment remains offline until it beats the current vector/rerank path without harming benchmark prompts.
- If value does not beat baseline, do not add user-facing UI.

## Phase 5: Deferred Product Surface

Only start this phase after the evaluation gate passes.

| Task | Effort | Depends On | Done Criteria |
|------|--------|------------|---------------|
| Add detail-page related evidence model | 4h | Phase 4 pass | Detail page can consume public evidence selector |
| Add UI copy and empty states | 3h | Detail model | No graph sidecar yields no broken UI or misleading message |
| Add config-gated rendering | 2h | UI model | Feature can remain internal or limited-release |
| Consider `INFERRED` related-artwork edges | 6h | Phase 4 pass | Direction/symmetry policy, confidence gate, and source scoring are approved |
| Consider graph-assisted rerank boost | Later | Phase 4 pass plus offline benchmark win | A tiny graph score can be enabled only behind config and only after benchmark evidence beats the unchanged baseline |

Suggested files:

- `apps/web/app/artwork/[id]/page.tsx`
- `apps/web/lib/release-catalog.ts`

## Dependencies Map

```text
Metadata-only baseline + payload measurement
  -> Schema + limits + visibility + taxonomy
    -> Optional manifest field
      -> Extracted-only builder
        -> Loader + public/internal selectors
          -> Evaluation gate
            -> User-facing UI or discard
```

The critical path is baseline -> contract -> builder -> loader -> evaluation. UI work is intentionally off the critical path.

## Acceptance Criteria

- Existing release manifests continue to parse.
- New manifests can include optional `relationshipGraph`.
- Graph shard is an object with explicit schema version, build info, limits, nodes, and edges.
- Parser rejects malformed, oversized, duplicate, self-loop, unknown reference, internal-data-bearing, and visibility-leaking public graphs.
- Runtime relationship graph loading uses an object-shard loader; it does not reuse array-only shard helpers.
- `ShardInfo.recordCount` for `relationshipGraph` means public node count, and parser verifies it against `nodes.length`.
- The public sidecar is generated from release artifacts only.
- The public sidecar physically contains public data only; internal report data is not present for selectors to filter out.
- Internal relationship graph reports live under `data/curation/reports/relationship-graph/<release-version>/`, not under `data/releases/<release-version>/`.
- Public build info records builder version, taxonomy version, and input fingerprints without local paths or secrets.
- `SourceRef` and `InputFingerprint` support manifest sources through a union or a tested fixed convention.
- Taxonomy normalization is versioned, deterministic, and covered by parser/builder tests.
- Dynamic citations are excluded from v1.
- Scene evidence is internal/report-only until pipeline and runtime share one scorer.
- Runtime search ranking remains unchanged when the sidecar exists.
- Public selectors return only public `EXTRACTED` evidence.
- Internal reports include node count, edge count, confidence breakdown, rejected records, and top relation categories.
- Evaluation compares sidecar value to a metadata-only baseline using the fixed Phase 0 thresholds and has a discard path.

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Contract ambiguity blocks implementation | High | Medium | Phase 1 defines JSON shape, direction, IDs, source refs, limits, and empty graph behavior |
| Internal report is accidentally published | High | Medium | Reports live under `data/curation/reports`, release publish denylist blocks report-like files under `data/releases` |
| Manifest source references cannot be represented | High | Low | `SourceRef` and `InputFingerprint` use a manifest-aware union or a tested fixed convention |
| Scene evidence disagrees with runtime scene selection | High | Medium | Keep scene edges internal until scorer is shared |
| Internal/debug evidence leaks into detail page | High | Medium | Keep internal/debug data out of the public shard physically and add selector/parser tests |
| Graph duplicates metadata baseline with no added value | Medium | High | Phase 0 baseline and Phase 4 gate can discard sidecar |
| Taxonomy aliases collapse distinct art concepts | Medium | Medium | Version taxonomy, report alias merges, and keep original release fields traceable through `SourceRef` |
| Artifact cannot be reproduced later | Medium | Medium | Public build info and internal report record input fingerprints, builder version, and taxonomy version |
| Inferred related edges feel arbitrary | High | Medium | Defer inferred public edges until after value gate |
| Manifest optionality drifts again | Medium | Medium | Add loader tests for absent sidecar |
| Runtime payload grows too much | Medium | Medium | Phase 0 payload measurement, measured parser limits, and builder-side max degree trimming |
| Code-symbol graph contaminates product semantics | High | Low | Generate only from release artifacts, never from `graphify-out` |
| Prompt registry scope creeps into graph semantics | Medium | Medium | Keep prompt/case sources as a sibling artifact with its own schema and value gate |

## Resolved Decisions

- v1 graph shard is an object, not an array.
- v1 release directory contains only `relationship-graph-01.json`; internal reports live under `data/curation/reports/relationship-graph/<release-version>/`.
- v1 public runtime shard physically contains public data only.
- v1 emits directed edges only.
- v1 records builder version, taxonomy version, and input fingerprints.
- v1 does not emit `related_artwork`.
- v1 does not include dynamic citation evidence.
- v1 public selector allows only public `EXTRACTED` edges.
- v1 scene evidence is internal/report-only unless a shared scorer lands first.
- v1 limits are measured in Phase 0 before schema fixtures freeze them.
- v1 degree strategy is builder-side trimming plus parser rejection of untrimmed artifacts.
- External prompt/case registry support is a separate future artifact, not part of `relationshipGraph`.
- User-facing UI waits for evaluation.

## Open Questions

- Should the long-term release reader move into `packages/corpus` after v1?
- What is the final acceptable browser payload after measuring the current release?
- Should relationship taxonomy live in code, a release-adjacent data file, or `packages/corpus`?
- If `related_artwork` ships later, should consumers treat it as two directed edges or a declared undirected projection?
- What evidence would justify moving an offline graph-boost score into runtime reranking?

## Recommended First Pull Request

Start with measurement, not schema:

1. Add metadata-only related selector and benchmark fixtures.
2. Add current-release extracted-only payload measurement and degree distribution report.
3. Define proposed numeric parser limits from measurement, with buffer.
4. Define value thresholds using the Phase 0 defaults or an explicitly reviewed replacement.
5. Do not add manifest fields, parser code, object-shard loader, public sidecar artifact, runtime catalog wiring, or UI.
6. Write outputs only under `data/curation/reports/relationship-graph/<release-version>/`.

That PR proves the sidecar is worth specifying and prevents contract fixtures from baking in impossible limits.

## Recommended Second Pull Request

Add the contract and parser:

1. Add relationship graph contract types and parser tests.
2. Add optional manifest field parsing.
3. Add build info and taxonomy version fields to the graph schema.
4. Add `SourceRef` and `InputFingerprint` manifest-source fixtures.
5. Add object-shard loader contract tests, including `ShardInfo.recordCount === nodes.length`.
6. Add fixtures for valid, empty, malformed, over-limit, missing-build-info, taxonomy-drift, internal-data-bearing, and visibility-leak graphs.
7. Do not generate release artifacts yet.
8. Do not touch UI.

## Recommended Third Pull Request

Add the extracted-only builder:

1. Generate canonicalized public nodes and deterministic public `EXTRACTED` edges.
2. Write `data/releases/<release-version>/relationship-graph-01.json`.
3. Write `data/curation/reports/relationship-graph/<release-version>/relationship-graph-report.json`.
4. Add release publish denylist checks for relationship graph reports.
5. Add a pipeline command.
6. Run builder against the current release in a review branch.

## Recommended Fourth Pull Request

Wire optional loading and internal evaluation:

1. Load optional graph sidecar into the catalog path with the object-shard loader.
2. Add public selectors with parser/selector tests proving internal data cannot leak.
3. Join graph evidence into internal vector debug output only.
4. Compare against metadata-only baseline using fixed thresholds.
5. Optionally run an offline graph-boost experiment without changing runtime ranking.
6. Produce keep/iterate/discard recommendation before any UI PR.
