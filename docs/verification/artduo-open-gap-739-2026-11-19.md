# ArtDuo 11 月 19 日 739 发布验收

2026 年 11 月 19 日 23:55:55（台北时间），腾讯源站切换到 `2026-11-19-open-gap-739`。已推送的应用提交为 `ddca2b97153be414ef512cc2aa21816b186d0321`，包含前言件数校验提交 `5f6d2bd`。

## 切换前核对

- 目标机逐文件核对了 775 个源码文件和 963 个数据文件，验证了 739 张预览、739 张深度图及 739 条外观记录。媒体清单复用了全部 1555 个对象。源码与数据差异通过腾讯网页终端传输，收端核对了压缩包的 SHA-256。[源码清单](artduo-open-gap-739-2026-11-19/source-manifest.json) · [数据清单](artduo-open-gap-739-2026-11-19/release-data-manifest.json) · [媒体差异](artduo-open-gap-739-2026-11-19/media-delta.json) · [压缩包回执](artduo-open-gap-739-2026-11-19/package-receipt.json)
- 本机完整回归通过 576 项。腾讯候选构建、类型检查和 321 项回归通过，回环健康检查正常。候选首次执行时启动脚本的路径遗漏了 `runuser` 所在目录，补齐后在同一候选目录重跑。候选 offer 展览用规则选满 6 件，6 张预览散列核对通过。重排调用用时 707ms，保存记录的 `degraded` 为空。[本机回归](artduo-open-gap-739-2026-11-19/local-regression.json) · [目标机验证](artduo-open-gap-739-2026-11-19/target/validation.json) · [候选展览](artduo-open-gap-739-2026-11-19/target/candidate-curation.json)
- 额度核对时当日剩余 197 次模型请求和 966,433 个保守预留 Token。按每场 3 次请求估算，剩余请求数可承接约 65 场新展览。[额度回执](artduo-open-gap-739-2026-11-19/target/quota.json)
- 腾讯先校验了 `/var/backups/artduo/20261119-open-gap-739` 中的持久状态备份与私有环境副本，随后切换。备份压缩包为 422,047,659 字节。11 月 18 日的 739 发布目录作为回滚点保留。切换后 Web 与手写服务均为 active。[备份与切换](artduo-open-gap-739-2026-11-19/target/rollout.json)

## 公网验收

- `aitoshuu.me` 和 `tongye.me` 均返回健康检查 HTTP 200 和同一构建 `DdRhOSeTDrITCRGNvFSL2`。正式入口、大小写归一、查询参数、深层路径、JS/CSS 和缺失资源 404 均通过。《化装舞会》的预览、深度图、原图在两域均通过字节校验。两域各自的首页和八个邻站响应与切换前一致。11 月 17 日及 11 月 18 日的两条保存展览在两域均按原顺序播放。[切换前检查](artduo-open-gap-739-2026-11-19/public-base.json) · [双域名检查](artduo-open-gap-739-2026-11-19/public-checks.json)
- 在 `aitoshuu.me` 提交固定 offer 请求，从前言走完 6 件画作与中途的雕塑展间，进入结语。同一份展览在 `tongye.me` 回放时作品和顺序一致。公网这次使用规则选画，`degraded` 为空。实时计划最后一段偏向明亮、开阔的天空，收尾选了《Spring in France》。[桌面流程](artduo-open-gap-739-2026-11-19/interactive.json) · [公网展览保存记录](artduo-open-gap-739-2026-11-19/target/live-offer.json) · [双域回放](artduo-open-gap-739-2026-11-19/offer-both-domains.json)
- 用 1440×900 浏览器视口核对等待过程，原句在提交后、加载中、前言待文本时的位置一致。前言待文本时进入按钮禁用。实体 iPhone 和安卓验收由用户进行。[前言待文本](artduo-open-gap-739-2026-11-19/wait-frames/wait-pending.png) · [前言](artduo-open-gap-739-2026-11-19/wait-frames/wait-preface.png) · [结语](artduo-open-gap-739-2026-11-19/wait-frames/wait-closing.png)
- 两个健康请求的探针在检查的访问日志里各匹配 0 条。两域的构建号与腾讯当前构建一致，公网刚生成的 offer 展览也在腾讯持久目录中核对到了同一保存记录。[腾讯源站核对](artduo-open-gap-739-2026-11-19/target/origin-trace.json)

临时候选服务、状态、环境文件和传输包已清理。发布目录与备份均保留。[清理回执](artduo-open-gap-739-2026-11-19/cleanup.json)
