import { useParams } from "react-router-dom";
import { useWorkspace } from "../hooks/use-workspace.js";
import { WorkspaceSetupDrawer } from "./workspace-setup-drawer.js";
import { ParameterStorePanel } from "./workspace-settings-parameters.js";
import { DatabasesPanel } from "./workspace-settings-databases.js";
import { EnvironmentPanel } from "./workspace-settings-environment.js";
import { WorkspaceOverviewPanel } from "./workspace-settings-overview.js";
import { useWorkspaceSettings } from "./use-workspace-settings.js";
import {
  WorkspaceSettingsError,
  WorkspaceSettingsLoading,
  WorkspaceSettingsTabNav
} from "./workspace-settings-shell.js";
import type { WorkspaceDetail } from "../lib/workspaces-api.js";
import type { ProjectSummary } from "../lib/projects-api.js";

type SettingsState = ReturnType<typeof useWorkspaceSettings>;

function WorkspaceSettingsPanels(options: {
  workspaceId: string;
  workspace: WorkspaceDetail;
  projects: ProjectSummary[];
  s: SettingsState;
  busy: boolean;
}) {
  const { workspaceId, workspace, projects, s, busy } = options;
  const fallbackTarget = workspace.members[0]?.repoName ?? "";

  if (s.tab === "parameters") {
    return <ParameterStorePanel workspaceId={workspaceId} />;
  }
  if (s.tab === "databases") {
    return (
      <DatabasesPanel
        workspaceId={workspaceId}
        onSetupCta={() => s.setSetupDrawer(s.setupCtaMode)}
        setupBusy={s.setupDrawerOpen}
        setupCtaLabel={s.setupCtaMode === "fix" ? "Fix" : "Analyze"}
      />
    );
  }
  if (s.tab === "environment") {
    return <EnvironmentPanel workspaceId={workspaceId} />;
  }
  if (s.tab === "overview") {
    return (
      <WorkspaceOverviewPanel
        workspace={workspace}
        projects={projects}
        busy={busy}
        healthStatus={s.healthStatus}
        healthFindings={s.healthFindings}
        setupCtaMode={s.setupCtaMode}
        setupDrawer={s.setupDrawer}
        setupDrawerOpen={s.setupDrawerOpen}
        onSetup={() => s.setSetupDrawer(s.setupCtaMode)}
        membersError={s.membersError}
        editingDepends={s.editingDepends}
        selectedIds={s.selectedIds}
        available={s.available}
        routeRows={s.routeRows}
        routesDirty={s.routesDirty}
        routesError={s.routesError}
        suggestedRoutes={s.suggestedRoutes}
        onToggleSelected={s.toggleSelected}
        onAddSelected={s.onAddSelected}
        onEditDepends={(id) =>
          s.setEditingDepends(s.editingDepends === id ? null : id)
        }
        onSaveDepends={s.onSaveDepends}
        onCancelEdit={() => s.setEditingDepends(null)}
        onRemoveMember={s.onRemoveMember}
        onApplySuggested={s.applySuggestedRoutes}
        onUpdateRow={s.updateRow}
        onRemoveRow={s.removeRoute}
        onAddRoute={() => s.addRoute(fallbackTarget)}
        onSaveRoutes={s.onSaveRoutes}
        onDelete={s.onDelete}
      />
    );
  }
  return null;
}

export function WorkspaceSettingsView() {
  const { workspaceId = "" } = useParams();
  const ws = useWorkspace(workspaceId);
  const s = useWorkspaceSettings({
    workspaceId,
    workspace: ws.workspace,
    projects: ws.projects,
    busy: ws.busy,
    setBusy: ws.setBusy,
    setError: ws.setError,
    setWorkspace: ws.setWorkspace
  });

  if (ws.error && !ws.workspace) {
    return <WorkspaceSettingsError message={ws.error} />;
  }
  if (!ws.workspace) {
    return <WorkspaceSettingsLoading />;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 p-6 pb-16">
      <header>
        <h2 className="text-2xl font-semibold">{ws.workspace.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Projects forged into one session — shared chat, sandbox, and network
          plane.
        </p>
      </header>
      <WorkspaceSettingsTabNav tab={s.tab} onTab={s.setTab} />
      <WorkspaceSettingsPanels
        workspaceId={workspaceId}
        workspace={ws.workspace}
        projects={ws.projects}
        s={s}
        busy={ws.busy}
      />
      {s.setupDrawer ? (
        <WorkspaceSetupDrawer
          workspaceId={workspaceId}
          mode={s.setupDrawer}
          open
          onClose={() => s.setSetupDrawer(null)}
          onHealthUpdated={(status, findings) => {
            s.setHealthStatus(status);
            s.setHealthFindings(findings);
          }}
        />
      ) : null}
    </div>
  );
}
