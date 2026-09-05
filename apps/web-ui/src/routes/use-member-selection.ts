import { useMemo, useState } from "react";
import type { WorkspaceDetail } from "../lib/workspaces-api.js";
import type { ProjectSummary } from "../lib/projects-api.js";

export function useMemberSelection(options: {
  workspace: WorkspaceDetail | null;
  projects: ProjectSummary[];
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const memberIds = useMemo(
    () => new Set(options.workspace?.members.map((m) => m.projectId) ?? []),
    [options.workspace]
  );
  const available = useMemo(
    () => options.projects.filter((p) => !memberIds.has(p.id)),
    [options.projects, memberIds]
  );
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  return { selectedIds, setSelectedIds, available, toggleSelected };
}
