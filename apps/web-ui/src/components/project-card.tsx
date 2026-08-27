import { useState } from "react";
import { Folder, MoreVertical, RefreshCw, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
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

function ProjectCardMenu(options: {
  name: string;
  loading: boolean;
  onRefresh: () => void;
  onDelete: () => void;
}) {
  const { name, loading, onRefresh, onDelete } = options;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${name}`}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground outline-none"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          disabled={loading}
          onClick={(e) => {
            e.stopPropagation();
            onRefresh();
          }}
        >
          <RefreshCw className="size-4" />
          {loading ? "Refreshing…" : "Refresh"}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation();
            if (
              window.confirm(
                `Disconnect project "${name}"? This cannot be undone.`
              )
            ) {
              onDelete();
            }
          }}
        >
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function projectInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
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
      aria-label={`Open project ${name}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
      className="group relative aspect-square cursor-pointer rounded-xl border bg-background p-4 transition-shadow hover:shadow-md"
    >
      <div className="absolute right-2 top-2">
        <ProjectCardMenu
          name={name}
          loading={loading}
          onRefresh={() => void handleRefresh()}
          onDelete={onDelete}
        />
      </div>
      <div className="flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center">
          <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-lg font-semibold text-muted-foreground">
            {source === "local" ? (
              <Folder className="size-7" />
            ) : (
              projectInitial(name)
            )}
          </div>
        </div>
        <div>
          <h3 className="line-clamp-2 font-semibold leading-snug">{name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {sourceLabel(source)}
          </p>
          {status === "unavailable" && (
            <p className="mt-1 text-xs text-destructive">Unavailable</p>
          )}
          {lastActivityAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Active {new Date(lastActivityAt).toLocaleDateString()}
            </p>
          )}
          {error && (
            <p className="mt-1 line-clamp-2 text-xs text-destructive">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
