import { existsSync } from "node:fs";
import { readFile, readdir, mkdir, writeFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stringify as stringifyYaml } from "yaml";
import { parsePipeline } from "./schema.js";
import type { PipelineDefinition } from "./types.js";
const here = path.dirname(fileURLToPath(import.meta.url));
export const SYSTEM_WORKFLOWS_DIR = path.resolve(here, "..", "definitions");
export const DEFAULT_WORKFLOW_ID = "sdlc";
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
export function userWorkflowsRoot(): string {
  return (
    process.env.FORGE_USER_WORKFLOWS_ROOT ||
    path.join(os.homedir(), ".forge", "workflows")
  );
}
export type WorkflowSource = "user" | "system";
export interface ResolvedWorkflow {
  definition: PipelineDefinition;
  source: WorkflowSource;
  path: string;
  id: string;
}
export interface WorkflowCatalogEntry {
  id: string;
  name: string;
  version: number;
  stageCount: number;
  source: WorkflowSource;
  finalColumn: string;
}
export async function resolveWorkflow(opts: {
  id?: string;
  userId?: string;
}): Promise<ResolvedWorkflow> {
  const id = opts.id || DEFAULT_WORKFLOW_ID;
  const candidates: Array<{
    file: string;
    source: WorkflowSource;
  }> = [];
  if (opts.userId) {
    candidates.push({
      file: path.join(userWorkflowsRoot(), opts.userId, `${id}.yaml`),
      source: "user"
    });
  }
  candidates.push({
    file: path.join(SYSTEM_WORKFLOWS_DIR, `${id}.yaml`),
    source: "system"
  });
  for (const candidate of candidates) {
    if (existsSync(candidate.file)) {
      const text = await readFile(candidate.file, "utf8");
      return {
        definition: parsePipeline(text),
        source: candidate.source,
        path: candidate.file,
        id
      };
    }
  }
  throw new Error(
    `workflow "${id}" not found (looked in: ${candidates.map((c) => c.file).join(", ")})`
  );
}
export async function listSystemWorkflowIds(): Promise<string[]> {
  const entries = await readdir(SYSTEM_WORKFLOWS_DIR).catch(
    () => [] as string[]
  );
  return entries
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.replace(/\.yaml$/, ""));
}
async function listUserWorkflowIds(userId: string): Promise<string[]> {
  const dir = path.join(userWorkflowsRoot(), userId);
  const entries = await readdir(dir).catch(() => [] as string[]);
  return entries
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.replace(/\.yaml$/, ""));
}
export async function listWorkflowCatalog(
  userId?: string
): Promise<WorkflowCatalogEntry[]> {
  const byId = new Map<string, WorkflowCatalogEntry>();
  for (const id of await listSystemWorkflowIds()) {
    const resolved = await resolveWorkflow({ id });
    byId.set(id, {
      id,
      name: resolved.definition.name,
      version: resolved.definition.version,
      stageCount: resolved.definition.stages.length,
      source: "system",
      finalColumn: resolved.definition.finalColumn
    });
  }
  if (userId) {
    for (const id of await listUserWorkflowIds(userId)) {
      const resolved = await resolveWorkflow({ id, userId });
      byId.set(id, {
        id,
        name: resolved.definition.name,
        version: resolved.definition.version,
        stageCount: resolved.definition.stages.length,
        source: "user",
        finalColumn: resolved.definition.finalColumn
      });
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}
export function serializePipeline(definition: PipelineDefinition): string {
  return stringifyYaml(definition);
}
export function assertSafeDefinitionId(id: string): void {
  if (!SAFE_ID.test(id)) {
    throw new Error(
      'Invalid id: use letters, numbers, "_", "-", or "." (must start with alphanumeric).'
    );
  }
}
export async function writeUserWorkflow(opts: {
  userId: string;
  id: string;
  yamlText: string;
}): Promise<ResolvedWorkflow> {
  const { userId, id, yamlText } = opts;
  assertSafeDefinitionId(id);
  const definition = parsePipeline(yamlText);
  const dir = path.join(userWorkflowsRoot(), userId);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${id}.yaml`);
  await writeFile(
    file,
    yamlText.endsWith("\n") ? yamlText : `${yamlText}\n`,
    "utf8"
  );
  return { definition, source: "user", path: file, id };
}
export async function writeUserWorkflowDefinition(opts: {
  userId: string;
  id: string;
  definition: PipelineDefinition;
}): Promise<ResolvedWorkflow> {
  return writeUserWorkflow({
    userId: opts.userId,
    id: opts.id,
    yamlText: serializePipeline(opts.definition)
  });
}
export async function deleteUserWorkflow(
  userId: string,
  id: string
): Promise<void> {
  assertSafeDefinitionId(id);
  const file = path.join(userWorkflowsRoot(), userId, `${id}.yaml`);
  if (!existsSync(file)) {
    throw new Error(`user workflow "${id}" not found`);
  }
  await unlink(file);
}
export async function readWorkflowYaml(opts: {
  id: string;
  userId?: string;
}): Promise<{
  yaml: string;
  source: WorkflowSource;
  path: string;
}> {
  const resolved = await resolveWorkflow(opts);
  const yaml = await readFile(resolved.path, "utf8");
  return { yaml, source: resolved.source, path: resolved.path };
}
