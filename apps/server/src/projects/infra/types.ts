export type InfraArchive = {
  url: string;
  version: string;
  fileName: string;
};

export type InfraInstallFacet = {
  dependencyId: string;
  label: string;

  binRelative?: string;

  probeBinary: string;

  requiredBinaries?: readonly string[];
  hostSessionOnly: boolean;

  versionAwareReuse?: boolean;
  resolveArchive(options: {
    platform: NodeJS.Platform;
    arch: string;
    version?: string;
  }): InfraArchive | null;
};

export type InfraSetupFacet = {
  engineId: string;
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
  detectFromFacts(facts: {
    envKeysReferenced?: string[];
    detectedStack?: string[];
  }): boolean;
};
