import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import {
  attachWorkspaceDatabase,
  type AppDbEngineId,
  getAppDbEngine
} from "../projects/sessionAppDb.js";
import { listDbSetupEngineIds } from "../projects/appDb/registry.js";
import type { ProvisionedWorkspaceEngine } from "../projects/appDb/workspaceDb.js";
import { emitSetupAgentEval } from "../services/eval/phoenix.js";
import { listProjectInfraDependencyIds } from "../projects/hostInfra/registry.js";

const SETUP_RECOVERY_HINT =
  "Next: briefly explain this failure to the user (do not end on this error alone). " +
  "Then call ask_user (kind=mcq) with 2–4 concrete recovery actions you choose " +
  "(e.g. local/host missing binary: install_project_infra after consent; start existing service; skip). " +
  "Do not install host infra via run_terminal — use install_project_infra. " +
  "Stop after ask_user — do not mutate without consent.";

function formatSetupSuccess(provisioned: ProvisionedWorkspaceEngine): {
  output: string;
  metadata: Record<string, unknown>;
} {
  const hostMode = provisioned.containerName.startsWith("host:");
  const how = provisioned.reused
    ? "Reused an already-running engine on this machine."
    : hostMode
      ? "Started a local engine process under ~/.forge/appdb/."
      : provisioned.pulled
        ? "Pulled image and started a Docker app-DB container."
        : "Started a Docker app-DB container.";
  const lines = [
    `Set up ${provisioned.label} project infra for this workspace.`,
    hostMode
      ? `runtime: local host (127.0.0.1:${provisioned.hostPort})`
      : `image: ${provisioned.image}`,
    `database: ${provisioned.database}`,
    how,
    `Injected \`${provisioned.envKey}\` into workspace parameters (redacted in chat).`,
    hostMode
      ? "Apps should use the injected localhost URI."
      : "Restart or re-open the session sandbox if the running container still lacks the new env."
  ];
  return {
    output: lines.join("\n"),
    metadata: {
      engineId: provisioned.engineId,
      database: provisioned.database,
      envKey: provisioned.envKey,
      image: provisioned.image,
      hostMode,
      reused: provisioned.reused,
      hostPort: provisioned.hostPort
    }
  };
}

function setupFailure(output: string, metadata?: Record<string, unknown>) {
  return {
    success: false as const,
    output: `${output}\n\n${SETUP_RECOVERY_HINT}`,
    metadata: {
      recoverable: true,
      needsUserAction: true,
      ...metadata
    }
  };
}

export async function executeSetupProjectInfra(options: {
  sessionId: string;
  args: Record<string, unknown>;
}): Promise<{
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}> {
  const engineIdRaw =
    typeof options.args.engineId === "string"
      ? options.args.engineId.trim().toLowerCase()
      : "";
  const userApproved = options.args.userApproved === true;

  if (!userApproved) {
    return {
      success: false,
      output:
        "setup_project_infra requires userApproved: true. Propose the engine to the user first; only call again after they explicitly approve."
    };
  }

  if (engineIdRaw !== "postgres" && engineIdRaw !== "mongo") {
    const setupIds = listDbSetupEngineIds();
    const installIds = listProjectInfraDependencyIds();
    if (installIds.includes(engineIdRaw) && !setupIds.includes(engineIdRaw)) {
      return {
        success: false,
        output:
          `\`${engineIdRaw}\` is an installable runtime (use install_project_infra), not a service engine. ` +
          `setup_project_infra is only for: ${setupIds.join(", ")}.`
      };
    }
    return {
      success: false,
      output: `engineId must be one of: ${setupIds.join(", ")}.`
    };
  }
  const engineId = engineIdRaw as AppDbEngineId;
  const engine = getAppDbEngine(engineId);
  if (!engine) {
    return { success: false, output: `Unknown engine ${engineId}` };
  }

  const chatRepo = new ChatFeatureRepository();
  const chat = await chatRepo.getBySessionId(options.sessionId);
  if (!chat?.workspaceId) {
    return {
      success: false,
      output: "setup_project_infra is only available on workspace sessions."
    };
  }

  try {
    const provisioned = await attachWorkspaceDatabase({
      workspaceId: chat.workspaceId,
      engineId,
      sessionId: options.sessionId
    });
    void emitSetupAgentEval({
      sessionId: options.sessionId,
      workspaceId: chat.workspaceId,
      infraProvisioned: [engineId]
    }).catch(() => undefined);
    const formatted = formatSetupSuccess(provisioned);
    return { success: true, ...formatted };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return setupFailure(`setup_project_infra failed: ${message}`, {
      engineId,
      code: /mongod|postgres|not found|not running/i.test(message)
        ? "host_dependency_missing"
        : "setup_failed"
    });
  }
}
