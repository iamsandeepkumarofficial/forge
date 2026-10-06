import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { fetchPrimaryWorkspace } from "../lib/projects-api.js";

export function ProjectToWorkspaceRedirect(options: {
  suffix?: "chats" | "settings" | "";
}) {
  const { projectId } = useParams();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const suffix = options.suffix ?? "chats";

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void (async () => {
      try {
        const { workspaceId: wsId } = await fetchPrimaryWorkspace(projectId);
        if (!cancelled) setWorkspaceId(wsId);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!projectId || failed) {
    return <Navigate to="/" replace />;
  }
  if (!workspaceId) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Opening workspace…
      </div>
    );
  }
  const path =
    suffix === ""
      ? `/workspaces/${workspaceId}`
      : `/workspaces/${workspaceId}/${suffix}`;
  return <Navigate to={path} replace />;
}
