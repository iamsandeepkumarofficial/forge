import {
  APP_DB_ENGINES,
  getAppDbEngine
} from "../projects/appDb/engines.js";
import {
  DEFAULT_SANDBOX_IMAGE,
  GENERIC_SANDBOX_IMAGE
} from "../projects/sessionSandbox/constants.js";

/** Lookup allowlisted Docker images for app DBs and sandboxes (proposal helper). */
export async function executeDockerImageLookup(options: {
  args: Record<string, unknown>;
}): Promise<{ success: boolean; output: string; metadata?: Record<string, unknown> }> {
  const query =
    typeof options.args.query === "string"
      ? options.args.query.trim().toLowerCase()
      : "";
  const engineId =
    typeof options.args.engineId === "string"
      ? options.args.engineId.trim().toLowerCase()
      : "";

  if (engineId) {
    const engine = getAppDbEngine(engineId);
    if (!engine) {
      return {
        success: false,
        output: `Unknown engineId \`${engineId}\`. Allowed: ${APP_DB_ENGINES.map((e) => e.id).join(", ")}.`
      };
    }
    return {
      success: true,
      output: [
        `${engine.label}`,
        `image: ${engine.image}`,
        `envKey: ${engine.envKey}`,
        `networkAlias: ${engine.networkAlias}`,
        `hostPort: ${engine.hostPort}`
      ].join("\n"),
      metadata: {
        engineId: engine.id,
        image: engine.image,
        envKey: engine.envKey
      }
    };
  }

  const rows: Array<{ kind: string; id: string; image: string; note: string }> =
    [
      {
        kind: "sandbox",
        id: "node",
        image: DEFAULT_SANDBOX_IMAGE,
        note: "Node 20 + Playwright — use when any member has Node ecosystem evidence"
      },
      {
        kind: "sandbox",
        id: "generic",
        image: GENERIC_SANDBOX_IMAGE,
        note: "Minimal Debian — agent/skills install language toolchains after user approval"
      },
      ...APP_DB_ENGINES.map((e) => ({
        kind: "app-db",
        id: e.id,
        image: e.image,
        note: `${e.label}; injects ${e.envKey}`
      }))
    ];

  const filtered = query
    ? rows.filter(
        (r) =>
          r.id.includes(query) ||
          r.image.toLowerCase().includes(query) ||
          r.note.toLowerCase().includes(query) ||
          r.kind.includes(query)
      )
    : rows;

  if (filtered.length === 0) {
    return {
      success: false,
      output: `No images matched query \`${query}\`.`
    };
  }

  return {
    success: true,
    output: filtered
      .map((r) => `- [${r.kind}/${r.id}] \`${r.image}\` — ${r.note}`)
      .join("\n"),
    metadata: { images: filtered }
  };
}
