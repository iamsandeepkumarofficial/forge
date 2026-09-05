export type AppType = "web" | "api" | "worker";
export interface ForgeApp {
  name: string;
  cwd: string;
  command: string;
  port?: number;
  type: AppType;

  repo?: string;
}
export interface ForgeConfig {
  apps: ForgeApp[];
}
export type AppStartFailure = "process" | "port";
export interface AppStatus extends ForgeApp {
  running: boolean;
  url?: string;
  hostPort?: number;
  startFailure?: AppStartFailure;
}
export type LaunchConfigSource = "launch" | "legacy" | "none";
