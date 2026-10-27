# 手写寄语纪念卡运行说明

正式功能位于 `apps/web` 与 `packages/ui`。前言提供本次观展的提前准备入口；结语提供制作、进度、预览及 PNG 保存。用户必须确认准确寄语和独立个人落款。Inko 只收到这些文字、字迹及排版参数；作品图片、心情原句与观看记录不附带发送。

## 配置与启动

服务端读取项目环境中的 `INKO_API_KEY`，其次读取项目 `.inko/key`。密钥仅供路由与 Worker 使用，不能放入 `NEXT_PUBLIC_*`、前端代码或公开目录。本机既有密钥已通过用户授权的 Ego Lite 控制台复制到 `.inko/key`；该目录内容由自身 `.gitignore` 排除。

```sh
pnpm --filter @artduo/contracts build
pnpm --filter @artduo/web build
pnpm --filter @artduo/web start
```

在另一个受进程管理器监督的进程中运行持久 Worker：

```sh
pnpm --filter @artduo/web handwriting:worker
```

Worker 启动时向 Inko 核验可用字迹，提供其中最多六款；可通过 `INKO_STYLE_CODES=1,2,3` 固定账号实际可用的字迹。核验完成后才开放新制作。Worker 停止、配置缺失或心跳失效时，界面明确提示服务不可用；原有普通分享仍然可用，已有完成结果仍可在有效期内读取。

若开发机的网络依赖代理，需要让 Worker 进程使用同一代理。在支持 Node 环境代理的运行时中，可在启动命令前传入 `HTTPS_PROXY`、`HTTP_PROXY` 与 `NODE_USE_ENV_PROXY=1`。本次本机联调用的是已配置的 `http://127.0.0.1:7897`，只为本任务的进程传入环境变量，没有修改系统网络设置。部署服务器应使用自己的实际网络配置，不能直接照抄本机端口。

默认 API 地址为 `https://api.inkotype.com/v1`，可用服务端 `INKO_API_BASE` 覆盖。只接受 HTTPS。素材仅从该 API 主机及 Inko 官方域名下载，不接受用户提交的图片 URL，不跟随素材重定向。

## 持久化与部署边界

沿用当前单实例、私有持久卷的运行方式。Next 和 Worker 必须读取同一个 `ARTDUO_STATE_DIR`；本机未指定时，使用 `.cache/artduo-runtime/handwriting`。该目录不能位于 `public` 下，文件权限为私有。

- `jobs`：草稿、请求状态、上游编号、报价、租约与清理结果。
- `requests`：会话内稳定请求 ID 与任务的绑定；重试及刷新沿用同一请求。
- `assets`：原始笔迹包与准备后的透明 PNG；只有受归属校验的文字层可以通过路由读取。
- `worker.json`：心跳、可用状态及经核验的字迹。
- `coordination`：账号协调锁和提交间隔。

多个项目共用 Inko 账号时，应显式将各项目的 `INKO_COORDINATION_DIR` 配置到同一私有持久目录，以协调账号并发与提交节奏。不能分别调高站点并发后相加使用。独立机器或无服务器环境需提供相同语义的共享持久队列与协调存储，再运行独立 Worker；当前文件锁实现只支持同一主机的持久卷，不能宣称支持分布式部署。

任务不会依赖 Next 请求结束后的临时进程。重启后从持久任务、上游编号和已保存笔迹包继续。网络超时后使用原幂等标识核对，不创建另一笔不明提交。取消后迟到结果不会重新发布到当前卡面。

## 费用、交付与故障恢复

模型固定为 `lyric-1`，开启 `scene: true`，保留可见 `AI生成 · Inko` 标识。每次新提交必须先通过 `/quote` 和 `/layout`：显式报价为零、没有缺字、没有未安置文字且页数不超过四页。报价缺失、非零或异常时停止提交，不请求充值，不调用网站另行计费的 AI 助手。

作品使用现有本地预览路径；后台从笔迹包的字形准备透明暖色笔迹层，保留完整寄语与落款。卡面宽度为 1080 px，高度随笔迹、标题、作者和来源增长。PNG 导出后重新封装原有 AIGC 字段、XMP、来源页编号与独立的编辑标记，不以普通文字结果冒充手写结果。

所需笔迹包和透明 PNG 保存后才请求 `/delivery-complete`，按实际结果记录成功或错误。调用清理失败不会把已保存的纪念卡改为失败。受控素材默认可读取三十天；过期或丢失时明确显示失效，用户可保留原文重新制作。

寄语最多 2000 字，个人落款最多 40 字；超出完整卡面能力时应修改文字或段落，不裁切署名、隐去生成标识或静默降级。生成失败时原输入保留，可显式重试；普通分享入口始终独立。

API、排版和笔迹包格式依据：[Inko API](https://github.com/pretend1111/inko-skill/blob/main/inko-handwriting/references/api.md)、[布局](https://github.com/pretend1111/inko-skill/blob/main/inko-handwriting/references/layout.md)、[笔迹包](https://github.com/pretend1111/inko-skill/blob/main/inko-handwriting/references/scene.md)。本机实际接口核验记录保存在本次接入的验收目录，费用和延迟以该次实际返回为准。
