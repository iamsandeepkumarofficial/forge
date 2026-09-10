import { isHostSession } from "../projects/sandboxRuntime/resolve.js";
import { installProjectInfraDependency } from "../projects/hostInfra/install.js";
import {
  dependencyIdAliasHint,
  getProjectInfraDependency,
  hasSetupFacet,
  listProjectInfraDependencyIds
} from "../projects/hostInfra/registry.js";

async function installApprovedDependency(options: {
  dependencyId: string;
  label: string;
  version?: string;
}): Promise<{
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}> {
  try {
    const installed = await installProjectInfraDependency(
      options.dependencyId,
      {
        version: options.version || undefined
      }
    );
    const binList = Object.entries(installed.binaries)
      .map(([name, path]) => `${name} → ${path}`)
      .join("\n");
    const how = installed.reused
      ? `Reused existing install at ${installed.installRoot}.`
      : `Downloaded ${options.label} ${installed.version} into ${installed.installRoot} (folder kept intact; current → this version).`;
    const next = hasSetupFacet(installed.dependencyId)
      ? `Next: call setup_project_infra with engineId matching this dependency (mongo→mongo, postgres→postgres) and userApproved: true.`
      : `Next: re-check with get_workspace_health / \`${installed.dependencyId === "node" ? "node -v" : installed.dependencyId}\` — session PATH prefers ~/.forge/runtime/<dep>/current/bin. Do not call setup_project_infra for language runtimes.`;
    return {
      success: true,
      output: [
        `Installed project dependency \`${installed.dependencyId}\` (${options.label} ${installed.version}).`,
        how,
        next,
        "Do not use run_terminal to install host deps — the OS sandbox cannot write ~/.forge/runtime.",
        binList
      ].join("\n"),
      metadata: {
        dependencyId: installed.dependencyId,
        version: installed.version,
        reused: installed.reused,
        binDir: installed.binDir,
        installRoot: installed.installRoot,
        binaries: installed.binaries,
        needsSetup: hasSetupFacet(installed.dependencyId)
      }
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      output:
        `install_project_infra failed: ${message}\n\n` +
        "Next: explain briefly, then ask_user (mcq) for recovery (retry install, skip, or use a Cloud session).",
      metadata: {
        dependencyId: options.dependencyId,
        recoverable: true,
        needsUserAction: true,
        code: "install_failed"
      }
    };
  }
}

export async function executeInstallProjectInfra(options: {
  sessionId: string;
  args: Record<string, unknown>;
}): Promise<{
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}> {
  const dependencyIdRaw =
    typeof options.args.dependencyId === "string"
      ? options.args.dependencyId.trim().toLowerCase()
      : "";
  const userApproved = options.args.userApproved === true;
  const version =
    typeof options.args.version === "string"
      ? options.args.version.trim()
      : undefined;

  if (!userApproved) {
    return {
      success: false,
      output:
        "install_project_infra requires userApproved: true. Propose the dependency via ask_user first; only call again after they explicitly approve."
    };
  }

  if (!dependencyIdRaw) {
    return {
      success: false,
      output: `dependencyId is required. Known: ${listProjectInfraDependencyIds().join(", ")}.`
    };
  }

  const aliasHint = dependencyIdAliasHint(dependencyIdRaw);
  if (aliasHint) {
    return {
      success: false,
      output: aliasHint
    };
  }

  const dep = getProjectInfraDependency(dependencyIdRaw);
  if (!dep) {
    return {
      success: false,
      output: `Unknown dependencyId \`${dependencyIdRaw}\`. Known: ${listProjectInfraDependencyIds().join(", ")}. Add an adapter install facet to extend installers.`
    };
  }

  if (dep.hostSessionOnly && !(await isHostSession(options.sessionId))) {
    return {
      success: false,
      output:
        `${dep.label} install is for local (host) sessions only. ` +
        (hasSetupFacet(dep.id)
          ? `Cloud sessions use Docker via setup_project_infra — do not install host binaries here.`
          : `Cloud sessions need a matching sandbox image (not host install).`)
    };
  }

  return installApprovedDependency({
    dependencyId: dep.id,
    label: dep.label,
    version
  });
}
