import { arch as osArch } from "node:os";

export type ProjectInfraDependencyId = string;

export type ProjectInfraArchive = {
  url: string;
  version: string;
  fileName: string;
};

export type ProjectInfraDependency = {
  id: ProjectInfraDependencyId;
  label: string;
  binaries: readonly string[];
  hostSessionOnly: boolean;
  resolveArchive: (options: {
    platform: NodeJS.Platform;
    arch: string;
    version?: string;
  }) => ProjectInfraArchive | null;
};

const MONGO_DEFAULT = "7.0.14";
const POSTGRES_DEFAULT = "16.6.0";

function mongoArchive(options: {
  platform: NodeJS.Platform;
  arch: string;
  version: string;
}): ProjectInfraArchive | null {
  const a =
    options.arch === "arm64" || options.arch === "aarch64" ? "arm64" : "x86_64";
  if (options.platform === "darwin") {
    const slug = a === "arm64" ? "arm64" : "x86_64";
    const fileName = `mongodb-macos-${slug}-${options.version}.tgz`;
    return {
      version: options.version,
      fileName,
      url: `https://fastdl.mongodb.org/osx/${fileName}`
    };
  }
  if (options.platform === "linux") {
    const slug = a === "arm64" ? "aarch64" : "x86_64";
    const fileName = `mongodb-linux-${slug}-ubuntu2204-${options.version}.tgz`;
    return {
      version: options.version,
      fileName,
      url: `https://fastdl.mongodb.org/linux/${fileName}`
    };
  }
  return null;
}

function postgresTriple(
  platform: NodeJS.Platform,
  arch: string
): string | null {
  const a = arch === "arm64" || arch === "aarch64" ? "aarch64" : "x86_64";
  if (platform === "darwin") return `${a}-apple-darwin`;
  if (platform === "linux") return `${a}-unknown-linux-gnu`;
  return null;
}

function postgresArchive(options: {
  platform: NodeJS.Platform;
  arch: string;
  version: string;
}): ProjectInfraArchive | null {
  const triple = postgresTriple(options.platform, options.arch);
  if (!triple) return null;
  const fileName = `postgresql-${options.version}-${triple}.tar.gz`;
  return {
    version: options.version,
    fileName,
    url: `https://github.com/theseus-rs/postgresql-binaries/releases/download/${options.version}/${fileName}`
  };
}

export const PROJECT_INFRA_DEPENDENCIES: readonly ProjectInfraDependency[] = [
  {
    id: "mongo",
    label: "MongoDB",
    binaries: ["mongod"],
    hostSessionOnly: true,
    resolveArchive: ({ platform, arch, version }) =>
      mongoArchive({
        platform,
        arch,
        version: version?.trim() || MONGO_DEFAULT
      })
  },
  {
    id: "postgres",
    label: "PostgreSQL",
    binaries: ["postgres", "initdb", "psql", "pg_isready"],
    hostSessionOnly: true,
    resolveArchive: ({ platform, arch, version }) =>
      postgresArchive({
        platform,
        arch,
        version: version?.trim() || POSTGRES_DEFAULT
      })
  }
];

export function listProjectInfraDependencyIds(): string[] {
  return PROJECT_INFRA_DEPENDENCIES.map((d) => d.id);
}

export function getProjectInfraDependency(
  id: string
): ProjectInfraDependency | null {
  const key = id.trim().toLowerCase();
  return PROJECT_INFRA_DEPENDENCIES.find((d) => d.id === key) ?? null;
}

export function currentHostArch(): string {
  return osArch();
}
