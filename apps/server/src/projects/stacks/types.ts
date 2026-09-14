import type { InfraInstallFacet } from "../infra/types.js";

export type StackId = "node" | "python" | "go";

export type RuntimeToolId = StackId;

export type RuntimeRequirement = {
  tool: RuntimeToolId;

  range: string;

  source: string;
};

export type StackEvidence = {
  ecosystem: StackId;
  manifests: string[];
  lockfiles: string[];
  packageManagerGuess?: string;
};

export type StackFactsView = {
  ecosystemEvidence: Array<{
    ecosystem: string;
    manifests?: string[];
    lockfiles?: string[];
    packageManagerGuess?: string;
  }>;
  detectedStack?: string[];
  hasPackageJson?: boolean;
  packageManager?: string;
  scripts?: string[];
  envKeysReferenced?: string[];
};

export type StackAdapter = {
  id: StackId;
  label: string;

  hostBinary: string;

  skillId: string | null;
  collectEvidence(rootPath: string): StackEvidence | null;
  detectRequirement(rootPath: string): RuntimeRequirement | null;
  detectStackTags(rootPath: string): string[];
  suggestSkills(facts: StackFactsView): string[];
  installGap(rootPath: string): string | null;
  probe: { argv: string[]; parse(stdout: string): string | null };
  matchesFacts(facts: StackFactsView): boolean;

  install?: InfraInstallFacet;
};
