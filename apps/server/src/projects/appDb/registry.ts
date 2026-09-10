import type { InfraInstallFacet, InfraSetupFacet } from "../infra/types.js";
import { mongoAdapter } from "./mongo/index.js";
import { postgresAdapter } from "./postgres/index.js";

export type DbAdapter = {
  id: string;
  install: InfraInstallFacet;
  setup: InfraSetupFacet;
};

export const DB_ADAPTERS: readonly DbAdapter[] = [
  postgresAdapter,
  mongoAdapter
] as const;

export function listDbSetupEngineIds(): string[] {
  return DB_ADAPTERS.map((a) => a.setup.engineId);
}

export function getDbAdapter(id: string): DbAdapter | undefined {
  const key = id.trim().toLowerCase();
  return DB_ADAPTERS.find((a) => a.id === key);
}

export function getSetupFacet(id: string): InfraSetupFacet | null {
  return getDbAdapter(id)?.setup ?? null;
}
