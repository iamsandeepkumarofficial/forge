import type {
  WorkspaceDetail,
  WorkspaceHealthFinding,
  WorkspaceMember,
  WorkspaceRoute
} from "../lib/workspaces-api.js";
import type { ProjectSummary } from "../lib/projects-api.js";
import { WorkspaceHealthSection } from "./workspace-settings-health.js";
import { WorkspaceMembersSection } from "./workspace-settings-members.js";
import { WorkspaceRoutesSection } from "./workspace-settings-routes.js";
import { WorkspaceDangerSection } from "./workspace-settings-danger.js";
import type { RouteRow } from "./workspace-settings-helpers.js";

export function WorkspaceOverviewPanel(options: {
  workspace: WorkspaceDetail;
  projects: ProjectSummary[];
  busy: boolean;
  healthStatus: string | null;
  healthFindings: WorkspaceHealthFinding[];
  setupCtaMode: "analyze" | "fix";
  setupDrawer: "analyze" | "fix" | null;
  setupDrawerOpen: boolean;
  onSetup: () => void;
  membersError: string | null;
  editingDepends: string | null;
  selectedIds: Set<string>;
  available: ProjectSummary[];
  routeRows: RouteRow[];
  routesDirty: boolean;
  routesError: string | null;
  suggestedRoutes: WorkspaceRoute[];
  onToggleSelected: (id: string) => void;
  onAddSelected: () => void;
  onEditDepends: (projectId: string) => void;
  onSaveDepends: (member: WorkspaceMember, deps: string[]) => void;
  onCancelEdit: () => void;
  onRemoveMember: (projectId: string) => void;
  onApplySuggested: () => void;
  onUpdateRow: (key: string, patch: Partial<RouteRow>) => void;
  onRemoveRow: (key: string) => void;
  onAddRoute: () => void;
  onSaveRoutes: () => void;
  onDelete: () => void;
}) {
  const o = options;
  const memberRepoNames = o.workspace.members.map((m) => m.repoName);
  return (
    <>
      <WorkspaceHealthSection
        healthStatus={o.healthStatus}
        healthFindings={o.healthFindings}
        setupCtaMode={o.setupCtaMode}
        setupDrawer={o.setupDrawer}
        setupDrawerOpen={o.setupDrawerOpen}
        membersEmpty={o.workspace.members.length === 0}
        onSetup={o.onSetup}
      />
      <WorkspaceMembersSection
        workspace={o.workspace}
        available={o.available}
        selectedIds={o.selectedIds}
        membersError={o.membersError}
        editingDepends={o.editingDepends}
        busy={o.busy}
        onToggleSelected={o.onToggleSelected}
        onAddSelected={o.onAddSelected}
        onEditDepends={o.onEditDepends}
        onSaveDepends={o.onSaveDepends}
        onCancelEdit={o.onCancelEdit}
        onRemoveMember={o.onRemoveMember}
      />
      <WorkspaceRoutesSection
        routeRows={o.routeRows}
        routesDirty={o.routesDirty}
        routesError={o.routesError}
        suggestedRoutes={o.suggestedRoutes}
        memberRepoNames={memberRepoNames}
        membersEmpty={o.workspace.members.length === 0}
        busy={o.busy}
        onApplySuggested={o.onApplySuggested}
        onUpdateRow={o.onUpdateRow}
        onRemoveRow={o.onRemoveRow}
        onAddRoute={o.onAddRoute}
        onSaveRoutes={o.onSaveRoutes}
      />
      <WorkspaceDangerSection busy={o.busy} onDelete={o.onDelete} />
    </>
  );
}
