import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import { autoStartPreview, readForgeConfig } from "./appRunner.js";
import { ensureLaunchConfig } from "./launchScaffold.js";
import {
  formatLaunchAppNames,
  logLaunchConfigProvisionResult
} from "./launchConfigLog.js";

/**
 * Post-provision setup: restore deps cache, scaffold/seed launch.json, auto-start.
 * Does not install deps or start/reattach app DBs — setup agent + user-gated
 * provision_app_engine own that. Env for already-attached engines still comes
 * from resolveSessionEnv / workspace parameters.
 */
export async function finalizeSessionProvision(sessionId: string): Promise<void> {
  const chatRepo = new ChatFeatureRepository();
  await chatRepo.getBySessionId(sessionId);

  try {
    const { restoreWorkspaceDepsForSession } = await import(
      "./workspaceEnvironment.js"
    );
    await restoreWorkspaceDepsForSession(sessionId);
  } catch (err) {
    console.warn(
      `[finalizeSessionProvision] deps restore ${sessionId}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  try {
    const launch = await ensureLaunchConfig(sessionId);
    let appNames: string | undefined;
    if (launch.ready) {
      const { config } = await readForgeConfig(sessionId);
      appNames = formatLaunchAppNames(config.apps);
    }
    logLaunchConfigProvisionResult({
      sessionId,
      source: launch.source,
      ready: launch.ready,
      appNames
    });
  } catch (err) {
    console.warn(
      `[finalizeSessionProvision] launch scaffold ${sessionId}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  // Preview auto-start can take minutes (Next dev servers, port repair). Run in
  // the background so session/start and Temporal ensureChatSandbox return quickly.
  void autoStartPreview(sessionId).catch((err) => {
    console.warn(
      `[finalizeSessionProvision] autoStartPreview ${sessionId}: ${err instanceof Error ? err.message : String(err)}`
    );
  });
}
