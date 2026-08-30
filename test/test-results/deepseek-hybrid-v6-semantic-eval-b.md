# DeepSeek hybrid-v6 独立语义评估 B

## 评估口径

- 共 188 条：DeepSeek holdout 128 条、narration 40 条；K3 comparator holdout 16 条、narration 4 条。
- 评分前以 SHA-256 匿名键替换 provider/variant，并在每个证据 case 内打乱输出；188 条分数固定后才恢复标签汇总。
- Holdout 五维：证据忠实、任务功能、语义辨析、自然度、边界约束；Narration 五维：证据忠实、前言功能、结语功能、两段一致性、自然度/边界。各维 0–4，总分 20。
- 不按参考措辞相似度评分，K3 不自动满分。时延、token、hard pass、解析率等性能数据均未参与质量分。

## Variant / provider 总体

| provider | variant | kind | n | 均分 /20 | 严重错误 |
|---|---|---|---:|---:|---:|
| DeepSeek | generic-task-routed-v5 | holdout | 64 | 16.11 | 27（42.19%） |
| DeepSeek | recommended-hybrid-v6 | holdout | 64 | 17.58 | 14（21.88%） |
| Kimi K3 | k3-256k-comparator | holdout | 16 | 19.75 | 0 |
| DeepSeek | combined-baseline-v5 | narration | 20 | 14.90 | 13（65%） |
| DeepSeek | combined-guarded-v6 | narration | 20 | 18.65 | 3（15%） |
| Kimi K3 | k3-256k-comparator | narration | 4 | 19.50 | 0 |

若只按 provider 混合其所有 variant/kind，DeepSeek 168 条均分 16.83、严重错误 57 条；K3 20 条均分 19.70、严重错误 0 条。该数字混合了 baseline 与 candidate，只用于完整汇总，不用于替代架构比较。

## Holdout：按任务类型

| taskType | v5 均分 / 严重 | v6 均分 / 严重 | K3 均分 / 严重 | v6-v5 | v6-K3 |
|---|---:|---:|---:|---:|---:|
| emotion_response | 16.19 / 6 | 17.19 / 2 | 19.75 / 0 | +1.00 | -2.56 |
| artwork_intro | 19.00 / 1 | 19.19 / 1 | 19.50 / 0 | +0.19 | -0.31 |
| exhibition_preface | 13.50 / 6 | 16.63 / 3 | 20.00 / 0 | +3.13 | -3.38 |
| exhibition_closing | 12.88 / 7 | 15.25 / 4 | 20.00 / 0 | +2.38 | -4.75 |
| curation_analysis | 16.06 / 7 | 18.00 / 4 | 19.75 / 0 | +1.94 | -1.75 |

v6 相对 v5 总体提升 1.47 分，严重错误减少 13 条、下降 20.31 个百分点。五维均改善，其中证据忠实 +0.44、语义辨析 +0.47；自然度基本持平（+0.05）。因此改进是真实的来源绑定增益，不是长度或硬通过造成的假象。

但 v6 holdout 尚未稳定：均分 17.58，严重错误率仍为 21.88%，相对 K3 低 2.17 分。差距集中在展览结语、前言和情绪回应；作品介绍已经接近 comparator。

### Holdout 残留风险

- `confirm_emotion_pleased_and_uncertain`：v6 四轮均分 13.0，分差 12；两轮把用户视角写成助手自身的“我很高兴/我不确定”。
- `confirm_preface_glass_negative_boxes`：均分 16.0，分差 10；两轮重新引入“历史载体、时间留痕、未尽叙事”等解释。
- `confirm_closing_seed_packets`：均分 14.25，3/4 轮严重错误；把未知种子状态扩写成采集、保存、后续命运或“记录缺失”。
- `confirm_curation_family_access`：均分 15.0，3/4 轮严重错误；从年龄和手杖推“幼童/长者、低刺激、行动辅助”，或补轮椅、屏幕注视等未给条件。
- v6 holdout 的严重错误标签累计为：语义强化 9、事实虚构 4、能力推断 3、人称错位 2、未知状态误写 1；一条可有多个标签。

## Narration：按 packet

| packet | baseline-v5 均分 / 严重 | guarded-v6 均分 / 严重 | K3 均分 / 严重 | v6-v5 | v6-K3 |
|---|---:|---:|---:|---:|---:|
| corrected_maps | 14.0 / 4 | 18.8 / 1 | 19.0 / 0 | +4.8 | -0.2 |
| unsigned_receipts | 16.2 / 3 | 18.8 / 0 | 20.0 / 0 | +2.6 | -1.2 |
| lantern_slide_boxes | 14.8 / 3 | 19.4 / 0 | 20.0 / 0 | +4.6 | -0.6 |
| seed_catalogues | 14.6 / 3 | 17.6 / 2 | 19.0 / 0 | +3.0 | -1.4 |

guarded-v6 较 baseline 提升 3.75 分，严重错误从 13/20 降到 3/20。证据忠实 +1.20、结语功能 +1.00、自然度/边界 +1.15；两段一致性略降 0.10，但仍为 3.90。它相对 K3 只低 0.85 分，是本轮最接近 comparator 的部分。

三条 narration 严重错误分别来自：种子目录两轮把目录写成农业资料序列、时间见证或使用痕迹；改线地图一轮补“手绘原件”和“特定时期制图实践”。五轮分差方面，改线地图与种子目录均为 6，仍存在坏轮次尖峰。

## K3 comparator 的边界

K3 的 20 条没有严重错误，但并非自动满分：holdout 作品介绍和 narration 的改线地图、种子目录仍有轻微证据或表达扣分。且 K3 每个 case 只有一条，无法估计重复稳定性；因此 2.17 与 0.85 的差距应视为当前样本差，而不是总体模型差的无偏估计。

## 结论

不建议把 hybrid-v6 作为统一 holdout 路由直接替换 v5。v6 确实全面改善 v5，但尚未达到均分 18、严重错误率 10%以内或距 K3 一分以内的语义条件。作品介绍可先采用；情绪、人群可达和 framing 仍需继续加固。

`combined-guarded-v6` narration 可条件采用：其均分 18.65、严重错误率 15%，相对 baseline 是大幅且真实的改善。采用前应补三类硬约束：锁定情绪回应人称；删除“时间痕迹、历史见证、沉默、等待、故事、想象”等默认策展修辞；只允许把 ledger 的 `explicit_absences` 写为空白或不存在，其余未知统一保持“资料未记录”。
