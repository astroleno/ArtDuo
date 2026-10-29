# 观展连续性修整证据

对应[验收说明](../artduo-experience-continuity-2026-10-29.md)。公开材料仅包含合成验收身份和去敏发布回执；私有环境、真实手写任务身份、PNG 内容及额度账本不进入 Git。

本地文本日志仅规范换行与行尾空白，原始与归档指纹见 `local-artifact-receipt.json`；测试结果和错误内容未改写。

- `local-tests-final.log`：最终 547 项单元回归；`local-tests-initial.log`：首次并发超时记录。
- `local-typecheck-final.log`、`local-build.log`、`local-ui-build-final.log`、`local-web-build-final.log`：类型检查和生产构建；最终 UI / Web 构建包含缓存图片修复。
- `local-basic.json`、`local-normal.json`、`local-history-reload.json`：设置、阅读、近看、资料页往返、刷新和历史恢复。
- `local-narrative.json`：早到、迟到、未读跳过、存储拒绝四个受控叙事场景。
- `local-panels.json`：模拟手写任务和正式／独立雕塑设置返回。
- `local-layout.json`：三种屏宽下实际图像边界和溢出测量。
- `local-closing-1440.png`、`local-closing-390.png`、`local-closing-320.png`：真实作品结语截图；`fixture-portrait-390.png` 为明确标记的合成比例 fixture。
- `qa-normal.mjs`、`qa-narrative.mjs`、`qa-panels-v3.mjs`、`qa-layout-v3.mjs`：本轮 Ego 验收脚本。需要同一受控会话及隔离 fixture，非自动公网测试入口。
- `source-manifest.json`：冻结应用源码 / 配置与支持文件的字节数、SHA-256。不包含未提交历史数据或私有配置。
- `rollout.py`：本轮 ArtDuo 专用候选、验证、备份、切换与清理脚本；生产结果另记，脚本存在不等于已执行成功。
- `prepare-from-package.py`、`package-receipt.json`：GitHub 读取超时后的离线传输适配及包指纹；应用源码仍固定为同一提交，资源继续全量验哈希。
- `probe-public.py`：双域名 HTTPS、大小写归一、资源、已有展览、健康、手写可用性和首页／邻站的只读检查。

公网及目标机回执在发布后补齐。腾讯和本地 Build ID 由各自构建产生，不要求相同；公网两个域名应与腾讯同一构建对应。
