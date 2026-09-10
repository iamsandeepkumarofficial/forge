import { versionSatisfiesRange } from "../../versionSatisfy.js";
import type { InfraArchive, InfraInstallFacet } from "../../infra/types.js";

const NODE_MAJOR_18 = 18;
const NODE_MAJOR_20 = 20;
const NODE_MAJOR_22 = 22;

export const NODE_VERSION_PINS: Readonly<Record<number, string>> = {
  [NODE_MAJOR_18]: "18.20.8",
  [NODE_MAJOR_20]: "20.20.2",
  [NODE_MAJOR_22]: "22.20.0"
};

export const NODE_DEFAULT_MAJOR = NODE_MAJOR_20;

function nodeOs(platform: NodeJS.Platform): string | null {
  if (platform === "darwin") return "darwin";
  if (platform === "linux") return "linux";
  return null;
}

function nodeArch(arch: string): string {
  return arch === "arm64" || arch === "aarch64" ? "arm64" : "x64";
}

export function coerceNodeInstallVersion(raw?: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed === "*" || /^lts\b/i.test(trimmed)) {
    return NODE_VERSION_PINS[NODE_DEFAULT_MAJOR]!;
  }

  const exact = trimmed.replace(/^v/i, "");
  if (/^\d+\.\d+\.\d+$/.test(exact)) {
    return exact;
  }

  const majorOnly = exact.match(/^(\d+)(?:\.x)?$/i);
  if (majorOnly) {
    const major = Number(majorOnly[1]);
    const pin = NODE_VERSION_PINS[major];
    if (pin) return pin;
    throw new Error(
      `No pinned Node ${major}. Known majors: ${Object.keys(NODE_VERSION_PINS).join(", ")}. Pass an exact version (e.g. 20.20.2).`
    );
  }

  const preferred = [NODE_DEFAULT_MAJOR, NODE_MAJOR_18, NODE_MAJOR_22] as const;
  for (const major of preferred) {
    const pin = NODE_VERSION_PINS[major]!;
    if (versionSatisfiesRange(pin, trimmed)) return pin;
  }
  throw new Error(
    `No pinned Node satisfies range \`${trimmed}\`. Try version=20 (→ ${NODE_VERSION_PINS[20]}).`
  );
}

export function resolveNodeArchive(options: {
  platform: NodeJS.Platform;
  arch: string;
  version?: string;
}): InfraArchive | null {
  const os = nodeOs(options.platform);
  if (!os) return null;
  const arch = nodeArch(options.arch);
  let version: string;
  try {
    version = coerceNodeInstallVersion(options.version);
  } catch {
    return null;
  }
  const fileName = `node-v${version}-${os}-${arch}.tar.gz`;
  return {
    version,
    fileName,
    url: `https://nodejs.org/dist/v${version}/${fileName}`
  };
}

export const nodeInstallFacet: InfraInstallFacet = {
  dependencyId: "node",
  label: "Node.js",
  binRelative: "bin",
  probeBinary: "node",
  requiredBinaries: ["node", "npm", "npx"],
  hostSessionOnly: true,
  versionAwareReuse: true,
  resolveArchive: resolveNodeArchive
};
