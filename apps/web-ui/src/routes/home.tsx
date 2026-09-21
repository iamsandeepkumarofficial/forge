import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, FolderPlus, Layers, Settings } from "lucide-react";
import { ConnectProjectDialog } from "../components/connect-project-dialog.js";
import { DashboardOverview } from "../components/dashboard-overview.js";
import { ForgeMark } from "../components/forge-mark.js";
import { WorkspaceCard } from "../components/workspace-card.js";
import { useDashboardInsights } from "../hooks/use-dashboard-insights.js";
import {
  listWorkspaces,
  type WorkspaceSummary
} from "../lib/workspaces-api.js";
import { HomeLoaded } from "./home-loaded.js";

async function loadHomeWorkspaces(): Promise<WorkspaceSummary[]> {
  try {
    const ws = await listWorkspaces();
    return Array.isArray(ws) ? ws : [];
  } catch (err) {
    console.error("Failed to load workspaces:", err);
    return [];
  }
}

export function Home() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showWorkspaceDialog, setShowWorkspaceDialog] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const reload = async () => {
    setLoading(true);
    setWorkspaces(await loadHomeWorkspaces());
    setLoading(false);
  };
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await loadHomeWorkspaces();
      if (!cancelled) {
        setWorkspaces(rows);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  if (loading) return <div className="p-8 text-center">Loading...</div>;
  return (
    <HomeLoaded
      workspaces={workspaces}
      showDialog={showDialog}
      showWorkspaceDialog={showWorkspaceDialog}
      showActivity={showActivity}
      onShowDialog={setShowDialog}
      onShowWorkspaceDialog={setShowWorkspaceDialog}
      onShowActivity={setShowActivity}
      onReload={() => void reload()}
      onNavigate={(path) => void navigate(path)}
      HomeGrid={HomeGrid}
    />
  );
}

function CreateCard(options: {
  label: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const { label, title, subtitle, onClick, children } = options;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="group relative flex aspect-square w-full flex-col rounded-xl border border-dashed bg-muted/20 p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <div className="flex h-full flex-col">
        <div className="mb-3 text-muted-foreground transition-colors group-hover:text-primary">
          {children}
        </div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </button>
  );
}

function HomeWorkspacesSection(options: {
  workspaces: WorkspaceSummary[];
  cardGrid: string;
  onOpenWorkspace: (id: string) => void;
  onDeleteWorkspace: (id: string) => void;
  onCreateWorkspace: () => void;
  onConnectProject: () => void;
}) {
  const {
    workspaces,
    cardGrid,
    onOpenWorkspace,
    onDeleteWorkspace,
    onCreateWorkspace,
    onConnectProject
  } = options;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Workspaces
      </h2>
      <div className={cardGrid}>
        {workspaces.map((ws) => (
          <WorkspaceCard
            key={ws.id}
            name={ws.name}
            routeCount={ws.routes?.length ?? 0}
            onOpen={() => onOpenWorkspace(ws.id)}
            onDelete={() => onDeleteWorkspace(ws.id)}
          />
        ))}
        <CreateCard
          label="Connect a project"
          title="Connect project"
          subtitle="Local folder or GitHub — opens as a workspace"
          onClick={onConnectProject}
        >
          <FolderPlus className="size-7" />
        </CreateCard>
        <CreateCard
          label="Create a workspace"
          title="Empty workspace"
          subtitle="Add repos later in settings"
          onClick={onCreateWorkspace}
        >
          <Layers className="size-7" />
        </CreateCard>
      </div>
    </section>
  );
}

function HomeHeaderActions(options: { onShowActivity: () => void }) {
  const { onShowActivity } = options;
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Activity"
        onClick={onShowActivity}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Activity className="size-5" />
      </button>
      <Link
        to="/settings"
        aria-label="Settings"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Settings className="size-5" />
      </Link>
    </div>
  );
}

function HomeGrid(options: {
  workspaces: WorkspaceSummary[];
  showDialog: boolean;
  onShowDialog: (v: boolean) => void;
  onConnected: (workspaceId: string) => void;
  onOpenWorkspace: (id: string) => void;
  onCreateWorkspace: () => void;
  onDeleteWorkspace: (id: string) => void;
  onShowActivity: () => void;
}) {
  const {
    workspaces,
    showDialog,
    onShowDialog,
    onConnected,
    onOpenWorkspace,
    onCreateWorkspace,
    onDeleteWorkspace,
    onShowActivity
  } = options;
  const insights = useDashboardInsights({ projects: [], workspaces });
  const cardGrid =
    "grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-4";
  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <ForgeMark size="lg" />
          <HomeHeaderActions onShowActivity={onShowActivity} />
        </div>
        <DashboardOverview
          stats={insights.stats}
          heatmap={insights.heatmap}
          attention={insights.attention}
          loading={insights.loading}
          projectCount={0}
          workspaceCount={workspaces.length}
        />
        {showDialog && (
          <ConnectProjectDialog
            onClose={() => onShowDialog(false)}
            onConnected={onConnected}
          />
        )}
        <HomeWorkspacesSection
          workspaces={workspaces}
          cardGrid={cardGrid}
          onOpenWorkspace={onOpenWorkspace}
          onDeleteWorkspace={onDeleteWorkspace}
          onCreateWorkspace={onCreateWorkspace}
          onConnectProject={() => onShowDialog(true)}
        />
      </div>
    </div>
  );
}
