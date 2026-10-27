# 前端连续性验证证据 · 2026-10-28

对应[实施与双域名上线记录](../artduo-frontend-continuity-2026-10-28.md)。最终应用源码 `4c8dc03757b1176c1b82d300b4d8a248c796c191`，公网 Build ID `GT4SnLUf3ClmlN-dKZNAu`。

| 记录 | 用途与范围 |
| --- | --- |
| [browser-local.json](browser-local.json) | 隔离本地回放的实际尺寸、动作计时、取消/超时/失败、设备权限模拟、重排和恢复记录；包含迭代观察及最终兜底样式 |
| [browser-public.json](browser-public.json) | 最终版本的应用内浏览器 HTTPS 交互、视口、原位返回和所选作品恢复 |
| [public-checks.json](public-checks.json) | 两个域名 HTTP、资源指纹、Build ID、路由恢复与接口可用性 |
| [deployment-summary.json](deployment-summary.json) | Linux 构建、回归、资源、服务、备份、清理与私有证据摘要 |
| [source-package.json](source-package.json) | 冻结源码提交、492 文件清单和传输包摘要 |
| [local-cleanup.json](local-cleanup.json) | 本轮本地服务、构建与隔离状态清理；原运行资源保留 |
| [artifact-checks.json](artifact-checks.json) | 17 张原始截图的格式、尺寸与本地文档链接检查 |

## 本地截图

| 截图 | 状态 |
| --- | --- |
| [entry-mobile-light.png](entry-mobile-light.png) | 保留的手机浅色首页 |
| [plaque-opening-mobile.png](plaque-opening-mobile.png) | 原尺寸展签内的打开/取消反馈 |
| [reading-image-fallback-mobile.png](reading-image-fallback-mobile.png) | 图片失败仍可读文字；最终深色兜底 |
| [reading-mobile.png](reading-mobile.png) | 正常阅读 |
| [artwork-detail-mobile.png](artwork-detail-mobile.png) | 资料和首屏按需讲解 |
| [settings-motion-off-mobile.png](settings-motion-off-mobile.png) | 总轻动关闭后手机入口的禁用原因 |
| [settings-mobile.png](settings-mobile.png) | 简化后的设置 |
| [near-view-mobile.png](near-view-mobile.png) | 手机近看与 44px 玻璃控件 |
| [near-view-desktop.png](near-view-desktop.png) | 无触摸能力桌面近看 |
| [route-overview-desktop.png](route-overview-desktop.png) | 本次选集总览 |
| [route-overview-mobile.png](route-overview-mobile.png) | 手机总览与实际作品 |

## 公网截图

| 截图 | 来源与状态 |
| --- | --- |
| [entry-public-aitoshuu.jpg](entry-public-aitoshuu.jpg) | aitoshuu 默认首页，桌面浅色 |
| [entry-public-tongye.jpg](entry-public-tongye.jpg) | tongye 默认首页，桌面深色 |
| [reading-public-mobile.png](reading-public-mobile.png) | aitoshuu 正常阅读，390×844 |
| [artwork-detail-public-mobile.png](artwork-detail-public-mobile.png) | aitoshuu 资料页，390×844；讲解入口首屏可见 |
| [near-public-mobile.png](near-public-mobile.png) | aitoshuu 近看，390×844 |
| [route-overview-public-tongye.jpg](route-overview-public-tongye.jpg) | tongye 本次展览总览，桌面 |

手机均为浏览器视口/触摸模拟，不冒充实体设备。公网没有注入图片故障，没有触发新策展或生成任务。图片保持原始截图，不做修图或合成。
