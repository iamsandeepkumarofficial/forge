import net from "node:net";
import { repairHostPortBindings } from "../sessionSandbox/container.js";
import { sessionHostPortBase } from "../sessionSandbox/constants.js";
import type { EnsurePublishedPortReadyInput } from "./types.js";

const N_500 = 500;
const HOST_TCP_QUICK_TRIES = 8;
const HOST_TCP_AFTER_REPAIR_TRIES = 20;

async function isHostTcpListening(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(N_500);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

export async function ensureHostTcpPublishedReady(options: {
  publishedPort: number;
  tries?: number;
  intervalMs?: number;
}): Promise<boolean> {
  const tries = options.tries ?? HOST_TCP_QUICK_TRIES;
  const intervalMs = options.intervalMs ?? N_500;
  for (let i = 0; i < tries; i += 1) {
    if (await isHostTcpListening(options.publishedPort)) return true;
    if (i + 1 < tries && intervalMs > 0) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return false;
}

export async function ensureDockerPublishedPortReady(
  input: EnsurePublishedPortReadyInput
): Promise<boolean> {
  const { handle, publishedPort, onRepairRestart } = input;
  if (
    await ensureHostTcpPublishedReady({
      publishedPort,
      tries: HOST_TCP_QUICK_TRIES
    })
  ) {
    return true;
  }
  console.warn(
    `[dockerAdapter] session ${handle.sessionId}: host port ${publishedPort} not reachable; repairing Docker port bindings`
  );
  await repairHostPortBindings({
    containerName: handle.ref,
    portBase: sessionHostPortBase(handle.sessionId)
  });
  if (onRepairRestart) {
    const restarted = await onRepairRestart();
    if (!restarted) return false;
  }
  return ensureHostTcpPublishedReady({
    publishedPort,
    tries: HOST_TCP_AFTER_REPAIR_TRIES
  });
}
