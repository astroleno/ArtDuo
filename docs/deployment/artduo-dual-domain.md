# ArtDuo 双域名部署

用户已确认：腾讯运行应用、手写后台和持久数据；阿里只转发两个域名的 `/ArtDuo`，使用腾讯现有 HTTPS 加密回源。2026-10-25 完成隔离与恢复验收后，用户明确批准“切换公网测试版”，两个公网入口已启用并通过本轮检查。后续同范围操作复用该批准，不重复申请。

2026-10-28 用户批准继续优化首次进入展览，已移除整页重载和新策展的重复页面请求，提交推送并同步两个公网域名。当前正式版本见 [首次入展提速上线记录](../verification/artduo-first-exhibition-performance-2026-10-28.md)。此前 [观看恢复上线记录](../verification/artduo-viewing-recovery-2026-10-28.md) 与 [前端连续性上线记录](../verification/artduo-frontend-continuity-2026-10-28.md) 保留。首页、五秒翻牌、沉浸随动、18 件雕塑与 50% 概率保持不变，人物雕塑继续作为独立彩蛋。

2026-10-27 的 [自动翻牌上线记录](../verification/artduo-entry-autoflip-production-2026-10-27.md)、[新版默认入口与归档记录](../verification/artduo-default-experience-production-2026-10-27.md) 及 [输入页与按钮上线记录](../verification/artduo-entry-glass-production-2026-10-27.md) 保留。雕塑素材与彩蛋验收见 [雕塑上线记录](../verification/artduo-sculpture-production-2026-10-27.md)。

| 域名 | 普通入口 | 新版体验与手写卡 |
| --- | --- | --- |
| aitoshuu.me | <https://aitoshuu.me/ArtDuo> | <https://aitoshuu.me/ArtDuo?view=experience> |
| tongye.me | <https://tongye.me/ArtDuo> | <https://tongye.me/ArtDuo?view=experience> |

2026-10-27 用户明确要求两个域名默认使用新版，并归档旧版。两个 `/ArtDuo` 入口统一显示当前体验，旧 `view=classic` 地址按新版兼容打开，不再提供经典模式切换；旧源码及来源指纹保存在 `archive/classic-web-2026-10-27/`。此前记录的设备、首画与深度观感验收边界继续保留，不因默认入口切换而自动视为通过。

## 地址与模块

| 位置 | 职责 |
| --- | --- |
| 腾讯 `122.51.59.89` | 一个 Next 实例监听 `127.0.0.1:3240`，一个独立 Inko Worker；均已启动并设为开机启动 |
| `/opt/artduo/releases/<release>` | 与源码、锁文件配对的构建；Linux 上安装依赖 |
| `/opt/artduo/current` | 当前指向 `/opt/artduo/releases/20261028-first-exhibition-performance`；上一版 `20261028-viewing-recovery` 与更早恢复点保留 |
| `/opt/artduo/runtime` | ArtDuo 独立 Node.js v22.23.4、pnpm 8.15.1 运行时 |
| `/etc/artduo/artduo.env` | 私有环境文件，包含现有 DeepSeek、Inko 密钥及随机请求盐；权限 0600 |
| `/var/lib/artduo` | 持久状态、630 张校验预览、额度和手写任务；应用用户独占 |
| 阿里 `47.103.120.24` | `aitoshuu.me`、`tongye.me` 的现有站点只新增 ArtDuo location |

构建和运行均设置 `ARTDUO_BASE_PATH=/ArtDuo`。Next 的导航器自动加前缀；原生链接、表单、history、接口和素材使用共享路径工具。不可把带前缀地址再次传给 Next 导航器。作品原始资源路径仍用于磁盘定位，不作为浏览器公开地址。

`ARTDUO_PUBLIC_ORIGIN=https://aitoshuu.me`，`ARTDUO_PUBLIC_ORIGINS=https://tongye.me`。手写写入要求 Origin 在白名单内且与当前 Host 一致。Cookie 为 host-only、HttpOnly、SameSite=Lax、Secure，路径为 `/ArtDuo/api/handwriting`。两个域名各有自己的会话与草稿，公共语料和版本由同一个后端提供。

## 两层代理

将 `deploy/*http.conf.example` 中的内容各自放入相应主机 Nginx 的 http 配置；将 `*proxy.conf.example` 放入该主机 `/etc/artduo/`。`*locations.conf.example` 仅合并到已核对的 HTTPS server，不更改根路由、DNS 或其他应用。

阿里回源 `https://122.51.59.89`，使用 `aitoshuu.art` 作为 SNI 与 Host，校验可信 CA。阿里覆盖 `X-Real-IP` 和 `X-Forwarded-Host`。腾讯 ArtDuo 路径只允许阿里 IP 和回环检查，校验原始 Host 白名单，再把原域名传入 Next。两层均关闭响应缓冲，限制 16KiB 请求体，阿里另限制每个客户端 32 个并发连接。

不要关闭回源证书校验，也不要将应用端口直接开放公网。源地址限制必须在实际代理上测试，不能仅通过自己构造请求头推断安全。

## 目标机已准备的配置与恢复点

两台主机的 `/etc/artduo/public-ready-20261025/` 保存切流前候选配置。正式切流时已重新核对当前文件：阿里两个站点存在并行修改，因此基于各自当前内容仅合并本项目 include，保留原有修改；没有直接覆盖旧候选。实际切流副本及结果位于 `/etc/artduo/public-cutover-20261025/`，含 `activated.json` 与 `cleanup.json`。

腾讯只在现有 `aitoshuu.art.conf` 的 HTTPS server 增加 `tencent-artduo.locations.conf`；阿里分别在 `html_aitoshuu.me.conf`、`html_tongye.me.conf` 的 HTTPS server 增加 `aliyun-artduo.locations.conf`。已有 HTTP 跳转、根站点及其他应用路由保留。

隔离测试使用过阿里回环端口 `3246` 和腾讯受限临时路径。公网验收后已移除对应临时代理与 `artduo-acceptance-probe`，配置归档到 `/etc/artduo/retired-staging-20261025/`。正式 `map` 与 `limit_conn_zone` 保留在两台主机各自的 `0.artduo-http.conf`，不能重复加载或随临时配置一起删除。

腾讯已在停止本项目两个服务后保存一致的 `/var/backups/artduo/20261025-pre-public/state.tar.gz` 和私有环境副本。恢复点目录为 0700，环境副本为 0600。重启后已存展览和同一手写任务恢复，PNG 指纹不变，未重新生成。回退时保留当前持久数据，不通过清空额度或任务恢复服务。

发布前依赖检查发现 undici 与 esbuild 告警后，已将 undici 固定为 7.30.1、tsx 更新为 4.23.15（锁定 esbuild 0.28.2），本地和腾讯的生产依赖检查均为零告警。修复版本在独立目录完成 Linux 全项目构建后切换本项目两个服务，并再次通过原展览、原手写图、额度和双层代理检查；第二份一致恢复点位于 `/var/backups/artduo/20261025-auditfix-pre-switch/`。详细事实与未完成项见 [隔离验收记录](../verification/artduo-dual-domain-staging-2026-10-25.md)。

## 发布与验收

1. 先运行路径、双来源、会话与原功能回归，完成类型检查和 `/ArtDuo` 生产构建。打包当前发布、依赖的旧版本资源、公共背景与音频、本地 E5 模型、630 张校验预览。不要上传 macOS 的 node_modules、无关私有任务、完整本地查询记录或工作区密钥目录。
2. 在腾讯独立发布目录安装锁定的 Linux 依赖并构建；创建独立应用账户和私有环境文件，使用两个服务模板。只复制本次验收明确使用的展览回放夹具，放入私有目录。不得启动第二个处理同一队列的手写 Worker。
3. 目标机运行 `pnpm release:check -- --warm`，核对 630 张预览和深度图、模型、可写持久目录。隔离入口检查健康、页面、全部素材类别、既有展览回放、详情、手写恢复和下载。已有完整回放不能重新调用模型。
4. 重启 Next 与 Worker，原链接、队列、已生成素材、额度账本仍有效。记录两层代理的头覆盖、SSE、TLS 和来源拒绝测试。保留旧版构建与持久目录备份。
5. 将目标机证据交用户确认正式上线后，再合并两个域名的路由并先检查 Nginx 配置，随后平滑加载。通过两个真实 HTTPS 地址走同一流程，确认 URL 始终保留各自域名和 `/ArtDuo`。

回滚时撤销本次 ArtDuo location 或切回上一版发布目录，再检查健康与既有链接；不删除额度账本或私人任务来恢复服务。发布和回滚都不得覆盖同时进行的其他项目变更。

临时配置归档后，切流前的完整 vhost 副本只用于比对，不能盲目整文件覆盖回当前站点，否则可能恢复已归档的 staging include 并覆盖并行修改。停止公网入口时先撤销阿里两个 HTTPS server 的本项目 include，检查后平滑加载；应用回退保留当前持久数据和额度。

## CDN 与 COS

2026-10-25 的首次公网测试未接入 CDN/COS。当前绘画的 630 张预览、深度图、背景和音频继续由腾讯本机目录提供，经阿里反向代理访问；私有手写素材仍走归属校验接口。2026-10-27 上线的 18 件雕塑使用独立的已核验 COS/CDN 清单，媒体摘要为 `sha256:71dfdbd2050ec2c62a552591fba60dbb327cca4815d42b85027a9f2a8b41fe59`，不改变绘画交付模式。操作与回退见 [COS/CDN 运维](artduo-cdn-cos.md)。

## 当前验收边界

换画此前有效样本已达到 600ms 目标。2026-10-28 首次入展提速前后，在同一公网桌面浏览器分别使用新查询测量：普通缓存条件下首画可操作 8.044s → 7.507s，禁用浏览器 HTTP 缓存条件下 8.843s → 6.285s。更新后两次均未整页重载。每个条件每版只有一个有效样本，冷加载前后首件作品也不同，不能据此宣称所有查询均达到 8s；外部模型、网络和真机性能仍有波动。旧 32.059s 属于历史版本记录，不作为本轮改善基线。完整条件和原始记录见 [本轮验收](../verification/artduo-first-exhibition-performance-2026-10-28.md)。630 张 DA3 深度图已接入，此前整体观感和实体设备验收边界继续保留，尺寸模拟不代替真机。

目标机的 630 张预览与 630 张深度图均已核验；其中 498 件作品的高清原图首次近看仍依赖已核验上游。预览、深度图、背景和音频可以由本机素材提供。模型和资源 readiness 通过，不能代替首次新策展的实际耗时与公网浏览器完整流程验收。
