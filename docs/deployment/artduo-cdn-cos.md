# ArtDuo COS / CDN 运维

2026-10-25 用户确认复用现有资源、保留共享限额、ArtDuo 费用单独观察。实施与测试证据见 [本轮验收](../verification/artduo-cdn-cos-2026-10-25.md)。公网切流状态以该验收记录为准。

| 项目 | 配置 |
| --- | --- |
| COS | `tongye-1327162705`，上海 `ap-shanghai`，现有私有读写桶 |
| 存储类型 | 多 AZ 标准 `MAZ_STANDARD` |
| 对象范围 | `artduo/media-v1/objects/<sha256>/<filename>`，标签 `project=artduo` |
| CDN | `https://assets.aitoshuu.me`，中国大陆，网页小文件 |
| 回源 | COS 原生 HTTPS 域名，已有 CDN 服务身份只读授权 |
| 当前覆盖 | `2026-10-24-da3-curated-630`，1337 项、301551722 字节 |
| 成功缓存 | `public, max-age=31536000, immutable`，不覆盖旧键 |
| 跨域 | 现有 `Access-Control-Allow-Origin: *`，公开读取不带凭证 |
| 防盗链 | 保留既有规则；两个正式页面域名和空 Referer 可用，localhost 会被拒绝 |

公开范围是 630 张预览、630 张 DA3 深度图、50 张经典背景、六个展厅的 24 张背景/深度/法线，以及 3 首用户主动开启的音乐。只上传白名单闭包。私人手写图、任务、生成卡、展览与查询、模型权重、配置、密钥、备份和操作记录均不进入该前缀。

页面、API、SSE、RSC、`_next` 继续使用原有双域名链路。高清近看仍走应用接口；目标机 498 件高清原图的首次读取仍依赖已校验上游。历史 release 未建立专用 CDN 清单时，继续使用既有本机路径，不伪造 CDN 覆盖。

## 准备新批次

1. 准备发布依赖的本地预览和已验证深度产物，运行 `pnpm release:public-media -- --release <release> --output <private-output>/public-media-manifest.json --upload-dir <staging>`。
2. 检查种类、数量、大小与发布绑定。发布清单可随源码打包到 `data/releases/<release>/public-media-manifest.json`；旁边的 `.upload.json` 含本机路径，留在受限操作目录，不打包、不上传。
3. 在已登录 COS 控制台仅上传 `<staging>/artduo` 目录。本次操作使用私有 ACL、多 AZ 标准存储、原图、上述 Cache-Control 和项目标签。不要同步其他目录，不导出账户密钥。
4. 自动化上传仅接受操作者明确提供的单对象短期签名许可，放在 0600 文件，用 `scripts/publish-public-media.ts --upload-grants <file>`。不从浏览器或其他项目发现凭证。工具校验授权的精确 COS 对象键、来源字节及摘要；版本控制开启时 COS 可能忽略禁止覆盖头，因此仍须由发布流程保证旧键不变。
5. 运行 `pnpm exec tsx scripts/publish-public-media.ts --manifest <manifest> --origin https://assets.aitoshuu.me --receipts <private-output>/cdn-verification.json`。默认总验证量不超过十亿字节、1500 次请求、约 450000 字节/秒；保留收据，失败后从已验证项恢复，不循环全量读取。
6. 清单全量读取、SHA256、MIME、长度、CORS 与缓存头都通过后，完成候选版本、真实双来源 Canvas/WebGL、PNG、音频 Range、旧展览、私人恢复与回退验收。候选结果可审阅后确认公网切流。

新版本换对象键和清单，保留仍被支持版本引用的旧对象。不按年龄自动删除线上资源，不整站刷新其他项目。

## 应用配置与回退

仅服务端读取三个变量，客户端只取得当前页面所需的公开 URL：

```dotenv
ARTDUO_MEDIA_MODE=cdn
ARTDUO_MEDIA_ORIGIN=https://assets.aitoshuu.me
ARTDUO_MEDIA_MANIFEST=data/releases/2026-10-24-da3-curated-630/public-media-manifest.json
```

CDN 模式必须通过源发布清单摘要、完整依赖闭包及原图/深度绑定检查。配置缺项拒绝激活。房间 960/1600 和纹理分别使用实际哈希地址，不从大图 URL 猜测小图键。传输配置不改变作品顺序、展览身份、叙事和模型缓存键。

普通故障经确认可回本机时，将 `/etc/artduo/artduo.env` 中 `ARTDUO_MEDIA_MODE` 改为 `local`，只重启 `artduo-web.service` 并核验健康、原展览、预览/深度、私有图。Worker 不需要重启，持久目录、额度及任务不恢复为旧副本。已有页面可能需刷新才能换掉此前的 CDN URL。

若因异常流量或费用问题停服，不自动将全部失败请求回源到腾讯应用；先排查原因。回退旧构建时保留当前持久数据，不清空账本或重新生成已完成手写任务。

## 共享配置与费用观察

保留现有共享限额、防盗链、证书与全局缓存/响应头；不应用初案的 ArtDuo 月 100 GB 或短时 1 GB 停服配置。404 继承共享的 10 秒缓存，403 和 500—504 不缓存。证书当前到期日为 2027-01-17。

ArtDuo 单独记录对象清单、项目标签、发布批次和验证收据；按此核算本项目存储与发布读取。当前单份多 AZ 存储约 0.042 元/月；网络成本还包含 COS 回源/请求和 CDN 下行/HTTPS 请求，不能把同属腾讯理解为回源免费。刊例估算与实际折扣、免费额度和计量单位可能不同，核账以腾讯账单为准。

沿用 50 元/月成本观察值，25 / 40 元进行人工复核。这没有建立定时监控、独立自动告警或项目级硬封顶。共享 CDN 原生账单按域名统计，不能直接给出 ArtDuo 精确账单；整个 `assets.aitoshuu.me` 的费用和共享 HTTPS 免费额度不能全部归给 ArtDuo，也不能据此停掉其他内容。未读取其他前缀的私有访问日志。若以后要求精确独立自动核账，应先确认按前缀采集的统计能力或改用专属域名及其影响。

腾讯官方依据：[缓存键](https://cloud.tencent.com/document/product/228/47671)、[回源重写](https://cloud.tencent.com/document/product/228/50110)、[COS/CDN 授权](https://cloud.tencent.com/document/product/436/18669)、[CDN 计费](https://cloud.tencent.com/document/product/228/75562)、[COS 流量](https://cloud.tencent.com/document/product/436/53863)。

## 雕塑独立发布（2026-10-27）

18 件雕塑使用独立的 `apps/web/public/artduo-sculptures/media-manifest.json`，不改变绘画 release 的完整覆盖检查。62 项包含 36 个 GLB、18 张透明预览和两间展厅的八项图片/光照资源。名作修订保留最初 12 件，将六件旧增补替换为《加莱义民》《思想者》《掷铁饼者》、苏格拉底肖像、巴尔扎克纪念像和贝多芬纪念像；新增上传 18 个对象，复用 44 个既有对象。来源与处理指纹保存在同目录 `sources.json`。默认模型每件约 0.49—0.79 MB，18 件合计 10,664,892 字节，新增六件合计 3,928,232 字节。原始 STL/GLB 与中间处理网格不公开上传；退役对象保留归档，没有删除或覆盖旧 COS 对象。

`scripts/build-sculpture-media.ts` 生成白名单清单、私有本机来源列表和上传目录，继续复用既有哈希对象前缀、属性和核验工具。`--prepared-dir` 可先在本地处理目录构建完整清单，`--previous-manifest` 让上传目录跳过已发布键；最终仍须核验完整闭包。旧 bg-034 法线图的类型错误通过新增 `sculpture-bg-034-normal.png` 别名处理，没有覆盖旧对象或改变共享 CDN 设置。

当前已核验清单为 `sha256:71dfdbd2050ec2c62a552591fba60dbb327cca4815d42b85027a9f2a8b41fe59`：62/62 项全文件校验通过，完整闭包为 53,385,293 字节。修订使用各文件的实际授权：SMK 的 PDM 1.0、《思想者》的 CC BY-SA 4.0、巴尔扎克的 CC BY 4.0、贝多芬的 CC0 1.0。《加莱义民》完整无环境群像来自 [Zenodo 21692951](https://zenodo.org/records/21692951)，以 CC BY-NC-SA 4.0 正式入池；用户已明确当前为非商业使用。巴尔扎克使用 [Zenodo 10336866](https://zenodo.org/records/10336866) 的公开原始文件。两个来源均不要求 Sketchfab 登录。保留署名、改动说明及 SA/NC 条件，模型和渲染封面内嵌授权信息。

仅在全量 CDN 核验通过后写入 `delivery.json` 的来源、清单摘要与核验时间；服务端还会检查清单与当前雕塑来源文件的绑定。已核验的独立发布默认使用 CDN。`ARTDUO_SCULPTURE_MEDIA_MODE=local` 可显式用于本地诊断；它与绘画的 `ARTDUO_MEDIA_MODE` 分开控制。正常资源故障或发布清单不匹配会跳过可选侧厅，不自动把失败的模型请求转回应用服务器。资源交付完成不等于应用代码已部署。
