import { useState } from "react";
import type { WorkspaceMember } from "../lib/workspaces-api.js";
import { sourceLabel } from "./workspace-settings-helpers.js";

export function MemberCardHeader(options: {
  member: WorkspaceMember;
  editing: boolean;
  busy: boolean;
  showDepends: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { member, editing, busy, showDepends, onEdit, onRemove } = options;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate font-medium">{member.project.name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-md bg-background px-1.5 py-0.5 shadow-sm">
            {sourceLabel(member.project.source)}
          </span>
          <span className="font-mono">{member.repoName}</span>
          {!editing && member.dependsOn.length > 0 ? (
            <span>
              depends on{" "}
              {member.dependsOn.map((d) => (
                <span
                  key={d}
                  className="mr-1 inline-block rounded-md bg-background px-1.5 py-0.5 font-mono shadow-sm"
                >
                  {d}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {showDepends ? (
          <button
            type="button"
            disabled={busy}
            onClick={onEdit}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {editing ? "Close" : "Depends on"}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={onRemove}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export function useMemberDependsDraft(options: {
  editing: boolean;
  dependsOn: string[];
}) {
  const { editing, dependsOn } = options;
  const [draft, setDraft] = useState<Set<string>>(() => new Set(dependsOn));
  const editToken = editing ? `1:${dependsOn.join(",")}` : "0";
  const [editSync, setEditSync] = useState(editToken);
  if (editSync !== editToken) {
    setEditSync(editToken);
    if (editing) setDraft(new Set(dependsOn));
  }
  const toggleDep = (name: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };
  return { draft, toggleDep };
}
