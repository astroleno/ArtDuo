# DeepSeek V4 Flash Hybrid-v6 Confirmation A/B

## Holdout

| Variant | Samples | Usable | Hard pass | TTFT median | Total median | Input tokens | Output tokens |
|---|---:|---:|---:|---:|---:|---:|---:|
| generic-task-routed-v5 | 64 | 64 | 51 (79.7%) | 605 ms | 1587 ms | 350.3 | 107.0 |
| recommended-hybrid-v6 | 64 | 64 | 51 (79.7%) | 617 ms | 1603 ms | 529.8 | 107.4 |

## Combined narration

| Variant | Samples | Usable | Hard pass | TTFT median | Total median | Input tokens | Output tokens |
|---|---:|---:|---:|---:|---:|---:|---:|
| combined-baseline-v5 | 20 | 20 | 3 | 602 ms | 2062 ms | 314.3 | 180.6 |
| combined-guarded-v6 | 20 | 20 | 1 | 791 ms | 2061 ms | 517.8 | 176.3 |