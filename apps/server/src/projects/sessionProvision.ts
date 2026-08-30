import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import { ensureLaunchConfig } from "./launchScaffold.js";
import { autoStartPreview } from "./appRunner.js";

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
    await ensureLaunchConfig(sessionId);
  } catch (err) {
    console.warn(
      `[finalizeSessionProvision] launch scaffold ${sessionId}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  await autoStartPreview(sessionId);
}
