# DeepSeek 多文本语义盲评（Evaluator A）

本评估逐条读取 48 条原文，并以每条 Codex Sol max、Kimi K3 max 双 golden 为参照；现有 deterministic grade 仅用于核对格式约束，不作为语义评分结论。五项各 0–4 分，总分 20 分。严重错误按“发生该错误的输出条数”计数，同一输出可含多个 flag。

## Variant 汇总

| Variant | 指令贴合 | 事实依据 | 语义保真 | 克制边界 | 自然度 | 总分 | 严重错误 | 双 golden 差距 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| plain | 2.96 | 2.46 | 2.96 | 2.63 | 3.50 | 14.50 | 12 | 5.50 |
| source-isolated-v1 | 3.46 | 3.33 | 3.71 | 3.38 | 4.00 | 17.88 | 3 | 2.13 |

source-isolated-v1 比 plain 高 3.38 分，严重错误从 12 条降至 3 条。提升主要来自事实隔离、原因克制和前言结语不再被诗化套话大面积接管。

## 分类别表现

| Variant | 类别 | 总分 | 严重错误 | 双 golden 差距 |
|---|---|---:|---:|---:|
| plain | emotion | 16.13 | 1 | 3.88 |
| plain | artwork_intro | 17.63 | 3 | 2.38 |
| plain | framing_text | 9.75 | 8 | 10.25 |
| source-isolated-v1 | emotion | 18.00 | 0 | 2.00 |
| source-isolated-v1 | artwork_intro | 18.75 | 0 | 1.25 |
| source-isolated-v1 | framing_text | 16.88 | 3 | 3.13 |

plain 的主要失效集中在 framing_text：补写夜景元素、器物使用史、修补意义、观众心理，并多次把档案缺失归因于保存或流转。source-isolated-v1 已显著修复这一问题，但第二轮的 `preface_repair`、`closing_night_photos`、`preface_incomplete_archive` 再次出现 framing hallucination 或 cause invention。

## 两轮稳定性

| Variant | 平均绝对分差 | 分差不超过 2 的 case | 总 case |
|---|---:|---:|---:|
| plain | 2.33 | 8 | 12 |
| source-isolated-v1 | 2.25 | 6 | 12 |

source-isolated-v1 的平均分差略小，但稳定 case 数反而更少。其波动集中在中性情绪的长度控制，以及修补前言、夜景结语、残缺档案前言的第二轮证据越界。plain 的部分“稳定”是低质量错误连续复现，例如两个纪念结语均为 12 分，不代表可靠性更高。

## 严重错误分布

- plain：cause_invention 3 次、art_hallucination 3 次、framing_hallucination 8 次、cliche_takeover 5 次；共涉及 12 条输出。
- source-isolated-v1：cause_invention 1 次、framing_hallucination 3 次；共涉及 3 条输出。
- 两组均未出现 privacy_violation、diagnosis、decision_takeover 或 record_conflict_resolution。

## 具体强弱点

source-isolated-v1 的优势：

- 情感文本能更稳定地只承接用户明说的感受，隐私和道歉愤怒样本不再轻易补原因。
- 稀疏作品、记录冲突和不确定归属的边界更清楚，作品介绍类别达到 18.75。
- 前言结语的事实覆盖与自然度明显改善，诗化套话接管基本消失。

仍需修补：

- `emotion_neutral_now` 两轮回复持续低于长度下限；第一轮还转向递水、递纸巾，偏离“不分析、安静吃饭”。
- framing_text 仍会把可见痕迹扩写成使用史、恢复效果或器物历史。
- 夜景结语仍补出街灯、建筑、暗处等未给画面元素。
- 残缺档案仍偶发把“原因未记录”改写成“自然损坏、并非遮掩”。

## 最终建议

推荐 `source-isolated-v1` 作为后续基线，但暂不视为完成版。下一轮应：

1. 为中性情绪设置满足 55 字下限的“纯陪伴”模板，不增加分析、建议或服务动作。
2. 对 framing_text 做逐句来源绑定，禁止补使用史、视觉元素、修补效果、观众反应和档案缺失原因。
3. 明确区分“原因未记录”与“原因是保存损坏”；后者无证据时不得出现。
4. 重点复测修补、夜景、残缺档案三类的第二轮稳定性。

完整逐条评分、flags 与 12 case 两轮分数见 `deepseek-multitext-semantic-eval-a-1788096535228.json`。
