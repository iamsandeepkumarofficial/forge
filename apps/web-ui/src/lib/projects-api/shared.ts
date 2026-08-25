import { pocToken, runnerUrl } from "../tool-runner.js";

export const N_100 = 100;
export const N_1024 = 1024;
export const N_204 = 204;
export const N_800 = 800;

export const BASE_URL = runnerUrl();
export { pocToken };

export class ConnectProjectError extends Error {
  code?: string;
  help?: string;
  retryAfter?: string;
  constructor(
    message: string,
    options?: {
      code?: string;
      help?: string;
      retryAfter?: string;
    }
  ) {
    super(message);
    this.name = "ConnectProjectError";
    this.code = options?.code;
    this.help = options?.help;
    this.retryAfter = options?.retryAfter;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export type ProjectSummary = {
  id: string;
  name: string;
  source: string;
  status: string;
  createdAt?: string;
};

export type ChatSummary = {
  id: string;
  sessionId?: string;
  title?: string;
  kind?: "ticket" | "workbench";
  [key: string]: unknown;
};

export type SessionStatus = {
  sessionId: string;
  status?: string;
  [key: string]: unknown;
};

export type ChatFeatureType = "feature" | "bug" | "refactor";

export type DescriptionDocument = {
  version: 1;
  blocks: Array<{
    type: string;
    [key: string]: unknown;
  }>;
};
