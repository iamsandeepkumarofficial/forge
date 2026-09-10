import type { LaunchReadiness } from "../../prompts/repoReadiness.js";
import type { WorkspaceHealthReport } from "./health/types.js";
import type {
  HealthCheckStatus,
  SessionHealthCheckItem
} from "./sessionHealthChecks.js";

export type { HealthCheckStatus, SessionHealthCheckItem };

export type SessionHealthCheck = {
  id: string;
  label: string;
  status: HealthCheckStatus;
  summary: string;
  detail?: string;
  remediation?: string;
  items?: SessionHealthCheckItem[];
};

export type SessionHealthReport = {
  sessionId: string;
  workspaceId: string | null;
  computedAt: string;
  overall: HealthCheckStatus;
  checks: SessionHealthCheck[];
  launchReadiness: LaunchReadiness;
  runningApps: Array<{
    name: string;
    running: boolean;
    port?: number;
    url?: string;
  }>;
  workspaceStatus?: WorkspaceHealthReport["status"];
};
