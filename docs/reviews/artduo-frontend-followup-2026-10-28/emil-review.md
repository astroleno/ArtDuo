# ArtDuo 前端独立复评 · Emil

日期：2026-10-28。只读评审，已交付建议文档。

> 主线程后续勘误：雕塑预览会自动调用观展短文接口。原文关于“未新生成雕塑说明”的范围描述没有网络记录支持，只能确认未手动触发；缓存命中和实际生成未监测。独立评审原文判断保留，后续源码核对见 [模型复评与勘误](../artduo-frontend-model-comparison-2026-10-28.md)。

## 范围与方法

采用 `emil` → `emil-design-eng` 的 UI 交互工艺路线，关注动效目的与频次、立即反馈、可中断性、重复操作成本、按需层级与沉浸连续性。先读 `graphify-out/GRAPH_REPORT.md` 的 God Nodes 与社区结构，再调查当前 `apps/web`、`packages/ui` 源码。

本次代码基准为 `561ce2b8705609db027c8b7036154ee4c72c9d16`；已对比线上应用源码基准 `4c8dc03757b1176c1b82d300b4d8a248c796c191`，两者在 `apps/web`、`packages/ui` 范围内没有代码差异。本轮中性取证确认 HTTPS 页面返回 200，并包含预期 Build ID `GT4SnLUf3ClmlN-dKZNAu`。

没有读取 Lama 报告、旧版 Lama/Emil/综合评审或本轮综合摘要。主线程在一个新浏览器空间采集本轮中性截图和交互记录；复评者没有另开浏览器，已实际 `view_image` 查看 F01–F09、F02b/F02c、F09b/F10b、F12–F16 与 F13b，结合独立源码调查判断。不修改应用、不提交、不推送、不部署。

浏览器证据集中在 [manifest.json](/Users/aitoshuu/Documents/GitHub/ArtDuo/docs/reviews/artduo-frontend-followup-2026-10-28/evidence/manifest.json)。桌面尺寸为 1440×900；手机尺寸为 390×844，属于浏览器触控模拟。使用已经保存的六件展览回放，未新增策展请求。

## 总评

当前版本的方向成立：入口留白、展厅静观、边缘唤回、按需阅读构成同一条体验主线。F01/F03 中主页居中、输入细底线和按钮尺度一致；F06/F07 的作品及展签保持稳定，唤回的只有必要导航；F08 在窄屏保留了画作完整比例与独立展签。没有证据支持重新设计首页或增加常驻解释层。

已确认的问题集中在观看的恢复：浏览器返回越过当前阅读/近看层，近看下一张预备解码失败后仍停在“准备中”，阅读图片失败时保留大块空图区。三者均为 P2；本轮未确认 P1。近看末件的主动结束属于可选设计讨论，入场可中断性未完成有效验证。

## 应保留

- **入口的克制构成。** 居中问句、柔和明暗背景、透明细底线输入与单一主操作，符合既定设计；本轮不建议添加解释卡片、更多常驻按钮或重新排列首页。
- **五秒翻牌与专注输入互不争夺。** 输入聚焦或提交时暂停自动轮换；页面隐藏和减少动态效果也会停下自动轮换。[threshold.tsx](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/experience/threshold.tsx:57)、[entry-question.tsx](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/experience/entry-question.tsx:34)
- **展厅把主动权留给观看者。** 画作区域移动不会唤回整套导航，边缘或操作区移动才唤回；键盘焦点和已打开阅读面板保留控件。[use-idle-chrome.ts](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/experience/use-idle-chrome.ts:22)
- **常用操作已控制时间成本。** 正常换画的工艺是短淡入或小位移，当前观看速度将其收敛到 140–200ms；快速输入只保留一个待执行方向。无需套用笼统“所有动画都应更快”的整改。[experience.css](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/experience/experience.css:214)、[experience-shell.tsx](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/experience/experience-shell.tsx:105)
- **阅读进入过程已有立即反馈与取消。** 展签在读图期间显示“正在打开… · 取消”，图像解码后才打开阅读层；阅读图失败仍提供文字资料。背景换场保留上一张墙面，直到下一张已解码。[plaque.tsx](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/experience/plaque.tsx:71)、[room-backdrop.tsx](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/experience/room-backdrop.tsx:7)
- **信息层级按需展开。** 观看偏好和观看记录收在设置里的“本次展览”，馆藏说明与资料来源继续折叠；不应把这些内容重新常驻到作品周围。[walk.tsx](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/experience/walk.tsx:120)、[plaque.tsx](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/experience/plaque.tsx:15)
- **液态玻璃承担的是轻反馈。** 按压缩放、焦点描边、触碰与选中状态已经有统一规则，且减少动态效果会移除按压缩放；保留这一克制方向。[glass-buttons.css](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/glass/glass-buttons.css:60)
- **补充稳定态与收束覆盖。** F13b 的设置有限动画已停止，纸色面板清楚承载按需选项；F13 的入场叠影不是稳定缺陷。I15 实际从末件近看返回展厅、唤回边缘控件并点击“看完了”进入结语，I16 点击“回看最后一件”回到同一作品 `artic-64818`，结语操作闭环成立。F15 在 390×844 无横向溢出；不根据该截图单独推断末件图片已完成加载。
- **雕塑可独立成立。** F16/I17 的 Calais 独立预览为 `ready`，390×844 无横向溢出；数字石膏群像、低展台和独立展签维持了“另一件艺术品”的语义。本轮保留这个方向，不能把一次独立预览等同于随机彩蛋全流程或全部 18 件都已实测。

## 已确认问题

| Before | After | Why |
| --- | --- | --- |
| **P2 · E01：阅读/近看层打开后，浏览器返回直接退出本次观看。** I03 记录打开展签前后历史索引都是 2；I04/I07 分别在资料与近看层内执行 Back 后回到 `/ArtDuo` 首页。 | 将已打开的阅读/近看层纳入可回退的页面状态；第一次 Back 收起当前层并回到同件作品，再次 Back 才离开展览。 | 手机观看者借助熟悉的返回动作结束当前操作，却越过了自己正在看的空间，打断连续观看。 |
| **P2 · E02：下一张近看预备图已解码失败，仍显示“正在准备作品”并禁用前后切换。** F12/I12 的受控失败分支持续观察 5200ms；URL 已是第二件，画面和标题仍是第一件。 | 保留当前已就绪图像与署名，及时转为明确失败状态，提供重试与回到上一件；主展厅位置也与可见状态一致。 | 保留旧图避免闪白是正确的，但已失败的任务不能一直伪装成加载。恢复不应要求退出近看再重新定位。 |
| **P2 · E03：阅读图片失败后，空图区仍占约 300px。** F09 中失败提示停在大块暗色区域中央，正文从约 y=462 开始，约四成阅读层高度仍用于没有图像的区域。 | 图像失败时收拢图区为简短状态提示，把空间还给正文；可优先复用已就绪的画作预览。 | 降级应降低恢复成本。当前文字虽可读，但用户需在空白下方继续滚动，且失去了边看边读的参照。 |

### E01 · 阅读和近看退场应停留在当前作品

**复现：** 从首页进入本次展览 → 打开完整展签 → 执行浏览器 Back。中性记录 I03/I04 表明资料层没有新增可回退状态，Back 返回入口；I07 在近看层再次复现同样的越层返回。源码以 `expanded` 状态控制 `showModal()` / `close()`，近看通过本地状态挂载到 portal，均没有对应的历史状态；展厅位置本身持续通过 `replaceState` 更新。[plaque.tsx](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/experience/plaque.tsx:83)、[image-lightbox.tsx](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/immersive/image-lightbox.tsx:225)、[experience-route-client.tsx](/Users/aitoshuu/Documents/GitHub/ArtDuo/apps/web/components/experience-route-client.tsx:56)

**影响与建议：** 关闭按钮和 Escape 已有回到原展签的焦点处理；应把浏览器返回接入同一退场语义，保留作品、顺序和观看位置。实现时同时处理主动关闭，避免留下需要多按一次返回的空历史。

**验收：** 分别在资料层、近看层内执行浏览器 Back 后仍是同件画作与原路线，当前层已关闭且焦点可恢复；再执行一次 Back 才离开展览。直接关闭按钮、Escape、刷新与分享展览链接均不能产生重复历史或误开资料。

### E02 · 近看切换失败需要明确的结束与恢复状态

**复现与证据边界：** I12 仅在当前临时浏览器页面，让第二件 `smk-KMS4177` 的离 DOM 预备图片 `decode()` 拒绝，保留 connected 图片正常解码；随后从第一件近看点“下一幅”。5200ms 后 F12 仍显示第一件的图和标题，提示“正在准备作品”，前后按钮都不可用，关闭仍可用。I14 已恢复该临时替换并用 Escape 退出。这是**受控失败分支验证**，并非自然发生的线上故障，不能据此推断生产发生频率。

**原因与建议：** `pendingArtwork` 以当前目标与已经显示的作品 ID 是否相同判断；下一张预览的 `decode()` 拒绝后直接 `return`，没有错误状态或回退动作，`detail` 保留旧作品，前后控制又因 `pendingArtwork` 一起禁用。应继续把图像与署名成对保留，同时结束准备状态并给出可恢复选择。[image-lightbox.tsx](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/immersive/image-lightbox.tsx:103)、[image-lightbox.tsx](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/immersive/image-lightbox.tsx:145)、[image-lightbox.tsx](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/immersive/image-lightbox.tsx:292)

**验收：** 选择性拒绝下一张预备图解码后，界面及时显示失败而非继续准备；当前图像和标题保持一致，可重试或取消本次切换并留在原作。恢复解码后重试能到目标作品；URL、显示作品与返回展厅的位置保持一致。单独的高清图失败仍可保留已就绪预览，不应扩大为整件作品失败。

### E03 · 图像降级后应恢复可用的阅读面积

**复现：** F09 的手机资料层已进入“图片暂不可用，资料仍可阅读。”失败状态；不把它归类为仍在加载，也不据此推断 CDN、权限或设备原因。F09b 与 I08/I09 在正常重开时已就绪，图片资源 200、尺寸 1280×1019，因此本项只评价失败状态的布局，不声称阅读图片普遍不可用。

**证据与建议：** `data-image-state` 已由阅读组件暴露；CSS 的手机布局无论状态均保留 `minmax(130px, min(38dvh, 300px))` 图区。失败分支只隐藏图片并放入提示，没有改变网格行高。建议失败时压缩这一区域，或直接沿用已成功显示的画作像素。[plaque.tsx](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/experience/plaque.tsx:99)、[experience.css](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/experience/experience.css:468)

**验收：** 在 390×844 图片失败状态下，提示后紧接作品标题及正文，不保留 300px 空图区；正文、媒材和关闭入口可正常操作。图片成功时继续保留画作参照；不要在用户已阅读后因晚到图片把当前段落突然推走。

## 可选设计讨论与待测推断

这些不计入上面的三项问题，也不作为本轮必改项。

| Before | After | Why |
| --- | --- | --- |
| **可选讨论：** F14 末件近看右侧“下一幅”禁用，回房间后才有“看完了”；I15/I16 已验证进入结语及回看正常。 | 若以后优化，可在边界提供轻量“最后一件”提示，或另设由用户主动选择的完成入口。 | 不自动结束是既定设计，当前实现有测试明确保证；额外入口是否值得增加，应由产品判断其能否降低退出再完成的成本。 |
| **待测推断：** 源码使用固定 720ms 入场，再切换到 200ms 倒放关键帧退场。 | 后续只需验证真实入场中点击返回是否能从当前状态连续收回；若跳变再选择可中断的过渡。 | I06/I11 观察到关闭时已是 `phase=open`，未命中入场中断；不能据这两次测试宣称跳变、帧率或焦点失败。 |

源码位置：[immersive-detail-stage.tsx:42](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/immersive/immersive-detail-stage.tsx:42)、[immersive-detail-stage.tsx:105](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/immersive/immersive-detail-stage.tsx:105)、[room.tsx:224](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/experience/room.tsx:224)、[state.test.ts:80](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/experience/state.test.ts:80)、[globals.css:2333](/Users/aitoshuu/Documents/GitHub/ArtDuo/apps/web/app/globals.css:2333)。

## 范围边界与待验证

- F02 是主题切换后的瞬时截图，不用于判定稳定文字对比度；F02b/F02c 的稳定暗色按钮与主题图标正常，I05 的计算样式也支持这一点，因此未列缺陷。
- F10/F11 的早期截图未等媒体完成，不用于判断稳定图片缺失；F10b 的近看预览已解码。F13 过程帧已由有限动画停止后的 F13b 补充，稳定设置面板未见同样叠影，不列透明度缺陷。
- 窄屏静观后点画作中央是否造成非预期唤回/放大、720ms 入场中的指针返回连续性，未取得有效样本，保留待测，不记为失败。
- 本轮没有生成分享图、手写寄语或 AI 讲解，也未触发随机雕塑抽取；这些只覆盖入口和相关源码，不能据此宣称生成或随机分支已通过。
- 未实测实体手机、帧率、耗电与屏幕阅读器，不把这些记为已失败。
- 雕塑是独立艺术品彩蛋。18 件池、每次展览 50% 单次机会、画作请求中的“无人/排除人物”不排除雕塑，均按已确认产品方向接受；明确不要雕塑或限定媒介才需要尊重。当前源码具有单独的雕塑允许判断与一次机会持久化，本轮不因出现人物雕塑本身报告缺陷。[sculpture-encounter.ts](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/experience/sculpture-encounter.ts:15)、[use-sculpture-encounter.ts](/Users/aitoshuu/Documents/GitHub/ArtDuo/packages/ui/src/experience/use-sculpture-encounter.ts:25)
