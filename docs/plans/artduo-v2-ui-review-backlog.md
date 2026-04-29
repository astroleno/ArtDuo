# ArtDuo V2 UI Review Backlog (Phase 2)

Date: 2026-04-29  
Source: `review-screenshots/` desktop + mobile capture set, cross-lens review (`taste-skill`, `impeccable`, `huashu-design`)

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
