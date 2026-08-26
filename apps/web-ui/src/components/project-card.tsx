import { useState } from "react";
import { fetchProject } from "../lib/projects-api.js";

interface ProjectCardProps {
  projectId: string;
  name: string;
  source: "github" | "local" | "upload";
  status: "available" | "unavailable";
  lastActivityAt?: number;
  onOpen: () => void;
  onDelete: () => void;
}

function sourceLabel(source: "github" | "local" | "upload"): string {
  if (source === "github") return "GitHub";
  if (source === "local") return "Local";
  return "Upload";
}

function ProjectCardBody(options: {
  name: string;
  source: "github" | "local" | "upload";
  status: "available" | "unavailable";
  lastActivityAt?: number;
  error: string | null;
  loading: boolean;
  onRefreshClick: (e: React.MouseEvent) => void;
  onDeleteClick: (e: React.MouseEvent) => void;
}) {
  const {
    name,
    source,
    status,
    lastActivityAt,
    error,
    loading,
    onRefreshClick,
    onDeleteClick
  } = options;
  const sourceIcon = source === "github" ? "🔗" : "📁";
  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{name}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {sourceIcon} {sourceLabel(source)}
          </p>
          {lastActivityAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Last active: {new Date(lastActivityAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <span
          className={`px-2 py-1 rounded text-xs ${status === "available" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : "bg-destructive/15 text-destructive"}`}
        >
          {status === "available" ? "Available" : "Unavailable"}
        </span>
      </div>
      {error && <p className="text-destructive text-sm mt-2">{error}</p>}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={onRefreshClick}
          disabled={loading}
          className="text-sm text-primary hover:underline disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
        <button
          onClick={onDeleteClick}
          className="text-sm text-destructive hover:underline"
        >
          Delete
        </button>
      </div>
    </>
  );
}

export function ProjectCard({
  projectId,
  name,
  source,
  status,
  lastActivityAt,
  onOpen,
  onDelete
}: ProjectCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchProject(projectId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
      className="border rounded-lg p-4 bg-background cursor-pointer hover:shadow-md transition-shadow"
    >
      <ProjectCardBody
        name={name}
        source={source}
        status={status}
        lastActivityAt={lastActivityAt}
        error={error}
        loading={loading}
        onRefreshClick={(e) => {
          e.stopPropagation();
          void handleRefresh();
        }}
        onDeleteClick={(e) => {
          e.stopPropagation();
          if (
            window.confirm(
              `Disconnect project "${name}"? This cannot be undone.`
            )
          ) {
            onDelete();
          }
        }}
      />
    </div>
  );
}
