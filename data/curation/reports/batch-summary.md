# Met Batch Summary

## Contract

- Canonical probe handoff: `data/curation/reports/probe-approved-query-matrix.json`
- Review loop must consume `review-queue/` only.
- `candidate-pool/` is currently a mirror snapshot of the same candidate set during bootstrap.

## Result

| Theme | Canonical Run ID | Query | Candidates | Excluded | Review queue | Candidate mirror |
| --- | --- | --- | --- | --- | --- | --- |
| serenity | `2026-04-25T02-33-12-593Z--serenity--repose` | `repose` | 71 | 29 | `data/curation/review-queue/serenity--2026-04-25T02-33-12-593Z--serenity--repose.json` | `data/curation/candidate-pool/serenity--2026-04-25T02-33-12-593Z--serenity--repose.json` |
| melancholy | `2026-04-24T03-00-57-855Z--melancholy--melancholy` | `melancholy` | 68 | 32 | `data/curation/review-queue/melancholy--2026-04-24T03-00-57-855Z--melancholy--melancholy.json` | `data/curation/candidate-pool/melancholy--2026-04-24T03-00-57-855Z--melancholy--melancholy.json` |
| wonder | `2026-04-24T03-04-20-455Z--wonder--astonishment` | `astonishment` | 71 | 29 | `data/curation/review-queue/wonder--2026-04-24T03-04-20-455Z--wonder--astonishment.json` | `data/curation/candidate-pool/wonder--2026-04-24T03-04-20-455Z--wonder--astonishment.json` |
| contemplation | `2026-04-24T15-17-19-827Z--contemplation--contemplation` | `contemplation` | 33 | 67 | `data/curation/review-queue/contemplation--2026-04-24T15-17-19-827Z--contemplation--contemplation.json` | `data/curation/candidate-pool/contemplation--2026-04-24T15-17-19-827Z--contemplation--contemplation.json` |
| hope | `2026-04-24T03-11-48-117Z--hope--hope` | `hope` | 68 | 32 | `data/curation/review-queue/hope--2026-04-24T03-11-48-117Z--hope--hope.json` | `data/curation/candidate-pool/hope--2026-04-24T03-11-48-117Z--hope--hope.json` |
| joy | `2026-04-25T02-34-30-154Z--joy--merry-company` | `merry company` | 68 | 32 | `data/curation/review-queue/joy--2026-04-25T02-34-30-154Z--joy--merry-company.json` | `data/curation/candidate-pool/joy--2026-04-25T02-34-30-154Z--joy--merry-company.json` |
| mystery | `2026-04-24T03-14-05-444Z--mystery--apparition` | `apparition` | 90 | 10 | `data/curation/review-queue/mystery--2026-04-24T03-14-05-444Z--mystery--apparition.json` | `data/curation/candidate-pool/mystery--2026-04-24T03-14-05-444Z--mystery--apparition.json` |
| desire | `2026-04-25T02-39-47-702Z--desire--sensuality` | `sensuality` | 46 | 54 | `data/curation/review-queue/desire--2026-04-25T02-39-47-702Z--desire--sensuality.json` | `data/curation/candidate-pool/desire--2026-04-25T02-39-47-702Z--desire--sensuality.json` |

Total candidate pool added this wave: `515`

## Notes

### serenity

- Batch report: `data/sources/met/batch/serenity/2026-04-25T02-33-12-593Z--serenity--repose/batch-report.md`
- Probe approval: `data/curation/reports/probe-approved-query-matrix.json` via probe `2026-04-25T02-16-37-014Z--serenity--repose`
- Canonical review queue: `data/curation/review-queue/serenity--2026-04-25T02-33-12-593Z--serenity--repose.json`
- Candidate-pool mirror: `data/curation/candidate-pool/serenity--2026-04-25T02-33-12-593Z--serenity--repose.json`
- Gap report: `data/curation/reports/gap-report-2026-04-25T02-33-12-593Z--serenity--repose.json`
- Audit contract on canonical artifacts: `satisfied`
- Exclude counts: `missing-image=29`, `missing-title=18`, `missing-object-url=18`, `missing-artist-and-description=18`
- Metadata gaps: `missing-description=100`, `missing-artist=18`
- Starter records: `10065 Repose`, `42547 Bodhidharma in meditation`, `72301 Buddha Seated in Meditation`, `678013 Tiger in Repose`

### melancholy

- Batch report: `data/sources/met/batch/melancholy/2026-04-24T03-00-57-855Z--melancholy--melancholy/batch-report.md`
- Probe approval: `data/curation/reports/probe-approved-query-matrix.json` via probe `2026-04-24T02-45-55-823Z--melancholy--melancholy`
- Canonical review queue: `data/curation/review-queue/melancholy--2026-04-24T03-00-57-855Z--melancholy--melancholy.json`
- Candidate-pool mirror: `data/curation/candidate-pool/melancholy--2026-04-24T03-00-57-855Z--melancholy--melancholy.json`
- Gap report: `data/curation/reports/gap-report-2026-04-24T03-00-57-855Z--melancholy--melancholy.json`
- Audit contract on canonical artifacts: `satisfied`
- Exclude counts: `missing-image=32`, `missing-title=3`, `missing-object-url=3`, `missing-artist-and-description=3`
- Metadata gaps: `missing-description=100`, `missing-artist=3`
- Superseded run: `2026-04-24T02-57-50-204Z--melancholy--melancholy` via `data/sources/met/batch/melancholy/2026-04-24T02-57-50-204Z--melancholy--melancholy/batch-report.json` because Superseded after batch gating was corrected to track `missing-description` as a metadata gap instead of auto-excluding every record.
- Superseded run: `2026-04-24T14-58-34-971Z--melancholy--melancholy` via `data/sources/met/batch/melancholy/2026-04-24T14-58-34-971Z--melancholy--melancholy/batch-report.json` because Discovered non-canonical batch run sharing the same approved batch input.
- Starter records: `391598 Melancholy`, `65397 Pensive bodhisattva`, `38012 Melancholy Courtesan`, `285610 Pensive`

### wonder

- Batch report: `data/sources/met/batch/wonder/2026-04-24T03-04-20-455Z--wonder--astonishment/batch-report.md`
- Probe approval: `data/curation/reports/probe-approved-query-matrix.json` via probe `2026-04-24T02-46-28-237Z--wonder--astonishment`
- Canonical review queue: `data/curation/review-queue/wonder--2026-04-24T03-04-20-455Z--wonder--astonishment.json`
- Candidate-pool mirror: `data/curation/candidate-pool/wonder--2026-04-24T03-04-20-455Z--wonder--astonishment.json`
- Gap report: `data/curation/reports/gap-report-2026-04-24T03-04-20-455Z--wonder--astonishment.json`
- Audit contract on canonical artifacts: `satisfied`
- Exclude counts: `missing-image=29`, `missing-title=2`, `missing-object-url=2`, `missing-artist-and-description=2`
- Metadata gaps: `missing-description=100`, `missing-artist=2`
- Superseded run: `2026-04-24T15-04-34-024Z--wonder--astonishment` via `data/sources/met/batch/wonder/2026-04-24T15-04-34-024Z--wonder--astonishment/batch-report.json` because Discovered non-canonical batch run sharing the same approved batch input.
- Starter records: `395293 Admiration with Astonishment (Le Brun Travested, or Caricatures of the Passions)`, `623059 Figure 57: Astonishment, stupefaction, amazement`, `817550 Moses striking the rock with a stick to bring forth water, while the Israelites look on in amazement`, `438816 The Forest in Winter at Sunset`

### contemplation

- Batch report: `data/sources/met/batch/contemplation/2026-04-24T15-17-19-827Z--contemplation--contemplation/batch-report.md`
- Probe approval: `data/curation/reports/probe-approved-query-matrix.json` via probe `2026-04-24T16-52-22-853Z--contemplation--contemplation`
- Canonical review queue: `data/curation/review-queue/contemplation--2026-04-24T15-17-19-827Z--contemplation--contemplation.json`
- Candidate-pool mirror: `data/curation/candidate-pool/contemplation--2026-04-24T15-17-19-827Z--contemplation--contemplation.json`
- Gap report: `data/curation/reports/gap-report-2026-04-24T15-17-19-827Z--contemplation--contemplation.json`
- Audit contract on canonical artifacts: `satisfied`
- Exclude counts: `missing-image=67`, `missing-title=59`, `missing-object-url=59`, `missing-artist-and-description=59`
- Metadata gaps: `missing-description=100`, `missing-artist=59`
- Starter records: `438417 Two Men Contemplating the Moon`, `42547 Bodhidharma in meditation`, `65397 Pensive bodhisattva`, `72301 Buddha Seated in Meditation`

### hope

- Batch report: `data/sources/met/batch/hope/2026-04-24T03-11-48-117Z--hope--hope/batch-report.md`
- Probe approval: `data/curation/reports/probe-approved-query-matrix.json` via probe `2026-04-24T02-49-43-514Z--hope--hope`
- Canonical review queue: `data/curation/review-queue/hope--2026-04-24T03-11-48-117Z--hope--hope.json`
- Candidate-pool mirror: `data/curation/candidate-pool/hope--2026-04-24T03-11-48-117Z--hope--hope.json`
- Gap report: `data/curation/reports/gap-report-2026-04-24T03-11-48-117Z--hope--hope.json`
- Audit contract on canonical artifacts: `satisfied`
- Exclude counts: `missing-image=32`
- Metadata gaps: `missing-description=100`
- Superseded run: `2026-04-24T15-09-31-657Z--hope--hope` via `data/sources/met/batch/hope/2026-04-24T15-09-31-657Z--hope--hope/batch-report.json` because Discovered non-canonical batch run sharing the same approved batch input.
- Starter records: `460524 Hope`, `11145 The Veteran in a New Field`, `255973 Statue of Dionysos leaning on a female figure ("Hope Dionysos")`, `270851 The Time of Promise`

### joy

- Batch report: `data/sources/met/batch/joy/2026-04-25T02-34-30-154Z--joy--merry-company/batch-report.md`
- Probe approval: `data/curation/reports/probe-approved-query-matrix.json` via probe `2026-04-24T16-53-04-786Z--joy--merry-company`
- Canonical review queue: `data/curation/review-queue/joy--2026-04-25T02-34-30-154Z--joy--merry-company.json`
- Candidate-pool mirror: `data/curation/candidate-pool/joy--2026-04-25T02-34-30-154Z--joy--merry-company.json`
- Gap report: `data/curation/reports/gap-report-2026-04-25T02-34-30-154Z--joy--merry-company.json`
- Audit contract on canonical artifacts: `satisfied`
- Exclude counts: `missing-image=32`, `missing-title=18`, `missing-object-url=18`, `missing-artist-and-description=18`
- Metadata gaps: `missing-description=100`, `missing-artist=18`
- Starter records: `437749 Merry Company on a Terrace`, `282190 Pierrot Laughing`, `248420 Terracotta head of a laughing satyr`, `437812 A Dance in the Country`

### mystery

- Batch report: `data/sources/met/batch/mystery/2026-04-24T03-14-05-444Z--mystery--apparition/batch-report.md`
- Probe approval: `data/curation/reports/probe-approved-query-matrix.json` via probe `2026-04-24T02-47-52-479Z--mystery--apparition`
- Canonical review queue: `data/curation/review-queue/mystery--2026-04-24T03-14-05-444Z--mystery--apparition.json`
- Candidate-pool mirror: `data/curation/candidate-pool/mystery--2026-04-24T03-14-05-444Z--mystery--apparition.json`
- Gap report: `data/curation/reports/gap-report-2026-04-24T03-14-05-444Z--mystery--apparition.json`
- Audit contract on canonical artifacts: `satisfied`
- Exclude counts: `missing-image=10`
- Metadata gaps: `missing-description=100`
- Superseded run: `2026-04-24T14-58-34-971Z--mystery--apparition` via `data/sources/met/batch/mystery/2026-04-24T14-58-34-971Z--mystery--apparition/batch-report.json` because Discovered non-canonical batch run sharing the same approved batch input.
- Starter records: `635400 The Apparition of the Virgin of El Pilar to St. James`, `849803 The Oracle`, `451418 "Muhammad's Call to Prophecy and the First Revelation", Folio from a Majma' al-Tavarikh (Compendium of Histories)`, `340635 An Apparition`

### desire

- Batch report: `data/sources/met/batch/desire/2026-04-25T02-39-47-702Z--desire--sensuality/batch-report.md`
- Probe approval: `data/curation/reports/probe-approved-query-matrix.json` via probe `2026-04-25T02-17-09-125Z--desire--sensuality`
- Canonical review queue: `data/curation/review-queue/desire--2026-04-25T02-39-47-702Z--desire--sensuality.json`
- Candidate-pool mirror: `data/curation/candidate-pool/desire--2026-04-25T02-39-47-702Z--desire--sensuality.json`
- Gap report: `data/curation/reports/gap-report-2026-04-25T02-39-47-702Z--desire--sensuality.json`
- Audit contract on canonical artifacts: `satisfied`
- Exclude counts: `missing-title=25`, `missing-image=54`, `missing-object-url=25`, `missing-artist-and-description=25`
- Metadata gaps: `missing-description=100`, `missing-artist=25`
- Starter records: `451023 The Lovers`, `459100 Tahitian Women Bathing`, `436131 Bather Stepping into a Tub`, `55233 Lovers`

## Suggested Next Step

Move into review loop with `mystery` first, then `wonder`, then `melancholy`, then `hope`. `mystery` has the biggest usable queue and the cleanest exclusion profile.

