import {
  allocateReservedAppPort,
  FIRST_APP_PORT,
  hostPortForContainerPort,
  isReservedAppPort,
  LAST_APP_PORT
} from "../sessionSandbox/constants.js";
import type { ResolveListenPortInput } from "./types.js";

export function cloudPublishedAppPortsEnv(): string {
  return `${FIRST_APP_PORT}-${LAST_APP_PORT}`;
}

export function resolveCloudListenPort(input: ResolveListenPortInput): number {
  const preferred = input.preferred;
  if (preferred != null && isReservedAppPort(preferred)) {
    if (!input.usedListenPorts.includes(preferred)) return preferred;
  }
  const allocated = allocateReservedAppPort(input.usedListenPorts);
  if (allocated != null) return allocated;
  if (preferred != null && isReservedAppPort(preferred)) return preferred;
  return FIRST_APP_PORT;
}

export function resolveDockerPublishedPort(
  sessionId: string,
  listenPort: number
): number | null {
  return hostPortForContainerPort(sessionId, listenPort);
}

export function cloudListenPortRangeLabel(): string {
  return `${FIRST_APP_PORT}–${LAST_APP_PORT}`;
}

export { FIRST_APP_PORT, isReservedAppPort, LAST_APP_PORT };
