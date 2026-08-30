import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import {
  attachWorkspaceDatabase,
  type AppDbEngineId,
  getAppDbEngine
} from "../projects/sessionAppDb.js";
import { emitSetupAgentEval } from "../services/eval/phoenix.js";

export async function executeProvisionAppEngine(options: {
  sessionId: string;
  args: Record<string, unknown>;
}): Promise<{ success: boolean; output: string; metadata?: Record<string, unknown> }> {
  const engineIdRaw =
    typeof options.args.engineId === "string"
      ? options.args.engineId.trim().toLowerCase()
      : "";
  const userApproved = options.args.userApproved === true;

  if (!userApproved) {
    return {
      success: false,
      output:
        "provision_app_engine requires userApproved: true. Propose the engine to the user first; only call again after they explicitly approve."
    };
  }

  if (engineIdRaw !== "postgres" && engineIdRaw !== "mongo") {
    return {
      success: false,
      output: "engineId must be `postgres` or `mongo`."
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
      output: "provision_app_engine is only available on workspace sessions."
    };
  }

  try {
    const provisioned = await attachWorkspaceDatabase(
      chat.workspaceId,
      engineId
    );
    void emitSetupAgentEval({
      sessionId: options.sessionId,
      workspaceId: chat.workspaceId,
      infraProvisioned: [engineId]
    }).catch(() => undefined);
    return {
      success: true,
      output: [
        `Provisioned ${provisioned.label} for this workspace.`,
        `image: ${provisioned.image}`,
        `database: ${provisioned.database}`,
        `Injected \`${provisioned.envKey}\` into workspace parameters (redacted in chat).`,
        "Restart or re-open the session sandbox if the running container still lacks the new env."
      ].join("\n"),
      metadata: {
        engineId,
        database: provisioned.database,
        envKey: provisioned.envKey,
        image: provisioned.image
      }
    };
  } catch (err) {
    return {
      success: false,
      output: `Provision failed: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
