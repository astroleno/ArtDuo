# ArtDuo Gallery 背景场景解析目录（VLM Draft）

Created: 2026-04-23
Status: active
References:

- `docs/specs/artduo-v2-background-scene-schema.md`
- `public/artduo-gallery/artduo-gallery-scene-vlm-drafts.json`
- `public/artduo-gallery/scenes/`
- `public/artduo-gallery/`

## 目标

这份目录把 `public/artduo-gallery/` 下的 50 张背景图整理为一版可落盘、可检索、可继续归一化的 scene draft。

这次产物参考了 `artduo-v2-background-scene-schema.md` 里的 Layer A 和最小必需字段，同时把原始 ChatGPT 默认文件名统一改成了可读的 ASCII 资产名。

## 方法

1. 用多个 agents 并行解析图像语义、挂画区、UI 可读性和转场倾向
2. 对 agent 草稿做人工补齐与字段归一，统一为一版 nested draft record
3. 生成 machine-readable JSON manifest 和一份给人看的 catalog 文档
4. 按 `bg-{series}-{descriptor}-{index}.png` 模式重命名资产文件

## 产物

- JSON manifest: `public/artduo-gallery/artduo-gallery-scene-vlm-drafts.json`
- Child JSONs: `public/artduo-gallery/scenes/bg-xxx.json`
- Catalog 文档: `docs/specs/artduo-v2-artduo-gallery-scene-drafts.md`
- 背景记录数: **50**
- 已重命名 PNG 数: **50**
- 已拆分子 JSON 数: **50**

## Broad Families

| Family | Count |
| --- | ---: |
| classical-and-museum | 15 |
| ornate-and-luxe | 6 |
| warm-and-organic | 7 |
| minimal-and-white-cube | 6 |
| futurist-and-parametric | 5 |
| editorial-and-set | 3 |
| industrial-and-brutalist | 4 |
| sacral-and-gothic | 4 |

## 备注

- `bg-001` 已在 2026-04-23 晚间被替换为新的纯背景画廊图，并同步删除误入库的 UI 合成图。
- 当前 JSON 更接近 `BackgroundSceneVlmDraft` 到 `BackgroundSceneRecord` 之间的 hybrid draft；如果后面要接严格匹配逻辑，建议继续归一化 `artwork_palette_modes` / `artwork_composition_modes` 等枚举。
- 第 11 到 20 张在首轮生成时先做了人工补齐，随后已用延迟返回的 subagent 结果做交叉核对；当前文件保留的是统一归一后的 hybrid draft。

## 文件改名映射

| ID | Original Filename | Suggested Filename | Label | Asset Group |
| --- | --- | --- | --- | --- |
| 001 | ChatGPT Image 2026年4月23日 20_34_27.png | bg-skylit-warm-gallery-plaster-wall-001.png | 天光暖木留白展墙 | skylit-warm-gallery |
| 002 | ChatGPT Image 2026年4月23日 00_43_59.png | bg-industrial-gallery-concrete-002.png | 工业灰墙极简展厅 | industrial-gallery |
| 003 | ChatGPT Image 2026年4月23日 00_44_04.png | bg-ornate-museum-emerald-003.png | 墨绿鎏金华丽展厅 | ornate-museum |
| 004 | ChatGPT Image 2026年4月23日 00_44_09.png | bg-warm-wood-gallery-plaster-wall-004.png | 暖木留白静谧展厅 | warm-wood-gallery |
| 005 | ChatGPT Image 2026年4月23日 00_44_14.png | bg-white-cube-gallery-minimal-005.png | 白立柱极简白盒展厅 | white-cube-gallery |
| 006 | ChatGPT Image 2026年4月23日 00_44_18.png | bg-classical-museum-color-ochre-006.png | 金赭古典博物馆厅 | classical-museum-color |
| 007 | ChatGPT Image 2026年4月23日 00_44_22.png | bg-classical-museum-color-midnight-blue-007.png | 夜蓝古典博物馆厅 | classical-museum-color |
| 008 | ChatGPT Image 2026年4月23日 00_44_26.png | bg-classical-museum-color-terracotta-008.png | 赤陶古典博物馆厅 | classical-museum-color |
| 009 | ChatGPT Image 2026年4月23日 00_44_30.png | bg-classical-museum-color-sage-green-009.png | 鼠尾草古典博物馆厅 | classical-museum-color |
| 010 | ChatGPT Image 2026年4月23日 00_44_36.png | bg-ornate-museum-gold-black-010.png | 金黑装饰豪华展厅 | ornate-museum |
| 011 | ChatGPT Image 2026年4月23日 00_44_40.png | bg-warm-wood-zen-gallery-sunlit-wall-011.png | 暖木日影留白展墙 | warm-wood-zen-gallery |
| 012 | ChatGPT Image 2026年4月23日 00_44_44.png | bg-minimal-white-partition-gallery-black-bench-012.png | 白幕极简白盒展墙 | minimal-white-partition-gallery |
| 013 | ChatGPT Image 2026年4月23日 00_44_48.png | bg-gold-classical-gallery-champagne-wall-013.png | 金色古典主展墙 | gold-classical-gallery |
| 014 | ChatGPT Image 2026年4月23日 00_44_50.png | bg-framed-classical-gallery-light-cream-014.png | 浅金框景古典展墙 | framed-classical-gallery |
| 015 | ChatGPT Image 2026年4月23日 00_45_01.png | bg-soft-white-chamber-curved-wall-015.png | 柔光未来白舱 | soft-white-chamber |
| 016 | ChatGPT Image 2026年4月23日 00_45_06.png | bg-terracotta-arcade-gallery-arched-openings-016.png | 陶粉拱廊庭院展墙 | terracotta-arcade-gallery |
| 017 | ChatGPT Image 2026年4月23日 00_45_09.png | bg-gothic-dark-gallery-aubergine-wall-017.png | 哥特紫黑剧场展厅 | gothic-dark-gallery |
| 018 | ChatGPT Image 2026年4月23日 00_45_12.png | bg-graphic-editorial-gallery-navy-panel-018.png | 几何蓝红编辑展墙 | graphic-editorial-gallery |
| 019 | ChatGPT Image 2026年4月23日 00_50_03.png | bg-baroque-atrium-gallery-sculpted-arches-019.png | 穹顶雕像巴洛克厅 | baroque-atrium-gallery |
| 020 | ChatGPT Image 2026年4月23日 00_50_10.png | bg-palatial-red-gallery-carmine-wall-020.png | 朱红鎏金宫廷展墙 | palatial-red-gallery |
| 021 | ChatGPT Image 2026年4月23日 00_50_14.png | bg-grand-classical-hall-arched-021.png | 古典穹顶展厅墙 | grand-classical-hall |
| 022 | ChatGPT Image 2026年4月23日 00_50_26.png | bg-minimal-window-gallery-modern-022.png | 现代临窗展墙 | minimal-window-gallery |
| 023 | ChatGPT Image 2026年4月23日 00_56_30.png | bg-arched-museum-wall-classical-023.png | 古典拱厅主展墙 | arched-museum-wall |
| 024 | ChatGPT Image 2026年4月23日 00_56_35.png | bg-monumental-stone-gallery-minimal-024.png | 浅石材中庭展墙 | monumental-stone-gallery |
| 025 | ChatGPT Image 2026年4月23日 00_56_39.png | bg-sacred-arched-gallery-ornate-025.png | 圣堂拱顶留白墙 | sacred-arched-gallery |
| 026 | ChatGPT Image 2026年4月23日 00_56_43.png | bg-rotunda-stone-chamber-dramatic-026.png | 圆厅石壁展区 | rotunda-stone-chamber |
| 027 | ChatGPT Image 2026年4月23日 00_58_27.png | bg-brutalist-minimal-gallery-concrete-027.png | 极简混凝土展墙 | brutalist-minimal-gallery |
| 028 | ChatGPT Image 2026年4月23日 00_58_32.png | bg-zen-editorial-alcove-wood-028.png | 侘寂木作展墙 | zen-editorial-alcove |
| 029 | ChatGPT Image 2026年4月23日 00_58_35.png | bg-art-deco-salon-emerald-029.png | 装饰艺术展墙 | art-deco-salon |
| 030 | ChatGPT Image 2026年4月23日 00_58_38.png | bg-futurist-white-gallery-curved-030.png | 未来白盒展厅 | futurist-white-gallery |
| 031 | ChatGPT Image 2026年4月23日 01_00_58.png | bg-classical-museum-hall-arched-031.png | 古典穹顶展厅 | classical-museum-hall |
| 032 | ChatGPT Image 2026年4月23日 01_01_03.png | bg-gothic-stone-gallery-arched-032.png | 哥特石拱展厅 | gothic-stone-gallery |
| 033 | ChatGPT Image 2026年4月23日 01_01_07.png | bg-ornate-wood-gallery-wood-paneled-033.png | 深木古典画廊 | ornate-wood-gallery |
| 034 | ChatGPT Image 2026年4月23日 01_01_11.png | bg-minimal-white-gallery-concrete-034.png | 极简白墙展厅 | minimal-white-gallery |
| 035 | ChatGPT Image 2026年4月23日 01_04_59.png | bg-celestial-rotunda-gallery-cream-wall-035.png | 星穹圆厅展墙 | celestial-rotunda-gallery |
| 036 | ChatGPT Image 2026年4月23日 01_05_04.png | bg-earthen-cave-gallery-warm-light-036.png | 土岩洞壁展厅 | earthen-cave-gallery |
| 037 | ChatGPT Image 2026年4月23日 01_05_09.png | bg-iridescent-black-gallery-black-box-037.png | 虹彩黑盒展厅 | iridescent-black-gallery |
| 038 | ChatGPT Image 2026年4月23日 01_05_14.png | bg-parametric-soft-gallery-curved-038.png | 流线曲面展厅 | parametric-soft-gallery |
| 039 | ChatGPT Image 2026年4月23日 01_06_01.png | bg-light-classical-gallery-light-cream-039.png | 浅金古典白厅 | light-classical-gallery |
| 040 | ChatGPT Image 2026年4月23日 01_06_05.png | bg-modern-windowed-gallery-white-wall-040.png | 通透现代白厅 | modern-windowed-gallery |
| 041 | ChatGPT Image 2026年4月23日 01_06_09.png | bg-classical-gallery-wall-warm-brown-041.png | 古典暖棕展墙 | classical-gallery-wall |
| 042 | ChatGPT Image 2026年4月23日 01_06_12.png | bg-minimal-museum-partition-gray-042.png | 极简灰厅主墙 | minimal-museum-partition |
| 043 | ChatGPT Image 2026年4月23日 01_18_39.png | bg-wabi-zen-display-wall-wabi-sabi-043.png | 侘寂木框展墙 | wabi-zen-display-wall |
| 044 | ChatGPT Image 2026年4月23日 01_18_42.png | bg-art-deco-grand-wall-gold-trim-044.png | 装饰艺术展墙 | art-deco-grand-wall |
| 045 | ChatGPT Image 2026年4月23日 01_18_46.png | bg-brutalist-concrete-hall-minimal-045.png | 清水混凝土展墙 | brutalist-concrete-hall |
| 046 | ChatGPT Image 2026年4月23日 01_18_49.png | bg-futuristic-white-chamber-curved-046.png | 未来白舱展壁 | futuristic-white-chamber |
| 047 | ChatGPT Image 2026年4月23日 01_24_27.png | bg-daylit-scandinavian-gallery-light-wood-047.png | 天光浅木展厅 | daylit-scandinavian-gallery |
| 048 | ChatGPT Image 2026年4月23日 01_24_31.png | bg-industrial-loft-white-wall-brick-048.png | 工业白幕展墙 | industrial-loft-white-wall |
| 049 | ChatGPT Image 2026年4月23日 01_24_33.png | bg-gothic-arch-niche-stone-049.png | 哥特拱龛展墙 | gothic-arch-niche |
| 050 | ChatGPT Image 2026年4月23日 01_24_36.png | bg-playful-editorial-geometry-pastel-050.png | 糖果几何展墙 | playful-editorial-geometry |
