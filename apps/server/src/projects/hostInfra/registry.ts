import { arch as osArch } from "node:os";
import { DB_ADAPTERS } from "../appDb/registry.js";
import type { InfraInstallFacet } from "../infra/types.js";
import { STACK_ADAPTERS } from "../stacks/registry.js";

export type ProjectInfraDependencyId = string;

export type ProjectInfraArchive = {
  url: string;
  version: string;
  fileName: string;
};

export type ProjectInfraDependency = InfraInstallFacet & {
  id: string;
  binaries: readonly string[];
};

function facetToDep(facet: InfraInstallFacet): ProjectInfraDependency {
  const binaries = facet.requiredBinaries?.length
    ? facet.requiredBinaries
    : [facet.probeBinary];
  return {
    ...facet,
    id: facet.dependencyId,
    binaries
  };
}

function collectInstallFacets(): InfraInstallFacet[] {
  const out: InfraInstallFacet[] = [];
  for (const adapter of STACK_ADAPTERS) {
    if (adapter.install) out.push(adapter.install);
  }
  for (const adapter of DB_ADAPTERS) {
    out.push(adapter.install);
  }
  return out;
}

export function listProjectInfraDependencyIds(): string[] {
  return collectInstallFacets().map((f) => f.dependencyId);
}

export function getProjectInfraDependency(
  id: string
): ProjectInfraDependency | null {
  const key = id.trim().toLowerCase();

  const aliased = key.match(/^(node|python|go)-(\d+(?:\.\d+)*)$/);
  if (aliased) {
    return null;
  }
  const facet = collectInstallFacets().find((f) => f.dependencyId === key);
  return facet ? facetToDep(facet) : null;
}

export function dependencyIdAliasHint(rawId: string): string | null {
  const key = rawId.trim().toLowerCase();
  const m = key.match(/^(node|python|go)-(\d+(?:\.\d+)*)$/);
  if (!m) return null;
  return `Use dependencyId=\`${m[1]}\` with version=\`${m[2]}\` (not \`${key}\`).`;
}

export function hasSetupFacet(dependencyId: string): boolean {
  return DB_ADAPTERS.some((a) => a.install.dependencyId === dependencyId);
}

export function currentHostArch(): string {
  return osArch();
}
