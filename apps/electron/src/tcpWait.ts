import { createConnection } from "node:net";
import { POLL_MS } from "./types.js";
import { sleep } from "./httpWait.js";

const DEFAULT_TCP_TIMEOUT_MS = 500;

export async function isTcpOpen(options: {
  host: string;
  port: number;
  timeoutMs?: number;
}): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TCP_TIMEOUT_MS;
  return new Promise((resolve) => {
    const socket = createConnection({
      host: options.host,
      port: options.port
    });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

export async function waitForTcp(options: {
  host: string;
  port: number;
  attempts: number;
  label: string;
}): Promise<void> {
  for (let i = 0; i < options.attempts; i += 1) {
    if (await isTcpOpen({ host: options.host, port: options.port })) {
      return;
    }
    if (i + 1 < options.attempts) await sleep(POLL_MS);
  }
  throw new Error(
    `timed out waiting for ${options.label} on ${options.host}:${options.port}`
  );
}
