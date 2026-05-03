# ArtDuo V2 UI Review Backlog (Phase 2)

Date: 2026-04-29  
Source: `review-screenshots/` desktop + mobile capture set, cross-lens review (`taste-skill`, `impeccable`, `huashu-design`)

Latest review: 2026-05-03  
Latest source: `review-screenshots-2026-05-03/` desktop + mobile capture set, same cross-lens review. No code changes were made during that review pass.

## Scope Boundary

- Keep `frontend/` as legacy donor; do not use it as current runtime implementation target.
- Apply UI changes only when equivalent routes/components exist under `apps/web`.
- Do not block Phase 2 API/session work on visual refactors.

## Prioritized Backlog

1. Landing first-screen art signal
- Add low-contrast real artwork background or 3-slice drifting layer.
- Keep intent input readable with explicit contrast floor.

2. Typography contract enforcement
- Ensure runtime pages actually apply serif/sans pairing.
- Use serif for emotional question/title, sans for controls and metadata.

3. Gallery layout de-templating
- Replace uniform 3-column cards with asymmetric composition (`1 hero + secondary wall`).
- Add image error and loading fallback states; avoid empty card blocks.

4. Immersive detail hierarchy
- Reduce dashboard-style side panel weight.
- Move to caption-first metadata near artwork; defer dense analysis to progressive disclosure.

5. Token centralization
- Extract duplicated color/spacing/typography tokens into shared style source.
- Avoid per-page drift from repeated manual variables.

6. Curatorial loading narrative
- Replace generic spinner with staged curation timeline + artwork placeholders.
- Keep waits meaningful for 10-30s cases.

7. Reduced motion coverage
- Add global `prefers-reduced-motion` fallback to disable non-essential animations/transitions.

## Quick Wins (Next UI Pass)

1. Landing: add artwork background layer at 12%-18% opacity.
2. Gallery: implement asymmetric grid and robust image fallback.
3. Immersive: remove heavy card chrome and adopt caption treatment.
4. Shared: centralize tokens and add reduced-motion media query.

## 2026-05-03 Apps/Web Pass

1. Landing: use release artwork slices as a low-opacity first-viewport art signal.
2. Gallery: replace equal three-column presentation with a primary work, curatorial arc, and stage groups while preserving ranked result access.
3. Detail: move artwork metadata into a caption treatment and reduce side-copy visual weight.
4. Shared: preserve artwork proportions with `object-fit: contain`, enrich image fallback metadata, and add global reduced-motion coverage.

## Acceptance Signals

1. Landing first screen is recognizably art-curation without reading helper text.
2. Gallery avoids equal-weight three-column template and preserves artwork proportions.
3. Immersive view keeps artwork as primary focus (target visual weight 65%-72%).
4. Missing image cases show graceful fallback metadata instead of blank blocks.
5. Reduced-motion mode disables non-essential animation across landing/gallery/immersive states.
