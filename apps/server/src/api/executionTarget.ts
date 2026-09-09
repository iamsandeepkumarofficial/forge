import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ExecutionTarget } from "@forge/db";
import {
  executionTargetToKind,
  parseExecutionTarget
} from "../projects/sandboxRuntime/resolve.js";

const execFileAsync = promisify(execFile);
const DOCKER_INFO_TIMEOUT_MS = 15_000;

export function readExecutionTarget(body: unknown): ExecutionTarget {
  if (!body || typeof body !== "object") return "local";
  const raw = (body as { executionTarget?: unknown }).executionTarget;
  return parseExecutionTarget(raw) ?? "local";
}

export async function assertCloudSandboxAvailable(
  target: ExecutionTarget
): Promise<void> {
  if (target !== "cloud") return;
  const kind = executionTargetToKind(target);
  if (kind === "kubernetes") {
    throw new Error(
      "Cloud sessions with FORGE_CLOUD_SANDBOX=kubernetes are not available in this desktop build yet. Unset FORGE_CLOUD_SANDBOX to use local Docker, or use a Normal (local) session."
    );
  }
  try {
    await execFileAsync("docker", ["info"], {
      timeout: DOCKER_INFO_TIMEOUT_MS
    });
  } catch {
    throw new Error(
      "Cloud sessions require Docker. Start Docker Desktop (or a compatible daemon), or choose a Normal (local) session."
    );
  }
}
