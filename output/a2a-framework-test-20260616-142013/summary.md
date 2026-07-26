# ArtDuo V2 A2A Framework Test Run

- Source spec: `docs/specs/artduo-v2-a2a-framework-test-examples.md`
- Run directory: `output/a2a-framework-test-20260616-142013`
- Date: 2026-06-16
- Browser/E2E: not run. This run intentionally avoided Playwright per project instruction.

## Full Non-Playwright Test Suite

Command:

```bash
pnpm -r test
```

Result: pass.

Workspace totals from `pnpm-r-test.log`:

| Workspace | Tests | Pass | Fail |
| --- | ---: | ---: | ---: |
| `@artduo/contracts` | 36 | 36 | 0 |
| `@artduo/corpus` | 39 | 39 | 0 |
| `@artduo/ui` | 13 | 13 | 0 |
| `@artduo/web` | 23 | 23 | 0 |
| `@artduo/api` | 37 | 37 | 0 |
| `@artduo/pipeline` | 37 | 37 | 0 |
| Total | 185 | 185 | 0 |

Log: `pnpm-r-test.log`

## Targeted Commands And Results

| Area | Command | Result | Log |
| --- | --- | --- | --- |
| Contracts / parsers | `pnpm --filter @artduo/contracts exec tsx --test src/affective-agent.test.ts` | 5 pass, 0 fail | `contracts-affective-agent.log` |
| Corpus / A2A extraction | `pnpm --filter @artduo/contracts build && pnpm --filter @artduo/corpus exec tsx --test src/affective-intent.test.ts src/artwork-agent-capsule.test.ts` | 10 pass, 0 fail | `corpus-a2a.log` |
| Web lib / negotiation + gallery route | `pnpm --filter @artduo/web exec tsx --test test/lib/affective-negotiation.test.ts test/lib/gallery-route.test.ts` | 6 pass, 0 fail | `web-a2a-lib.log` |
| UI / immersive orchestration | `pnpm --filter @artduo/ui exec tsx --test src/immersive/scene-orchestrator.test.ts src/immersive/immersive-gallery.test.tsx` | 5 pass, 0 fail | `ui-immersive-a2a.log` |
| Replay evaluation | `pnpm exec tsx scripts/evaluate-intent-immersion.ts a2a-framework-test-20260616-142013` | 50 cases completed | `evaluate-intent-immersion.log` |
| Replay repeat | `pnpm exec tsx scripts/evaluate-intent-immersion.ts a2a-framework-test-20260616-142013-repeat` | 50 cases completed | `evaluate-intent-immersion-repeat.log` |
| Spec coverage audit | `node output/a2a-framework-test-20260616-142013/audit-spec-coverage.mjs` | 100 rows parsed | `spec-coverage-audit.log` |
| Spec harness | `pnpm exec tsx output/a2a-framework-test-20260616-142013/run-a2a-spec-harness.ts` | 55 pass, 40 fail, 5 blocked | `spec-harness.log` |
| Claude Code read-only review | `claude -p ...` | Review completed | `claude-readonly-review-v2.log` |

## Replay Summary

- Cases: 50
- Average intent score: 0.955
- Average immersion score: 1
- Average growth-form score: 0.883
- Average total score: 0.975
- Low intent cases under 0.5: 0
- Hard resistance violations: 0
- Repeat run matched deterministically at JSON level in the spec harness.

Replay artifacts:

- `output/intent-immersion-eval/a2a-framework-test-20260616-142013.json`
- `output/intent-immersion-eval/a2a-framework-test-20260616-142013.md`
- `output/intent-immersion-eval/a2a-framework-test-20260616-142013-repeat.json`
- `output/intent-immersion-eval/a2a-framework-test-20260616-142013-repeat.md`

## 100-Row Spec Harness Summary

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
| Total | 100 | 55 | 40 | 5 |

Artifacts:

- `spec-harness-results.json`
- `spec-harness-results.md`
- `run-a2a-spec-harness.ts`

## Coverage Audit

- Rows parsed: 100
- One-to-one source evidence: 3
- Layer covered only: 83
- Manual/E2E only: 10
- Not automated: 4

Artifacts:

- `spec-coverage-audit.json`
- `spec-coverage-audit.md`
- `audit-spec-coverage.mjs`

## Coverage Note

The source spec lists 100 designed examples. The existing automated suite is green, but the 100-row spec is not fully satisfied. Current implementation/spec harness result is 55 pass, 40 fail, 5 blocked. The largest gaps are A1 user affect extraction, A7 replay/reporting metadata, and A9 product journey/safety context handling.
