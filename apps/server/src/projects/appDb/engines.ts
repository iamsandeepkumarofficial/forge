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

export const APP_DB_ENGINES: readonly AppDbEngine[] = [
  {
    id: "postgres",
    label: "PostgreSQL 16",
    image: "postgres:16",
    containerName: "forge-appdb-postgres-16",
    networkAlias: "postgres-apps",
    containerPort: 5432,
    hostPort: 5434,
    volumeName: "forge-appdb-postgres-16-data",
    envKey: "DATABASE_URL",
    user: "forge",
    password: "forge",
    legacyContainerNames: ["forge-postgres-apps"]
  },
  {
    id: "mongo",
    label: "MongoDB 7",
    image: "mongo:7",
    containerName: "forge-appdb-mongo-7",
    networkAlias: "mongo-apps",
    containerPort: 27017,
    hostPort: 27017,
    volumeName: "forge-appdb-mongo-7-data",
    envKey: "MONGODB_URI",
    user: "forge",
    password: "forge",
    legacyContainerNames: ["forge-mongo-apps"]
  }
] as const;

export function getAppDbEngine(id: string): AppDbEngine | undefined {
  return APP_DB_ENGINES.find((e) => e.id === id);
}

export function appDbEnabled(): boolean {
  return process.env.FORGE_APP_DB_ENABLED !== "0";
}

export function sandboxNetworkName(): string {
  return process.env.FORGE_SANDBOX_NETWORK?.trim() || "forge";
}

export function workspaceDbName(workspaceId: string): string {
  const cleaned = workspaceId.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 48);
  return `forge_ws_${cleaned || "workspace"}`;
}

export function sessionDbName(sessionId: string): string {
  const cleaned = sessionId.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 48);
  return `forge_${cleaned || "session"}`;
}

export function connectionUrlFor(
  engine: AppDbEngine,
  database: string
): string {
  const { user, password, networkAlias, containerPort, envKey } = engine;
  if (envKey === "DATABASE_URL") {
    return `postgresql://${user}:${password}@${networkAlias}:${containerPort}/${database}`;
  }
  return `mongodb://${user}:${password}@${networkAlias}:${containerPort}/${database}?authSource=admin`;
}


export function detectEnginesFromFacts(facts: {
  envKeysReferenced?: string[];
  detectedStack?: string[];
}): AppDbEngineId[] {
  const ids = new Set<AppDbEngineId>();
  const keys = facts.envKeysReferenced ?? [];
  const stack = facts.detectedStack ?? [];
  if (
    keys.includes("DATABASE_URL") ||
    stack.includes("prisma") ||
    stack.some((s) => ["django", "fastapi", "flask"].includes(s))
  ) {
    ids.add("postgres");
  }
  if (keys.includes("MONGODB_URI") || stack.includes("mongoose")) {
    ids.add("mongo");
  }
  return [...ids];
}
