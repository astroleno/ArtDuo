# Met Probe Summary

## Contract

- Probe verdicts use `pass / mixed / fail` only.
- Review-loop decisions use `promote / hold / reject` only.
- Canonical batch handoff lives in `data/curation/reports/probe-approved-query-matrix.json`.

## Overview

| Theme | Run ID | Hits | Usable | Image | Artist | Desc | Auto | Manual | Gate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| serenity | `2026-04-25T02-16-37-014Z--serenity--repose` | 40 | 5/10 | 0.8 | 0.6 | 0.0 | `pass` | `pass` | `approved-for-batch` |
| melancholy | `2026-04-24T02-45-55-823Z--melancholy--melancholy` | 79 | 5/10 | 0.7 | 0.8 | 0.0 | `pass` | `pass` | `approved-for-batch` |
| longing | `2026-04-25T02-18-47-977Z--longing--wistful` | 20 | 8/10 | 0.8 | 1.0 | 0.0 | `pass` | `fail` | `redesign-query` |
| wonder | `2026-04-24T02-46-28-237Z--wonder--astonishment` | 80 | 8/10 | 0.9 | 0.8 | 0.0 | `pass` | `pass` | `approved-for-batch` |
| contemplation | `2026-04-24T16-52-22-853Z--contemplation--contemplation` | 60 | 4/10 | 0.8 | 0.6 | 0.0 | `mixed` | `pass` | `approved-for-batch` |
| hope | `2026-04-24T02-49-43-514Z--hope--hope` | 80 | 7/10 | 0.7 | 1.0 | 0.0 | `pass` | `pass` | `approved-for-batch` |
| loneliness | `2026-04-25T02-18-56-673Z--loneliness--solitary-figure` | 40 | 3/10 | 0.3 | 1.0 | 0.0 | `mixed` | `fail` | `redesign-query` |
| joy | `2026-04-24T16-53-04-786Z--joy--merry-company` | 79 | 6/10 | 0.7 | 0.7 | 0.0 | `pass` | `pass` | `approved-for-batch` |
| mystery | `2026-04-24T02-47-52-479Z--mystery--apparition` | 80 | 6/10 | 0.9 | 0.7 | 0.0 | `pass` | `pass` | `approved-for-batch` |
| desire | `2026-04-25T02-17-09-125Z--desire--sensuality` | 58 | 8/10 | 0.8 | 1.0 | 0.0 | `pass` | `pass` | `approved-for-batch` |

## Audit Notes

### serenity

- Probe report: `data/sources/met/probe/serenity/2026-04-25T02-16-37-014Z--serenity--repose/probe-report.md`
- Configured input: query `repose`; synonyms `meditation`; excludes `stillness`, `calm`, `serenity`, `tranquil`
- Summary-level bans: `serenity`, `tranquil`
- Approved batch input: query `repose`; synonyms `meditation`; excludes `stillness`, `calm`, `serenity`, `tranquil`
- Decision note: Switching to the narrower `repose` + `meditation` lane finally removed the worst title-match noise and produced a coherent enough scene set to batch.
- Sample titles: `10065 Repose`, `42547 Bodhidharma in meditation`, `72301 Buddha Seated in Meditation`, `369738 Repose (Ruhende vom Rücken)`, `10239 Meditation`

### melancholy

- Probe report: `data/sources/met/probe/melancholy/2026-04-24T02-45-55-823Z--melancholy--melancholy/probe-report.md`
- Configured input: query `melancholy`; synonyms `pensive`, `solitude`, `wistful`; excludes `sadness`, `blue`
- Summary-level bans: none
- Approved batch input: query `melancholy`; synonyms `pensive`, `solitude`, `wistful`; excludes `sadness`, `blue`
- Decision note: Configured input already matched the approved batch input; this lane is clean enough to move forward.
- Sample titles: `391598 Melancholy`, `38012 Melancholy Courtesan`, `382737 Autumn's Grey and Melancholy`, `285610 Pensive`, `65397 Pensive bodhisattva`

### longing

- Probe report: `data/sources/met/probe/longing/2026-04-25T02-18-47-977Z--longing--wistful/probe-report.md`
- Configured input: query `wistful`; synonyms none; excludes `longing`, `pining`, `melancholy`, `pensive`
- Summary-level bans: `yearning`, `melancholy`, `pensive`
- Decision note: After isolating the lane down to `wistful`, Met still collapses toward portrait, fashion, and satire material; this theme needs a fresh query concept or another source, not another incremental rerun.
- Sample titles: `437900 Comtesse de la Châtre (Marie Charlotte Louise Perrette Aglaé Bontemps, 1762–1848)`, `737764 Woman lost in thought beneath a wutong tree`, `436603 Samson Captured by the Philistines`, `51996 The Courtesan Nishikigi of the Yotsumeya Brothel, from the series “A Pattern Book of the Year’s First Designs, Fresh as Spring Herbs” (“Hinagata wakana hatsu moyō”)`

### wonder

- Probe report: `data/sources/met/probe/wonder/2026-04-24T02-46-28-237Z--wonder--astonishment/probe-report.md`
- Configured input: query `astonishment`; synonyms `amazement`, `awe`, `marvel`; excludes `wonder`, `miracle`
- Summary-level bans: `marvel`
- Approved batch input: query `astonishment`; synonyms `amazement`, `awe`; excludes `wonder`, `miracle`, `marvel`
- Decision note: Dropped `marvel` from the approved batch input after manual review showed surname/card noise in the probe sample.
- Sample titles: `395293 Admiration with Astonishment (Le Brun Travested, or Caricatures of the Passions)`, `623059 Figure 57: Astonishment, stupefaction, amazement`, `817550 Moses striking the rock with a stick to bring forth water, while the Israelites look on in amazement`, `438816 The Forest in Winter at Sunset`, `459100 Tahitian Women Bathing`

### contemplation

- Probe report: `data/sources/met/probe/contemplation/2026-04-24T16-52-22-853Z--contemplation--contemplation/probe-report.md`
- Configured input: query `contemplation`; synonyms `meditation`, `pensive`; excludes `reflection`, `solitude`
- Summary-level bans: `solitude`
- Approved batch input: query `contemplation`; synonyms `meditation`, `pensive`; excludes `reflection`, `solitude`
- Decision note: Dropping `solitude` cleaned the lane enough; the remaining sample is thematically coherent, and the auto miss is mainly an artifact of image-rich `Unknown Artist` works depressing artist coverage.
- Sample titles: `438417 Two Men Contemplating the Moon`, `42547 Bodhidharma in meditation`, `72301 Buddha Seated in Meditation`, `439344 Two Men before a Waterfall at Sunset`, `437394 Aristotle with a Bust of Homer`

### hope

- Probe report: `data/sources/met/probe/hope/2026-04-24T02-49-43-514Z--hope--hope/probe-report.md`
- Configured input: query `hope`; synonyms `renewal`, `aspiration`, `promise`; excludes `looking forward`
- Summary-level bans: `promise`
- Approved batch input: query `hope`; synonyms `renewal`, `aspiration`; excludes `looking forward`, `promise`
- Decision note: Dropped `promise` from the approved batch input after probe review showed it widened the lane faster than it improved fit.
- Sample titles: `460524 Hope`, `11145 The Veteran in a New Field`, `270851 The Time of Promise`, `255973 Statue of Dionysos leaning on a female figure ("Hope Dionysos")`

### loneliness

- Probe report: `data/sources/met/probe/loneliness/2026-04-25T02-18-56-673Z--loneliness--solitary-figure/probe-report.md`
- Configured input: query `solitary figure`; synonyms `solitude`; excludes `pensive`, `desolation`, `lonesome`, `widower`, `office in a small city`
- Summary-level bans: `pensive`, `desolation`, `widower`, `office in a small city`
- Decision note: Even after stripping back to the more scene-led `solitary figure` lane, image coverage stalls far below gate and the remaining sample is too sparse to justify more Met reruns.
- Sample titles: `49171 Landscape with solitary figure`, `825541 The Widower`, `729602 Our Lady of Solitude`

### joy

- Probe report: `data/sources/met/probe/joy/2026-04-24T16-53-04-786Z--joy--merry-company/probe-report.md`
- Configured input: query `merry company`; synonyms `cheerful`, `laughing`, `dancing`; excludes `festival`, `celebration`, `rejoicing`, `joy`, `delight`
- Summary-level bans: `festival`, `celebration`, `rejoicing`, `cheerful`
- Approved batch input: query `merry company`; synonyms `laughing`, `dancing`; excludes `festival`, `celebration`, `rejoicing`, `joy`, `delight`, `cheerful`
- Decision note: Switching to the scene-led `merry company` lane removed the old event-ephemera collapse; `cheerful` still reintroduces interior/card noise, so it stays banned in the approved batch input.
- Sample titles: `437749 Merry Company on a Terrace`, `282190 Pierrot Laughing`, `437812 A Dance in the Country`, `436622 Merrymakers at Shrovetide`, `394395 The Cheerful Cupids`

### mystery

- Probe report: `data/sources/met/probe/mystery/2026-04-24T02-47-52-479Z--mystery--apparition/probe-report.md`
- Configured input: query `apparition`; synonyms `oracle`, `prophecy`, `enigmatic`; excludes `mystery`, `vision`
- Summary-level bans: `enigmatic`
- Approved batch input: query `apparition`; synonyms `oracle`, `prophecy`; excludes `mystery`, `vision`, `enigmatic`
- Decision note: Dropped `enigmatic` from the approved batch input after manual review showed it diluted the narrative-supernatural lane.
- Sample titles: `635400 The Apparition of the Virgin of El Pilar to St. James`, `849803 The Oracle`, `451418 "Muhammad's Call to Prophecy and the First Revelation", Folio from a Majma' al-Tavarikh (Compendium of Histories)`, `340635 An Apparition`, `744086 Prophecy Explained`

### desire

- Probe report: `data/sources/met/probe/desire/2026-04-25T02-17-09-125Z--desire--sensuality/probe-report.md`
- Configured input: query `sensuality`; synonyms `lovers`, `bathing`; excludes `desire`, `longing`, `passion`, `romance`, `yearning`
- Summary-level bans: `yearning`, `passion`, `romance`
- Approved batch input: query `sensuality`; synonyms `lovers`, `bathing`; excludes `desire`, `longing`, `passion`, `romance`, `yearning`
- Decision note: Flipping the lane to `sensuality` with `lovers` / `bathing` removed the sorrow-object spillover and produced a strong enough image-led desire set to batch.
- Sample titles: `451023 The Lovers`, `193438 Eternal Spring`, `459100 Tahitian Women Bathing`, `436131 Bather Stepping into a Tub`, `55233 Lovers`

