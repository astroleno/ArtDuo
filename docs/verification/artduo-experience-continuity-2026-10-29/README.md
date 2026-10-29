# 观展连续性修整证据

对应[验收说明](../artduo-experience-continuity-2026-10-29.md)。公开材料仅包含合成验收身份和去敏发布回执；私有环境、真实手写任务身份、PNG 内容及额度账本不进入 Git。

本地与目标机的构建／测试输出仅规范换行与行尾空白，原始与归档指纹见 `local-artifact-receipt.json` 和 `target-artifact-receipt.json`；测试结果和错误内容未改写。没有收集线上访问或模型调用日志。

- `local-tests-final.log`：最终 547 项单元回归；`local-tests-initial.log`：首次并发超时记录。
- `local-typecheck-final.log`、`local-build.log`、`local-ui-build-final.log`、`local-web-build-final.log`：类型检查和生产构建；最终 UI / Web 构建包含缓存图片修复。
- `local-basic.json`、`local-normal.json`、`local-history-reload.json`：设置、阅读、近看、资料页往返、刷新和历史恢复。
- `local-narrative.json`：早到、迟到、未读跳过、存储拒绝四个受控叙事场景。
- `local-panels.json`：模拟手写任务和正式／独立雕塑设置返回。
- `local-layout.json`：三种屏宽下实际图像边界和溢出测量。
- `local-closing-actions.json`、`qa-closing-actions.mjs`：320px 下主动结束、回看同一末件、受控分享失败／重试及长标题后操作可达；不实际下载分享图。
- `local-closing-1440.png`、`local-closing-390.png`、`local-closing-320.png`：真实作品结语截图；`fixture-portrait-390.png` 为明确标记的合成比例 fixture。
- `qa-normal.mjs`、`qa-narrative.mjs`、`qa-panels-v3.mjs`、`qa-layout-v3.mjs`：本轮 Ego 验收脚本。需要同一受控会话及隔离 fixture，非自动公网测试入口。
- `source-manifest.json`：冻结应用源码 / 配置与支持文件的字节数、SHA-256。不包含未提交历史数据或私有配置。
- `rollout.py`：本轮 ArtDuo 专用候选、验证、备份、切换与清理脚本；生产结果另记，脚本存在不等于已执行成功。
- `prepare-from-package.py`、`package-receipt.json`：GitHub 读取超时后的离线传输适配及包指纹；应用源码仍固定为同一提交，资源继续全量验哈希。
- `test-fixture-receipt.json`、`resume-validation.py`：目标机补齐历史测试数据、保留原断言并移除临时资料；已通过步骤用日志指纹和冻结源码核对后复用。
- `finish-validation.py`：在全数相关回归通过后恢复正式配置检查。只读取配置、加载本地模型及回放已有 HTML，独立确认没有候选 provider 调用。
- `probe-public.py`：双域名 HTTPS、大小写归一、资源、已有展览、健康、手写可用性和首页／邻站的只读检查。

- `public-baseline.json`、`public-checks.json`、`neighbors-comparison.json`：双域名入口、构建标记、静态资源及 18 个首页／邻站入口的前后检查。
- `public-browser.json`、`qa-public-v3.mjs`、`public-*.png`：最终通过的公网桌面与手机尺寸交互记录。
- `target/validation.json`、`target/rollout.json`、`target/post-deploy.json`：目标机 163 项相关回归、正式素材、源码绑定、备份、私有状态与额度连续性。
- `target/cleanup.json`、`target/temporary-files-cleanup.json`、`target/transfer-cleanup.json`、`browser-cleanup.json`：候选、临时文件、传输包和浏览器清理。
- `target-evidence-receipt.json`、`target/public-evidence-files.json`：88,337 B 去敏证据包及 35 个文件的原始指纹；解包逐一验证后才规范文本日志。永久回执 `transfer-cleanup.json` 为证据包删除后另行下载。
- `target/prepare*.log`、`target/web-tests-without-fixture.log`、`target/readiness-disabled-config.log`：保留实际失败原因，不能将其当作通过记录；最终结果分别见对应成功日志。
- `target/execution-helpers.json`：实际执行脚本指纹；最终正式配置验证修正后的 helper 与本目录 `rollout.py` 一致，早期传输包仍记录其原始脚本版本。

腾讯和本地 Build ID 由各自构建产生，不要求相同；两个公网域名已核对为腾讯同一构建。服务器原始构建／测试输出保留在受保护的 `.deployment`，完整私有恢复点另存于 `/var/backups/artduo/20261029-experience-continuity`。
