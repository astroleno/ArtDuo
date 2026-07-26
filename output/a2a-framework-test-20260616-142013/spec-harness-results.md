# A2A Spec Harness Results

- Total: 100
- Pass: 55
- Fail: 40
- Blocked: 5

## By Agent

| Agent | Total | Pass | Fail | Blocked |
| --- | ---: | ---: | ---: | ---: |
| A1 | 10 | 0 | 10 | 0 |
| A2 | 10 | 3 | 7 | 0 |
| A3 | 10 | 9 | 1 | 0 |
| A4 | 10 | 9 | 1 | 0 |
| A5 | 10 | 8 | 2 | 0 |
| A6 | 10 | 7 | 1 | 2 |
| A7 | 10 | 2 | 7 | 1 |
| A8 | 10 | 7 | 3 | 0 |
| A9 | 10 | 1 | 7 | 2 |
| A10 | 10 | 9 | 1 | 0 |

## Cases

| ID | Status | Message |
| --- | --- | --- |
| A1-01 | fail | missing quiet stage |
| A1-02 | fail | missing chaotic resistance |
| A1-03 | fail | missing soft/spacious desire |
| A1-04 | fail | dark nuance was not preserved |
| A1-05 | fail | missing memory hint childhood |
| A1-06 | fail | tension was not elevated |
| A1-07 | fail | expected 5 stages, got 4 |
| A1-08 | fail | missing encouragement/support desire |
| A1-09 | fail | ambiguous input did not lower confidence |
| A1-10 | fail | missing healing narrative resistance |
| A2-01 | pass | OK |
| A2-02 | fail | description/retrieval mood was not derived |
| A2-03 | fail | blue/navy equivalent colors were duplicated |
| A2-04 | fail | missing derived scene/subject signal river |
| A2-05 | pass | OK |
| A2-06 | pass | OK |
| A2-07 | fail | missing restriction boundary display-only |
| A2-08 | fail | minimal capsule confidence should be low |
| A2-09 | fail | generic text became concrete mood |
| A2-10 | fail | conflicting color sources did not lower confidence |
| A3-01 | pass | OK |
| A3-02 | pass | OK |
| A3-03 | pass | OK |
| A3-04 | pass | OK |
| A3-05 | pass | OK |
| A3-06 | fail | fallback/all-rejected trace reason missing |
| A3-07 | pass | OK |
| A3-08 | pass | OK |
| A3-09 | pass | OK |
| A3-10 | pass | OK |
| A4-01 | pass | OK |
| A4-02 | pass | OK |
| A4-03 | pass | OK |
| A4-04 | pass | OK |
| A4-05 | pass | OK |
| A4-06 | pass | OK |
| A4-07 | pass | OK |
| A4-08 | fail | same id appears in supporting and rejected |
| A4-09 | pass | OK |
| A4-10 | pass | OK |
| A5-01 | pass | OK |
| A5-02 | pass | OK |
| A5-03 | pass | OK |
| A5-04 | fail | emotionIds strong match did not beat weak mood match |
| A5-05 | fail | artworkPaletteModes matching failed |
| A5-06 | pass | OK |
| A5-07 | pass | OK |
| A5-08 | pass | OK |
| A5-09 | pass | OK |
| A5-10 | pass | OK |
| A6-01 | pass | OK |
| A6-02 | pass | OK |
| A6-03 | fail | high intensity was not clamped |
| A6-04 | pass | OK |
| A6-05 | pass | OK |
| A6-06 | pass | OK |
| A6-07 | blocked | Requires browser layout-shift measurement or hydration timing; skipped under no-Playwright constraint. |
| A6-08 | pass | OK |
| A6-09 | pass | OK |
| A6-10 | blocked | Viewport coverage and online LLM timeout fallback require browser/network scenario control; skipped under no-Playwright constraint. |
| A7-01 | fail | artwork capsules missing |
| A7-02 | pass | OK |
| A7-03 | fail | violation count/rate grouped statistics missing |
| A7-04 | fail | per-stage curve metrics missing |
| A7-05 | fail | reviewer fields missing |
| A7-06 | fail | failed-case reproduction section missing |
| A7-07 | fail | baseline/candidate diff output missing |
| A7-08 | pass | OK |
| A7-09 | fail | raw user prompts are copied into replay JSON |
| A7-10 | blocked | Script has hardcoded cases and no injectable malformed-case fixture interface to continue after invalid inputs. |
| A8-01 | fail | GrowthForm.sourceText: expected non-empty string |
| A8-02 | fail | 10k+ query was not truncated or rejected |
| A8-03 | pass | OK |
| A8-04 | pass | OK |
| A8-05 | pass | OK |
| A8-06 | pass | OK |
| A8-07 | pass | OK |
| A8-08 | pass | OK |
| A8-09 | fail | GrowthForm.trace[1].score: expected number |
| A8-10 | pass | OK |
| A9-01 | fail | empty-cliche/chicken-soup boundary missing |
| A9-02 | fail | breakup context missing |
| A9-03 | fail | celebration desire missing |
| A9-04 | fail | companionship/intimacy missing |
| A9-05 | fail | child/family context missing |
| A9-06 | fail | crisis/safety risk not detected |
| A9-07 | fail | quiet/alive desires missing |
| A9-08 | blocked | Rapid rewrite cancellation/race behavior requires UI request concurrency instrumentation. |
| A9-09 | blocked | Share-link privacy and return-to-gallery state requires routed browser/session validation. |
| A9-10 | pass | OK |
| A10-01 | pass | OK |
| A10-02 | pass | OK |
| A10-03 | pass | OK |
| A10-04 | pass | OK |
| A10-05 | pass | OK |
| A10-06 | pass | OK |
| A10-07 | fail | dangling evidenceIds accepted |
| A10-08 | pass | OK |
| A10-09 | pass | OK |
| A10-10 | pass | OK |

