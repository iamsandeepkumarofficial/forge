import { assertSafeRepoDirectoryName } from "@forge/core";
import type { WorkspaceRoute } from "@forge/db";

export function findDependsOnCycle(
  members: Array<{ repoName: string; dependsOn: string[] }>
): string[] | null {
  const edges = new Map<string, string[]>();
  for (const m of members) {
    edges.set(m.repoName, [...(m.dependsOn ?? [])]);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string): string[] | null {
    if (visiting.has(node)) {
      const idx = stack.indexOf(node);
      return idx >= 0 ? [...stack.slice(idx), node] : [node, node];
    }
    if (visited.has(node)) return null;
    visiting.add(node);
    stack.push(node);
    for (const dep of edges.get(node) ?? []) {
      if (!edges.has(dep)) continue;
      const cycle = dfs(dep);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  }

  for (const name of edges.keys()) {
    const cycle = dfs(name);
    if (cycle) return cycle;
  }
  return null;
}

export function topoSortRepoNames(
  members: Array<{ repoName: string; dependsOn: string[] }>
): string[] {
  const cycle = findDependsOnCycle(members);
  if (cycle) {
    throw new Error(`dependsOn cycle: ${cycle.join(" -> ")}`);
  }
  const remaining = new Map(
    members.map((m) => [m.repoName, new Set(m.dependsOn ?? [])])
  );
  const ordered: string[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining.entries()]
      .filter(([, deps]) => {
        for (const d of deps) {
          if (remaining.has(d)) return false;
        }
        return true;
      })
      .map(([name]) => name)
      .sort();
    if (ready.length === 0) {
      throw new Error("dependsOn cycle detected during topo sort");
    }
    for (const name of ready) {
      remaining.delete(name);
      ordered.push(name);
    }
  }
  return ordered;
}

export function normalizeRepoName(raw: string): string {
  const name = raw.trim();
  assertSafeRepoDirectoryName(name);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
    throw new Error(
      `Invalid repoName "${name}": use letters, digits, ., _, - (must start with alphanumeric)`
    );
  }
  return name;
}

export function validateWorkspaceRoutes(
  routes: WorkspaceRoute[],
  memberRepoNames: Set<string>
): WorkspaceRoute[] {
  if (!Array.isArray(routes)) {
    throw new Error("routes must be an array");
  }
  const seen = new Set<string>();
  const normalized: WorkspaceRoute[] = [];
  for (let i = 0; i < routes.length; i++) {
    const r = routes[i];
    if (!r || typeof r !== "object") {
      throw new Error(`routes[${i}] must be an object`);
    }
    const pathPrefix =
      typeof r.pathPrefix === "string" ? r.pathPrefix.trim() : "";
    const target = typeof r.target === "string" ? r.target.trim() : "";
    if (!pathPrefix.startsWith("/")) {
      throw new Error(
        `routes[${i}].pathPrefix must start with / (got "${pathPrefix}")`
      );
    }
    if (!target || !memberRepoNames.has(target)) {
      throw new Error(
        `routes[${i}].target "${target}" is not a member repoName`
      );
    }
    if (seen.has(pathPrefix)) {
      throw new Error(`Duplicate route pathPrefix "${pathPrefix}"`);
    }
    seen.add(pathPrefix);
    normalized.push({
      pathPrefix,
      target,
      ...(r.stripPrefix === true ? { stripPrefix: true } : {})
    });
  }
  const catchAllIdx = normalized.findIndex((r) => r.pathPrefix === "/");
  if (catchAllIdx >= 0 && catchAllIdx !== normalized.length - 1) {
    throw new Error(
      'Catch-all route pathPrefix "/" must be last so specific prefixes (e.g. /api) are not shadowed'
    );
  }
  return normalized;
}

export function resolveEnvTemplates(
  templates: Record<string, string>,
  services: Record<string, { internalUrl: string; publicUrl: string }>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(templates ?? {})) {
    out[key] = String(raw).replace(
      /\{\{\s*([a-zA-Z0-9._-]+)\.(internalUrl|publicUrl)\s*\}\}/g,
      (full) => {
        const matched = full.match(
          /\{\{\s*([a-zA-Z0-9._-]+)\.(internalUrl|publicUrl)\s*\}\}/
        );
        const svc = matched?.[1] ?? "";
        const field = (matched?.[2] ?? "internalUrl") as
          "internalUrl" | "publicUrl";
        const entry = services[svc];
        if (!entry) {
          throw new Error(
            `Unknown service "${svc}" in env template for ${key}`
          );
        }
        return entry[field];
      }
    );
  }
  return out;
}
