import {
  NavLink,
  Outlet,
  Link,
  useParams,
  useNavigate,
  useLocation
} from "react-router-dom";
import { useEffect, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { fetchProject } from "../lib/projects-api.js";
import { cn } from "@/lib/utils";

const NAV = [{ to: "chats", label: "Chats" }] as const;

export function ProjectShell() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [projectName, setProjectName] = useState<string | null>(null);
  useEffect(() => {
    if (!projectId) return;
    void fetchProject(projectId)
      .then((p) => setProjectName(typeof p?.name === "string" ? p.name : null))
      .catch(() => setProjectName(null));
  }, [projectId]);
  if (!projectId) {
    return <div className="p-8 text-muted-foreground">Missing workspace</div>;
  }
  const onNewChat =
    location.pathname.endsWith(`/projects/${projectId}/chats`) &&
    new URLSearchParams(location.search).get("new") === "1";
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border">
        <div className="space-y-2 border-b border-border p-4">
          <Link
            to="/"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            ← Workspaces
          </Link>
          <h1
            className="truncate text-base font-semibold"
            title={projectName ?? undefined}
          >
            {projectName ?? "Workspace"}
          </h1>
        </div>
        <div className="border-b border-border p-2">
          <button
            type="button"
            onClick={() => navigate(`/projects/${projectId}/chats?new=1`)}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              onNewChat
                ? "bg-primary text-primary-foreground"
                : "bg-foreground text-background hover:opacity-90"
            )}
          >
            <MessageSquarePlus className="size-4" />
            New chat
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={`/projects/${projectId}/${item.to}`}
              end
              className={({ isActive }) =>
                cn(
                  "rounded px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-2">
          <Link
            to="/settings"
            className="block rounded px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Settings
          </Link>
        </div>
      </aside>
      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
