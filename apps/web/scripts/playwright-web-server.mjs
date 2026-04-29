import { spawn } from "node:child_process";
import net from "node:net";

const host = "127.0.0.1";
const port = Number(process.env.ARTDUO_WEB_E2E_PORT ?? "3211");
const url = `http://${host}:${port}`;

function isPortOpen() {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function isUrlReady() {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(2_000),
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function waitForUrlReady() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await isUrlReady()) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  return false;
}

if (await isUrlReady()) {
  console.log(`Reusing existing @artduo/web server on ${url}`);
  setInterval(() => {}, 2 ** 31 - 1);
} else if (await isPortOpen()) {
  if (await waitForUrlReady()) {
    console.log(`Reusing existing @artduo/web server on ${url}`);
    setInterval(() => {}, 2 ** 31 - 1);
  } else {
    console.error(`${url} is occupied but did not return a healthy response. Stop the stale process or set ARTDUO_WEB_E2E_PORT.`);
    process.exit(1);
  }
} else {
  const child = spawn("pnpm", ["exec", "next", "dev", "-p", String(port), "-H", host], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  const forwardSignal = (signal) => {
    child.kill(signal);
  };

  process.once("SIGINT", forwardSignal);
  process.once("SIGTERM", forwardSignal);
  child.once("exit", (code, signal) => {
    process.exit(code ?? (signal ? 1 : 0));
  });
}
