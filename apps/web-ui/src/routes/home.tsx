import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FolderPlus, Layers, Plus, Settings } from "lucide-react";
import { ConnectProjectDialog } from "../components/connect-project-dialog.js";
import { DashboardEmptyState } from "../components/dashboard-empty-state.js";
import { DashboardOverview } from "../components/dashboard-overview.js";
import { ForgeMark } from "../components/forge-mark.js";
import { ProjectCard } from "../components/project-card.js";
import { WorkspaceCard } from "../components/workspace-card.js";
import { useDashboardInsights } from "../hooks/use-dashboard-insights.js";
import { runnerUrl } from "../lib/tool-runner.js";
import { deleteProject } from "../lib/projects-api.js";
import {
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  type WorkspaceSummary
} from "../lib/workspaces-api.js";

type ProjectRow = {
  id: string;
  name: string;
  source: "github" | "local" | "upload";
  status: "available" | "unavailable";
  lastActivityAt?: number | string;
};

async function fetchProjectRows(): Promise<ProjectRow[]> {
  const baseUrl = runnerUrl();
  const response = await fetch(`${baseUrl}/api/projects`);
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to fetch projects:", response.status, errorText);
    throw new Error(`Failed to load projects: ${response.status}`);
  }
  const data = (await response.json()) as ProjectRow[];
  return Array.isArray(data) ? data : [];
}

export function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const loadProjects = async () => {
    setLoading(true);
    try {
      setProjects(await fetchProjectRows());
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
    try {
      const ws = await listWorkspaces();
      setWorkspaces(Array.isArray(ws) ? ws : []);
    } catch (err) {
      console.error("Failed to load workspaces:", err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchProjectRows();
        if (!cancelled) setProjects(rows);
      } catch (err) {
        console.error("Failed to load projects:", err);
      }
      try {
        const ws = await listWorkspaces();
        if (!cancelled) setWorkspaces(Array.isArray(ws) ? ws : []);
      } catch (err) {
        console.error("Failed to load workspaces:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const handleDelete = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      await loadProjects();
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  };
  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (projects.length === 0 && workspaces.length === 0) {
    return <DashboardEmptyState onConnected={() => void loadProjects()} />;
  }
  return (
    <HomeGrid
      projects={projects}
      workspaces={workspaces}
      showDialog={showDialog}
      onShowDialog={setShowDialog}
      onConnected={() => void loadProjects()}
      onOpen={(id) => void navigate(`/projects/${id}/chats`)}
      onDelete={(id) => void handleDelete(id)}
      onOpenWorkspace={(id) => void navigate(`/workspaces/${id}`)}
      onCreateWorkspace={() => {
        void (async () => {
          const name = window.prompt("Workspace name", "My workspace");
          if (!name?.trim()) return;
          try {
            const ws = await createWorkspace(name.trim());
            await loadProjects();
            navigate(`/workspaces/${ws.id}`);
          } catch (err) {
            console.error("Failed to create workspace:", err);
            alert(err instanceof Error ? err.message : String(err));
          }
        })();
      }}
      onDeleteWorkspace={(id) => {
        void (async () => {
          try {
            await deleteWorkspace(id);
            await loadProjects();
          } catch (err) {
            console.error("Failed to delete workspace:", err);
          }
        })();
      }}
    />
  );
}

function SectionIconButton(options: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const { label, onClick, children } = options;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function EmptyWorkspaceCard(options: { onCreate: () => void }) {
  return (
    <button
      type="button"
      onClick={options.onCreate}
      className="flex aspect-square flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 p-6 text-center transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <span className="inline-flex size-14 items-center justify-center rounded-2xl border border-dashed border-border bg-background text-muted-foreground">
        <Layers className="size-7" />
      </span>
      <div>
        <p className="text-sm font-medium">Create a workspace</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Group services for one feature chat
        </p>
      </div>
    </button>
  );
}

function HomeGrid(options: {
  projects: ProjectRow[];
  workspaces: WorkspaceSummary[];
  showDialog: boolean;
  onShowDialog: (v: boolean) => void;
  onConnected: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenWorkspace: (id: string) => void;
  onCreateWorkspace: () => void;
  onDeleteWorkspace: (id: string) => void;
}) {
  const {
    projects,
    workspaces,
    showDialog,
    onShowDialog,
    onConnected,
    onOpen,
    onDelete,
    onOpenWorkspace,
    onCreateWorkspace,
    onDeleteWorkspace
  } = options;
  const insights = useDashboardInsights({ projects, workspaces });
  const cardGrid =
    "grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-4";
  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <ForgeMark size="lg" />
          <Link
            to="/settings"
            aria-label="Settings"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Settings className="size-5" />
          </Link>
        </div>

        <DashboardOverview
          stats={insights.stats}
          heatmap={insights.heatmap}
          attention={insights.attention}
          loading={insights.loading}
          projectCount={projects.length}
          workspaceCount={workspaces.length}
        />

        {showDialog && (
          <ConnectProjectDialog
            onClose={() => onShowDialog(false)}
            onConnected={onConnected}
          />
        )}

        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Workspaces</h2>
            {workspaces.length > 0 && (
              <SectionIconButton label="New workspace" onClick={onCreateWorkspace}>
                <Plus className="size-4" />
              </SectionIconButton>
            )}
          </div>
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
            {workspaces.length === 0 && (
              <EmptyWorkspaceCard onCreate={onCreateWorkspace} />
            )}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Projects</h2>
            <SectionIconButton
              label="Connect project"
              onClick={() => onShowDialog(true)}
            >
              <FolderPlus className="size-4" />
            </SectionIconButton>
          </div>
          <div className={cardGrid}>
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                projectId={project.id}
                name={project.name}
                source={project.source}
                status={project.status}
                lastActivityAt={
                  project.lastActivityAt == null
                    ? undefined
                    : typeof project.lastActivityAt === "number"
                      ? project.lastActivityAt
                      : Date.parse(project.lastActivityAt)
                }
                onOpen={() => onOpen(project.id)}
                onDelete={() => onDelete(project.id)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
