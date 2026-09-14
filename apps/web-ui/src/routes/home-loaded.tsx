import { ActivityDialog } from "../components/activity-dialog.js";
import { CreateWorkspaceDialog } from "../components/create-workspace-dialog.js";
import { DashboardEmptyState } from "../components/dashboard-empty-state.js";
import { deleteProject } from "../lib/projects-api.js";
import {
  deleteWorkspace,
  type WorkspaceSummary
} from "../lib/workspaces-api.js";

export type HomeProjectRow = {
  id: string;
  name: string;
  source: "github" | "local" | "upload";
  status: "available" | "unavailable";
  lastActivityAt?: number | string;
};

type HomeGridProps = {
  projects: HomeProjectRow[];
  workspaces: WorkspaceSummary[];
  showDialog: boolean;
  onShowDialog: (v: boolean) => void;
  onConnected: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenWorkspace: (id: string) => void;
  onCreateWorkspace: () => void;
  onDeleteWorkspace: (id: string) => void;
  onShowActivity: () => void;
};

export function HomeLoaded(options: {
  projects: HomeProjectRow[];
  workspaces: WorkspaceSummary[];
  showDialog: boolean;
  showWorkspaceDialog: boolean;
  showActivity: boolean;
  onShowDialog: (v: boolean) => void;
  onShowWorkspaceDialog: (v: boolean) => void;
  onShowActivity: (v: boolean) => void;
  onReload: () => void;
  onNavigate: (path: string) => void;
  HomeGrid: (props: HomeGridProps) => React.ReactNode;
}) {
  const {
    projects,
    workspaces,
    showDialog,
    showWorkspaceDialog,
    showActivity,
    onShowDialog,
    onShowWorkspaceDialog,
    onShowActivity,
    onReload,
    onNavigate,
    HomeGrid
  } = options;
  const activityOverlay = showActivity ? (
    <ActivityDialog onClose={() => onShowActivity(false)} />
  ) : null;
  if (projects.length === 0 && workspaces.length === 0) {
    return (
      <>
        <DashboardEmptyState
          onConnected={onReload}
          onShowActivity={() => onShowActivity(true)}
        />
        {activityOverlay}
      </>
    );
  }
  return (
    <>
      <HomeGrid
        projects={projects}
        workspaces={workspaces}
        showDialog={showDialog}
        onShowDialog={onShowDialog}
        onConnected={onReload}
        onOpen={(id) => onNavigate(`/projects/${id}/chats`)}
        onDelete={(id) => void deleteHomeProject(id, onReload)}
        onOpenWorkspace={(id) => onNavigate(`/workspaces/${id}`)}
        onCreateWorkspace={() => onShowWorkspaceDialog(true)}
        onShowActivity={() => onShowActivity(true)}
        onDeleteWorkspace={(id) => void deleteHomeWorkspace(id, onReload)}
      />
      {activityOverlay}
      {showWorkspaceDialog && (
        <CreateWorkspaceDialog
          onClose={() => onShowWorkspaceDialog(false)}
          onCreated={(ws) => {
            onShowWorkspaceDialog(false);
            onReload();
            onNavigate(`/workspaces/${ws.id}`);
          }}
        />
      )}
    </>
  );
}

async function deleteHomeProject(
  projectId: string,
  onReload: () => void
): Promise<void> {
  try {
    await deleteProject(projectId);
    onReload();
  } catch (err) {
    console.error("Failed to delete project:", err);
  }
}

async function deleteHomeWorkspace(
  id: string,
  onReload: () => void
): Promise<void> {
  try {
    await deleteWorkspace(id);
    onReload();
  } catch (err) {
    console.error("Failed to delete workspace:", err);
  }
}
