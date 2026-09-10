import { spawn } from "node:child_process";
import { withForgeRuntimePath } from "../hostInfra/paths.js";
import { goStackAdapter } from "./go/index.js";
import { nodeStackAdapter } from "./node/index.js";
import { pythonStackAdapter } from "./python/index.js";
import type {
  RuntimeRequirement,
  RuntimeToolId,
  StackAdapter,
  StackEvidence,
  StackFactsView,
  StackId
} from "./types.js";

export type {
  RuntimeRequirement,
  RuntimeToolId,
  StackAdapter,
  StackEvidence,
  StackFactsView,
  StackId
} from "./types.js";

export const STACK_ADAPTERS: readonly StackAdapter[] = [
  nodeStackAdapter,
  pythonStackAdapter,
  goStackAdapter
] as const;

const N_8000 = 8000;

export type AvailableRuntimes = Partial<Record<RuntimeToolId, string>>;

export function getStackAdapter(id: StackId): StackAdapter | undefined {
  return STACK_ADAPTERS.find((a) => a.id === id);
}

export function collectEcosystemEvidence(rootPath: string): StackEvidence[] {
  const evidence: StackEvidence[] = [];
  for (const adapter of STACK_ADAPTERS) {
    const e = adapter.collectEvidence(rootPath);
    if (e) evidence.push(e);
  }
  return evidence;
}

export function detectRuntimeRequirements(
  rootPath: string
): RuntimeRequirement[] {
  const out: RuntimeRequirement[] = [];
  for (const adapter of STACK_ADAPTERS) {
    const req = adapter.detectRequirement(rootPath);
    if (req) out.push(req);
  }
  return out;
}

export function detectStack(rootPath: string): string[] {
  const tags = new Set<string>();
  for (const adapter of STACK_ADAPTERS) {
    for (const t of adapter.detectStackTags(rootPath)) tags.add(t);
  }
  return [...tags].sort();
}

function dbMigrationsOverlay(facts: StackFactsView): string[] {
  const stacks = facts.detectedStack ?? [];
  if (
    stacks.includes("prisma") ||
    stacks.includes("mongoose") ||
    (facts.envKeysReferenced ?? []).some((k) =>
      ["DATABASE_URL", "MONGODB_URI", "REDIS_URL"].includes(k)
    )
  ) {
    return ["db-migrations"];
  }
  return [];
}

export function suggestSkillsForFacts(facts: StackFactsView): string[] {
  const skills = new Set<string>();
  for (const adapter of STACK_ADAPTERS) {
    for (const s of adapter.suggestSkills(facts)) skills.add(s);
  }
  for (const s of dbMigrationsOverlay(facts)) skills.add(s);
  return [...skills].sort();
}

export function factsHaveNodeEvidence(facts: StackFactsView): boolean {
  return nodeStackAdapter.matchesFacts(facts);
}

export function factsHavePythonEvidence(facts: StackFactsView): boolean {
  return pythonStackAdapter.matchesFacts(facts);
}

export function factsHaveGoEvidence(facts: StackFactsView): boolean {
  return goStackAdapter.matchesFacts(facts);
}

export function requiredHostTools(factsList: StackFactsView[]): string[] {
  const tools = new Set<string>(["git"]);
  let matched = false;
  for (const facts of factsList) {
    for (const adapter of STACK_ADAPTERS) {
      if (adapter.matchesFacts(facts)) {
        tools.add(adapter.hostBinary);
        matched = true;
      }
    }
  }
  if (!matched) tools.add("node");
  return [...tools].sort();
}

export function installGapForEvidence(
  rootPath: string,
  evidence: Array<{ ecosystem: string }>
): string | null {
  for (const e of evidence) {
    const adapter = STACK_ADAPTERS.find((a) => a.id === e.ecosystem);
    if (!adapter) continue;
    const gap = adapter.installGap(rootPath);
    if (gap) return gap;
  }
  return null;
}

function runLocal(argv: string[]): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      PATH: withForgeRuntimePath(process.env.PATH)
    };
    const child = spawn(argv[0]!, argv.slice(1), {
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, N_8000);
    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString("utf8");
    });
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout: stdout || stderr });
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ code: 1, stdout: "" });
    });
  });
}

export async function probeAvailableRuntimes(options: {
  sessionId: string;
  containerName: string;
}): Promise<AvailableRuntimes> {
  const { sessionId, containerName } = options;
  const out: AvailableRuntimes = {};
  try {
    const { dockerExec } = await import("../sandboxExec.js");
    for (const adapter of STACK_ADAPTERS) {
      try {
        const result = await dockerExec({
          container: containerName,
          sessionId,
          argv: adapter.probe.argv
        });
        const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
        if (result.code === 0) {
          const ver = adapter.probe.parse(text);
          if (ver) out[adapter.id] = ver;
        }
      } catch {
        void 0;
      }
    }
    return out;
  } catch {
    for (const adapter of STACK_ADAPTERS) {
      const result = await runLocal(adapter.probe.argv);
      if (result.code === 0) {
        const ver = adapter.probe.parse(result.stdout);
        if (ver) out[adapter.id] = ver;
      }
    }
    return out;
  }
}

export function extractRuntimeVersionFromOutput(
  tool: RuntimeToolId,
  raw: string
): string | null {
  const adapter = getStackAdapter(tool);
  return adapter?.probe.parse(raw) ?? null;
}

export { detectPackageManager } from "./node/index.js";
