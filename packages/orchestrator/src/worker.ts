import path from "node:path";
import { fileURLToPath } from "node:url";
import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities/index.js";
import { env } from "./env.js";

export function formatTemporalConnectError(
  address: string,
  err: unknown
): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (/ConnectionRefused|tcp connect error|Connection refused/i.test(message)) {
    return new Error(
      `Cannot reach Temporal at ${address}. Start it first:\n` +
        `  pnpm temporal:dev   (Temporal dev server on :7233, Web UI on :8233)\n` +
        `or set TEMPORAL_ADDRESS to your Temporal endpoint.`
    );
  }
  if (err instanceof Error) return err;
  return new Error(message);
}

export async function runWorker(): Promise<void> {
  let connection: NativeConnection;
  try {
    connection = await NativeConnection.connect({
      address: env.temporalAddress
    });
  } catch (err) {
    throw formatTemporalConnectError(env.temporalAddress, err);
  }
  const worker = await Worker.create({
    connection,
    namespace: env.temporalNamespace,
    taskQueue: env.taskQueue,
    workflowsPath: fileURLToPath(
      new URL("./workflows/index.ts", import.meta.url)
    ),
    activities
  });
  console.log(
    `[orchestrator] worker up — namespace="${env.temporalNamespace}" taskQueue="${env.taskQueue}" ` +
      `temporal=${env.temporalAddress} toolRunner=${env.toolRunnerUrl}`
  );
  await worker.run();
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entry && entry === fileURLToPath(import.meta.url)) {
  runWorker().catch((err) => {
    console.error("[orchestrator] worker failed:", err);
    process.exit(1);
  });
}
