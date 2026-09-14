

import type { WorkspacePrepareShadows } from "../workspace/health/types.js";

type OtelApi = {
  trace: {
    getTracer: (name: string) => {
      startActiveSpan: (
        name: string,
        fn: (span: {
          setAttribute: (k: string, v: string | number | boolean) => void;
          end: () => void;
        }) => void
      ) => void;
    };
  };
};

let registerPromise: Promise<boolean> | null = null;

function collectorBase(): string | null {
  const raw =
    process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim() ||
    process.env.FORGE_PHOENIX_ENDPOINT?.trim() ||
    "";
  if (!raw) return null;
  return raw.replace(/\/$/, "").replace(/\/v1\/traces$/i, "");
}

async function ensureRegistered(): Promise<boolean> {
  const base = collectorBase();
  if (!base) return false;
  if (!registerPromise) {
    registerPromise = (async () => {
      try {
        const { register } = await import("@arizeai/phoenix-otel");
        register({
          projectName:
            process.env.PHOENIX_PROJECT_NAME?.trim() || "forge-setup-agent",
          url: base,
          batch: false
        });
        return true;
      } catch (err) {
        console.warn(
          `[phoenix] register failed: ${err instanceof Error ? err.message : String(err)}`
        );
        return false;
      }
    })();
  }
  return registerPromise;
}

async function withSetupSpan(
  name: string,
  attrs: Record<string, string | number | boolean>
): Promise<void> {
  if (!(await ensureRegistered())) return;
  try {
    const otel = (await import("@opentelemetry/api")) as unknown as OtelApi;
    const tracer = otel.trace.getTracer("forge.setup");
    tracer.startActiveSpan(name, (span) => {
      for (const [k, v] of Object.entries(attrs)) {
        span.setAttribute(k, v);
      }
      span.end();
    });
  } catch (err) {
    console.warn(
      `[phoenix] span failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export type SetupPrepareEvalInput = {
  workspaceId: string;
  shadows?: WorkspacePrepareShadows;
  status: string;
  findingCodes: string[];
};

export type SetupAgentEvalInput = {
  workspaceId?: string;
  sessionId: string;
  agentStack?: string;
  skillId?: string;
  installCommand?: string;
  installOk?: boolean;
  sandboxImage?: string;
  paramsUpserted?: string[];
  infraProvisioned?: string[];
};


export async function emitSetupPrepareEval(
  input: SetupPrepareEvalInput
): Promise<void> {
  const shadows = input.shadows;
  const ecosystems =
    shadows?.ecosystemEvidence
      .flatMap((m) => m.evidence.map((e) => `${m.repo}:${e.ecosystem}`))
      .join(",") ?? "";
  await withSetupSpan("forge.setup.prepare", {
    "forge.workspace_id": input.workspaceId,
    "forge.health_status": input.status,
    "forge.finding_codes": input.findingCodes.join(","),
    "shadow.ecosystems": ecosystems,
    "shadow.params":
      shadows?.paramCandidates.map((p) => p.key).join(",") ?? "",
    "shadow.infra": shadows?.infraEvidence.join(",") ?? "",
    "shadow.sandbox_image": shadows?.preferredSandboxImage ?? ""
  });
}


export async function emitSetupAgentEval(
  input: SetupAgentEvalInput
): Promise<void> {
  await withSetupSpan("forge.setup.agent", {
    "forge.session_id": input.sessionId,
    ...(input.workspaceId
      ? { "forge.workspace_id": input.workspaceId }
      : {}),
    ...(input.agentStack ? { "agent.stack": input.agentStack } : {}),
    ...(input.skillId ? { "agent.skill_id": input.skillId } : {}),
    ...(input.installCommand
      ? { "agent.install_command": input.installCommand }
      : {}),
    ...(input.installOk !== undefined
      ? { "agent.install_ok": input.installOk }
      : {}),
    ...(input.sandboxImage
      ? { "agent.sandbox_image": input.sandboxImage }
      : {}),
    ...(input.paramsUpserted
      ? { "agent.params": input.paramsUpserted.join(",") }
      : {}),
    ...(input.infraProvisioned
      ? { "agent.infra": input.infraProvisioned.join(",") }
      : {})
  });
}

export function phoenixEnabled(): boolean {
  return collectorBase() != null;
}
