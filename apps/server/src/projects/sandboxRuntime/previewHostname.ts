import { FIRST_APP_PORT } from "../sessionSandbox/constants.js";
import {
  sessionPreviewHostname,
  sessionPreviewHostnameForPort
} from "./hostnames.js";
import { portsForSession } from "./sessionPortRegistry.js";

export function cloudPreviewHostname(
  sessionId: string,
  listenPort: number
): string {
  return listenPort === FIRST_APP_PORT
    ? sessionPreviewHostname(sessionId)
    : sessionPreviewHostnameForPort(sessionId, listenPort);
}

export function hostPreviewHostname(
  sessionId: string,
  listenPort: number
): string {
  const allocated = portsForSession(sessionId);
  const primary =
    allocated.length === 0 || Math.min(...allocated) === listenPort;
  return primary
    ? sessionPreviewHostname(sessionId)
    : sessionPreviewHostnameForPort(sessionId, listenPort);
}
