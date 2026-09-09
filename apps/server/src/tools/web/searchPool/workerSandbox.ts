const N_12000 = 12000;
const N_1500000 = 1500000;

export type WorkerState = "warming" | "ready" | "busy" | "draining" | "stopped";
export type WebSearchWorker = {
  id: string;
  containerName: string;
  state: WorkerState;
  startedAt: number;
};

export function workerContainerName(index: number): string {
  return `forge-websearch-${index}`;
}

function hostWorkerName(index: number): string {
  return `host-websearch-${index}`;
}

export async function ensureWorker(index: number): Promise<WebSearchWorker> {
  return {
    id: `websearch-${index}`,
    containerName: hostWorkerName(index),
    state: "ready",
    startedAt: Date.now()
  };
}

export async function stopWorker(_index: number): Promise<void> {
  return;
}

async function fetchHtmlOnHost(options: {
  url: string;
  timeoutMs: number;
}): Promise<string> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), options.timeoutMs);
  try {
    const r = await fetch(options.url, {
      signal: ac.signal,
      headers: {
        "User-Agent": "ForgeAgentWebSearch/1.0",
        Accept: "text/html"
      },
      redirect: "follow"
    });
    if (!r.ok) {
      throw new Error(`HTTP ${r.status}`);
    }
    const text = await r.text();
    return text.slice(0, N_1500000);
  } finally {
    clearTimeout(t);
  }
}

export async function fetchHtmlInWorker(options: {
  containerName: string;
  url: string;
  timeoutMs?: number;
}): Promise<string> {
  return fetchHtmlOnHost({
    url: options.url,
    timeoutMs: options.timeoutMs ?? N_12000
  });
}
