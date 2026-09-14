import { registerPreviewRoute } from "../../preview/previewPlaneClient.js";
import { ensureHostTcpPublishedReady } from "./ensurePublishedPort.js";
import {
  allocateSessionPort,
  isHostRegistryPort,
  loadSessionPortRegistry
} from "./sessionPortRegistry.js";
import { hostPreviewHostname } from "./previewHostname.js";
import { isReservedAppPort } from "./cloudPorts.js";
import type {
  EnsurePublishedPortReadyInput,
  PreviewBinding,
  ResolveListenPortInput,
  WorkspaceHandle
} from "./types.js";

export async function hostResolveListenPort(
  input: ResolveListenPortInput
): Promise<number> {
  await loadSessionPortRegistry().catch(() => undefined);
  const preferred = input.preferred;
  if (
    preferred != null &&
    isHostRegistryPort(preferred) &&
    !input.usedListenPorts.includes(preferred)
  ) {
    return allocateSessionPort(input.sessionId, preferred);
  }
  if (preferred != null && isReservedAppPort(preferred)) {
    console.warn(
      `[hostAdapter] session ${input.sessionId} app ${input.appName}: ignoring docker reserved port ${preferred}; allocating host registry port`
    );
  }
  return allocateSessionPort(input.sessionId);
}

export async function hostPublishPreviewPort(
  handle: WorkspaceHandle,
  port: number
): Promise<PreviewBinding> {
  const hostname = hostPreviewHostname(handle.sessionId, port);
  const backendService = `127.0.0.1:${port}`;
  const localUrl = `http://127.0.0.1:${port}`;
  const registered = await registerPreviewRoute({
    sessionId: handle.sessionId,
    port,
    backendService,
    hostname
  });
  return {
    hostname: registered?.hostname ?? hostname,
    targetPort: port,
    url: registered?.url ?? localUrl
  };
}

export async function hostEnsurePublishedPortReady(
  input: EnsurePublishedPortReadyInput
): Promise<boolean> {
  return ensureHostTcpPublishedReady({ publishedPort: input.publishedPort });
}
