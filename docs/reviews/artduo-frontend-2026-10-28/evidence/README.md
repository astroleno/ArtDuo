# ArtDuo 前端评审证据索引

采集日期：2026-10-28。供 Lama 与 Emil 两份独立评审共同引用；此目录保存原始画面与交互事实，不替代各评审的判断。

## 版本与方法

- 线上入口：<https://aitoshuu.me/ArtDuo>。
- 本地审阅基线：`f908cda5b0c9b540a59f154bb61e4c5902c80130`；该提交为发布记录，线上应用源码为 `ce2724022219314bf65e0a8a06c8d54daa4f763c`。
- 线上 Build ID：`JK4fakq2RdGylYpAtwGIZ`。
- 浏览器：Ego，使用一个专属任务空间，取证结束后已关闭。
- 桌面视口：1440 × 900。手机视口：390 × 844，相关触摸交互启用触摸模拟，并核对 `maxTouchPoints=1`、粗指针和无悬停能力。
- 首页实际操作包括切换明暗、空输入提交；观展使用已有六件作品的公开回放链接，操作了近看、展签、详情、返回、设置。结语通过同一回放链接的 `phase=closing` 进入，并非本轮完整停留看完六件作品。
- 加莱义民通过独立试展地址查看，不能据此证明正式展览中实际抽中了彩蛋。
- 没有提交新的策展请求，没有生成 AI 讲解、分享图或手写寄语卡，没有授权手机传感器。
- [manifest.json](manifest.json) 保存每张图的 URL、采集备注，以及适用的可访问性快照、尺寸和交互记录。截图采用 CSS 视口尺寸，不是实体手机截图。

回放使用馆藏 `2026-10-24-da3-curated-630`、配方 `experience-v2`。观看愿望为“我想在清晨的河岸边，看一组有树影、微风和明亮天空的画。”，路线为 `artic-16487 → smk-KMS4177 → artic-14620 → smk-KMSsp491 → artic-28560 → artic-64818`。它是固定样本，不能代表所有新策展结果。

## 截图索引

| 编号 | 页面与状态 | 截图 |
| --- | --- | --- |
| E01 | 桌面首页，深色 | [entry-desktop-dark.png](entry-desktop-dark.png) |
| E02 | 桌面首页，浅色 | [entry-desktop-light.png](entry-desktop-light.png) |
| E03 | 空输入提交，提示位于输入下方 | [entry-empty-error.png](entry-empty-error.png) |
| E04 | 手机首页，浅色初始化帧；判断稳定外观请用 E22 | [entry-mobile-light.png](entry-mobile-light.png) |
| E05 | 手机首页，深色 | [entry-mobile-dark.png](entry-mobile-dark.png) |
| E06 | 桌面序言 | [preface-desktop.png](preface-desktop.png) |
| E07 | 手机序言 | [preface-mobile.png](preface-mobile.png) |
| E08 | 从序言提前打开寄语卡表单，未生成 | [preface-keepsake-mobile.png](preface-keepsake-mobile.png) |
| E09 | 桌面展厅，抵达第一件作品 | [walk-desktop-arrival.png](walk-desktop-arrival.png) |
| E10 | 桌面展厅，静置后 | [walk-desktop-idle.png](walk-desktop-idle.png) |
| E11 | 桌面展厅，指针移至边缘后 | [walk-desktop-edge.png](walk-desktop-edge.png) |
| E12 | 手机展厅，触摸能力核对后的初始状态 | [walk-mobile-arrival.png](walk-mobile-arrival.png) |
| E13 | 手机静置后首次点击画作，进入近看 | [walk-mobile-first-tap.png](walk-mobile-first-tap.png) |
| E14 | 手机完整展签 | [reading-mobile.png](reading-mobile.png) |
| E14b | 展签下方“进入详细讲解”入口 | [reading-mobile-actions.png](reading-mobile-actions.png) |
| E15 | 独立作品详情首屏，图片尚在加载的帧 | [artwork-detail-mobile-top.png](artwork-detail-mobile-top.png) |
| E16 | 作品详情下方按需讲解区，图片已加载 | [artwork-detail-mobile-explanation.png](artwork-detail-mobile-explanation.png) |
| E17 | 手机观展设置 | [settings-mobile.png](settings-mobile.png) |
| E18 | 设置展开“本次展览与路线” | [settings-mobile-expanded.png](settings-mobile-expanded.png) |
| E19 | 桌面结语；稳定态补证见 E19b | [closing-desktop.png](closing-desktop.png) |
| E19b | 桌面结语，确认玻璃按钮增强后 | [closing-desktop-stable.png](closing-desktop-stable.png) |
| E20 | 手机结语；稳定态补证见 E20b | [closing-mobile.png](closing-mobile.png) |
| E20b | 手机结语，确认玻璃按钮增强后 | [closing-mobile-stable.png](closing-mobile-stable.png) |
| E21 | 重新选路线的辅助页，玻璃按钮增强前 | [route-support-mobile.png](route-support-mobile.png) |
| E21b | 同一辅助页稳定态，按钮已增强 | [route-support-mobile-stable.png](route-support-mobile-stable.png) |
| E22 | 手机浅色首页稳定态，主题过渡及玻璃增强完成 | [entry-mobile-light-stable.png](entry-mobile-light-stable.png) |
| E23 | 加莱义民独立试展，手机 | [sculpture-calais-mobile-preview.png](sculpture-calais-mobile-preview.png) |
| E24 | 加莱义民独立试展，桌面 | [sculpture-calais-desktop-preview.png](sculpture-calais-desktop-preview.png) |

## 可重复核对的交互事实

1. **静置与导航。** 桌面静置后，中央画面内移动约 20px，没有唤回下一件按钮；该按钮父层透明度为 0 且禁止指针事件。移向边缘会恢复。设置按钮仍可点击。手机触摸模拟下首次点画作能进入近看，再用“返回画廊视图”正常关闭。不能把这些记录写成“所有控制失效”或“手机首点失效”。对应 O01、O02、E09–E13。
2. **展签打开等待。** 单次测得点击至原生阅读对话框打开约 **1436.2ms**。点击后的首个动画帧 `aria-busy=true`，对话框尚未打开；该记录没有等待过程的截图，不能据此单独断定没有任何可见反馈。可见反馈机制需结合源码评审。单次样本不构成性能基准。对应 E14、manifest 中该状态的计时记录。
3. **讲解入口。** “进入详细讲解”打开独立详情页；详情中的“生成这件作品的讲解”还需一次操作，按钮在该手机布局中的文档纵坐标约 1062px，超出 844px 首屏。未点击生成，不能评判模型输出或请求成功率。返回链接实际保留了同一策展 ID、路线和第一件作品。对应 E14b–E16、O03。
4. **稳定态排除。** E22 中“开始观展”可用，文字为 `rgb(48,43,37)`，自身与祖先透明度均为 1，高 46px，无运行中的动画。E21b 中玻璃增强标记已存在，主按钮计算背景透明。E04 的淡色按钮与 E21 的红色按钮不作为稳定界面缺陷。
5. **雕塑。** E23/E24 中加莱义民模型与背景合成已显示，手机无横向溢出。未操作自由旋转、未验证手机重力、未遍历其余 17 件，未测量 50% 触发概率。

## 评审边界

- 不包含新用户从输入到策展完成的全链路等待、真实移动网络、真实手机传感器、连续帧率、辅助技术完整认证、18 件雕塑逐件检查。
- 不把源码中的防护或参数视为已通过实体设备验证；不把单张截图视为动画连贯性的证明。
- 个别图中的黑色圆形魔杖或“解释”悬浮元素来自浏览器扩展，不属于 ArtDuo，不计入产品问题。
- 两位子 agent 分别形成判断；主线程只共享中性证据，不向一方转发另一方结论。综合文档对共同项去重，并保留分歧和验证限制。
