import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createWorkbenchSession,
  deleteChat,
  fetchWorkbenchSessions,
  type ProjectWorkbenchSession
} from "../lib/projects-api.js";

async function loadSessionsForProject(options: {
  projectId: string;
  setSessions: (rows: ProjectWorkbenchSession[]) => void;
  setError: (value: string | null) => void;
  setLoading: (value: boolean) => void;
}): Promise<void> {
  options.setLoading(true);
  try {
    options.setSessions(await fetchWorkbenchSessions(options.projectId));
    options.setError(null);
  } catch (err) {
    options.setError(
      err instanceof Error ? err.message : "Failed to load sessions"
    );
  } finally {
    options.setLoading(false);
  }
}

export function useWorkbenchSessions(options: {
  projectId: string;
  onClose: () => void;
}) {
  const { projectId, onClose } = options;
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ProjectWorkbenchSession[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState(projectId);
  if (activeProjectId !== projectId) {
    setActiveProjectId(projectId);
    setLoading(true);
  }
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchWorkbenchSessions(projectId);
        if (!cancelled) {
          setSessions(rows);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load sessions"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);
  return {
    sessions,
    title,
    setTitle,
    loading,
    creating,
    deletingId,
    error,
    handleCreate: (e: React.FormEvent) =>
      void createSession({
        e,
        projectId,
        title,
        onClose,
        navigate,
        setCreating,
        setError
      }),
    handleDelete: (sessionId: string, sessionTitle: string) =>
      void removeSession({
        projectId,
        sessionId,
        sessionTitle,
        setDeletingId,
        setError,
        setSessions,
        setLoading
      }),
    handleResume: (sessionId: string) => {
      onClose();
      void navigate(`/projects/${projectId}/chats/${sessionId}`);
    }
  };
}

async function createSession(options: {
  e: React.FormEvent;
  projectId: string;
  title: string;
  onClose: () => void;
  navigate: ReturnType<typeof useNavigate>;
  setCreating: (v: boolean) => void;
  setError: (v: string | null) => void;
}) {
  options.e.preventDefault();
  options.setCreating(true);
  options.setError(null);
  try {
    const session = await createWorkbenchSession(
      options.projectId,
      options.title.trim() || "Workbench"
    );
    options.onClose();
    void options.navigate(`/projects/${options.projectId}/chats/${session.id}`);
  } catch (err) {
    options.setError(
      err instanceof Error ? err.message : "Failed to create session"
    );
  } finally {
    options.setCreating(false);
  }
}

async function removeSession(options: {
  projectId: string;
  sessionId: string;
  sessionTitle: string;
  setDeletingId: (v: string | null) => void;
  setError: (v: string | null) => void;
  setSessions: (rows: ProjectWorkbenchSession[]) => void;
  setLoading: (v: boolean) => void;
}) {
  if (
    !window.confirm(
      `Delete workbench "${options.sessionTitle}"? This cannot be undone.`
    )
  ) {
    return;
  }
  options.setDeletingId(options.sessionId);
  options.setError(null);
  try {
    await deleteChat(options.projectId, options.sessionId);
    await loadSessionsForProject({
      projectId: options.projectId,
      setSessions: options.setSessions,
      setError: options.setError,
      setLoading: options.setLoading
    });
  } catch (err) {
    options.setError(
      err instanceof Error ? err.message : "Failed to delete session"
    );
  } finally {
    options.setDeletingId(null);
  }
}
