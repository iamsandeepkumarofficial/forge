import { cn } from "@/lib/utils";
import type { WorkspaceHealthFinding } from "../lib/workspaces-api.js";

const HEALTH_FINDINGS_LIMIT = 12;

export function WorkspaceHealthSection(options: {
  healthStatus: string | null;
  healthFindings: WorkspaceHealthFinding[];
  setupCtaMode: "analyze" | "fix";
  setupDrawer: "analyze" | "fix" | null;
  setupDrawerOpen: boolean;
  membersEmpty: boolean;
  onSetup: () => void;
}) {
  const o = options;
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Workspace health</h3>
          <p className="text-sm text-muted-foreground">
            Setup chat lists blockers as tasks then fixes them one by one
            (ask_user widgets for env/infra). While health is computing the CTA
            stays Fix so the agent waits on shadows and continues.
          </p>
        </div>
        <button
          type="button"
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50",
            o.setupCtaMode === "fix"
              ? "bg-accent text-accent-foreground hover:opacity-90"
              : "border hover:bg-muted"
          )}
          disabled={o.setupDrawerOpen || o.membersEmpty}
          onClick={o.onSetup}
        >
          {o.setupDrawerOpen
            ? o.setupDrawer === "fix"
              ? "Fixing…"
              : "Analyzing…"
            : o.setupCtaMode === "fix"
              ? "Fix"
              : "Analyze"}
        </button>
      </div>
      {o.healthStatus ? (
        <p className="text-sm">
          Status:{" "}
          <span
            className={cn(
              "font-medium",
              o.healthStatus === "ready" && "text-green-600",
              o.healthStatus === "blocked" && "text-destructive",
              o.healthStatus === "warnings" && "text-amber-600",
              o.healthStatus === "computing" && "text-muted-foreground"
            )}
          >
            {o.healthStatus}
          </span>
        </p>
      ) : null}
      {o.healthFindings.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {o.healthFindings.slice(0, HEALTH_FINDINGS_LIMIT).map((f, i) => (
            <li key={`${f.code}-${i}`} className="text-muted-foreground">
              <span className="font-medium text-foreground">
                [{f.severity}]{f.repo ? ` ${f.repo}:` : ""}
              </span>{" "}
              {f.message}
              {f.hint ? ` — ${f.hint}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No issues reported yet. Add projects or run Analyze.
        </p>
      )}
    </section>
  );
}
