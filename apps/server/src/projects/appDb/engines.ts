import { DB_ADAPTERS, getSetupFacet } from "./registry.js";
import type { InfraSetupFacet } from "../infra/types.js";

const N_48 = 48;

export type AppDbEngineId = "postgres" | "mongo";

export type AppDbEngine = {
  id: AppDbEngineId;
  label: string;
  image: string;
  containerName: string;
  networkAlias: string;
  containerPort: number;
  hostPort: number;
  volumeName: string;
  envKey: "DATABASE_URL" | "MONGODB_URI";
  user: string;
  password: string;
  legacyContainerNames: string[];
};

function setupToEngine(setup: InfraSetupFacet): AppDbEngine {
  return {
    id: setup.engineId as AppDbEngineId,
    label: setup.label,
    image: setup.image,
    containerName: setup.containerName,
    networkAlias: setup.networkAlias,
    containerPort: setup.containerPort,
    hostPort: setup.hostPort,
    volumeName: setup.volumeName,
    envKey: setup.envKey,
    user: setup.user,
    password: setup.password,
    legacyContainerNames: [...setup.legacyContainerNames]
  };
}

export const APP_DB_ENGINES: readonly AppDbEngine[] = DB_ADAPTERS.map((a) =>
  setupToEngine(a.setup)
);

export function getAppDbEngine(id: string): AppDbEngine | undefined {
  const setup = getSetupFacet(id);
  return setup ? setupToEngine(setup) : undefined;
}

export function appDbEnabled(): boolean {
  return process.env.FORGE_APP_DB_ENABLED !== "0";
}

export function sandboxNetworkName(): string {
  return process.env.FORGE_SANDBOX_NETWORK?.trim() || "forge";
}

export function workspaceDbName(workspaceId: string): string {
  const cleaned = workspaceId.replace(/[^a-zA-Z0-9]/g, "_").slice(0, N_48);
  return `forge_ws_${cleaned || "workspace"}`;
}

export function sessionDbName(sessionId: string): string {
  const cleaned = sessionId.replace(/[^a-zA-Z0-9]/g, "_").slice(0, N_48);
  return `forge_${cleaned || "session"}`;
}

export function connectionUrlFor(options: {
  engine: AppDbEngine;
  database: string;
  hostMode: boolean;
}): string {
  const { engine, database, hostMode } = options;
  const { user, password, networkAlias, containerPort, hostPort, envKey } =
    engine;
  const host = hostMode ? "127.0.0.1" : networkAlias;
  const port = hostMode ? hostPort : containerPort;
  if (envKey === "DATABASE_URL") {
    return `postgresql://${user}:${password}@${host}:${port}/${database}`;
  }
  if (hostMode) {
    return `mongodb://${host}:${port}/${database}`;
  }
  return `mongodb://${user}:${password}@${host}:${port}/${database}?authSource=admin`;
}

export function appDbInjectionHint(hostMode = false): string {
  if (hostMode) {
    return (
      "Forge injects `DATABASE_URL` / `MONGODB_URI` at localhost (`127.0.0.1:5434` / `127.0.0.1:27017`). " +
      "Local sessions never start Docker for app DBs — if setup fails, call `install_project_infra` after ask_user " +
      "(or place binaries in ~/.forge/runtime/<dep>/current/bin/), then retry `setup_project_infra`."
    );
  }
  return "Forge reuses one shared container per image on docker network `forge` (`postgres-apps` / `mongo-apps`) and injects `DATABASE_URL` / `MONGODB_URI`. Do not install database servers.";
}

export function detectEnginesFromFacts(facts: {
  envKeysReferenced?: string[];
  detectedStack?: string[];
}): AppDbEngineId[] {
  const ids: AppDbEngineId[] = [];
  for (const adapter of DB_ADAPTERS) {
    if (adapter.setup.detectFromFacts(facts)) {
      ids.push(adapter.setup.engineId as AppDbEngineId);
    }
  }
  return ids;
}
