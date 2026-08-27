import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { getWorkspace } from "../lib/workspaces-api.js";

/**
 * Smart index: Settings when the workspace has no members yet, else Chats.
 */
export function WorkspaceIndexRedirect() {
  const { workspaceId = "" } = useParams();
  const [target, setTarget] = useState<"chats" | "settings" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void getWorkspace(workspaceId)
      .then((ws) => {
        if (cancelled) return;
        setTarget(ws.members.length === 0 ? "settings" : "chats");
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setTarget("settings");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (!target) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Loading…</div>
    );
  }
  return (
    <Navigate to={`/workspaces/${workspaceId}/${target}`} replace />
  );
}
