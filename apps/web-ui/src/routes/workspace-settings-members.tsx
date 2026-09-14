import { Check, Folder, Loader2, Plus } from "lucide-react";
import type {
  WorkspaceDetail,
  WorkspaceMember
} from "../lib/workspaces-api.js";
import type { ProjectSummary } from "../lib/projects-api.js";
import { cn } from "@/lib/utils";
import { sourceLabel } from "./workspace-settings-helpers.js";
import { MemberCard } from "./workspace-settings-member-card.js";

function MembersList(options: {
  members: WorkspaceMember[];
  memberRepoNames: string[];
  editingDepends: string | null;
  busy: boolean;
  onEdit: (projectId: string) => void;
  onSaveDepends: (member: WorkspaceMember, deps: string[]) => void;
  onCancelEdit: () => void;
  onRemove: (projectId: string) => void;
}) {
  const o = options;
  if (o.members.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        No projects yet. Pick from available projects below.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {o.members.map((m) => (
        <MemberCard
          key={m.id}
          member={m}
          allRepoNames={o.memberRepoNames}
          editing={o.editingDepends === m.projectId}
          busy={o.busy}
          onEdit={() => o.onEdit(m.projectId)}
          onSaveDepends={(deps) => o.onSaveDepends(m, deps)}
          onCancelEdit={o.onCancelEdit}
          onRemove={() => o.onRemove(m.projectId)}
        />
      ))}
    </ul>
  );
}

function AddProjectsPanel(options: {
  available: ProjectSummary[];
  selectedIds: Set<string>;
  busy: boolean;
  onToggle: (id: string) => void;
  onAdd: () => void;
}) {
  const { available, selectedIds, busy, onToggle, onAdd } = options;
  if (available.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Add projects</p>
        <button
          type="button"
          disabled={busy || selectedIds.size === 0}
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
          Add selected
          {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {available.map((p) => {
          const selected = selectedIds.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(p.id)}
              className={cn(
                "flex items-start gap-3 rounded-xl px-3 py-3 text-left shadow-sm transition-colors",
                selected
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted/40 hover:bg-muted/70"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background"
                )}
              >
                {selected ? <Check className="size-3" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{p.name}</span>
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {sourceLabel(p.source)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WorkspaceMembersSection(options: {
  workspace: WorkspaceDetail;
  available: ProjectSummary[];
  selectedIds: Set<string>;
  membersError: string | null;
  editingDepends: string | null;
  busy: boolean;
  onToggleSelected: (id: string) => void;
  onAddSelected: () => void;
  onEditDepends: (projectId: string) => void;
  onSaveDepends: (member: WorkspaceMember, deps: string[]) => void;
  onCancelEdit: () => void;
  onRemoveMember: (projectId: string) => void;
}) {
  const o = options;
  const memberRepoNames = o.workspace.members.map((m) => m.repoName);
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Projects in this workspace</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Member projects mount together when you open a workspace chat.
        </p>
      </div>
      {o.membersError ? (
        <p className="text-sm text-destructive">{o.membersError}</p>
      ) : null}
      <MembersList
        members={o.workspace.members}
        memberRepoNames={memberRepoNames}
        editingDepends={o.editingDepends}
        busy={o.busy}
        onEdit={o.onEditDepends}
        onSaveDepends={o.onSaveDepends}
        onCancelEdit={o.onCancelEdit}
        onRemove={o.onRemoveMember}
      />
      <AddProjectsPanel
        available={o.available}
        selectedIds={o.selectedIds}
        busy={o.busy}
        onToggle={o.onToggleSelected}
        onAdd={o.onAddSelected}
      />
      {o.available.length === 0 && o.workspace.members.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          All connected projects are already in this workspace.
        </p>
      ) : null}
    </section>
  );
}
