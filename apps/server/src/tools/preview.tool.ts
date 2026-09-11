import {
  appLogs,
  listAppStatuses,
  readForgeConfig,
  runApp,
  stopApp,
  upsertLaunchApp,
  matchLaunchApp,
  type AppStatus,
  type AppType,
  type ForgeApp
} from "../projects/appRunner.js";
import {
  readFileFromSandbox,
  resolveSandbox
} from "../projects/sandboxExec.js";
import type { ToolResult } from "./types.js";

const N_300 = 300;
const LAUNCH_REL = ".forge/launch.json";

const APP_TYPES = new Set<AppType>(["web", "api", "worker"]);

async function resolveAppName(options: {
  sessionId: string;
  args: Record<string, unknown>;
}): Promise<{ name: string } | { error: string }> {
  const explicit =
    typeof options.args.name === "string" ? options.args.name.trim() : "";
  const { config } = await readForgeConfig(options.sessionId);
  if (explicit) {
    const matched = matchLaunchApp(config.apps, explicit);
    if (!matched) {
      const known = config.apps.map((a) => a.name).join(", ") || "(none)";
      return {
        error: `App "${explicit}" is not in .forge/launch.json (known: ${known}). Use upsert_launch_app, then preview_start.`
      };
    }
    return { name: matched.name };
  }
  const web = config.apps.find((a) => a.type === "web");
  const api = config.apps.find((a) => a.type === "api");
  const fallback = config.apps[0];
  const pick = web ?? api ?? fallback;
  if (!pick) {
    return {
      error:
        "App name required. Add apps to .forge/launch.json (Run tab → Auto-create) or upsert_launch_app."
    };
  }
  return { name: pick.name };
}

function formatAppStatus(app: AppStatus): string {
  const lines = [
    `name: ${app.name}`,
    `type: ${app.type}`,
    `running: ${app.running}`,
    `command: ${app.command}`,
    `cwd: ${app.cwd}`
  ];
  if (app.port != null) {
    lines.push(`containerPort: ${app.port}`);
  }
  if (app.hostPort != null) {
    lines.push(`hostPort: ${app.hostPort}`);
  }
  if (app.url) {
    lines.push(`url: ${app.url}`);
  }
  return lines.join("\n");
}

function parseUpsertApp(args: Record<string, unknown>): ForgeApp | string {
  const name = typeof args.name === "string" ? args.name.trim() : "";
  const cwd = typeof args.cwd === "string" ? args.cwd.trim() : "";
  const command = typeof args.command === "string" ? args.command.trim() : "";
  const type = args.type;
  if (!name || !cwd || !command) {
    return "name, cwd, and command are required";
  }
  if (typeof type !== "string" || !APP_TYPES.has(type as AppType)) {
    return "type must be web, api, or worker";
  }
  const app: ForgeApp = { name, cwd, command, type: type as AppType };
  if (typeof args.port === "number" && Number.isFinite(args.port)) {
    app.port = Math.floor(args.port);
  }
  if (typeof args.repo === "string" && args.repo.trim()) {
    app.repo = args.repo.trim();
  }
  return app;
}

export class PreviewToolService {
  async start(
    sessionId: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const resolved = await resolveAppName({ sessionId, args });
    if ("error" in resolved) {
      return { success: false, output: resolved.error };
    }
    const status = await runApp(sessionId, resolved.name);
    if (!status.running) {
      return startFailedResult({
        sessionId,
        name: resolved.name,
        status
      });
    }
    const urlHint = status.url ? ` at ${status.url}` : "";
    return {
      success: true,
      output: `Started ${resolved.name} in session sandbox${urlHint}`,
      metadata: { app: status, mode: "sandbox" }
    };
  }
  async stop(
    sessionId: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const name = typeof args.name === "string" ? args.name.trim() : "";
    if (!name) {
      return {
        success: false,
        output: "name required (.forge/launch.json app name)"
      };
    }
    const { config } = await readForgeConfig(sessionId);
    if (!config.apps.some((a) => a.name === name)) {
      return {
        success: false,
        output: `App "${name}" is not in .forge/launch.json.`
      };
    }
    await stopApp(sessionId, name);
    return { success: true, output: `Stopped ${name}` };
  }
  async status(
    sessionId: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const filterName = typeof args.name === "string" ? args.name.trim() : "";
    const { exists, source, apps } = await listAppStatuses(sessionId);
    const filtered = filterName
      ? apps.filter((a) => a.name === filterName)
      : apps;
    const output =
      filtered.length === 0
        ? exists
          ? "No matching apps in .forge/launch.json."
          : "No .forge/launch.json — scaffold from the Run tab or upsert_launch_app."
        : filtered.map(formatAppStatus).join("\n\n---\n\n");
    return {
      success: true,
      output,
      metadata: { exists, source, apps: filtered }
    };
  }
  async logs(
    sessionId: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const resolved = await resolveAppName({ sessionId, args });
    if ("error" in resolved) {
      return { success: false, output: resolved.error };
    }
    const tailRaw = args.tail;
    const tail =
      typeof tailRaw === "number" && Number.isFinite(tailRaw)
        ? Math.floor(tailRaw)
        : N_300;
    const text = await appLogs({
      sessionId,
      name: resolved.name,
      tail
    });
    return {
      success: true,
      output: text || "(no log output yet)",
      metadata: { name: resolved.name }
    };
  }
  async upsert(
    sessionId: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const parsed = parseUpsertApp(args);
    if (typeof parsed === "string") {
      return { success: false, output: parsed };
    }
    const sandbox = await resolveSandbox(sessionId);
    const before = await readFileFromSandbox({
      container: sandbox.containerName,
      absPath: `${sandbox.workingDir}/${LAUNCH_REL}`,
      sessionId
    });
    const config = await upsertLaunchApp(sessionId, parsed);
    const written = config.apps.find((a) => a.name === parsed.name) ?? parsed;
    return {
      success: true,
      output: `Updated .forge/launch.json with app "${written.name}" (cwd: ${written.cwd}).`,
      metadata: {
        app: written,
        apps: config.apps,
        files: [
          {
            path: LAUNCH_REL,
            op: before === null ? "create" : "update",
            before
          }
        ]
      }
    };
  }
}

async function startFailedResult(options: {
  sessionId: string;
  name: string;
  status: AppStatus;
}): Promise<ToolResult> {
  const logs = await appLogs({
    sessionId: options.sessionId,
    name: options.name
  }).catch(() => "");
  const logBlock = logs.trim()
    ? logs.trim()
    : "(no log output — cwd missing or process exited immediately)";
  const reason =
    options.status.startFailure === "port"
      ? `Failed to start ${options.name}. Port ${options.status.port ?? "?"} is not listening.`
      : `Failed to start ${options.name}. Process is not running.`;
  return {
    success: false,
    output: [
      reason,
      `cwd: ${options.status.cwd}`,
      `command: ${options.status.command}`,
      `logs:\n${logBlock}`,
      'If cwd is the repo folder name, upsert_launch_app with cwd ".", then preview_start again.'
    ].join("\n"),
    metadata: { app: options.status }
  };
}
