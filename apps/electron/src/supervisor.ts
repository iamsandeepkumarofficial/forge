import type { ChildProcess } from "node:child_process";
import { readConfig, stopComposeOnQuit } from "./config.js";
import {
  composeStop,
  composeUpInfra,
  ensureSandboxImage,
  preflightDocker,
  waitForPostgres
} from "./docker.js";
import {
  materializeHostRuntimeEnv,
  materializeLlmEnv,
  materializePreviewEnv,
  mergeEnvExtras
} from "./env.js";
import { isHostDesktopMode } from "./hostMode.js";
import { waitForHttp } from "./httpWait.js";
import { ensureNativeStack, type NativeStackHandle } from "./nativeStack.js";
import { killProcessTree, spawnLogged } from "./processTree.js";
import { findRepoRoot } from "./repoRoot.js";
import { HEALTH_ATTEMPTS, TOOL_PLANE_HEALTH } from "./types.js";
import type { ForgeConfig } from "./types.js";

export type SupervisorDeps = {
  findRoot?: () => string;
  readCfg?: () => ForgeConfig;
  stopCompose?: (root: string) => void;
  ensureStack?: (root: string) => Promise<void>;
  spawnHarness?: (root: string) => ChildProcess[];
  waitHealth?: () => Promise<void>;
  hostMode?: boolean;
};

export class Supervisor {
  private readonly children: ChildProcess[] = [];
  private started = false;
  private native: NativeStackHandle | null = null;
  private readonly deps: SupervisorDeps;

  constructor(deps: SupervisorDeps = {}) {
    this.deps = deps;
  }

  getStatus(): string {
    if (this.started) return "Forge desktop supervisor — infra running";
    return "Forge desktop supervisor — infra not started";
  }

  async startInfra(): Promise<string> {
    if (this.started) return "Infra already started";
    const root = this.root();
    try {
      await this.prepareStack(root);
      this.startHarness(root);
      this.started = true;
      await this.awaitHealth();
      return "Infra started (postgres, temporal, server, orchestrator; preview in-process)";
    } catch (err) {
      this.killChildren();
      this.native?.stop();
      this.native = null;
      throw err;
    }
  }

  async stopInfra(): Promise<string> {
    this.killChildren();
    this.native?.stop();
    this.native = null;
    this.started = false;
    this.maybeStopCompose();
    return "Infra stopped";
  }

  track(child: ChildProcess): void {
    this.children.push(child);
  }

  private root(): string {
    return this.deps.findRoot?.() ?? findRepoRoot({});
  }

  private useHostMode(): boolean {
    return this.deps.hostMode ?? isHostDesktopMode();
  }

  private async prepareStack(root: string): Promise<void> {
    if (this.deps.ensureStack) {
      await this.deps.ensureStack(root);
      return;
    }
    if (this.useHostMode()) {
      this.native = await ensureNativeStack(root);
      this.children.push(...this.native.children);
      return;
    }
    await dockerEnsureStack(root);
  }

  private startHarness(root: string): void {
    const spawned = this.deps.spawnHarness
      ? this.deps.spawnHarness(root)
      : defaultSpawnHarness({
          root,
          config: this.cfg(),
          hostMode: this.useHostMode()
        });
    this.children.push(...spawned);
  }

  private awaitHealth(): Promise<void> {
    if (this.deps.waitHealth) return this.deps.waitHealth();
    return waitForHttp({
      url: TOOL_PLANE_HEALTH,
      attempts: HEALTH_ATTEMPTS
    }).catch(() => undefined);
  }

  private cfg(): ForgeConfig {
    return this.deps.readCfg?.() ?? readConfig();
  }

  private killChildren(): void {
    for (const child of this.children) {
      if (child.pid) killProcessTree(child.pid);
    }
    this.children.length = 0;
  }

  private maybeStopCompose(): void {
    if (this.useHostMode()) return;
    if (!stopComposeOnQuit(this.cfg())) return;
    const stop = this.deps.stopCompose ?? composeStop;
    try {
      stop(this.root());
    } catch {
      return;
    }
  }
}

async function dockerEnsureStack(root: string): Promise<void> {
  preflightDocker();
  composeUpInfra(root);
  await waitForPostgres();
  ensureSandboxImage(root);
}

function defaultSpawnHarness(options: {
  root: string;
  config: ForgeConfig;
  hostMode: boolean;
}): ChildProcess[] {
  const parts = [materializeLlmEnv(options.config), materializePreviewEnv()];
  if (options.hostMode) parts.push(materializeHostRuntimeEnv());
  const env = mergeEnvExtras(parts);
  return [
    spawnPnpm({
      root: options.root,
      filter: "@forge/server",
      script: "dev",
      env
    }),
    spawnPnpm({
      root: options.root,
      filter: "@forge/orchestrator",
      script: "dev",
      env
    })
  ];
}

function spawnPnpm(options: {
  root: string;
  filter: string;
  script: string;
  env: Record<string, string>;
}): ChildProcess {
  return spawnLogged({
    cmd: "pnpm",
    args: ["--filter", options.filter, "run", options.script],
    cwd: options.root,
    env: { ...options.env, FORGE_BIND_HOST: "127.0.0.1" },
    label: options.filter
  });
}
