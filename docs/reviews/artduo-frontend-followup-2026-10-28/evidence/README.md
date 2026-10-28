# 当前前端复评证据 · 2026-10-28

对应[综合复评](../../artduo-frontend-followup-summary-2026-10-28.md)、[Lama](../lama-review.md)与[Emil](../emil-review.md)。

本地基准 `561ce2b8705609db027c8b7036154ee4c72c9d16`，线上应用源码 `4c8dc03757b1176c1b82d300b4d8a248c796c191`；本轮 HTTPS 内容确认 Build ID `GT4SnLUf3ClmlN-dKZNAu`。采集使用一个 Ego Lite 任务空间，沿用已保存的六件展览。两个评审共用这组中性证据，分别独立调查源码与判断。

截图未经修图或合成。1440×900 桌面、390×844 触控模拟均为 CSS 像素；手机模拟不代表实体设备。所有地址、交互和元数据见 [manifest.json](manifest.json)；文件摘要与格式检查见 [artifact-checks.json](artifact-checks.json)。

## 截图索引

| ID | 文件 | 状态与证据用途 |
| --- | --- | --- |
| F01 | [entry-desktop-light.png](entry-desktop-light.png) | 桌面浅色首页 |
| F02 | [entry-desktop-dark.png](entry-desktop-dark.png) | 主题切换后紧接捕获，属于过渡帧；不判定稳定对比度 |
| F02b | [entry-mobile-dark-stable-empty.png](entry-mobile-dark-stable-empty.png) | 有限动态停止后的暗色空输入 |
| F02c | [entry-mobile-dark-stable-filled.png](entry-mobile-dark-stable-filled.png) | 有限动态停止后的暗色非空输入，未提交 |
| F03 | [entry-mobile-light.png](entry-mobile-light.png) | 手机浅色首页 |
| F04 | [entry-mobile-error.png](entry-mobile-error.png) | 空输入错误与输入焦点 |
| F05 | [preface-mobile.png](preface-mobile.png) | 既有展览前言 |
| F06 | [walk-desktop-idle.png](walk-desktop-idle.png) | 静观状态 |
| F07 | [walk-desktop-edge.png](walk-desktop-edge.png) | 边缘唤回状态，与 F06 对照 |
| F08 | [walk-mobile.png](walk-mobile.png) | 手机画作、展签与导航 |
| F09 | [reading-mobile.png](reading-mobile.png) | 首次阅读遇到图片失败/超时降级，文字可读；未注入，根因未记录 |
| F09b | [reading-mobile-ready.png](reading-mobile-ready.png) | 重开后正常图文参照；1280×1019，资源 200 |
| F10 | [near-mobile.png](near-mobile.png) | 初期媒体未等齐，不用于稳定黑屏判断 |
| F10b | [near-mobile-ready.png](near-mobile-ready.png) | 预览已解码、控件 44px；采集元数据中深度增强仍 loading |
| F11 | [artwork-detail-mobile.png](artwork-detail-mobile.png) | 资料、按需讲解与返回结构；图像未等待完成，不作最终媒体判断 |
| F12 | [near-next-image-failure.png](near-next-image-failure.png) | 选择性拒绝下一张离 DOM 预备图解码后的准备状态，观察 5200ms |
| F13 | [settings-mobile-expanded.png](settings-mobile-expanded.png) | 设置入场过程帧；不作为稳定面板透明度缺陷 |
| F13b | [settings-mobile-stable.png](settings-mobile-stable.png) | 有限动态结束后的设置；末件顺序操作禁用 |
| F14 | [near-final-work-mobile.png](near-final-work-mobile.png) | 末件近看与禁用的下一幅；用于边界动作，不评完整深度终态 |
| F15 | [closing-mobile.png](closing-mobile.png) | 结语文字与按钮结构。末幅图区仍是占位，媒体终态未验证 |
| F16 | [sculpture-calais-mobile.png](sculpture-calais-mobile.png) | 《加莱义民》独立预览，模型与展台可见，ready；未测试完整随机偶遇 |

## 交互记录的解释

- I01/I02：未点击问句也发生轮换；空输入有内联错误并回焦。I01 的 `textContent` 含供翻牌使用的当前/下一句结构，不是双标题可见缺陷。
- I03/I04/I07：打开阅读或近看未增加可回退层；原生浏览器历史返回到了首页。资料页自己的返回按钮在 I10 正确保留原展览、作品和顺序。
- I05：稳定暗色空/非空输入均非禁用、文字浅色、opacity 1、有限动态停止，排除 F02 误报。
- I08/I09：重开后阅读图正常。I08 的文字字段已纠正为 `dialog[open]`；原采集误取第一个隐藏设置 dialog，不能据隐藏文字判断资料混入设置。
- I06/I11：两次尝试观察入场打断，但关闭实际都发生在 `phase=open` 后，因此不是有效入场中断样本。I11 在 DOM 移除当帧记录的焦点值早于后续恢复，不作为焦点故障证据。
- I12a：首次广泛拒绝解码同时影响了普通行内图，未隔离到预备图。该尝试不支持“持续准备”的结论；已恢复并退出。
- I12/F12：只拒绝第二件 `smk-KMS4177` **离 DOM** 预备图片解码，页面已连接图片仍正常；5200ms 后模态层仍为第一件、目标 URL 已到第二件、前后切换禁用、关闭可用。源码可解释该分支没有错误状态。此为可重复的受控分支，不是生产故障发生率证据。I14 已恢复原型并 Escape 退出。
- I15/I16：末件先退出近看，边缘唤回控件后由“看完了”进入结语；“回看最后一件”回同作。自动化曾在控件隐去时尝试点击被图像拦截，唤回后完成，不把隐去状态记为布局阻断。
- I17：独立雕塑预览 ready。未手动发起新策展、详细讲解、分享图或手写；源码确认该预览会自动请求雕塑观展短文接口，本轮未监测缓存命中或实际生成，不能据未点击按钮断言没有请求。

取证期间曾遇本机临时空间不足及一次截图超时；同一任务空间恢复后继续采集，没有清理无关资料或创建第二个浏览器空间。相关过程帧和未命中的测试均明确保留边界，不冒充稳定态或实机证据。临时原型修改已恢复，视口模拟已清除，任务空间正常 finish。
