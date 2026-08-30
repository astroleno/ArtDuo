# DeepSeek 前言/结语合并与并行拆分流式基准

| Strategy | Samples | First text median | All complete median | Input tokens | Output tokens | Parse rate |
|---|---:|---:|---:|---:|---:|---:|
| combined | 20 | 659 ms | 2373.5 ms | 279.5 | 186.8 | 100.0% |
| split-parallel | 20 | 422 ms | 1556.5 ms | 636.0 | 216.9 | 100.0% |