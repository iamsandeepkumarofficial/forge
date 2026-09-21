import { ActivityDialog } from "../components/activity-dialog.js";
import { CreateWorkspaceDialog } from "../components/create-workspace-dialog.js";
import { DashboardEmptyState } from "../components/dashboard-empty-state.js";
import {
  deleteWorkspace,
  type WorkspaceSummary
} from "../lib/workspaces-api.js";

type HomeGridProps = {
  workspaces: WorkspaceSummary[];
  showDialog: boolean;
  onShowDialog: (v: boolean) => void;
  onConnected: (workspaceId: string) => void;
  onOpenWorkspace: (id: string) => void;
  onCreateWorkspace: () => void;
  onDeleteWorkspace: (id: string) => void;
  onShowActivity: () => void;
};

export function HomeLoaded(options: {
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
  const openWorkspace = (workspaceId: string) => {
    onReload();
    onNavigate(`/workspaces/${workspaceId}`);
  };
  if (workspaces.length === 0) {
    return (
      <>
        <DashboardEmptyState
          onConnected={openWorkspace}
          onShowActivity={() => onShowActivity(true)}
        />
        {activityOverlay}
      </>
    );
  }
  return (
    <>
      <HomeGrid
        workspaces={workspaces}
        showDialog={showDialog}
        onShowDialog={onShowDialog}
        onConnected={openWorkspace}
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
