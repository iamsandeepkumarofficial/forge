import { commandOnPath } from "./sandboxRuntime/osSandbox.js";

export type HostToolchainReport = {
  ok: boolean;
  missing: string[];
  guidance: string[];
};

export async function checkHostToolchain(): Promise<HostToolchainReport> {
  const missing: string[] = [];
  const guidance: string[] = [];
  if (!(await commandOnPath("git"))) {
    missing.push("git");
    guidance.push("Install git and ensure it is on PATH.");
  }
  if (!(await commandOnPath("node"))) {
    missing.push("node");
    guidance.push("Install Node.js 20+ and ensure `node` is on PATH.");
  }
  return {
    ok: missing.length === 0,
    missing,
    guidance
  };
}
