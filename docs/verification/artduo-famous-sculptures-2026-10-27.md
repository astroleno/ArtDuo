# ArtDuo：18 件雕塑名作修订验证

2026-10-27。用户明确当前为非商业用途；不再把“必须可商用”作为入池条件，也不要求 Sketchfab 登录。保留最初 12 件，将六件旧增补替换为下表作品。《加莱义民》的六人完整群像计为一件，总数为 18。

## 来源、处理与介绍

| 作品 | 下载来源与授权 | 处理后的默认模型 | 事实与展示核对 |
| --- | --- | --- | --- |
| 加莱义民 | [Scan the World / 3DBigDataSpace，Zenodo](https://zenodo.org/records/21692951)，CC BY-NC-SA 4.0 | 179,986 三角面；787,948 B | 完整群像、无环境；移除 461 个退化面，保留两个实际组成部分。低展台适配整体底座。人物是六位城市显要市民，介绍没有将其写成工人或断言他们最终遇难。 |
| 思想者 | [Scan the World / Jonathan Beck，Commons STL](https://commons.wikimedia.org/wiki/File:Scan_the_World_-_The_Thinker_(Auguste_Rodin).stl)，CC BY-SA 4.0 | 160,000 三角面；674,220 B | 独立人物及自身底座；区分构思年代与不同铸件年代，不虚构扫描铸件的具体收藏地点。 |
| 掷铁饼者 | [SMK KAS1074](https://api.smk.dk/api/v1/art/?object_number=KAS1074&lang=en)，PDM 1.0 | 140,000 三角面；560,344 B | 石膏翻模扫描；保留铁饼、完整人物及支撑，不混用 KAS1549 的修复说明。 |
| 苏格拉底肖像 | [SMK KAS635](https://api.smk.dk/api/v1/art/?object_number=KAS635&lang=en)，PDM 1.0 | 140,000 三角面；590,884 B | 头像与柱形基座；将哲学家的生卒年与后来肖像类型、复制品的年代分开。可见部位不含完整身体、手部或衣纹。 |
| 巴尔扎克纪念像 | [pattarrian，Zenodo 公开镜像](https://zenodo.org/records/10336866)，CC BY 4.0 | 159,968 三角面；651,652 B | 原始下载 950,164 面；去掉后加的高展示台，保留衣袍、人物和薄原生底座，并封闭新底面。裁切后为 453,598 面，再执行减面。 |
| 贝多芬纪念像 | [noe-3d.at，Commons STL](https://commons.wikimedia.org/wiki/File:Ludwig_van_Beethoven_-_3D_model_by_noe-3d.at_-_Sketchfab.stl)，CC0 1.0 | 159,998 三角面；663,184 B | 完整日常衣着人物，保留自身支撑石和题字底座；不带公园、柱廊或周边环境。 |

六件默认模型合计 3,928,232 B，18 件默认模型合计 10,664,892 B。统一数字石膏材质不冒充原作材质。原始下载、授权记录、GLB 转换和底座裁切收据保留在私有准备目录；GLB 与透明封面内嵌实际来源、署名、授权和改动说明，SA/NC 条件也显示在展签中。

作品介绍另据 [Hirshhorn](https://hirshhorn.si.edu/explore/auguste-rodin-the-burghers-of-calais/)、[西洋美术馆](https://rodin.nmwa.go.jp/3d-models/burghers-of-calais/)、[罗丹美术馆《思想者》](https://www.musee-rodin.fr/en/musee/collections/oeuvres/thinker)、[Middelheim 巴尔扎克记录](https://collectie-in-het-park.middelheimmuseum.be/en/menselijkenatuur/balzac)整理。贝多芬介绍根据 [Beethoven-Haus Bonn](https://www.beethoven.de/en/media/view/5453063242383360)和[维也纳公园记录](https://www.wien.gv.at/freizeit/heiligenstaedterpark)，将 1902 年人物设计与 1910 年纪念设施分开标注。

## CDN 与池切换

- 清单：`apps/web/public/artduo-sculptures/media-manifest.json`，摘要 `sha256:71dfdbd2050ec2c62a552591fba60dbb327cca4815d42b85027a9f2a8b41fe59`。
- 完整闭包 62 项：36 个 GLB、18 张透明封面、两间展厅的八项图片/深度/法线资源，共 53,385,293 B。62/62 项实际完整下载并通过 SHA-256、长度、MIME、CORS 与 immutable 缓存校验后，才更新 `delivery.json`。
- 本次上传 18 个新对象，复用 44 个已发布对象。介绍日期修正没有改变资产字节；修正后的清单仍重新执行了完整 62 项核验。
- 最初 12 条选择记录逐项保持相同，所有派生文件的本机哈希吻合。公开目录只保留当前 36 个 GLB 和 18 张封面；六件退役作品移至本机回滚档案。没有删除或覆盖旧 COS 对象，也没有改动绘画发布清单、共享存储设置或 CDN 策略。
- 正式体验继续沿用每个符合条件的展览一次 30% 机会、最多一件、刷新与返回不重抽的规则；绘画成员、顺序和计数不变。

## 实际页面与 AI

本地优化构建运行于 `http://127.0.0.1:3219`。六件均在实际 `/experience/sculptures` 页面检查，而非只用独立模型查看器：

- 桌面 1440 × 900 和手机 390 × 844 各六件，均从正式 CDN 模型地址载入，模型、AO 和环境光状态全部为 ready，无横向溢出；12 张截图已检查完整轮廓、展台接触和展签位置。
- 《加莱义民》实际鼠标测试：模型静态朝向始终为 -1.1000，视点从 `0,0` 变为 `0.3419,-0.2735`，柔光输入随鼠标变化；背景图片的来源、变换和裁切位置完全不变。回到中心后输入归零。没有开启模型绕轴旋转。
- 手机尺寸下六件的感应状态均为 off，设置中有“开启手机随动”入口；未自动请求或启用传感器。展开手机展签后没有横向溢出。桌面群像展签显示独立的事实介绍、AI 引导、署名、NC/SA 条件和实际 Zenodo 来源链接。
- 六件实际请求 `/api/sculptures/narrative` 均为 HTTP 200 / grounded。逐件检查可见部位；苏格拉底文案没有补出双手、身体或衣纹，其他文案没有增补材质、作者、年代或心理诊断。固定事实说明独立保留，拒绝或不可用的 AI 输出仍回退到本地观看提示。

## 检查结果与范围

- Web 雕塑目录、叙述、预览测试：9/9 通过。
- UI 彩蛋选择、刷新稳定性、排除条件和构图测试：6/6 通过。
- 外部来源导入、源文件完整性和授权校验测试：2/2 通过。
- Next.js 优化构建、Web 类型检查均通过；类型检查在构建结束后顺序执行。
- 最后截图期间发生一次本机 ENOSPC。仅删除可从已保留原始 GLB 重新生成的巴尔扎克未裁切中间 STL，释放 47,508,284 B；原始文件、转换/裁切收据与最终网格保留。随后补齐桌面与手机截图核对。

准备与核验材料位于本任务私有产物目录 `artduo-famous-sculptures-20261027`，包括 `activation.json`、`cdn-verification-famous-18-final.json`、`final-desktop-checks.json`、`final-phone-checks.json`、`final-pointer-check.json` 和 `ai-famous-six.json`。

模型/CDN 交付与本机集成已经验证；本轮没有部署生产应用、提交或推送代码。手机为浏览器触摸与尺寸模拟，未替代真机 GPU、iOS 授权弹窗和实际重力传感器测试。

后续用户批准上线并改为 50% 概率，生产切换和真实正式展览验证已完成，见 [雕塑彩蛋上线验收](artduo-sculpture-production-2026-10-27.md)。上文“未部署”记录的是此前本地准备阶段。
