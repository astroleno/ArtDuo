# 交接：发布 stage-fit 选画与连续等待（2026-11-15）

执行方：Codex（通过 Ego Lite 操作腾讯云服务器）。监工：Claude（artduo 会话）逐项核对本文第 6 节的证据后才算完成。

**执行通道（2026-11-15 更新）**：Codex 本机的腾讯与 GitHub SSH 均被拦截（见 `docs/verification/artduo-stage-fit-release-preparation-2026-11-14.md`）。改为在 Ego Lite 中登录腾讯云控制台，用实例的网页终端执行；源码用该终端从 GitHub 拉取，拉取失败时沿用 10/29 的“带 SHA-256 冻结源码包”方案。不要为此在本机放开 SSH 或保存任何凭据。

## 1. 发布范围

- 应用提交：以本文所在分支 `codex/artduo-v2-vector-smoke` 上**包含本行的最新提交**为准（2026-11-15 起不再是 `3fc6a44`），发布前在证据中记录完整 SHA。相对 `3fc6a44` 的追加：安静阶段在有其他展厅时不进入城市景观展厅（硬排除）；评测超时与线上一致；作品情绪读解数据与缺口报告（只用于离线统计，不影响线上选画）。Codex 11/14 复核的 27 个文件哈希已与 `3fc6a44` 逐一核对一致。只发布该提交；工作区里未提交的 README、`graphify-out`、历史资料和数据不纳入。
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

## 8. 2026-11-16 追加：随本次发布上线的新数据版本

发布范围扩大为分支最新提交（当前 `2fff032`），在 `3b2569e` 之后追加：

- `89c0664` 近期曝光轮换（选画版本 14）与 Dark Reader 标记。
- `3e9a5dc` “在小房间里加班”这类处境描述不再被当作题材（选画版本 15）。
- `2fff032` 新数据版本 `2026-11-16-open-gap-688`（688 件可展出，新增 58 件）。

### 数据与媒体（不在 Git 中，需单独传输）

1. 版本目录 `data/releases/2026-11-16-open-gap-688`（约 153MB）。传输后在目标机逐文件核对 `manifest.json` 中各分片的 SHA-256；`public-media-manifest.json` 已随提交入库，可对照。
2. `data/curation/affect-readings/2026-11-16-open-gap-688.json` 已在 Git 中，只供离线统计，线上不读取。
3. 公开媒体：本机 `.cache/public-media/2026-11-16-open-gap-688/upload/artduo`（1453 个文件，约 330MB）需按 `docs/deployment/artduo-cdn-cos.md` 在 COS 控制台上传，必须在切换版本之前完成；`.upload.json` 含本机路径，不上传、不打包。
4. 新版本中 14 件芝加哥作品为本地图片（随版本目录传输）；44 件大都会／SMK 作品为经指纹核验的公网原图，首次近看时由目标机按需取图核验。目标机需能访问 `images.metmuseum.org` 与 `iip.smk.dk`（与现有作品相同）。
5. 线上默认版本按目录名排序取最新，传入新目录即会成为默认；必须先完成 COS 上传和第 6 节证据中的回环候选验证，再把目录放入正式数据位置。

### 追加验收

- 候选上用“升职了，想看热闹又明亮的画”和“最近总在小房间里加班，想看看开阔的远方和天空”各完成一次策展：两组都必须有 6 件作品且图片全部加载；后一句此前在本地返回空展览。
- 打开一条旧版本（`2026-10-24-da3-curated-630`）保存的展览链接，作品与顺序不变。
- 深度报告中新增 58 行逐条注明 `depth-anything-small`，原 630 行为 DA3 且字节不变（单元测试 `curated-depth-release` 已覆盖）。
