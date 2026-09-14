import type { InfraInstallFacet, InfraSetupFacet } from "../../infra/types.js";

const POSTGRES_DEFAULT = "16.6.0";

function postgresTriple(
  platform: NodeJS.Platform,
  arch: string
): string | null {
  const a = arch === "arm64" || arch === "aarch64" ? "aarch64" : "x86_64";
  if (platform === "darwin") return `${a}-apple-darwin`;
  if (platform === "linux") return `${a}-unknown-linux-gnu`;
  return null;
}

export const postgresSetupFacet: InfraSetupFacet = {
  engineId: "postgres",
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
  legacyContainerNames: ["forge-postgres-apps"],
  detectFromFacts(facts) {
    const keys = facts.envKeysReferenced ?? [];
    const stack = facts.detectedStack ?? [];
    return (
      keys.includes("DATABASE_URL") ||
      stack.includes("prisma") ||
      stack.some((s) => ["django", "fastapi", "flask"].includes(s))
    );
  }
};

export const postgresInstallFacet: InfraInstallFacet = {
  dependencyId: "postgres",
  label: "PostgreSQL",
  binRelative: "bin",
  probeBinary: "postgres",
  requiredBinaries: ["postgres", "initdb", "psql", "pg_isready"],
  hostSessionOnly: true,
  versionAwareReuse: false,
  resolveArchive: ({ platform, arch, version }) => {
    const ver = version?.trim() || POSTGRES_DEFAULT;
    const triple = postgresTriple(platform, arch);
    if (!triple) return null;
    const fileName = `postgresql-${ver}-${triple}.tar.gz`;
    return {
      version: ver,
      fileName,
      url: `https://github.com/theseus-rs/postgresql-binaries/releases/download/${ver}/${fileName}`
    };
  }
};

export const postgresAdapter = {
  id: "postgres" as const,
  install: postgresInstallFacet,
  setup: postgresSetupFacet
};
