# 交接：发布 stage-fit 选画与连续等待（2026-11-15）

执行方：Codex（通过 Ego Lite 操作腾讯云服务器）。监工：Claude（artduo 会话）逐项核对本文第 6 节的证据后才算完成。

## 1. 发布范围

- 应用提交：`3fc6a44f617a5ba757f6e460116be2ab322d51dd`（分支 `codex/artduo-v2-vector-smoke`，已推送）。只发布该提交；工作区里未提交的 README、`graphify-out`、历史资料和数据不纳入。
- 建议 release 名：`20261115-stage-fit`。
- 改动摘要：选画版本升到 13（已保存的展览作品不变，房间会按新规则重新匹配）；新策展在选画后多一次 `deepseek-flash` 调用，10 秒超时，失败退回规则选画并记 `stage-choice-unavailable`；等待画面从提交到前言连续；雕塑侧厅和房间按阶段选择；换画加载中不再显示上一幅。

## 2. 先读，再动手

1. 根目录 `README.md` 的“公网部署规则”6 条，全部适用。
2. `docs/deployment/artduo-dual-domain.md`、`docs/deployment/artduo-public-release.md`。
3. 上一轮完整记录 `docs/verification/artduo-experience-continuity-2026-10-29.md` 及其目录下的 `rollout.py`、`README.md`。本轮沿用同一套流程：冻结源码清单 → 腾讯候选目录 → 目标机构建／类型检查／回归 → 回环候选验证 → 完整备份 → 原子切换 → 双域名验收 → 清理。
4. 不要假设当前线上版本：先读取 `/opt/artduo/current` 的实际指向，作为本轮 `BASE` 与回滚目标，写入证据。

## 3. 本轮必须额外核对的事项

1. **模型额度**（只读，不改）：读取线上 `ARTDUO_MODEL_DAILY_REQUESTS`、`ARTDUO_MODEL_DAILY_TOKENS`、并发上限，以及今日账本已用量。每次新策展将约为 3 次模型请求（意图、选画、导览）。在证据中写出按当前上限估算的“每日可承接新策展数”变化。若余量明显不足，停止并报告，由用户决定是否调整，不得自行修改额度。
2. **选画调用实际生效**：在回环候选上用一句新的合成问句完成一次真实策展（会占用 1 次策展额度，计入证据）。核对保存的 curation 记录：`selectionVersion` 为 13；作品证据含 `model:stage-fit`，或 `degraded` 含 `stage-choice-unavailable` 且原因可解释；记录 `stage-choice` 计时。
3. **等待连续性**：在候选或公网上各截一组帧——提交后约 0.5 秒、加载页、前言待文本、前言出现。四帧中观众原句位置一致，前言文字到达前“进入展厅”不可点。
4. **已有链接**：打开一条线上已有展览链接，作品与顺序不变，能正常进入展厅。

## 4. 禁止事项

- 不修改共享 Nginx，除非验证证明必须；若必须，按 README 第 5 条重新读取现网、备份、`nginx -t` 后再重载。
- 不删除旧发布、旧备份或其他项目文件；不动两个首页和其他 8 个项目。
- 密钥、`/etc/artduo/*.env`、额度账本、手写任务内容、原始日志不得进入 Git、证据包或聊天输出。
- 不放宽、不删改任何测试断言；失败如实记录。

## 5. 回滚条件

出现以下任一情况立即切回 `BASE` 并恢复两项服务：健康检查或 readiness 失败；已有展览链接作品或顺序改变；新策展报错（不是退回规则选画）；双域名任一入口异常；邻站或首页回归失败。回滚后同样完成双域名检查并记录。

## 6. 交付证据（放在 `docs/verification/artduo-stage-fit-2026-11-15/`）

监工按下列清单核对，缺一项即视为未完成：

| 文件 | 必须包含 |
| --- | --- |
| `source-manifest.json` | 提交 SHA、文件数、逐文件 SHA-256 |
| `target/validation.json` | 目标机构建 Build ID、类型检查结果、各包回归通过数／总数、素材检查（预览、深度图、语义模型） |
| `target/quota.json` | 第 3.1 项的上限、今日已用、估算前后对比（只含数字，不含密钥） |
| `target/candidate-curation.json` | 合成问句、curationId、selectionVersion、作品 id 与 evidence、degraded、stage-choice 毫秒数 |
| `target/rollout.json` | BASE、切换时间、新 current、备份路径与 SHA-256、服务状态、环境文件未变 |
| `public-checks.json` | 两个域名的正式／小写／混写入口、深层页、查询参数、版本标记、JS/CSS、健康检查、请求确实到达腾讯；首页与邻站回归 |
| `wait-frames/*.png` | 第 3.3 项四帧（桌面 1440 宽与手机 390 宽各一组） |
| `cleanup.json` | 候选服务、临时凭据、传输包已清理 |

完成后在 `docs/verification/artduo-stage-fit-2026-11-15.md` 写一页记录（格式参照 10/29），列出实际未测项。只提交本轮相关文件并推送，核对远端提交后通知监工。

## 7. 不在本轮范围

真机 Safari／Android 验收由用户本人完成；作品库扩充与情绪说明补全由 Claude 另行进行，不随本次发布。
