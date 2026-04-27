# Embedding Promotion Gate External Test Pack

This pack freezes the minimum assets needed to reproduce the embedding promotion gate from a clean checkout.

It covers engineering-facing external testing only:
- `.env` resolution for remote embedding providers
- strict remote embedding builds
- local vs remote provider benchmark comparison
- debug retrieval against a fixed release manifest
- hard-failure behavior when remote build configuration is invalid

It does not cover full product external testing:
- `LLM_PROVIDER` and chat provider wiring are still out of scope
- session, SSE, explanation, and app UI flows are not part of this pack

## Included Assets

- `corpus/release-ready.json`: the 221-record release-ready corpus snapshot
- `release/manifest.json`: deterministic local baseline release manifest
- `release/embeddings-01.json`: deterministic local baseline embeddings shard
- `release/embedding-report.json`: local baseline embedding build report
- `benchmarks/vector-promotion-prompts.json`: 24-prompt promotion gate set
- `benchmarks/vector-smoke-prompts.json`: 8-prompt smoke set
- `reports/vector-benchmark-local.json`: local baseline benchmark report
- `reports/vector-benchmark-smoke.json`: smoke benchmark report
- `reports/vector-provider-benchmark-key1.json`: remote provider benchmark using key slot 1
- `reports/vector-provider-benchmark-key2.json`: remote provider benchmark using key slot 2

## Snapshot Expectations

- Release artifact: `221` artworks, `50` background scenes, `221` embeddings
- Local baseline: `top1=0.75`, `top5=0.791667` on the 24-prompt promotion set
- Local smoke: `top1=1.0`, `top5=1.0` on the 8-prompt smoke set
- Remote key1: `top1=0.875`, `top5=0.958333`
- Remote key2: `top1=0.916667`, `top5=1.0`

The local baseline is deterministic. Remote provider results should be treated as the checked-in reference for this snapshot, not as a guarantee that every future rerun will be byte-for-byte identical.

## Quick Start

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
PACK_ROOT="$REPO_ROOT/test-packs/embedding-promotion-gate/2026-04-25-curation-b"
pnpm install
```

No separate `pnpm build` bootstrap is required for the pack commands below. The pipeline CLI entrypoints prepare the workspace package builds themselves.

## 1. Validate the Checked-In Local Baseline

```bash
cd "$REPO_ROOT"
pnpm vector:benchmark -- \
  --manifest "$PACK_ROOT/release/manifest.json" \
  --prompts "$PACK_ROOT/benchmarks/vector-promotion-prompts.json" \
  --output "$PACK_ROOT/reports/vector-benchmark-local.rerun.json"
```

Expected result:
- `provider=local-hash`
- `promptCount=24`
- `rerankTop1HitRate=0.75`
- `rerankTop5HitRate=0.791667`

## 2. Re-run the Smoke Benchmark

```bash
cd "$REPO_ROOT"
pnpm vector:benchmark -- \
  --manifest "$PACK_ROOT/release/manifest.json" \
  --prompts "$PACK_ROOT/benchmarks/vector-smoke-prompts.json" \
  --output "$PACK_ROOT/reports/vector-benchmark-smoke.rerun.json"
```

Expected result:
- `provider=local-hash`
- `promptCount=8`
- `rerankTop1HitRate=1`
- `rerankTop5HitRate=1`

## 3. Run Remote Provider Benchmarks

These commands expect a working `.env` at repo root with embedding provider endpoint/model/API key settings.

### Key Slot 1

```bash
cd "$REPO_ROOT"
pnpm vector:benchmark:provider -- \
  --corpus-path "$PACK_ROOT/corpus/release-ready.json" \
  --prompts "$PACK_ROOT/benchmarks/vector-promotion-prompts.json" \
  --baseline "$PACK_ROOT/reports/vector-benchmark-local.json" \
  --embedding-provider remote \
  --embedding-api-key-slot 1 \
  --output "$PACK_ROOT/reports/vector-provider-benchmark-key1.rerun.json"
```

### Key Slot 2

```bash
cd "$REPO_ROOT"
pnpm vector:benchmark:provider -- \
  --corpus-path "$PACK_ROOT/corpus/release-ready.json" \
  --prompts "$PACK_ROOT/benchmarks/vector-promotion-prompts.json" \
  --baseline "$PACK_ROOT/reports/vector-benchmark-local.json" \
  --embedding-provider remote \
  --embedding-api-key-slot 2 \
  --output "$PACK_ROOT/reports/vector-provider-benchmark-key2.rerun.json"
```

Expected result:
- `provider=remote-openai-compatible`
- `model=text-embedding-3-large`
- `dimensions=3072`
- `baselineComparable=true`
- remote hit rates should not be worse than the local baseline

## 4. Run Debug Retrieval

### Mystery query

```bash
cd "$REPO_ROOT"
pnpm vector:debug -- \
  --manifest "$PACK_ROOT/release/manifest.json" \
  --query "enigmatic oracle shadowed hall" \
  --output "$PACK_ROOT/reports/vector-debug-mystery.rerun.json"
```

### Contemplation query

```bash
cd "$REPO_ROOT"
pnpm vector:debug -- \
  --manifest "$PACK_ROOT/release/manifest.json" \
  --query "quiet meditative reflection in a cloister" \
  --output "$PACK_ROOT/reports/vector-debug-contemplation.rerun.json"
```

Expected result:
- output includes `vectorTopK`, `rerankedTopK`, and `lexicalTopK`
- rerank top-1 should map to the intended theme for the sample query

## 5. Validate Strict Remote Build

This exercises the default release build behavior for embeddings: remote by default, no silent fallback.

```bash
cd "$REPO_ROOT"
REMOTE_OUTPUT_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/artduo-external-pack-remote.XXXXXX")"
pnpm --filter @artduo/pipeline build:release -- \
  --output-root "$REMOTE_OUTPUT_ROOT" \
  --corpus-path "$PACK_ROOT/corpus/release-ready.json" \
  --release-version release

pnpm --filter @artduo/pipeline build:embeddings -- \
  --output-root "$REMOTE_OUTPUT_ROOT" \
  --corpus-path "$PACK_ROOT/corpus/release-ready.json" \
  --release-version release
```

Expected result:
- provider resolves to remote by default
- report shows `model=text-embedding-3-large`
- report shows `dimensions=3072`

## 6. Validate Explicit Local Opt-In

```bash
cd "$REPO_ROOT"
LOCAL_OUTPUT_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/artduo-external-pack-local.XXXXXX")"
pnpm --filter @artduo/pipeline build:release -- \
  --output-root "$LOCAL_OUTPUT_ROOT" \
  --corpus-path "$PACK_ROOT/corpus/release-ready.json" \
  --release-version release

pnpm --filter @artduo/pipeline build:embeddings -- \
  --output-root "$LOCAL_OUTPUT_ROOT" \
  --corpus-path "$PACK_ROOT/corpus/release-ready.json" \
  --release-version release \
  --embedding-provider local
```

Expected result:
- provider resolves to `local-hash`
- report shows `dimensions=256`

## 7. Validate Hard Failure

This confirms strict remote mode does not silently fall back.

```bash
cd "$REPO_ROOT"
BROKEN_OUTPUT_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/artduo-external-pack-broken.XXXXXX")"
pnpm --filter @artduo/pipeline build:release -- \
  --output-root "$BROKEN_OUTPUT_ROOT" \
  --corpus-path "$PACK_ROOT/corpus/release-ready.json" \
  --release-version release

pnpm --filter @artduo/pipeline build:embeddings -- \
  --output-root "$BROKEN_OUTPUT_ROOT" \
  --corpus-path "$PACK_ROOT/corpus/release-ready.json" \
  --release-version release \
  --embedding-endpoint "https://invalid.example.test/v1/embeddings"
```

Expected result:
- command exits non-zero
- no silent fallback to `local-hash`
