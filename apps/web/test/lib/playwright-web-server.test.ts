import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import path from "node:path";
import { test } from "node:test";

test("CI web server refuses to reuse an unrelated healthy service", async () => {
  const occupiedServer = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("not ArtDuo");
  });
  occupiedServer.listen(0, "127.0.0.1");
  await once(occupiedServer, "listening");

  const address = occupiedServer.address();
  assert.ok(address && typeof address === "object");
  const child = spawn(process.execPath, [path.resolve("scripts/playwright-web-server.mjs")], {
    cwd: path.resolve(process.cwd()),
    env: {
      ...process.env,
      CI: "1",
      ARTDUO_WEB_E2E_PORT: String(address.port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const timeout = setTimeout(() => child.kill("SIGTERM"), 2_000);

  try {
    const [exitCode] = await once(child, "exit");
    assert.equal(exitCode, 1);
    assert.match(stderr, /occupied/i);
  } finally {
    clearTimeout(timeout);
    occupiedServer.close();
    await once(occupiedServer, "close");
  }
});
