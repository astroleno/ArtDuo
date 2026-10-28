# 观看恢复修整证据

本轮实现、验证与发布说明见[主文档](../artduo-viewing-recovery-2026-10-28.md)。

- [近看失败恢复](near-failed-desktop.png)：定向拒绝下一件预览解码，当前图与署名保留，提供重试及留在原作。
- [手机阅读失败](reading-failed-mobile.png)：图区收至 96px，正文可直接阅读。
- [手机原地重试后](reading-retried-mobile.png)：图片区保持高度，正文原滚动位置不变。
- [首页](entry-desktop.png)：居中问句与单一主操作，现有外观保留。
- [雕塑手机页](sculpture-mobile.png)：《加莱义民》阅读收起后仍留在同一雕塑。

手机为 390×844 浏览器模拟。近看失败为受控本地分支，不代表自然生产故障频率；没有改变公网随机数或绘画选集。

## 发布与公网证据

- [本地最终检查](local-checks.json)、[本地交互记录](browser-local.json)：冻结提交对应的 531 项回归、构建与类型检查及受控失败分支。
- [腾讯发布回执](target-rollout.json)、[持久数据与清理后检](postflight.json)：应用提交、源码包、构建、备份、两张手写图片和清理结果。
- [目标机构建日志](target-build.log.gz)、[类型检查日志](target-typecheck.log.gz)、[143 项相关回归日志](target-tests.log.gz)、[素材与运行环境检查](target-readiness.log.gz)：压缩保留原始字节，解压后哈希与回执一致。
- [双域名 HTTPS 检查](public-checks.json)、[公网交互记录](browser-public.json)：同一新 Build ID、已有展览、静态资源、返回行为与雕塑状态。
- [公网首页](public-entry.png)、[公网换画返回后](public-walk.png)、[tongye 手机首页](public-tongye-mobile.png)、[公网雕塑手机页](public-sculpture-mobile.png)。

检查复用了已完成的展览，没有重新策展；雕塑页为明确指定《加莱义民》的试展入口，不用于证明 50% 正式彩蛋抽中率。AO / 环境 ready 是本次浏览器运行状态，不能替代实体手机的性能和感应验收。
