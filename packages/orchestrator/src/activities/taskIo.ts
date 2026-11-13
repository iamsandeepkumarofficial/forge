import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  MAX_INLINE_TASK_OUTPUT_BYTES,
  isArtifactOutput,
  isValueOutput,
  resolveTaskInput,
  type InputMapping,
  type TaskOutput
} from "@forge/core";

function expandHome(raw: string): string {
  if (raw.startsWith("~/")) {
    return path.resolve(os.homedir(), raw.slice(2));
  }
  if (raw === "~") {
    return os.homedir();
  }
  return raw;
}

function sessionsRoot(): string {
  const raw = process.env.FORGE_SESSIONS_ROOT?.trim();
  if (!raw) {
    return path.join(os.homedir(), ".forge", "sessions");
  }
  const expanded = expandHome(raw);
  return path.isAbsolute(expanded)
    ? expanded
    : path.resolve(process.cwd(), expanded);
}

const SAFE_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function safePathSegment(label: string, value: string): string {
  const trimmed = value.trim();
  if (!SAFE_PATH_SEGMENT.test(trimmed)) {
    throw new Error(`Unsafe ${label} for an artifact path`);
  }
  return trimmed;
}

export function artifactFilePath(opts: {
  sessionId: string;
  planId: string;
  taskId: string;
  artifactId: string;
}): string {
  const root = path.resolve(path.join(sessionsRoot(), "_artifacts"));
  const filePath = path.resolve(
    path.join(
      root,
      safePathSegment("sessionId", opts.sessionId),
      safePathSegment("planId", opts.planId),
      safePathSegment("taskId", opts.taskId),
      `${safePathSegment("artifactId", opts.artifactId)}.json`
    )
  );
  if (!filePath.startsWith(root + path.sep)) {
    throw new Error("Artifact path escaped the artifact root");
  }
  return filePath;
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

export async function spillTaskOutput(input: {
  sessionId: string;
  planId: string;
  taskId: string;
  value: unknown;
}): Promise<TaskOutput> {
  const serialized = JSON.stringify(input.value ?? null);
  const bytes = Buffer.byteLength(serialized, "utf8");
  if (bytes <= MAX_INLINE_TASK_OUTPUT_BYTES) {
    return { kind: "value", value: input.value };
  }
  const artifactId = randomUUID();
  const filePath = artifactFilePath({
    sessionId: input.sessionId,
    planId: input.planId,
    taskId: input.taskId,
    artifactId
  });
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, serialized, "utf8");
  return {
    kind: "artifact",
    artifactId,
    metadata: {
      bytes,
      contentType: "application/json"
    }
  };
}

export async function loadTaskArtifact(input: {
  sessionId: string;
  planId: string;
  taskId: string;
  artifactId: string;
}): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  try {
    const filePath = artifactFilePath(input);
    const value = await readJsonFile(filePath);
    return { ok: true, value };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

async function materializeDependencyOutput(opts: {
  sessionId: string;
  planId: string;
  taskId: string;
  output: TaskOutput | unknown;
}): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  if (isValueOutput(opts.output)) {
    return { ok: true, value: opts.output.value };
  }
  if (isArtifactOutput(opts.output)) {
    return loadTaskArtifact({
      sessionId: opts.sessionId,
      planId: opts.planId,
      taskId: opts.taskId,
      artifactId: opts.output.artifactId
    });
  }
  return { ok: true, value: opts.output ?? null };
}

export async function prepareTaskInput(input: {
  sessionId: string;
  planId: string;
  taskId: string;
  inputMappings?: InputMapping[];
  dependencies: Array<{ id: string; output: TaskOutput | null }>;
  staticInput?: unknown;
}): Promise<{ ok: true; input: unknown } | { ok: false; error: string }> {
  const dependencyValues: Record<string, unknown> = {};
  for (const dep of input.dependencies) {
    if (dep.output === null || dep.output === undefined) {
      return {
        ok: false,
        error: `Missing output for dependency "${dep.id}"`
      };
    }
    const loaded = await materializeDependencyOutput({
      sessionId: input.sessionId,
      planId: input.planId,
      taskId: dep.id,
      output: dep.output
    });
    if (!loaded.ok) {
      return {
        ok: false,
        error: `Failed to load artifact for "${dep.id}": ${loaded.error}`
      };
    }
    dependencyValues[dep.id] = loaded.value;
  }
  const resolved = resolveTaskInput({
    dependencyValues,
    dependencyIds: input.dependencies.map((d) => d.id),
    mappings: input.inputMappings,
    staticInput: input.staticInput
  });
  if (!resolved.ok) {
    return {
      ok: false,
      error: resolved.errors.map((e) => e.message).join("; ")
    };
  }
  return { ok: true, input: resolved.input };
}
