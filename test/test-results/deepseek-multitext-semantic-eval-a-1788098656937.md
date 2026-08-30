# Evaluator A：source-isolated-v3.1 最终盲评

## 结论

推荐保留 **single-pass v3.1**，但先补两条 framing 定向约束；不建议把 guarded2 作为默认路径。guarded2 将硬通过率从 30% 提到 65%，但语义均分只增加 0.25，严重错误仍为 3 条，同时平均输入成本增加 112.8%，总延迟中位数增加 130.6%。

约 500 tokens 的压缩对中性情绪没有造成净损失，反而较 v1 提升；对 framing 则有有限但明确的损失：事实边界大体保住了，前言/结语更容易退化成库存式复述，semantic fidelity 明显低于 v3。

## 总览

| 路径 | 全量均分 | Emotion | Framing | 严重错误 | 双 golden 差距 | 硬通过率 | 平均输入 tokens | 总延迟中位数 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| single-pass | 17.975 | 18.625 | 17.8125 | 3/40（7.5%） | 2.025 | 30% | 463.0 | 1.392s |
| guarded2 | 18.225 | 19.125 | 18.0000 | 3/40（7.5%） | 1.775 | 65% | 985.375 | 3.2095s |

两条路径的 emotion 均无严重错误；严重错误全部来自 framing，均为 3/32（9.375%）。

## 五维均分

| 路径 | instruction | grounding | fidelity | restraint | naturalness |
|---|---:|---:|---:|---:|---:|
| single-pass 全量 | 3.3000 | 3.6500 | 3.3250 | 3.8500 | 3.8500 |
| single-pass emotion | 3.7500 | 3.5000 | 3.7500 | 4.0000 | 3.6250 |
| single-pass framing | 3.1875 | 3.6875 | 3.2188 | 3.8125 | 3.9063 |
| guarded2 全量 | 3.6500 | 3.6250 | 3.3250 | 3.8250 | 3.8000 |
| guarded2 emotion | 4.0000 | 3.6250 | 3.8750 | 4.0000 | 3.6250 |
| guarded2 framing | 3.5625 | 3.6250 | 3.1875 | 3.7813 | 3.8438 |

guarded2 相对 single-pass 的主要增量是 instruction alignment（+0.35）。semantic fidelity 不变，factual grounding 与 restraint 各降 0.025，naturalness 降 0.05。因此，硬通过率的大幅提高不能视作同等幅度的文本质量提升。

## 相对历史基线

| 对比 | single-pass | guarded2 |
|---|---:|---:|
| Emotion 相对 v1（18.00） | +0.625 | +1.125 |
| Framing 相对 v3（18.75） | -0.9375 | -0.7500 |
| Emotion 严重错误率变化 | 0 pp | 0 pp |
| Framing 严重错误率变化 | +4.375 pp | +4.375 pp |

压缩后的 framing 主要损失不是基础事实复述，而是文本功能：single-pass 的 framing semantic fidelity 比 v3 低 0.5813；guarded2 低 0.6125。guarded2 虽补足篇幅与格式，却没有恢复前言/结语应有的观看入口和收束能力。

## 八轮稳定性

| Case | single-pass 均分 / 极差 / 严重轮 | guarded2 均分 / 极差 / 严重轮 |
|---|---:|---:|
| emotion_neutral_now | 18.625 / 3 / 0 | 19.125 / 2 / 0 |
| preface_repair | 17.625 / 2 / 0 | 17.250 / 4 / 1 |
| closing_night_photos | 17.000 / 5 / 3 | 18.000 / 5 / 2 |
| preface_incomplete_archive | 17.625 / 1 / 0 | 17.250 / 2 / 0 |
| closing_memorial_objects | 19.000 / 2 / 0 | 19.625 / 1 / 0 |

guarded2 将八轮 framing 均值的极差从 1.75 降到 1.25，但 case 内并非全面变稳：`preface_repair` 极差由 2 扩大到 4，`closing_night_photos` 仍为 5。稳定性改善集中在纪念物结语，并未覆盖高风险夜景与修补前言。

## 严重错误与修订副作用

single-pass 的 3 条严重错误都在夜景结语：一次补出“背后故事待探寻”，两次把资料未记录的“人物身份”误写成“拍摄者身份”。guarded2 修复了其中一次身份漂移，但保留另外两条，并在修补前言新增“物件曾被使用”的无依据经历，严重错误总数没有下降。

guarded2 相对 single-pass 有 14 条最终文本改变；文件当前轮 `repairSummary` 记载 18 次尝试、4 次采用。部分修订还产生“十二件馆藏记录”“原始样貌”等量词或边界问题。这说明长度修订会把原本的形式不足转化为新的语义风险。

## 成本判断

- single-pass 全量平均输入 463 tokens；framing 平均 510.75 tokens，较 v3 的 693.5 下降约 26.4%。
- guarded2 全量平均输入 985.375 tokens，较 single-pass 增加 112.8%；总延迟中位数从 1.392s 增至 3.2095s。
- 代价换来总分 +0.25、framing +0.1875、emotion +0.5，但严重错误率不变。

因此，guarded2 的约 985 tokens / 3.21s 成本不值得作为默认执行路径。它适合只处理 JSON 不可解析、字段缺失等结构性失败；对纯长度不足的语义合格文本，不应自动整段改写。

## 最终建议

采用 single-pass v3.1，并做三个窄修补：

1. 固定区分“照片中的人物身份”与“拍摄者身份”。
2. 明令禁止把未记录内容写成“可探寻的背后故事”。
3. 为 framing 保留一句功能性要求：前言须建立观看入口，结语须收束已知与空缺，不能只复述清单。

若保留条件修订，触发条件应限于解析或字段失败；长度不足只允许局部补句，不重写整段。
