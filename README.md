# ArtDuo

## 公网部署规则

正式入口：[tongye.me/ArtDuo](https://tongye.me/ArtDuo) · [aitoshuu.me/ArtDuo](https://aitoshuu.me/ArtDuo)。

1. **固定分工**：两个主域名的 DNS、HTTPS 证书和公网入口保留在阿里云 `47.103.120.24`；这 9 个项目的应用或静态源站统一在腾讯云上海 `122.51.59.89`。阿里按项目路径反向代理，浏览器保留当前访问域名；不得把访客跳到服务器 IP、`aitoshuu.art` 或另一个主域名。
2. **路径约定**：`/ArtDuo`、`/SonoScope`、`/FamilyTree`、`/Focuence`、`/OutSet`、`/CordIndex`、`/CoScroll`、`/LuBirth`、`/InfiDao` 是唯一正式大小写。纯小写和其他大小混写用 308 在同域归一；只改项目名前缀，保留子路径大小写、编码和完整查询参数。末尾斜杠沿用各项目路由约定；缺失静态资源返回真实 404。
3. **域名与代理**：链接、接口、canonical 和 OG URL（若有）使用当前公网域名。入口覆盖传入的代理头；源站只信任受控网关的原始域名和客户端地址。跨云 HTTPS 校验真实证书与 SNI，不能关闭证书验证。Cookie、浏览器存储和离线缓存继续按域名隔离；流式接口关闭代理缓存与缓冲。
4. **项目范围**：只调整本项目的源站目录、服务和精确路由，保留两个首页、其他项目、DNS、证书续期及安全规则。服务器迁移不改变网站名称、个人网站属性和页面内容。COS/CDN 使用已有不可变版本前缀，保留 MIME、编码、CORS、缓存和音频 Range；密钥、私有环境、数据库、日志及临时传输包不得进入 Git 或公开目录。
5. **发布顺序**：从已确认的源码或线上冻结版本生成产物，记录源码提交、release ID 和 SHA-256；先上传并逐文件核对腾讯候选，验证依赖与健康状态，再原子切换本项目版本链接或网关 include。共享 Nginx 修改前重新读取现网、备份受影响文件，通过 `nginx -t` 后才重载，保留可用回滚版本，不能覆盖并行维护。
6. **验收与交付**：两个域名分别检查正式、小写、大小混写入口、深层页面、查询参数、版本标记、JS/CSS 与项目关键功能，核实最终地址仍在本站，并确认请求实际到达腾讯。邻站和首页必须回归；新功能按本项目测试要求验收。清理本轮测试服务、临时访问凭据及传输包，记录实际未测项；仅将本轮相关文件 commit、push，核对远端提交后交付。

腾讯源站使用 `/etc/artduo/tencent-artduo.locations.conf`，Node 后台监听本机 `3240`；阿里只代理本项目入口。既有发布目录和语义模型、手写后台配置按本项目部署文档维护。

本节为当前公网部署约定。旧文档或工具草案若仍把活动源站写成阿里，应按本节腾讯源站架构审阅后使用，不得直接覆盖现网。


ArtDuo is an AI-assisted emotional art curation project. The current active work is the V2 rebuild: a release-backed, contract-driven application that turns a short visitor intent into a browsable artwork gallery and detail pages.

The legacy `frontend/` app is kept as donor/reference material. New runtime work lives under `apps/` and shared packages live under `packages/`.

## Current Status

V2 Phase 1 is closed as a product thin slice.

- `apps/web` is a real Next App Router application.
- Landing -> Gallery -> Detail works against release artifacts.
- Runtime truth source is `data/releases/2026-10-06-paintings/manifest.json` (236 records; 144 eligible flat artworks, including 15 newly verified paintings/prints). Earlier release links remain available.
- The web thin slice currently uses a server-side release bridge: Next.js reads local release shards and runs retrieval on the server.
- Browser-local IndexedDB/Worker retrieval is explicitly deferred; it is not claimed as complete.
- Repeatable acceptance is wired through `pnpm preflight:check`.
- The four-act experience is available at `/?view=experience`; the classic flow remains the default until the touch-device, accessibility, media-source, and performance gates in the acceptance record are complete.
- The experience now supports explicit feedback on the unseen part of a route, tab-local viewing pace, shareable route order, and a separate artwork reading layer. See the [viewing adaptation acceptance record](docs/reviews/artduo-viewing-adaptation-2026-10-09.md).

Historical Phase 1 closeout evidence (these scores do not describe the refreshed corpus):

- Closeout report: `data/curation/reports/phase1-closeout-report.md`
- Release: `data/releases/2026-04-25-curation-b/`
- Benchmark prompts: `benchmarks/vector-promotion-prompts.json`
- Current benchmark gate: rerank Top-1 `95.83%`, rerank Top-5 `100%`, manual top10 pass rate `83.33%`

## Active Commands

Install dependencies:

```bash
pnpm install
```

Run the V2 web app:

```bash
pnpm --filter @artduo/web dev -- -p 3210 -H 127.0.0.1
```

To enable the evaluated DeepSeek artwork-introduction path, configure these server-only variables in `.env`:

```dotenv
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
```

When all three are present, V2 uses OpenAI-compatible SSE streaming with the grounded artwork prompt. Otherwise it keeps the local deterministic explanation fallback. Exhibition preface and closing remain a single deterministic narrative path; the lower-scoring standalone LLM prompts are not enabled.

Open:

```text
http://127.0.0.1:3210
```

Run the full Phase 1 gate:

```bash
pnpm preflight:check
```

Run only the local vector benchmark:

```bash
pnpm vector:benchmark -- --release-version 2026-04-25-curation-b
```

Run only web E2E:

```bash
pnpm --filter @artduo/web test:e2e
```

By default, Playwright uses port `3211` so it does not collide with manual debugging on `3210`. To explicitly reuse another port:

```bash
ARTDUO_WEB_E2E_PORT=3210 pnpm --filter @artduo/web test:e2e
```

## Workspace Layout

```text
apps/
  web/        Next App Router product thin slice
  api/        API route helpers and tests
  pipeline/   Release artifact, curation, embedding, and benchmark builders
packages/
  contracts/  Shared v0.1 display/data contracts
  corpus/     Release loading, embedding, vector search, rerank
  ui/         Scaffold for shared UI extraction
data/
  releases/   Runtime release artifacts
  curation/   Curation reports, review outputs, closeout evidence
  sources/    Source collection artifacts
docs/
  plans/      Current implementation and continuation plans
  specs/      Shared contracts, UX, corpus, and scene specs
frontend/     Legacy donor/reference app
reference/    External and donor references
```

## Key V2 Files

- `apps/web/app/page.tsx`: Landing page and intent form.
- `apps/web/app/gallery/page.tsx`: Ranked gallery results.
- `apps/web/app/artwork/[id]/page.tsx`: Release-backed artwork detail page.
- `apps/web/components/artwork-image.tsx`: Image fallback handling.
- `apps/web/lib/release-catalog.ts`: Web release loading, hydration, scene selection, and search.
- `packages/corpus/src/query-embedding.ts`: Local query tokenization and alias expansion.
- `packages/corpus/src/vector-search.ts`: Vector search.
- `packages/corpus/src/rerank.ts`: Vector/lexical/grade reranking.
- `apps/web/e2e/`: Playwright E2E coverage for the thin slice and Phase 1 states.
- `apps/web/lib/experience-adapter.ts`: Builds a version-pinned server snapshot from the formal release records.
- `packages/ui/src/experience/`: Four-act experience, room layout, transitions, motion policy, and share card.

## Planning Documents

- Main V2 plan: `docs/plans/artduo-v2-lightweight-rebuild-plan.md`
- Collection runbook: `docs/plans/artduo-v2-artwork-collection-runbook.md`
- Next continuation plan: `docs/plans/artduo-v2-phase2-continuation-plan.md`
- Roadmap: `docs/roadmaps/artduo-v2-three-phase-roadmap.md`
- Shared contracts/API spec: `docs/specs/artduo-v2-shared-contracts-and-api.md`
- UX state matrix: `docs/specs/artduo-v2-ux-flow-and-state-matrix.md`
- Experience integration and acceptance: `docs/plans/artduo-v2-experience-integration-plan.md` and `docs/reviews/artduo-experience-integration-acceptance.md`
- Local corpus/media schema: `docs/specs/artduo-v2-local-corpus-and-media-schema.md`
- Background scene schema: `docs/specs/artduo-v2-background-scene-schema.md`

## Phase Summary

### Phase 1: Foundation Thin Slice

Status: closed.

Delivered:

- Workspace bootstrap under `apps/` and `packages/`.
- `v0.1` display/data contracts.
- Release manifest and shards for metadata, search, media, background scenes, and embeddings.
- Release-backed Landing -> Gallery -> Detail product path.
- Web state coverage for empty results, bad image fallback, unknown detail route, and missing shard diagnostics.
- Repeatable preflight and Playwright E2E.
- Benchmark and manual top10 gate above the written Phase 1 threshold.

Known deferral:

- Browser-local IndexedDB/Worker retrieval remains a named follow-up.

### Phase 2: Curation Core Experience

Status: next.

Goal:

- Add `v0.2` session, explanation, and event contracts.
- Add curation session APIs and artwork explanation APIs.
- Preserve the Phase 1 fast gallery path while explanations are generated and cached asynchronously.
- Add ownership, idempotency, rate limit, budget, retention, and request redaction boundaries.

See `docs/plans/artduo-v2-phase2-continuation-plan.md` before continuing work.

### Phase 3: Immersive Productization

Status: planned.

Goal:

- Restore immersive gallery routes and transitions after Phase 2 state/session contracts are stable.
- Add dynamic media, transition registry, SSE enhancement, metrics, and fallback behavior.

## Git Hygiene

The current Phase 1 closeout should be committed as reviewable slices:

1. Data/release artifacts for `2026-04-25-curation-b`.
2. Product thin slice under `apps/web`.
3. Repeatable acceptance scripts/config.
4. Closeout docs and main plan updates.

Do not commit local-only output such as `.codex/`, `test-results/`, `playwright-report/`, or `.DS_Store`.
