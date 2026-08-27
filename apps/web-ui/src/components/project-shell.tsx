import {
  NavLink,
  Outlet,
  Link,
  useParams,
  useNavigate,
  useLocation
} from "react-router-dom";
import { useEffect, useState } from "react";
import {
  MessageSquare,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Settings
} from "lucide-react";
import { fetchProject } from "../lib/projects-api.js";
import { useCollapsibleSidebar } from "../hooks/use-collapsible-sidebar.js";
import { ForgeMarkLink } from "./forge-mark.js";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "chats", label: "Chats", icon: MessageSquare }
] as const;

const SIDEBAR_KEY = "forge:project-shell-collapsed";

function SidebarIconButton(options: {
  label: string;
  collapsed: boolean;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  primary?: boolean;
  children: React.ReactNode;
}) {
  const { label, collapsed, onClick, href, active, primary, children } = options;
  const className = cn(
    "inline-flex items-center rounded-lg text-sm font-medium transition-colors",
    collapsed ? "size-9 justify-center" : "w-full gap-2 px-3 py-2",
    primary
      ? active
        ? "bg-primary text-primary-foreground"
        : "bg-primary text-primary-foreground hover:opacity-90"
      : active
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
  );
  if (href) {
    return (
      <Link
        to={href}
        aria-label={label}
        title={collapsed ? label : undefined}
        className={className}
      >
        {children}
        {!collapsed && <span>{label}</span>}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={className}
    >
      {children}
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

export function ProjectShell() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { collapsed, toggle } = useCollapsibleSidebar(SIDEBAR_KEY);
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
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-border transition-[width] duration-200",
          collapsed ? "w-14" : "w-56"
        )}
      >
        <div
          className={cn(
            "border-b border-border",
            collapsed ? "flex flex-col items-center gap-2 p-2" : "space-y-2 p-4"
          )}
        >
          <ForgeMarkLink
            to="/"
            size="sm"
            showWordmark={!collapsed}
            className={cn(
              collapsed ? "size-9 justify-center" : undefined
            )}
          />
          {!collapsed && (
            <h1
              className="truncate text-base font-semibold"
              title={projectName ?? undefined}
            >
              {projectName ?? "Project"}
            </h1>
          )}
        </div>
        <div className={cn("border-b border-border", collapsed ? "p-1.5" : "p-2")}>
          <SidebarIconButton
            label="New chat"
            collapsed={collapsed}
            primary
            active={onNewChat}
            onClick={() => navigate(`/projects/${projectId}/chats?new=1`)}
          >
            <MessageSquarePlus className="size-4 shrink-0" />
          </SidebarIconButton>
        </div>
        <nav
          className={cn(
            "flex flex-1 flex-col gap-0.5",
            collapsed ? "items-center p-1.5" : "p-2"
          )}
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={`/projects/${projectId}/${item.to}`}
                end
                aria-label={item.label}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center rounded-lg text-sm transition-colors",
                    collapsed ? "size-9 justify-center" : "gap-2 px-3 py-2",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && item.label}
              </NavLink>
            );
          })}
        </nav>
        <div
          className={cn(
            "border-t border-border",
            collapsed ? "flex flex-col items-center gap-1 p-1.5" : "space-y-1 p-2"
          )}
        >
          <SidebarIconButton
            label="Settings"
            collapsed={collapsed}
            href="/settings"
          >
            <Settings className="size-4 shrink-0" />
          </SidebarIconButton>
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggle}
            className={cn(
              "inline-flex items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
              collapsed ? "size-9 justify-center" : "w-full gap-2 px-3 py-2 text-sm"
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4 shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="size-4 shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
