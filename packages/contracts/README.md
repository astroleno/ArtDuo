# @artduo/contracts

ArtDuo V2 Phase 0 shared contracts and fixtures.

## v0.1 freeze

- `artwork.ts`
- `background-scene.ts`
- `background-match.ts`
- `corpus.ts`
- `exhibition-unit.ts`
- `errors.ts`

## Fixtures

Required v0.1 fixtures:

- `fixtures/corpus-manifest.json`
- `fixtures/background-scenes.json`
- `fixtures/exhibition-units.json`
- `fixtures/errors.json`

Bootstrap-only helper fixtures:

- `fixtures/artworks.json`
- `fixtures/background-match.json`

During Phase 0, the manifest intentionally points thin-slice metadata/search/media fixtures at the same `artworks.json` sample so frontend work can start before pipeline shard builders land in `apps/pipeline`.
