# 首次入展提速证据

结论、测量条件与局限见 [验收记录](../artduo-first-exhibition-performance-2026-10-28.md)。应用提交 `6c66b794e63f22fd47a2627b2b922cb516f87a09`；腾讯 Build ID `5bVUJJbMPiVU-art1rd1a`。愿望均为本轮合成测试输入。

| 证据 | 内容 |
| --- | --- |
| [before-normal.json](before-normal.json) / [before-river.json](before-river.json) | 旧正式版本普通 / 禁用 HTTP 缓存的首次新策展有效基线 |
| [after-normal.json](after-normal.json) / [after-cold.json](after-cold.json) | 新正式版本同口径首次新策展，应用计时、独立探针、资源和异常记录 |
| [browser-probe.js](browser-probe.js) | 浏览器测量探针；同一调用内安装并完成导航，避免跨调用生命周期失效 |
| [local-flow-final.json](local-flow-final.json) / [local-accepted.json](local-accepted.json) | 本地返回、前进、阅读、近看、刷新与最终接受构建 |
| [local-http.json](local-http.json) / [local-mobile.json](local-mobile.json) | 原生 GET、纠错及手机尺寸回归 |
| [public-flow.json](public-flow.json) | 公网返回、前进、阅读 Back、近看换画 Back 和刷新 |
| [public-mobile.json](public-mobile.json) | tongye 手机尺寸、阅读返回、自动轮换及明暗切换；轮换等待时间从任意周期中途开始，不代表完整轮换周期 |
| [public-checks.json](public-checks.json) | 双域名 HTTP / 静态文件 / 已存展览和 Build ID |
| [local-checks.json](local-checks.json) | 最终 536 项测试、类型检查、构建及原始日志哈希 |
| [package-receipt.json](package-receipt.json) / [target-rollout.json](target-rollout.json) | 冻结源码包、目标验证、切换、一致备份与清理回执 |

原始日志以 gzip 保存，不改动日志内容。解压后 SHA-256 应与回执一致：

- 本地：[测试](local-tests.log.gz)、[构建](local-build.log.gz)、[类型检查](local-typecheck.log.gz)，对应 `local-checks.json`。
- 腾讯：[测试](target-tests.log.gz)、[构建](target-build.log.gz)、[类型检查](target-typecheck.log.gz)、[素材就绪](target-readiness.log.gz)，对应 `target-rollout.json` 的 validation。

## 截图

| 公网 | 本地 |
| --- | --- |
| [新策展普通缓存首画](after-normal.png) | [最终构建首画](local-final-walk.png) |
| [新策展禁用缓存首画](after-cold.png) | [手机展厅](local-mobile-walk.png) |
| [刷新保留当前作品](public-refresh.png) | [手机入口](local-mobile-entry.png) |
| [tongye 手机展厅](public-mobile-walk.png) / [入口](public-mobile-entry.png) | |

截图记录实际页面，不作为首画计时的起止点。后台健康或素材 readiness 不代替用户浏览器中的画面验证；手机尺寸截图不代替真机。
