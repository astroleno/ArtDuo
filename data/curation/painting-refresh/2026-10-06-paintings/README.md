# Painting refresh — 2026-10-06

This directory records the evidence for the immutable `2026-10-06-paintings` release: 221 retained records and 15 additions, with 144 records eligible for the flat-art gallery. Objects remain in the corpus but do not fill the exhibition.

## Evidence

- `sources/`: cached [Met collection API](https://metmuseum.github.io/) and [Art Institute of Chicago API](https://api.artic.edu/docs/) responses. The refresh obtained 81 Met responses, including the new Great Wave; 141 existing records retain their previous source data after the Met endpoint became unavailable. These records are not represented as freshly verified.
- `provenance.json` / `corpus.json`: candidates, including exclusions and unavailable source records.
- `commons-images.json`: public image copies, file pages, license statements, museum accession checks, and downloaded-file hashes. The AIC image endpoint returned 403; accepted copies were matched to museum accession numbers. Commons licenses vary between CC0 and public-domain faithful reproduction; they are not all labeled CC0. Each record links its supporting file page.
- `image-checks.json`: historical network attempts, including failures; this is not the acceptance list.
- `decoded-images.json`: successful image decodes and original dimensions / hashes. All 15 images were visually checked in the [contact sheet](../../../../docs/assets/painting-curation-2026-10-06/new-paintings-contact-sheet.jpg).
- `curator-notes.json`: ArtDuo's visual descriptions, Chinese aliases, primary subjects, moods, and palettes. These interpretations are separate from museum facts. The first subject is the main depicted subject used for ranking.
- `verified-corpus.json` / `verified-provenance.json`: accepted release inputs. One extra AIC candidate, `artic-66042`, remains excluded because its image was not verified.
- `images/`: proportional JPEG previews (maximum 1280 px) and full views (maximum 2400 px), preserving the complete composition. No artwork crop was applied.

AIC API descriptions have CC BY 4.0 terms; other API fields are CC0 as documented by AIC. Raw responses and object URLs preserve museum attribution. Public-facing descriptions in this release are either factual catalog summaries or explicitly recorded ArtDuo visual observations.

## Reproduction

The collector is resumable and caches museum responses. Use `ARTDUO_MET_CACHE_ONLY=1` when the Met API is unavailable; do not bypass access restrictions. Respect upstream `Retry-After` responses. Source originals must be saved as `<artwork-id>.jpg` in an input directory from the recorded image URLs before verification/finalization; they are not fetched implicitly by the finalizer.

```sh
ARTDUO_MET_CACHE_ONLY=1 python3 scripts/collect/refresh-painting-corpus.py
node scripts/collect/verify-painting-images.mjs /path/to/source-images
# Inspect the contact sheet before accepting its decoded images.
node scripts/collect/finalize-painting-corpus.mjs /path/to/source-images
pnpm exec tsx apps/pipeline/src/build-release-manifest.ts --root-dir . --output-root data/curation/preview --corpus-path data/curation/painting-refresh/2026-10-06-paintings/verified-corpus.json --release-version NEW-VERSION
pnpm exec tsx apps/pipeline/src/build-embedding-shards.ts --root-dir . --output-root data/curation/preview --corpus-path data/curation/painting-refresh/2026-10-06-paintings/verified-corpus.json --release-version NEW-VERSION --embedding-provider local-hash
```

The finalizer is scoped to this collection date. For future additions, create a new input/version directory and adjust the scripts deliberately; never overwrite an accepted release. No paid embedding provider is used. The manifest checksum convention hashes serialized JSON without its trailing newline; `sizeBytes` includes that newline.
