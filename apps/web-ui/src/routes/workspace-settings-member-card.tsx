import { cn } from "@/lib/utils";
import type { WorkspaceMember } from "../lib/workspaces-api.js";
import {
  MemberCardHeader,
  useMemberDependsDraft
} from "./workspace-settings-member-parts.js";

function MemberDependsEditor(options: {
  others: string[];
  draft: Set<string>;
  busy: boolean;
  onToggle: (name: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { others, draft, busy, onToggle, onSave, onCancel } = options;
  return (
    <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
      <p className="text-xs text-muted-foreground">
        Start after these projects are ready:
      </p>
      {others.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Add another project to set dependencies.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {others.map((name) => {
            const on = draft.has(name);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(name)}
                className={cn(
                  "rounded-md px-2 py-1 font-mono text-xs shadow-sm",
                  on
                    ? "bg-accent text-accent-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onSave}
          className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground"
        >
          Save
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function MemberCard(options: {
  member: WorkspaceMember;
  allRepoNames: string[];
  editing: boolean;
  busy: boolean;
  onEdit: () => void;
  onSaveDepends: (dependsOn: string[]) => void;
  onCancelEdit: () => void;
  onRemove: () => void;
}) {
  const {
    member,
    allRepoNames,
    editing,
    busy,
    onEdit,
    onSaveDepends,
    onCancelEdit,
    onRemove
  } = options;
  const others = allRepoNames.filter((n) => n !== member.repoName);
  const { draft, toggleDep } = useMemberDependsDraft({
    editing,
    dependsOn: member.dependsOn
  });
  return (
    <li className="rounded-xl bg-muted/40 px-4 py-3 shadow-sm">
      <MemberCardHeader
        member={member}
        editing={editing}
        busy={busy}
        showDepends={others.length > 0}
        onEdit={onEdit}
        onRemove={onRemove}
      />
      {editing ? (
        <MemberDependsEditor
          others={others}
          draft={draft}
          busy={busy}
          onToggle={toggleDep}
          onSave={() => onSaveDepends([...draft])}
          onCancel={onCancelEdit}
        />
      ) : null}
    </li>
  );
}
