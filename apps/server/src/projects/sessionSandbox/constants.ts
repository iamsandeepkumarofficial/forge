const N_1024 = 1024;
const N_16 = 16;
const N_200 = 200;
const N_31 = 31;
const N_64 = 64;

export const DEFAULT_SANDBOX_IMAGE = "forge-sandbox:latest";
export const WORKSPACE_MOUNT = "/workspace";
export const RESERVED_PORTS = 10;
export const FIRST_APP_PORT = 3000;
/** Inclusive upper bound of Docker-published app ports (3000–3009). */
export const LAST_APP_PORT = FIRST_APP_PORT + RESERVED_PORTS - 1;
const HOST_PORT_FLOOR = 40000;
const HOST_PORT_BLOCKS = 250;

export const DOCKER_MAX_BUFFER = N_16 * N_1024 * N_1024;
export const BUILD_MAX_BUFFER = N_64 * N_1024 * N_1024;
export const DOCKER_NAME_MAX = N_200;
export const HASH_PRIME = N_31;

export function sessionHostPortBase(sessionId: string): number {
  let h = 0;
  for (const c of sessionId) h = (h * HASH_PRIME + c.charCodeAt(0)) >>> 0;
  return HOST_PORT_FLOOR + (h % HOST_PORT_BLOCKS) * RESERVED_PORTS;
}

export function isReservedAppPort(port: number): boolean {
  return (
    Number.isInteger(port) && port >= FIRST_APP_PORT && port <= LAST_APP_PORT
  );
}

/** Next free container port in the published 3000–3009 range, or null if full. */
export function allocateReservedAppPort(
  usedPorts: Iterable<number>
): number | null {
  const used = new Set(usedPorts);
  for (let port = FIRST_APP_PORT; port <= LAST_APP_PORT; port++) {
    if (!used.has(port)) return port;
  }
  return null;
}

export function hostPortForContainerPort(
  sessionId: string,
  containerPort: number
): number | null {
  const idx = containerPort - FIRST_APP_PORT;
  if (idx < 0 || idx >= RESERVED_PORTS) return null;
  return sessionHostPortBase(sessionId) + idx;
}

function sanitizeDockerName(sessionId: string): string {
  const cleaned = sessionId
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(0, DOCKER_NAME_MAX);
  return cleaned.replace(/^[._-]+/, "") || "session";
}

export function sessionVolumeName(sessionId: string): string {
  return `forge-session-${sanitizeDockerName(sessionId)}`;
}

export function sandboxContainerName(sessionId: string): string {
  return `forge-sandbox-${sanitizeDockerName(sessionId)}`;
}

export function preferredSandboxImageName(): string {
  return process.env.FORGE_SANDBOX_IMAGE?.trim() || DEFAULT_SANDBOX_IMAGE;
}
