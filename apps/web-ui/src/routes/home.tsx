import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ConnectProjectDialog } from "../components/connect-project-dialog.js";
import { DashboardEmptyState } from "../components/dashboard-empty-state.js";
import { ProjectCard } from "../components/project-card.js";
import { runnerUrl } from "../lib/tool-runner.js";
import { deleteProject } from "../lib/projects-api.js";

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
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const loadProjects = async () => {
    setLoading(true);
    try {
      setProjects(await fetchProjectRows());
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let cancelled = false;
    void fetchProjectRows()
      .then((rows) => {
        if (!cancelled) setProjects(rows);
      })
      .catch((err) => console.error("Failed to load projects:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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
  if (projects.length === 0) {
    return <DashboardEmptyState onConnected={() => void loadProjects()} />;
  }
  return (
    <WorkspaceGrid
      projects={projects}
      showDialog={showDialog}
      onShowDialog={setShowDialog}
      onConnected={() => void loadProjects()}
      onOpen={(id) => void navigate(`/projects/${id}/chats`)}
      onDelete={(id) => void handleDelete(id)}
    />
  );
}

function WorkspaceGrid(options: {
  projects: ProjectRow[];
  showDialog: boolean;
  onShowDialog: (v: boolean) => void;
  onConnected: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { projects, showDialog, onShowDialog, onConnected, onOpen, onDelete } =
    options;
  return (
    <div className="min-h-screen p-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="truncate text-3xl font-bold">Forge</h1>
          <span className="text-sm text-muted-foreground">Workspaces</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/settings"
            className="rounded px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Settings
          </Link>
          <button
            type="button"
            onClick={() => onShowDialog(true)}
            className="rounded bg-primary px-4 py-2 text-primary-foreground"
          >
            Connect workspace
          </button>
        </div>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Select a local folder (native picker in the desktop app, or absolute
        path in the browser) or connect a GitHub repository.
      </p>
      {showDialog && (
        <ConnectProjectDialog
          onClose={() => onShowDialog(false)}
          onConnected={onConnected}
        />
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}
