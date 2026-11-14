# Stage curation release preparation — 2026-11-14

Status: prepared locally; NOT committed, pushed, or deployed.

- Base commit: `d50e8461ba9fdcb37dcd63c6d82ed1554c9630b4`.
- Branch: `codex/artduo-v2-vector-smoke`.
- Intended commit: `feat(experience): align stage curation, rooms and waiting flow`.
- Public destinations: https://tongye.me/ArtDuo and https://aitoshuu.me/ArtDuo.
- Origin: Tencent 122.51.59.89; keep the existing Alibaba gateway and neighboring projects unchanged.

## Validation

- Web: 185/185 and UI: 121/121 passed during the preceding review of these unchanged sources. Both typechecks passed.
- API: 81/81 and API typecheck passed on 2026-11-14.
- Production build passed with `ARTDUO_BASE_PATH=/ArtDuo`; build ID `gUbpAa4pvytME5Ej2aohK`. This is a local macOS validation build, not a Linux deployment artifact.
- Scoped `git diff --check -- apps/web packages/ui` passed.
- Browser E2E, fresh-visit click regression, target-host readiness, and dual-domain checks remain unverified.
- Default package scripts encounter local executable/IPC limitations. Tests used `node --import tsx` (the existing loader path for UI/API); typechecks used the installed TypeScript binary directly.

## Execution blockers

- WebCodex returned `tunnel_client_not_seen`; no remote project connection was available.
- GitHub SSH and Tencent SSH were both blocked with `Operation not permitted`.
- `git add` was blocked when creating `.git/index.lock`. No staging or commit succeeded.
- No production services, routes, credentials or files were changed.

## Known release caveats

- Main gallery quiet-stage city-view handling is a score penalty, not a hard exclusion.
- Stage-fit evaluation currently permits 20-second requests and retries; production uses one 10-second request. Two judge runs differ in 6/25 selections.
- Cross-query variety remains limited (58 to 59 distinct works across 89 selections in the Pro comparison).
- The preface eight-second grace starts at the preface, not at initial submission.
- The reported 3–4 second next-button blockage remains unexplained; CPU load is not a demonstrated cause.

## Scoped source manifest

Only the following 27 code/test files belong to the reviewed iteration. Existing unrelated README edits, graph output, local settings, data imports, reference projects and historical artifacts must not be staged wholesale. Include this preparation note only if useful to the eventual release.

| File | SHA-256 |
| --- | --- |
| `apps/web/app/gallery/[id]/immersive/loading.tsx` | `c73a837c55e2be8dc9d092df17f6cb3836fe25791b14ba89cd3e35281cf42502` |
| `apps/web/components/experience-entry-client.tsx` | `7b529a2f12091f117c2b96d34ffc4b4e16fcf19c76053f8cf160fd0ce8059226` |
| `apps/web/lib/experience-adapter.ts` | `44574fd11cacb986c31027785628696362c31e65eb4c0adb86021a92cd6d6e5c` |
| `apps/web/lib/experience-analytics.ts` | `1f6ada17ec43d130235f2fa026082180ccc7465548085c1aaa23bf9bc79f6b86` |
| `apps/web/lib/sculpture-catalog.ts` | `4d36f9d6782fb1c2fc6f14a008459c1941c26e8e5e36640fec941e85f4f7ef35` |
| `apps/web/lib/semantic-curator.ts` | `31c84724911c1ad0ae1ff578cf2fe9493145bfd2895bcf3841fbbaf665efad0e` |
| `apps/web/lib/semantic-selection.ts` | `232a621e68a028295bfa93fa97f3a3962a10e2468da857e4eab953397716ac5b` |
| `apps/web/test/lib/semantic-curation.test.ts` | `ca149427deb10510ac87cb3a0654a34a2c1b141c784222b5d83f98b1ee6f6873` |
| `packages/ui/src/experience/experience-shell.tsx` | `f3d8b04f09475f4fe2016e89accea4ca4d1a8ccce26aaf89a81711291a1d9355` |
| `packages/ui/src/experience/experience.css` | `916fb2aeb56619a889ffcc5659e8a171c07e4186dcfe3a48460f5bf00677230b` |
| `packages/ui/src/experience/preface.tsx` | `0d545bd019cad09aa4af4521caa9ba9f2cab6a560f708114e96fa66bf80e7e71` |
| `packages/ui/src/experience/scene-matching.test.ts` | `103fcab07f94c9087abcb8604333cceee9a941e267f4c39901c7d79a8c586387` |
| `packages/ui/src/experience/scene-matching.ts` | `2953c11415d5530141837b0fa09c27d6ebace35da8bc8cd3a782427999b9c5bc` |
| `packages/ui/src/experience/sculpture-encounter.test.ts` | `c30f542b4e7f912aff48b82e9485800cbe1923bd37255d094c3189b71429c717` |
| `packages/ui/src/experience/sculpture-encounter.ts` | `4deefc15690a65ca74e54b88a24fbd913efb82af9e220dd5d180f9c7cfb72647` |
| `packages/ui/src/experience/sculpture-types.ts` | `edce0ef7750cfdeb47cc3789f823171414c05c99b2308a600a1d63ff0be69d54` |
| `packages/ui/src/experience/types.ts` | `76d3471a4930384e7f8b7766c79dee64bee3484fada9c9a7cd76ee24141d0399` |
| `packages/ui/src/experience/viewing-session.ts` | `95ee96ff872f506f87af1f925d1e2f8b893e6077729ce2edb7e0f0d509ee2a24` |
| `packages/ui/src/index.ts` | `1d7c54271b5e34fede11fdda926c01f55228a37888c736097a119e1ec62d44d0` |
| `apps/web/lib/artwork-offering.ts` | `e9137ee01f4082ea1a88da068ada7bd52addbf0568181e4ec839daff9e594e38` |
| `apps/web/lib/stage-rerank.ts` | `9cc806357765b8612b64441f0409283b9f95c4317c3107ee60cbc61965ea9de2` |
| `apps/web/scripts/stage-fit-eval.ts` | `5c2f87c1b423a1a1f7f56d2a397c32133c46657390e5f34385c5923d68769a4d` |
| `apps/web/test/fixtures/stage-fit-plans.json` | `f4cf53c11fe4464716b126fef0b3d602a655fee78a6557644180c886bad62ff3` |
| `apps/web/test/lib/artwork-offering.test.ts` | `4368a99057ff8a967456a5588a2309997745493bcd3db590ba3bb817cf7bc28d` |
| `apps/web/test/lib/stage-rerank.test.ts` | `443e9c8e6bee70d6dd09d09804c4aac151534d6d1c8abd77c16a92c7a98b0ee0` |
| `packages/ui/src/experience/waiting-frame.test.tsx` | `174b10419333fddd430c8adc03efdec1b7fa88e16696eefeda119574e577c295` |
| `packages/ui/src/experience/waiting-frame.tsx` | `d781078339feda4bc02ce9f9ce199fa7309eb3b0d92ca1642445ce8d8060df80` |
