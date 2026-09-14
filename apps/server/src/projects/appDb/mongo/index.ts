import type { InfraInstallFacet, InfraSetupFacet } from "../../infra/types.js";

const MONGO_DEFAULT = "7.0.14";

function mongoArchive(options: {
  platform: NodeJS.Platform;
  arch: string;
  version: string;
}): { version: string; fileName: string; url: string } | null {
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

export const mongoSetupFacet: InfraSetupFacet = {
  engineId: "mongo",
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
  legacyContainerNames: ["forge-mongo-apps"],
  detectFromFacts(facts) {
    const keys = facts.envKeysReferenced ?? [];
    const stack = facts.detectedStack ?? [];
    return keys.includes("MONGODB_URI") || stack.includes("mongoose");
  }
};

export const mongoInstallFacet: InfraInstallFacet = {
  dependencyId: "mongo",
  label: "MongoDB",
  binRelative: "bin",
  probeBinary: "mongod",
  requiredBinaries: ["mongod"],
  hostSessionOnly: true,
  versionAwareReuse: false,
  resolveArchive: ({ platform, arch, version }) =>
    mongoArchive({
      platform,
      arch,
      version: version?.trim() || MONGO_DEFAULT
    })
};

export const mongoAdapter = {
  id: "mongo" as const,
  install: mongoInstallFacet,
  setup: mongoSetupFacet
};
