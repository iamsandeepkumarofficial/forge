import { NavLink, Outlet, Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings
} from "lucide-react";
import { useCollapsibleSidebar } from "../hooks/use-collapsible-sidebar.js";
import { ForgeMarkLink } from "./forge-mark.js";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "chats", label: "Chats", icon: MessageSquare },
  { to: "settings", label: "Settings", icon: Settings }
] as const;

const SIDEBAR_KEY = "forge:workspace-shell-collapsed";

export function WorkspaceShell() {
  const { workspaceId } = useParams();
  const { collapsed, toggle } = useCollapsibleSidebar(SIDEBAR_KEY);
  if (!workspaceId) {
    return <div className="p-8 text-muted-foreground">Missing workspace</div>;
  }
  return (
    <div className="flex h-svh overflow-hidden bg-background text-foreground">
      <aside
        className={cn(
          "flex h-full shrink-0 flex-col bg-sidebar text-sidebar-foreground shadow-md transition-[width] duration-200",
          collapsed ? "w-14" : "w-56"
        )}
      >
        <div
          className={cn(
            collapsed ? "flex flex-col items-center gap-2 p-2" : "px-3 py-4"
          )}
        >
          <ForgeMarkLink
            to="/"
            size="sm"
            showWordmark={!collapsed}
            className={cn(collapsed ? "size-9 justify-center" : undefined)}
          />
        </div>

        <nav
          className={cn(
            "flex flex-1 flex-col gap-0.5",
            collapsed ? "items-center px-1.5 pb-2" : "px-3 pb-2"
          )}
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={`/workspaces/${workspaceId}/${item.to}`}
                end
                aria-label={item.label}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center rounded-lg text-sm font-medium transition-colors",
                    collapsed
                      ? "size-9 justify-center"
                      : "w-full gap-2 px-3 py-2",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        isActive && "text-primary"
                      )}
                    />
                    {!collapsed && item.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div
          className={cn(
            "mt-auto space-y-1",
            collapsed
              ? "flex flex-col items-center px-1.5 pb-2"
              : "px-3 pb-3"
          )}
        >
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggle}
            className={cn(
              "inline-flex items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
              collapsed
                ? "size-9 justify-center"
                : "w-full gap-2 px-3 py-2 text-sm"
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
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center px-6 py-3">
          <Link
            to="/"
            aria-label="Back to home"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4 shrink-0" />
            Home
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
