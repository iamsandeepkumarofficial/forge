import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import os from "node:os";

const N_10 = 10;
const N_1024 = 1024;
const N_120000 = 120000;
const N_15 = 15;
const N_36 = 36;

const execAsync = promisify(exec);
export interface SandboxConfig {
  image: string;
  workdir: string;
  allowedCommands: string[];
  allowedPaths: string[];
  timeout: number;
  memoryLimit?: string;
}
export interface SandboxExecutionResult {
  success: boolean;
  output: string;
  error?: string;
}
export interface SandboxSession {
  id: string;
  containerId: string;
  config: SandboxConfig;
}
export class SandboxManager {
  private baseImage: string;
  private tempDir: string;
  constructor(config: { baseImage?: string; tempDir?: string }) {
    this.baseImage = config.baseImage || "node:20-alpine";
    this.tempDir = config.tempDir || os.tmpdir();
  }
  async createSession(config: SandboxConfig): Promise<SandboxSession> {
    const sessionId = this.generateId();
    const containerName = `sandbox-${sessionId}`;
    const workdir = path.join(this.tempDir, sessionId);
    await this.execInHost(
      `docker run --rm -d --name ${containerName} -w ${workdir} ${this.baseImage} sleep infinity`
    );
    const session: SandboxSession = {
      id: sessionId,
      containerId: containerName,
      config
    };
    return session;
  }
  async execCommand(
    session: SandboxSession,
    command: string
  ): Promise<{
    output: string;
    error?: string;
  }> {
    const containerName = session.containerId;
    const timeout = session.config.timeout || N_120000;
    try {
      const { stdout, stderr } = await execAsync(
        `docker exec -w ${session.config.workdir} ${containerName} ${command}`,
        {
          timeout: timeout,
          maxBuffer: N_10 * N_1024 * N_1024
        }
      );
      return {
        output: stdout || stderr || "(no output)"
      };
    } catch (err: unknown) {
      const e = err as {
        stdout?: unknown;
        stderr?: unknown;
        message?: string;
      };
      const output = [e.stdout?.toString(), e.stderr?.toString()]
        .filter(Boolean)
        .join("\n");
      return {
        output: output,
        error: e.message
      };
    }
  }
  async cleanupSession(session: SandboxSession): Promise<void> {
    try {
      await execAsync(`docker rm -f ${session.containerId}`);
    } catch {
      void 0;
    }
  }
  private async execInHost(command: string): Promise<void> {
    const { stderr } = await execAsync(command);
    if (stderr) {
      console.error(`Docker stderr: ${stderr}`);
    }
  }
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(N_36).substring(2, N_15)}`;
  }
  async validateCommand(command: string): Promise<boolean> {
    const simpleCommand = command.split(" ")[0];
    return this.config.allowedCommands.includes(simpleCommand);
  }
  private get config(): SandboxConfig {
    throw new Error("Config not set");
  }
}
export const defaultSandboxConfig: SandboxConfig = {
  image: "node:20-alpine",
  workdir: "/workspace",
  allowedCommands: [
    "npm",
    "pnpm",
    "yarn",
    "node",
    "ls",
    "cat",
    "grep",
    "find",
    "rm",
    "mkdir",
    "cp",
    "mv"
  ],
  allowedPaths: ["/workspace", "/tmp"],
  timeout: 120000,
  memoryLimit: "512m"
};
