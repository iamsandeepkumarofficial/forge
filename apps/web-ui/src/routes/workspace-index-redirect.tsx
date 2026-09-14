import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { getWorkspace } from "../lib/workspaces-api.js";

export function WorkspaceIndexRedirect() {
  const { workspaceId = "" } = useParams();
  const [target, setTarget] = useState<"chats" | "settings" | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void getWorkspace(workspaceId)
      .then((ws) => {
        if (cancelled) return;
        setTarget(ws.members.length === 0 ? "settings" : "chats");
      })
      .catch(() => {
        if (!cancelled) {
          setTarget("settings");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (!target) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }
  return <Navigate to={`/workspaces/${workspaceId}/${target}`} replace />;
}
