# Sculpture room preview verification

Local route: `/experience/sculptures?model=athena&quality=compact&room=bg-022`.

## Result

The two isolated SMK / Scan the World sculptures are rendered inside the existing ArtDuo room photographs. A transparent WebGL foreground adds a digital plinth and floor shadow. Window daylight (`bg-022`) and soft gallery light (`bg-034`) share ArtDuo's existing motion preference, orientation filter, backdrop decoding, reading layer and quiet navigation. A shared pointer light now relights the depth-mapped photograph and the actual sculpture together.

Wide viewports keep the photograph aligned to its bottom edge so the sculpture stands in front of the existing bench. The optional room-lighting alignment uses the same crop. Painting rooms retain the default center projection.

## Automated verification

- `pnpm --filter @artduo/ui test`: 84 passed, 0 failed. Includes painting / plaque regressions, sculpture layout, stationary floor projection, bounded AO resolution, shared pointer coordinates and smoothing, source-centroid estimation and confidence bounds, shared motion and both lighting alignments. The lighting renderer test verifies sculpture mode is opt-in and painting defaults remain unchanged.
- `pnpm --filter @artduo/web exec tsx --test test/lib/sculpture-preview.test.ts`: 2 passed, 0 failed. Verifies all four GLBs, isolated single meshes, compact asset sizes, source attribution and matching room assets.
- UI and web type checks passed. Final optimized web build passed compilation, type validation and page generation. The new route is included in its route manifest.
- Scoped whitespace validation passed; generated temporary Next type include entries were removed from the source configuration.

## Rendered verification

Actual in-app browser checks covered desktop (1280×720 and 1440×900), phone (390×844 and 320×640) and landscape (844×390).

- Both sculptures load in compact and reference quality. The whole silhouette, plinth, plaque and navigation remain visible without horizontal overflow.
- Room selection changes the photograph, sculpture key light and plinth color. The chosen soft-light room has sufficient visible floor in front of its bench.
- Mouse follow changes the sculpture viewpoint while the photograph and floor contact point remain stationary. The sculpture pose stays fixed: drag, wheel, pinch and keyboard do not rotate or zoom the model. Painting and sculpture input share the same clamped `.65` parallax gain; the sculpture camera offset is capped below two degrees horizontally.
- A saved follow opt-out survives refresh. With follow off the view stays still. System reduced motion takes precedence.
- Opening the reader pauses follow. Escape restores focus to the plaque. The reader retains sculpture terminology, verified source links and PDM 1.0 attribution.
- Phone sensing starts off and requires the dedicated button. An explicit activation without sensor readings returns to an unavailable state while the work remains viewable.
- A controlled, temporary missing-GLB check showed the generated static sculpture reference, readable information and retry. After restoring the asset, retry returned to the interactive model. All files were restored and rechecked.
- The collected browser warning / error log was empty.

Screenshots and DOM-backed interaction records are saved in this task's visualization workspace as `artduo-sculpture-*-room-*.png`, `artduo-sculpture-reader-phone.png` and `artduo-sculpture-browser-results.json`.

## Parallax interaction correction

The previous drag handler added pointer movement to the model yaw. A browser reproduction changed Athena's yaw from `0.0715` to `1.1675` after one drag. That handler and the rotate / zoom / reset renderer API, keyboard shortcuts, custom pinch handling and related UI have been removed.

The painting room and sculpture renderer now use `roomParallaxInput`, which clamps absolute input and applies the existing `.65` painting gain. Sculpture pose and viewing distance are fixed. Repeated long drags kept Athena at `0.1200` and David at `0.2000`. Wheel and arrow / plus keys did not manipulate the model; leaving the room returned the viewpoint to `0.0000,0.0000`. The UI suite, type checking and optimized build passed again after the correction.

These checks are saved in `artduo-sculpture-parallax-regression.json`; the updated preview is `artduo-sculpture-parallax-fixed.png`.

## Background-derived lighting

The sculpture samples the same decoded photograph used by the visible backdrop and room lighting layer. Sampling uses linear RGB and separates the visible left / right regions, ceiling, wall, floor and the light source region. A small PMREM-filtered cube provides diffuse environment bounce; the source sample sets direct-light color and bounded intensity. The updated key direction uses a luminance-weighted centroid constrained by the room's visible window / ceiling source prior. The pedestal picks up the wall's stone color, and the photograph and 3D foreground share the same room shade above their respective layers.

This is a low-frequency image-based estimate. It does not reconstruct measured HDR illumination or unseen room geometry. The camera-side cube face is an attenuated estimate from the visible wall. A perspective photograph is not treated as a 360-degree panorama.

Browser verification confirmed that `bg-022` used the actual displayed `bg-022-1600.webp`, with a cool `#edf6ff` source and warm `#b9a794` floor bounce. `bg-034` used its corresponding photograph, with warm `#ffe0c1` source light and `#907c69` floor bounce. Rapid room switching ended with the latest photograph's probe. Both Athena and David retained their fixed pose and bounded parallax. Image requests are aborted on room change / disposal, old GPU probes are released after replacement, and photo sampling failure retains conservative profile lighting.

The final optimized build passed again. Its independent local cold-start smoke check reached ready model and photo-lighting states, using the same displayed responsive `bg-022-960.webp` source for both the photograph and probe. A development hot-compilation reload triggered the existing model-load timeout once; explicit retry recovered, and the optimized cold-start check passed. The temporary production smoke server was stopped afterwards.

Updated screenshots are `artduo-photo-lighting-window-desktop.png`, `artduo-photo-lighting-soft-desktop.png` and `artduo-photo-lighting-*-phone.png`. The sampled-source and room-switch records are in `artduo-photo-lighting-results.json` in this task's visualization workspace.

## Shared pointer relighting and visible parallax correction

The user's next visual review correctly identified two gaps: the fixed foot projection canceled much of the tiny camera movement, and the model's direct light direction was still a preset. Input diagnostics alone had not established a perceptible result.

- The background now uses its existing relative inverse-depth RG16 and +Y-up normal maps for small depth displacement, diffuse pointer lighting and eight-step depth occlusion. Color, depth and normal samples share one displaced UV. The room map report identifies `Xenova/depth-anything-small-hf` at revision `2e942621ab9f2371c1df9eb223291b5ac31475e6`; these are not the separate DA3 artwork assets.
- The Three renderer samples that same depth through the bottom-aligned cover transform to move the contact point. A small bounded camera offset exposes depth without changing the sculpture's pose. The pointer's viewport position, elevation, color and size come from one shared interaction module; a soft spotlight lights the real geometry and casts geometry shadows.
- Fixed source estimates for the displayed 1600px backgrounds were UV `(0.9242, 0.3283)` / direction `(0.9036, 0.3735, 0.2097)` for the right window, and UV `(0.4560, 0.1734)` / direction `(-0.1031, 0.9876, 0.1185)` for the ceiling wash. The contrast-derived confidence is a heuristic, not a calibrated probability. Front/back location remains an explicit bounded prior; no single-image physical inverse-rendering accuracy is claimed.
- Actual rendering exposed an overly large floor receiver and VSM artifacts with the moving light. The final version uses PCF shadows, a faded contact region, and a floor boundary projected from the photograph so the receiver cannot darken the back wall. The original photographed lighting is retained beneath the added soft light.
- Fifteen browser records cover left/right lighting, both rooms and works, compact and reference meshes, 390×844 portrait and 844×390 landscape, saved opt-out after refresh, reduced motion, reader/settings pause, fixed pose after dragging/wheel input and neutral return on pointer leave. The viewport override and reduced-motion emulation were reset, follow was restored on, and the local Athena/window preview was left open. Browser warnings/errors: zero.
- The left/right window screenshots show actual image changes: the left wall sample averaged `137.54` versus `121.35` RGB levels, the right wall `187.52` versus `215.12`, and the sculpture region's mean absolute pixel difference was `15.60/255`. These include parallax and lighting; they are evidence of visible response, not a separate photometric accuracy measurement. Visual inspection confirmed the light moved to the requested side and the fixed sculpture silhouette stayed stable.

Latest screenshots are `artduo-relight-window-{left,right}.png`, `artduo-relight-david-{left,right}.png`, `artduo-relight-{athena,david}-phone.png` and `artduo-relight-final-desktop.png`. The fifteen records and empty console log are in `artduo-relighting-results.json` in this task's visualization workspace. The final UI suite, UI type check, two web asset tests and optimized production build all passed after the renderer changes.

Reference reviewed: [Codrops, Relighting Images with Depth Maps and Three.js](https://tympanus.net/codrops/2026/08/19/relighting-images-with-depth-maps-and-three-js/) and its linked DGFX source. The implementation reuses the existing WebGL rendering and precomputed room maps.

## Latest correction: stationary photograph, weaker background light and geometry AO

- Removed all depth displacement from the sculpture background shader and locked the sculpture's floor contact projection. Depth and normals remain in use for relighting. The mouse-light power applied to the background is 16% of the sculpture-light power; original photographed illumination remains intact.
- Added a geometry GTAO prepass with 16 samples and an eight-sample depth/normal-aware denoise. Its field modulates indirect lighting on the sculpture and plinth. The transparent ground receiver combines directional/pointer shadows with ground contact AO, preserving its existing local and photographed-floor masks. No opaque compositing pass processes the room image.
- AO resolution is capped at 320,000 pixels, with observed buffers 754×424 on 1280×720 desktop and 253×548 on 390×844 phone viewport. Rendering remains on demand. Its targets, depth/normal materials, noise textures and auxiliary materials are released on model replacement / disposal. Float-target unavailability retains the existing shadows via a white occlusion fallback.
- Before/after neutral-view screenshots showed the sculpture/base join averaging 122.15 → 116.05 and the plinth/floor join 95.93 → 88.94 RGB levels. Drapery changed 175.76 → 172.00; the contact areas receive stronger local darkening without turning the whole sculpture dark. These are image-region comparisons, not calibrated photometric measurements.
- Left/right pointer screenshots showed background wall-region changes of 3.00 and 4.74/255, versus 10.72/255 across the sculpture region. The window frame's strongest edge stayed at the exact same x coordinate across 21 sampled rows: median and maximum displacement 0 px. The sculpture kept its fixed pose and fixed floor anchor while its viewpoint and light responded.
- Eight final browser records cover left/right input, both rooms/models, compact and reference quality, desktop and portrait phone layouts, and modal/follow-off behavior. Both joins remained visible, without an opaque floor rectangle or horizontal overflow. The viewport override was reset and the Athena/compact/window preview left open with follow enabled.
- The final UI tests (84), UI type check and optimized build passed. Node's test loader emitted a Three.js CommonJS deprecation warning when importing the AO sizing helper; it did not affect the browser build. Final browser warning/error records are empty. Earlier hot-update warnings occurred between coordinated helper removal and renderer-import updates; final reload and build confirm those imports are resolved.

Latest evidence: `artduo-contact-{before,after}.png`, `artduo-ao-stationary-{left,right}.png`, `artduo-ao-{athena,david}-phone.png`, `artduo-ao-final-desktop.png` and `artduo-ao-results.json` in the task's visualization workspace. Physical phone GPU performance and the float-target fallback were not exercised by the viewport checks.

## Boundaries of the 2026-10-26 trial

- Physical phone orientation behavior and the iOS permission prompt require testing on a phone; browser emulation does not verify those hardware interactions. The sculpture no longer provides custom touch gestures.
- That phase ended as a project-local two-model trial. No production deployment or model CDN upload was performed in that phase; the approved expansion below supersedes its model-count and delivery boundaries.
- The source license and model processing provenance are bundled in `apps/web/public/artduo-sculptures/sources.json`. Geometry display units and the digital material do not claim the original sculpture's actual size or original surface color.

## 2026-10-27：12 件雕塑、章节侧厅与 COS/CDN

用户已批准首批 12 件、每场 30% 的一次机会、最多一件、主题匹配、近期作品降权，以及馆方介绍、AI 文案、模型下载清理减面和 COS/CDN。设计记录见 `docs/plans/artduo-sculpture-encounters-2026-10-27.md`。

- **素材**：保留雅典娜、大卫头像，新增米洛的维纳斯、望楼的阿波罗、娜芙蒂蒂胸像、亚历山大化身赫利俄斯、青年马可·奥勒留、拉弓的厄洛斯、Kore、奥古斯都、沉睡的法翁、米开朗琪罗肖像。12 条 SMK 官方记录均有 PDM 1.0 标记，保存原作/翻模区别、来源和文件指纹；《米开朗琪罗肖像》的原作作者按馆方记录为 Battista Lorenzi。
- **本地处理**：12 份本地 STL 合计 295,974,708 字节。进行长度/哈希、有限坐标、退化面、微小孤立碎片、连通性检查及焊接、朝向/显示比例、平滑法线、误差受限减面和 Meshopt 压缩。原始扫描本来就是独立单连通雕塑，本轮没有发现需删除的退化面或孤立碎片；没有为凑清理数量切掉合法部件。默认模型 119,776—160,000 个三角形，每件 488,440—685,852 字节，合计 6,736,660 字节。保留更多细节版本，并从实际 WebGL 展示捕获透明预览图。
- **介绍与 AI**：馆方摘要、年代、作者与原作材质独立于观展引导。AI 复用现有服务端提供商与限额，按作品事实、实际扫描可见部位和展览主题写引导；缓存与输入/配方绑定，合并并发，临时失败有冷却。实测发现模型会给头像添加肩部、衣纹，因此加入逐件可见部位白名单与输出校验；无依据的部位、日期、署名、材质和个人心理判断回退到本地提示。打开的阅读层保持文字稳定。
- **观展机制**：侧厅记录独立于绘画路线和请求数量。至少四幅的适用展览抽一次，30% 命中、至多一件，优先章节间且至少两幅之后；单章节用中段。明确只看画作/排除雕塑时跳过。命中作品、位置、进入/完成状态保存在该展览的会话中；刷新、返回、快速连按不重抽。观看侧厅暂停绘画观察计时，继续回到原来的下一幅画；随动开关同步到返回后的画作，已通过按钮允许的手机感应选择在同一文档的房间切换中保留。素材或可选发布清单失效时跳过侧厅，绘画继续。
- **CDN**：独立清单为 `apps/web/public/artduo-sculptures/media-manifest.json`，已启用的摘要为 `sha256:c401d54d697aa83af6b5b71e4459e48244e8b012f806c3c7d0c3ea8ff8192bc3`。通过已登录 COS 控制台上传 24 个 GLB、12 张透明图与一份法线图别名；复用七份已发布房间资源。均采用私有权限、多 AZ 标准存储、`project=artduo`、一年 immutable 缓存。发现旧 `bg-034-normal.png` 字节正确但类型为 `text/plain`，为本次发布新增正确类型的 `sculpture-bg-034-normal.png`，没有覆盖旧对象或改写绘画发布清单。
- **交付核验**：44/44 项经 CDN 完整读取，通过 SHA256、MIME、长度、CORS 与 immutable 缓存检查；最终验证读取 34,091,413 字节、44 次请求。正式观展仅预载即将出现的一件默认模型，更多细节版本由试展设置按需读取；没有批量加载 12 件。
- **浏览器**：12 件默认模型均实际加载、生成透明图并保存桌面画面；CDN 模型、照片、深度/法线图、照片采光和 AO 均达到 ready。390×844 视口核对宽幅阿波罗与娜芙蒂蒂；触控模拟下手机按钮为“开启手机随动”，状态为 off。受控命中会话验证第三幅之后进入、刷新保持同一件、不会增加绘画观看记录、随动关闭后返回第四幅仍关闭、总数仍为 12、完成后刷新不再出现。受控阻断模型请求后自动回到下一幅绘画，生产构建未出现框架错误页。
- **检查**：UI 测试 89 项、聚焦 Web 测试 18 项、UI/Web 类型检查及优化构建通过。开发浏览器的 Monica 扩展向 body 添加属性，触发过一条开发模式 hydration 提示；未用应用代码屏蔽该扩展提示，另以优化构建核验正常页面与故障恢复。

本轮证据位于任务可视化目录下的 `artduo-sculpture-encounters-20261027/`：`desktop-model-checks.json`、`encounter-navigation-checks.json`、`encounter-failure-check.json`、`cdn-verification-v2.json`、逐件桌面图与 `*-phone-cdn*.png`。最初 CDN 核验因旧法线图 MIME 停止，修复别名后重新核验全闭包；不能把首份不完整收据当作交付依据。

**范围说明**：资源已经上传 COS 并由 CDN 交付；应用代码尚未部署到公网。浏览器尺寸模拟不能代替实体手机的 GPU、陀螺仪与 iOS 权限验证。原始 STL 保留在本地处理目录，没有作为运行时资源公开上传。

## 2026-10-27：扩充至 18 件，加入日常人物

用户随后要求补充普通人的视角，并把正式池扩充至 18 件。新增六件均有 SMK 原始记录及 PDM 1.0 标记：

| 展示题名 | 馆藏编号 | 默认三角形 | 默认字节 |
| --- | --- | ---: | ---: |
| 抱着小猫的女孩 | KMS5471 | 140,000 | 585,748 |
| 蜷坐的男孩 | KAS2382 | 140,000 | 598,216 |
| 坐在椅上的少女 | KAS2255 | 140,000 | 600,156 |
| 抱陶罐的老妇人 | KAS537 | 139,994 | 606,568 |
| 老渔夫 · 扫描局部 | KAS2288 | 140,000 | 581,060 |
| 沐浴的女孩们 | KMS5254 | 140,000 | 599,700 |

女孩与猫、沐浴群像是馆藏大理石作品的扫描，展签不会把它们称为石膏翻模；共同的数字石膏只是展示材质。老渔夫的身份解释保留馆方争议，实际扫描在小腿处截断；坐姿少女未保留双手。可见部位白名单、AI 提示和校验分别覆盖这些实际限制，禁止凭题名补出脚部、渔网、缺失的另一只手或不存在的配件。女孩作品的真实 AI 返回已在阅读层核对为 grounded，馆方说明保持独立。

18 份原始 STL 共 521,734,712 字节，默认 GLB 共 10,308,108 字节。六件新增模型仍使用同一误差上限、独立雕塑检查与 Meshopt 压缩；扫描均为单个有效连通对象，没有切除合法底座、支撑或身体部件。坐姿少女从 2,515,124 个三角形减至 140,000；其默认/参考版本实际渲染对照保留了衣褶、椅子与姿态，原扫描表面细纹在两版均存在。上游曾返回截断的 200/206，下载器以精确 Range、分段重试、稳定 ETag、长度与二进制 STL 结构检查恢复完整文件，未把截断响应当成原始资产。

本轮只上传 12 个新 GLB 和六张新透明图，没有覆盖原 12 件的哈希对象。更新后的独立清单为 **62 项**，摘要 `sha256:04535bc075456002ed6c4f199b6b9872590d18459061ebfe7cffba9978d9b241`。全量 CDN 核验 **62/62 通过**，62 次请求、57,364,566 字节，逐项验证完整 SHA256、长度、MIME、CORS 与 immutable 缓存后才启用新目录。两间展厅的照片、深度图和法线图继续由 CDN 读取。准备脚本支持私有处理目录、仅重做选定模型、保留旧衍生品，避免为扩充而重置旧海报或重传已有对象。

六件新增作品均在优化构建上逐件验证 1440×900 桌面与 390×844 触控视口：模型、照片采光和 AO 就绪，展签与导航可用，无横向溢出、应用异常或资源错误；默认手机感应均为 off，设置中显示“开启手机随动”。没有改变原来的 30% 展览级概率、一次机会、章节侧厅、主题匹配或返回绘画逻辑。UI 90 项、聚焦 Web 12 项、UI/Web 类型检查及本轮优化构建通过。透明图加载保留 no-referrer，并用 lazy 避免 React HTTP Link 预载丢失该属性；受控缺模型时，CDN 静态图仍以空 Referer 成功返回 200。

证据文件包括 `desktop-human-cdn-checks.json`、`phone-human-cdn-checks.json`、`production-browser-18-errors.json`、`everyday-ai-reader-check.json`、`poster-cdn-fallback-check.json`、`cdn-verification-18.json` 和 `*-cdn-18.png`，位于同一任务的 `artduo-sculpture-encounters-20261027/` 目录。

《加莱义民》完整群像另有无环境本地样片：来源为 [Scan the World / 3DBigDataSpace 的 Zenodo 21692951](https://zenodo.org/records/21692951)，[原始 API 记录](https://zenodo.org/api/records/21692951) 的许可是 CC BY-NC-SA 4.0。保留六人群像和原有基底，焊接、归一化、误差受限减面至 179,992 个三角形并压缩至 783,816 字节，实际加载了相同的 ArtDuo 采光、AO 和有界鼠标视点。它只保存在 `local-only-calais/`，**未进入正式 18 件、正式清单或 COS/CDN**。正式第 18 件暂选《沐浴的女孩们》，属于已授权的日常题材策展范围；关于 Calais 席位的可选询问尚无回复，没有把沉默当作商业使用授权。

资源已在 CDN；应用代码仍未部署公网。实体手机感应与 GPU 验证仍未进行，视口模拟不能替代实机结果。
