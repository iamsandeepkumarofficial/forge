import { POLL_MS } from "./types.js";

export type WaitForHttpOptions = {
  url: string;
  attempts: number;
  intervalMs?: number;
  expectJson?: (body: unknown) => string | null;
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
  let lastMismatch: string | null = null;
  for (let i = 0; i < options.attempts; i += 1) {
    try {
      const res = await fetch(options.url);
      if (res.ok) {
        if (!options.expectJson) return;
        const body: unknown = await res.json().catch(() => null);
        const mismatch = options.expectJson(body);
        if (!mismatch) return;
        lastMismatch = mismatch;
      }
    } catch {
      void 0;
    }
    if (i + 1 < options.attempts) await sleep(interval);
  }
  if (lastMismatch) {
    throw new Error(`timed out waiting for ${options.url}: ${lastMismatch}`);
  }
  throw new Error(`timed out waiting for ${options.url}`);
}

export function expectHostToolPlane(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return "tool plane /health did not return JSON (is another process on :4000?)";
  }
  const ok = (body as { ok?: unknown }).ok;
  if (ok === true) return null;
  return "tool plane /health is not ok — stop other Forge servers on :4000 and restart desktop";
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
