import {
  webSearchMaxWorkers,
  webSearchMinWarm,
  webSearchTargetLatencyMs,
  webToolsEnabled
} from "../enabled.js";
import {
  ensureWorker,
  stopWorker,
  type WebSearchWorker
} from "./workerSandbox.js";

const RATIO_0_5 = 0.5;
const N_30 = 30;
const N_60 = 60;
const N_60000 = 60000;

type LatSample = {
  at: number;
  ms: number;
};
type PoolState = {
  workers: WebSearchWorker[];
  desired: number;
  samples: LatSample[];
  requestTimestamps: number[];
  warming: Promise<void> | null;
  queue: Array<{
    run: () => Promise<unknown>;
    resolve: (v: unknown) => void;
    reject: (e: unknown) => void;
    enqueuedAt: number;
  }>;
  active: number;
};
const state: PoolState = {
  workers: [],
  desired: 0,
  samples: [],
  requestTimestamps: [],
  warming: null,
  queue: [],
  active: 0
};
const QUEUE_WAIT_MS = 20000;
function trimMetrics(now: number): void {
  const cutoff = now - N_60000;
  state.requestTimestamps = state.requestTimestamps.filter((t) => t >= cutoff);
  state.samples = state.samples.filter((s) => s.at >= cutoff);
}
export function poolRpm(): number {
  trimMetrics(Date.now());
  return state.requestTimestamps.length;
}
export function poolMeanLatencyMs(): number {
  trimMetrics(Date.now());
  if (state.samples.length === 0) return 0;
  const sum = state.samples.reduce((a, s) => a + s.ms, 0);
  return sum / state.samples.length;
}
function recomputeDesired(): void {
  if (!webToolsEnabled()) {
    state.desired = 0;
    return;
  }
  const min = webSearchMinWarm();
  const max = webSearchMaxWorkers();
  const target = webSearchTargetLatencyMs();
  const rpm = poolRpm();
  const lat = poolMeanLatencyMs();
  let desired = Math.max(min, state.desired || min);
  if (lat > target && rpm >= 3) {
    desired = Math.min(max, desired + 1);
  }
  if (rpm >= N_30) {
    desired = Math.min(max, Math.max(desired, min + 1));
  }
  if (rpm >= N_60) {
    desired = Math.min(max, Math.max(desired, min + 2));
  }
  if (rpm < 2 && lat < target * RATIO_0_5 && desired > min) {
    desired = Math.max(min, desired - 1);
  }
  state.desired = Math.max(min, Math.min(max, desired));
}
async function reconcileWorkers(): Promise<void> {
  recomputeDesired();
  const want = state.desired;
  while (state.workers.length < want) {
    const idx = state.workers.length;
    const w = await ensureWorker(idx);
    state.workers.push(w);
  }
  while (state.workers.length > want) {
    const idx = state.workers.length - 1;
    await stopWorker(idx);
    state.workers.pop();
  }
}
export async function ensureWarmPool(): Promise<void> {
  if (!webToolsEnabled()) {
    state.desired = 0;
    while (state.workers.length > 0) {
      const idx = state.workers.length - 1;
      await stopWorker(idx);
      state.workers.pop();
    }
    return;
  }
  if (!state.warming) {
    state.warming = (async () => {
      state.desired = Math.max(webSearchMinWarm(), state.desired);
      await reconcileWorkers();
    })().finally(() => {
      state.warming = null;
    });
  }
  await state.warming;
}
export function recordSearchMetrics(latencyMs: number): void {
  const now = Date.now();
  state.requestTimestamps.push(now);
  state.samples.push({ at: now, ms: latencyMs });
  trimMetrics(now);
  void reconcileWorkers().catch((err) => {
    console.warn("[web-search-pool] reconcile failed", err);
  });
}
export function pickWorker(): WebSearchWorker | null {
  return (
    state.workers.find((w) => w.state === "ready") ?? state.workers[0] ?? null
  );
}
export function listWorkers(): WebSearchWorker[] {
  return [...state.workers];
}
export async function withPoolSlot<T>(
  fn: (worker: WebSearchWorker) => Promise<T>
): Promise<T> {
  await ensureWarmPool();
  if (!webToolsEnabled()) {
    throw Object.assign(new Error("web tools disabled"), {
      code: "disabled" as const
    });
  }
  const worker = pickWorker();
  if (!worker) {
    throw Object.assign(new Error("no web search workers available"), {
      code: "overloaded" as const
    });
  }
  const capacity = Math.max(1, state.workers.length);
  const run = async (): Promise<T> => {
    state.active += 1;
    worker.state = "busy";
    try {
      return await fn(worker);
    } finally {
      worker.state = "ready";
      state.active -= 1;
      pumpQueue();
    }
  };
  if (state.active < capacity) {
    return run();
  }
  return new Promise<T>((resolve, reject) => {
    state.queue.push({
      run: () => run(),
      resolve: (v) => resolve(v as T),
      reject,
      enqueuedAt: Date.now()
    });
    setTimeout(() => {
      const idx = state.queue.findIndex((q) => q.reject === reject);
      if (idx >= 0) {
        state.queue.splice(idx, 1);
        reject(
          Object.assign(
            new Error("web search pool overloaded (queue timeout)"),
            {
              code: "overloaded" as const
            }
          )
        );
      }
    }, QUEUE_WAIT_MS);
  });
}
function pumpQueue(): void {
  const capacity = Math.max(1, state.workers.length);
  while (state.queue.length > 0 && state.active < capacity) {
    const job = state.queue.shift();
    if (!job) break;
    void job.run().then(job.resolve, job.reject);
  }
}
