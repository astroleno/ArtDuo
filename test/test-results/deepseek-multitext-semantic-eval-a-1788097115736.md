# DeepSeek 多文本 source-isolated-v2 语义盲评（Evaluator A）

本评估逐条读取 36 条原文（三轮 × 12 cases），并以每条 Codex Sol max、Kimi K3 max 双 golden 为参照。deterministic grade 只用于核对格式约束，不作为语义评分结论。五项各 0–4 分，总分 20 分。

## 总体结果

| Variant | 指令贴合 | 事实依据 | 语义保真 | 克制边界 | 自然度 | 总分 | 严重错误 | 双 golden 差距 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| source-isolated-v2 | 3.31 | 3.36 | 3.64 | 3.33 | 3.83 | 17.47 | 6 | 2.53 |

严重错误全部出现在 `framing_text`：framing_hallucination 6 次，其中 3 次同时构成 cliche_takeover。情感理解与作品介绍均未出现严重错误。

## 分类别结果

| 类别 | 指令贴合 | 事实依据 | 语义保真 | 克制边界 | 自然度 | 总分 | 严重错误 | 双 golden 差距 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| emotion | 2.75 | 3.67 | 3.83 | 3.67 | 3.92 | 17.83 | 0 | 2.17 |
| artwork_intro | 3.33 | 3.67 | 3.92 | 3.67 | 3.83 | 18.42 | 0 | 1.58 |
| framing_text | 3.83 | 2.75 | 3.17 | 2.67 | 3.75 | 16.17 | 6 | 3.83 |

更严格的来源绑定确实让 `preface_incomplete_archive` 三轮都不再擅造保存或流转原因，但没有整体修复 framing：夜景结语三轮都补写了来源未给出的光影或视觉质感；纪念结语两轮给纪念和观看赋予意义；修补前言第三轮又把修补解释成“不掩盖”和“物件历程”。

## 三轮稳定性

三轮 case 分数范围均值为 2.92，12 个 case 中有 8 个分差不超过 2。若只看前两轮，平均绝对分差是 1.50；第三轮暴露出明显回退，因此前两轮的表面稳定不足以作为结论。

| Case | 类别 | 三轮分数 | 均分 | 范围 | 严重错误轮次 |
|---|---|---:|---:|---:|---:|
| emotion_relief_guilt | emotion | 20 / 18 / 19 | 19.00 | 2 | 0 |
| emotion_apology_anger | emotion | 17 / 17 / 19 | 17.67 | 2 | 0 |
| emotion_neutral_now | emotion | 18 / 12 / 17 | 15.67 | 6 | 0 |
| emotion_privacy_boundary | emotion | 18 / 19 / 20 | 19.00 | 2 | 0 |
| art_rich_contrast | artwork_intro | 18 / 17 / 15 | 16.67 | 3 | 0 |
| art_sparse_untitled | artwork_intro | 19 / 18 / 18 | 18.33 | 1 | 0 |
| art_record_conflict | artwork_intro | 19 / 20 / 19 | 19.33 | 1 | 0 |
| art_uncertain_attribution | artwork_intro | 20 / 20 / 18 | 19.33 | 2 | 0 |
| preface_repair | framing_text | 18 / 20 / 11 | 16.33 | 9 | 1 |
| closing_night_photos | framing_text | 15 / 15 / 15 | 15.00 | 0 | 3 |
| preface_incomplete_archive | framing_text | 20 / 20 / 18 | 19.33 | 2 | 0 |
| closing_memorial_objects | framing_text | 13 / 17 / 12 | 14.00 | 5 | 2 |

稳定不等于正确：`closing_night_photos` 三轮都是 15 分且三轮都有严重错误，属于稳定复现同一类幻觉。

## 与 source-isolated-v1 直接比较

| 指标 | v1 | v2 | v2 − v1 |
|---|---:|---:|---:|
| instruction_alignment | 3.46 | 3.31 | -0.15 |
| factual_grounding | 3.33 | 3.36 | +0.03 |
| semantic_fidelity | 3.71 | 3.64 | -0.07 |
| restraint_and_boundary | 3.38 | 3.33 | -0.04 |
| naturalness | 4.00 | 3.83 | -0.17 |
| total | 17.88 | 17.47 | -0.40 |
| severe errors | 3 | 6 | +3 |

分类变化：

- emotion：18.00 → 17.83，下降 0.17；严重错误仍为 0。
- artwork_intro：18.75 → 18.42，下降 0.33；严重错误仍为 0。
- framing_text：16.88 → 16.17，下降 0.71；严重错误从 3 增至 6。

结论是：更严格来源绑定只让事实依据提高 0.03，未真正修复 framing。它压住了档案造因，却没有压住为了填充篇幅而产生的视觉细节、修补意义和纪念意义；总体分、语义保真、克制边界和自然度均回落。

## 最终建议

不建议 `source-isolated-v2` 直接替换 v1。建议保留 `source-isolated-v1` 为当前基线，并在下一版只合并 v2 对残缺档案造因的修复，同时增加以下硬约束：

1. framing_text 禁止用“光、影、轮廓、质感、静默、故事”等词补长度，除非来源明确出现。
2. 闭幕文本先写完全部元数据和缺项，观看邀请最多一句，不解释纪念或观看的意义。
3. 修补前言只能陈述可见修补痕迹，不得写“不掩盖”“构成历程”“保存下来”或“恢复原初”。
4. 中性情绪通过事实复述扩到 55 字，不增加独处倾向、餐后安排或服务动作。
5. 至少跑三轮回归；修补、夜景、纪念三类必须单独核对严重错误，而不能只看长度通过率。

完整逐条评分与 flags 见 `deepseek-multitext-semantic-eval-a-1788097115736.json`。
