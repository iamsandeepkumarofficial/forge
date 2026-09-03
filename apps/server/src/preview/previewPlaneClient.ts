import { SandboxRuntimeError } from "../projects/sandboxRuntime/types.js";

const N_200 = 200;
const N_201 = 201;
const N_204 = 204;
const N_404 = 404;

export type RegisterPreviewInput = {
  sessionId: string;
  port: number;
  backendService: string;
  hostname?: string;
  ownerEmail?: string;
  pathRoutes?: Array<{
    pathPrefix: string;
    backendService: string;
    stripPrefix?: boolean;
  }>;
};

export type RegisterPreviewResult = {
  hostname: string;
  url: string;
};

function previewPlaneBase(): string | undefined {
  const raw = process.env.PREVIEW_PLANE_URL?.trim();
  if (!raw) {
    return undefined;
  }
  return raw.replace(/\/$/, "");
}

function internalHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json"
  };
}

export async function registerPreviewRoute(
  input: RegisterPreviewInput
): Promise<RegisterPreviewResult | null> {
  const base = previewPlaneBase();
  if (!base) {
    return null;
  }
  const res = await fetch(`${base}/internal/preview/register`, {
    method: "POST",
    headers: internalHeaders(),
    body: JSON.stringify(input)
  });
  if (res.status !== N_200 && res.status !== N_201) {
    throw new SandboxRuntimeError({
      code: "preview_route_failed",
      message: `preview register failed: ${res.status}`
    });
  }
  return (await res.json()) as RegisterPreviewResult;
}

export async function revokePreviewSession(sessionId: string): Promise<void> {
  const base = previewPlaneBase();
  if (!base) {
    return;
  }
  const res = await fetch(
    `${base}/internal/preview/${encodeURIComponent(sessionId)}`,
    { method: "DELETE", headers: internalHeaders() }
  );
  if (!res.ok && res.status !== N_404 && res.status !== N_204) {
    throw new SandboxRuntimeError({
      code: "preview_route_failed",
      message: `preview revoke failed: ${res.status}`
    });
  }
}

export async function revokePreviewPort(input: {
  sessionId: string;
  port: number;
}): Promise<void> {
  const base = previewPlaneBase();
  if (!base) {
    return;
  }
  const res = await fetch(
    `${base}/internal/preview/${encodeURIComponent(input.sessionId)}/${input.port}`,
    { method: "DELETE", headers: internalHeaders() }
  );
  if (!res.ok && res.status !== N_404 && res.status !== N_204) {
    throw new SandboxRuntimeError({
      code: "preview_route_failed",
      message: `preview revoke port failed: ${res.status}`
    });
  }
}
