import { existsSync } from "node:fs";
import { readFile, readdir, mkdir, writeFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stringify as stringifyYaml } from "yaml";
import { parseAgent } from "./schema.js";
import type { AgentDefinition } from "./types.js";
const here = path.dirname(fileURLToPath(import.meta.url));
export const SYSTEM_AGENTS_DIR = path.resolve(here, "..", "definitions");
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
export function userAgentsRoot(): string {
  return (
    process.env.FORGE_USER_AGENTS_ROOT ||
    path.join(os.homedir(), ".forge", "agents")
  );
}
export type AgentSource = "user" | "system";
export interface ResolvedAgent {
  definition: AgentDefinition;
  source: AgentSource;
  path: string;
}
export interface AgentCatalogEntry {
  id: string;
  name: string;
  description: string;
  category?: string;
  source: AgentSource;
  tools: string[];
}
export async function resolveAgent(opts: {
  id: string;
  userId?: string;
}): Promise<ResolvedAgent> {
  const candidates: Array<{
    file: string;
    source: AgentSource;
  }> = [];
  if (opts.userId) {
    candidates.push({
      file: path.join(userAgentsRoot(), opts.userId, `${opts.id}.yaml`),
      source: "user"
    });
  }
  candidates.push({
    file: path.join(SYSTEM_AGENTS_DIR, `${opts.id}.yaml`),
    source: "system"
  });
  for (const candidate of candidates) {
    if (existsSync(candidate.file)) {
      const text = await readFile(candidate.file, "utf8");
      return {
        definition: parseAgent(text),
        source: candidate.source,
        path: candidate.file
      };
    }
  }
  throw new Error(
    `agent "${opts.id}" not found (looked in: ${candidates.map((c) => c.file).join(", ")})`
  );
}
export async function listSystemAgentIds(): Promise<string[]> {
  const entries = await readdir(SYSTEM_AGENTS_DIR).catch(() => [] as string[]);
  return entries
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.replace(/\.yaml$/, ""))
    .sort();
}
async function listUserAgentIds(userId: string): Promise<string[]> {
  const dir = path.join(userAgentsRoot(), userId);
  const entries = await readdir(dir).catch(() => [] as string[]);
  return entries
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.replace(/\.yaml$/, ""))
    .sort();
}
export async function loadAllSystemAgents(): Promise<AgentDefinition[]> {
  const ids = await listSystemAgentIds();
  return Promise.all(
    ids.map(async (id) => (await resolveAgent({ id })).definition)
  );
}
export async function listAgentCatalog(
  userId?: string
): Promise<AgentCatalogEntry[]> {
  const byId = new Map<string, AgentCatalogEntry>();
  for (const id of await listSystemAgentIds()) {
    const { definition } = await resolveAgent({ id });
    byId.set(id, {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      category: definition.category,
      source: "system",
      tools: definition.tools
    });
  }
  if (userId) {
    for (const id of await listUserAgentIds(userId)) {
      const { definition } = await resolveAgent({ id, userId });
      byId.set(id, {
        id: definition.id,
        name: definition.name,
        description: definition.description,
        category: definition.category,
        source: "user",
        tools: definition.tools
      });
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}
export function serializeAgent(definition: AgentDefinition): string {
  return stringifyYaml(definition);
}
export function assertSafeAgentId(id: string): void {
  if (!SAFE_ID.test(id)) {
    throw new Error(
      'Invalid id: use letters, numbers, "_", "-", or "." (must start with alphanumeric).'
    );
  }
}
export async function writeUserAgent(opts: {
  userId: string;
  id: string;
  yamlText: string;
}): Promise<ResolvedAgent> {
  const { userId, id, yamlText } = opts;
  assertSafeAgentId(id);
  const definition = parseAgent(yamlText);
  if (definition.id !== id) {
    throw new Error(
      `Agent id in YAML ("${definition.id}") must match path id ("${id}")`
    );
  }
  const dir = path.join(userAgentsRoot(), userId);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${id}.yaml`);
  await writeFile(
    file,
    yamlText.endsWith("\n") ? yamlText : `${yamlText}\n`,
    "utf8"
  );
  return { definition, source: "user", path: file };
}
export async function writeUserAgentDefinition(opts: {
  userId: string;
  definition: AgentDefinition;
}): Promise<ResolvedAgent> {
  return writeUserAgent({
    userId: opts.userId,
    id: opts.definition.id,
    yamlText: serializeAgent(opts.definition)
  });
}
export async function deleteUserAgent(
  userId: string,
  id: string
): Promise<void> {
  assertSafeAgentId(id);
  const file = path.join(userAgentsRoot(), userId, `${id}.yaml`);
  if (!existsSync(file)) {
    throw new Error(`user agent "${id}" not found`);
  }
  await unlink(file);
}
export async function readAgentYaml(opts: {
  id: string;
  userId?: string;
}): Promise<{
  yaml: string;
  source: AgentSource;
  path: string;
}> {
  const resolved = await resolveAgent(opts);
  const yaml = await readFile(resolved.path, "utf8");
  return { yaml, source: resolved.source, path: resolved.path };
}
