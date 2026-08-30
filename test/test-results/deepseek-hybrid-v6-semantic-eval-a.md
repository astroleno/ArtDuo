# Hybrid-v6 独立语义盲评（Evaluator A）

## 结论

推荐 DeepSeek 在 holdout 使用 `recommended-hybrid-v6`，在同源前言/结语使用 `combined-guarded-v6`。评分前已将同一 case 的输出按固定哈希打乱，并隐藏 provider、variant 与性能指标；逐条完成评分后才恢复身份汇总。K3 仅作为独立 comparator，未默认满分，也未按措辞相似度评分。

v6 的主要剩余风险集中在三处：细腻情绪中的角色错置或因果补写、无障碍策展中的年龄/能力推断，以及 narration 把“未记录”包装成“秘密、留白、想象、时间见证”等叙事框架。

## 数据与口径

- DeepSeek：128 条 holdout + 40 条 narration。
- K3 comparator：16 条 holdout + 4 条 narration。
- 共逐条评分 188 条；每条五维，各 0–4，总分 20。
- serious error 包括实质性事实虚构、语义强化、未知状态误写、能力/角色推断、硬约束违背及改变任务含义的 framing。
- JSON 保存全部逐条分数、盲评标签、理由、serious flags、task/packet 汇总及稳定性统计。

## Holdout 总体

| Provider / variant | n | 均分 /20 | 证据忠实 | 严重错误 | 严重率 | 总分标准差 |
|---|---:|---:|---:|---:|---:|---:|
| DeepSeek / generic-task-routed-v5 | 64 | 16.67 | 3.20 | 15 | 23.0% | 3.35 |
| DeepSeek / recommended-hybrid-v6 | 64 | 17.83 | 3.55 | 8 | 12.0% | 3.01 |
| K3 / k3-256k-comparator | 16 | 19.50 | 3.94 | 1 | 6.0% | 1.94 |

DeepSeek v6 − v5：均分 +1.16；严重错误率变化 -11.00 个百分点。

DeepSeek v6 − K3：均分 -1.67；严重错误率变化 +6.00 个百分点。K3 每 case 只有 1 次，稳定性不应与 DeepSeek 多轮直接等量解读。

### Holdout 按 task type：v6 − v5

| Task type | 均分差 | 严重率差（百分点） |
|---|---:|---:|
| artwork_intro | +0.75 | +0.00 |
| curation_analysis | +2.07 | -19.00 |
| emotion_response | +0.88 | -19.00 |
| exhibition_closing | +0.00 | +0.00 |
| exhibition_preface | +1.88 | -13.00 |

### Holdout 按 provider、variant 与 task type

| Provider / variant | Task type | n | 均分 /20 | 严重错误 | 严重率 | 标准差 |
|---|---|---:|---:|---:|---:|---:|
| DeepSeek / generic-task-routed-v5 | artwork_intro | 16 | 18.69 | 0 | 0% | 1.53 |
| DeepSeek / generic-task-routed-v5 | curation_analysis | 16 | 16.12 | 5 | 31% | 3.67 |
| DeepSeek / generic-task-routed-v5 | emotion_response | 16 | 17.00 | 4 | 25% | 2.94 |
| DeepSeek / generic-task-routed-v5 | exhibition_closing | 8 | 15.12 | 3 | 38% | 4.37 |
| DeepSeek / generic-task-routed-v5 | exhibition_preface | 8 | 14.62 | 3 | 38% | 2.45 |
| DeepSeek / recommended-hybrid-v6 | artwork_intro | 16 | 19.44 | 0 | 0% | 0.93 |
| DeepSeek / recommended-hybrid-v6 | curation_analysis | 16 | 18.19 | 2 | 12% | 2.43 |
| DeepSeek / recommended-hybrid-v6 | emotion_response | 16 | 17.88 | 1 | 6% | 2.98 |
| DeepSeek / recommended-hybrid-v6 | exhibition_closing | 8 | 15.12 | 3 | 38% | 2.80 |
| DeepSeek / recommended-hybrid-v6 | exhibition_preface | 8 | 16.50 | 2 | 25% | 4.36 |
| K3 / k3-256k-comparator | artwork_intro | 4 | 20.00 | 0 | 0% | — |
| K3 / k3-256k-comparator | curation_analysis | 4 | 20.00 | 0 | 0% | — |
| K3 / k3-256k-comparator | emotion_response | 4 | 18.00 | 1 | 25% | — |
| K3 / k3-256k-comparator | exhibition_closing | 2 | 20.00 | 0 | 0% | — |
| K3 / k3-256k-comparator | exhibition_preface | 2 | 20.00 | 0 | 0% | — |

## Narration 总体

| Provider / variant | n | 均分 /20 | 证据忠实 | 严重错误 | 严重率 | 总分标准差 |
|---|---:|---:|---:|---:|---:|---:|
| DeepSeek / combined-baseline-v5 | 20 | 12.45 | 2.20 | 17 | 85.0% | 2.89 |
| DeepSeek / combined-guarded-v6 | 20 | 17.05 | 3.55 | 3 | 15.0% | 2.44 |
| K3 / k3-256k-comparator | 4 | 19.75 | 4.00 | 0 | 0.0% | 0.43 |

DeepSeek guarded v6 − baseline v5：均分 +4.60；严重错误率变化 -70.00 个百分点。

DeepSeek guarded v6 − K3：均分 -2.70；严重错误率变化 +15.00 个百分点。

### Narration 按 provider、variant 与 packet

| Provider / variant | Packet | n | 均分 /20 | 严重错误 | 严重率 | 标准差 |
|---|---|---:|---:|---:|---:|---:|
| DeepSeek / combined-baseline-v5 | corrected_maps | 5 | 11.40 | 5 | 100% | 1.74 |
| DeepSeek / combined-baseline-v5 | lantern_slide_boxes | 5 | 10.80 | 5 | 100% | 1.17 |
| DeepSeek / combined-baseline-v5 | seed_catalogues | 5 | 13.60 | 3 | 60% | 3.88 |
| DeepSeek / combined-baseline-v5 | unsigned_receipts | 5 | 14.00 | 4 | 80% | 2.53 |
| DeepSeek / combined-guarded-v6 | corrected_maps | 5 | 16.40 | 1 | 20% | 3.20 |
| DeepSeek / combined-guarded-v6 | lantern_slide_boxes | 5 | 18.00 | 0 | 0% | 1.26 |
| DeepSeek / combined-guarded-v6 | seed_catalogues | 5 | 15.40 | 2 | 40% | 2.42 |
| DeepSeek / combined-guarded-v6 | unsigned_receipts | 5 | 18.40 | 0 | 0% | 0.49 |
| K3 / k3-256k-comparator | corrected_maps | 1 | 19.00 | 0 | 0% | — |
| K3 / k3-256k-comparator | lantern_slide_boxes | 1 | 20.00 | 0 | 0% | — |
| K3 / k3-256k-comparator | seed_catalogues | 1 | 20.00 | 0 | 0% | — |
| K3 / k3-256k-comparator | unsigned_receipts | 1 | 20.00 | 0 | 0% | — |

## 质量差异

- v6 holdout 的优势应看 task 分组：严格路由能减少跨字段串线与边界遗失，但 family-access 仍会把“使用手杖的成年叔叔”误写成“长者/老龄”，细腻情绪仍偶发角色错置、追问或因果补写。
- guarded-v6 narration 的核心收益是把前言限制在可见入口、把结语限制在已知与“资料未记录”的并列；这比单纯缩短文本更能降低 serious errors。
- 仍需保留词组级反叙事护栏：对“秘密、未竟、留白、等待想象、时间痕迹/见证、使用痕迹”等高风险词要求二次证据审计。
- K3 的严格样本通常更稳，但并非自动满分：个别输出也会出现功能过度技术化或对表格/圈记的行为推断。

## 稳定性说明

完整 JSON 提供每个 provider × variant × case/packet 的均分、标准差、极值和严重错误数。DeepSeek holdout 每 case 每 variant 为 4 轮，narration 每 packet 每 variant 为 5 轮；K3 每 case/packet 仅 1 轮，因此其标准差为 0 只表示无重复样本，不代表真实稳定性。

## 最终建议

将 `recommended-hybrid-v6` 与 `combined-guarded-v6` 作为当前候选；上线门槛不应只看均分，还应要求 serious error rate 在情绪、family-access 和 narration 三个高风险分组分别达标。下一轮优先加入角色人称校验、年龄/能力实体保持，以及 unknown-state 专项拒写词审计。
