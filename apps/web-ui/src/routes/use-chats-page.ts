import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  fetchWorkbenchSessions,
  type ProjectWorkbenchSession
} from "../lib/projects-api.js";
import { N_50 } from "./chats-storage.js";
import {
  deleteWorkbenchChat,
  loadChatSessions,
  startWorkbenchChat
} from "./chats-page-actions.js";
import { useChatsModelState } from "./use-chats-model-state.js";

function useChatsSessions(projectId: string | undefined) {
  const [sessions, setSessions] = useState<ProjectWorkbenchSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState(projectId);
  if (activeProjectId !== projectId) {
    setActiveProjectId(projectId);
    setLoading(true);
  }
  useEffect(() => {
    if (!projectId) return;
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
          setError(err instanceof Error ? err.message : "Failed to load chats");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);
  return { sessions, setSessions, loading, setLoading, error, setError };
}

export function useChatsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const forceNew = searchParams.get("new") === "1";
  const { sessions, setSessions, loading, setLoading, error, setError } =
    useChatsSessions(projectId);
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelState = useChatsModelState();
  const reload = () =>
    loadChatSessions({ projectId, setLoading, setSessions, setError });
  const showComposer = !loading && (sessions.length === 0 || forceNew);
  useEffect(() => {
    if (showComposer) {
      window.setTimeout(() => textareaRef.current?.focus(), N_50);
    }
  }, [showComposer]);
  return {
    projectId,
    sessions,
    prompt,
    setPrompt,
    loading,
    creating,
    deletingId,
    error,
    textareaRef,
    showComposer,
    setSearchParams,
    navigate,
    startChat: (text: string) =>
      void startWorkbenchChat({
        projectId,
        creating,
        text,
        navigate,
        setCreating,
        setError
      }),
    handleDelete: (sessionId: string, sessionTitle: string) =>
      void deleteWorkbenchChat({
        projectId,
        sessionId,
        sessionTitle,
        setDeletingId,
        setError,
        reload
      }),
    ...modelState
  };
}

export type ChatsPageState = ReturnType<typeof useChatsPage>;
