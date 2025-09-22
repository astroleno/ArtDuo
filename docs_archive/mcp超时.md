先给结论：大概率不是“API 挂了”，而是**调用链设计 + 运行环境**共同导致的超时。把原因按优先级拆给你，并附带定位与修复手册。

# 常见成因（按概率从高到低）

1. **一次性“搜索 + 批量详情水合（hydrate）”**
   很多搜索实现会先命中 `/search` 得到大量 `objectIDs`，随后在同一次工具调用里并发请求 `/objects/{id}` 做“富化”。如果结果量大（上百上千），就会：

* 并发风暴 → 连接数上限/端口耗尽
* 客户端或 MCP 客户端默认工具调用超时（常见 30–60s）
* 你的“降级逻辑”只覆盖单次请求，没覆盖“批量水合”的长尾

2. **并发与连接复用配置不当**
   Node/Undici 默认并发虽高，但若未启用 keep-alive、未限流到单主机，容易在网络稍慢时触发 `ETIMEDOUT/ECONNRESET`。

3. **DNS/IPv6 路径问题**
   本机或容器 DNS 解析慢 / 命中了不可用的 IPv6 路径（常见于双栈环境），会让 `time_namelookup` 或 `TLS` 建链拖长。

4. **代理/公司网络/云厂商 egress 限制**
   环境中设置了 `HTTP(S)_PROXY`、或出网白名单/带宽整形，`/search` 频次高比“单条详情”更容易触发节流。

5. **客户端超时门槛过短**
   `fetch` 没有显式超时，或 MCP 客户端/网关有更短的上游超时（如 10–15s），在高延时环境下更容易被切断。

6. **请求参数过宽导致结果过大**
   没有添加 `hasImages=true`、`isOnView`、`departmentId` 等过滤，命中海量 ID，进一步放大了 1) 的问题。

# 快速定位（5 分钟内给出方向）

1. **对比 cURL 直连耗时**（在同一台机器上执行）

```bash
curl -sS -w '\nlookup:%{time_namelookup} connect:%{time_connect} tls:%{time_appconnect} start:%{time_starttransfer} total:%{time_total}\n' \
'https://collectionapi.metmuseum.org/public/collection/v1/search?q=sunflowers&hasImages=true'
```

* 如果 `lookup` 明显大：是 DNS 问题
* 如果 `connect/tls` 大：是网络/代理/IPv6 路径
* 如果 `start` 大：API 服务慢或结果过大
* 如果 `total` 明显> `start`：是大 payload/本地处理拖慢

2. **拉取同样规模的“对象详情批量”**，观察是否在 N≈20 之后开始显著超时 → 提示并发/连接复用问题。

3. **查看你 MCP 工具调用的总时长**（从工具入口到返回的 wall time）：若搜索+水合放在一次调用里且>30s，优先改架构（见下）。

# 立刻可做的修复（不影响现有降级机制）

A. **把“搜索”和“水合详情”解耦**

* `search` 工具只返回 `total` + **前 N 个 objectIDs**（N=20/50，可随前端分页/“加载更多”）
* 新增 `get-objects-batch`（或复用已有 `get-museum-object` 多次调用）在**后续**再拉详情
* MCP 侧尽量**流式返回**（chunk/分页），避免一次工具调用等待全部完成

B. **限流 + 连接复用**

* 并发控制：`p-limit`（如并发=5–10）；对同一主机做队列
* 启用 keep-alive（Undici/Node）：

  * `undici.setGlobalDispatcher(new Agent({ keepAliveTimeout: 10_000, connections: 10 }))`
* 对错误码/网络错误做**指数退避 + 抖动**（如首等 300ms → 600ms → 1.2s，最多 3 次）

C. **显式超时与可中断**

* 给 `fetch` 包一层 `AbortController`，搜索 8–12s 超时，详情 3–5s 超时
* 把“客户端超时”设置为**略大于**你的 `fetch` 超时，避免外层先断

D. **收敛搜索参数**

* 默认带 `hasImages=true`，必要时支持 `departmentId`、`title`、`artistOrCulture=true`
* 服务端对“过宽 query”给出提示并自动加约束（如空格分词后至少 1 个关键词长度>2）

E. **网络与 DNS 护栏**

* Node 18+/容器里设置 IPv4 优先：

  * 运行参数 `--dns-result-order=ipv4first` 或 `dns.setDefaultResultOrder('ipv4first')`
* 若走代理，确保把 `collectionapi.metmuseum.org` 加入 `NO_PROXY`
* 在容器/机房里改用更快的公共 DNS（如 1.1.1.1/8.8.8.8），或在 /etc/hosts 里做短期 pin（仅排障时用）

# 示例伪码（搜索只返回轻量结果 + 限流水合）

```ts
// 搜索端：只做轻量请求
const url = new URL('https://collectionapi.metmuseum.org/public/collection/v1/search');
url.searchParams.set('q', q);
url.searchParams.set('hasImages', 'true');

const controller = new AbortController();
setTimeout(() => controller.abort(), 12000);
const res = await fetch(url, { signal: controller.signal });

const { total, objectIDs = [] } = await res.json();
// 只回前 20 个 ID，前端/客户端再分页取更多
return { total, objectIDs: objectIDs.slice(0, 20) };
```

```ts
// 批量详情端：限流 + 退避
import pLimit from 'p-limit';
const limit = pLimit(8);

async function getObjectSafe(id: number) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`, { signal: ctrl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise(s => setTimeout(s, (300 * 2 ** (attempt - 1)) + Math.random() * 200));
    }
  }
}

const hydrated = await Promise.all(objectIDs.map(id => limit(() => getObjectSafe(id))));
return hydrated;
```

# 运营层面的兜底

* **工具超时门槛**：把 MCP 客户端的单次工具超时设到 ≥ 25–30s（仅限搜索工具），详情工具 10–15s；同时在结果大时**提示分页**。
* **熔断/降级**：连续 N 次 `ETIMEDOUT/ECONNRESET` 即熔断 60–120 秒，仅返回 ID，不做水合。
* **缓存**：热门 query（如 “sunflowers”、“van gogh”）做 5–15 分钟内存/边缘缓存。

# 小结

搜索之所以“更容易超时”，根因多半是**结果规模 + 批量详情水合**触发的并发与时间预算问题；其次是**网络路径/DNS/代理**导致的建链慢。先解耦“搜索/详情”、启用限流与超时、收敛搜索参数，再检查 DNS/IPv6/代理设置，基本就能把超时率压到可控范围。
