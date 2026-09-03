import { POLL_MS } from "./types.js";

export type WaitForHttpOptions = {
  url: string;
  attempts: number;
  intervalMs?: number;
};

export async function isHttpOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

export async function waitForHttp(options: WaitForHttpOptions): Promise<void> {
  const interval = options.intervalMs ?? POLL_MS;
  for (let i = 0; i < options.attempts; i += 1) {
    if (await isHttpOk(options.url)) return;
    if (i + 1 < options.attempts) await sleep(interval);
  }
  throw new Error(`timed out waiting for ${options.url}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
