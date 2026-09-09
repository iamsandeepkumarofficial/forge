import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseTimestamp } from "../lib/dashboard-insights.js";
import {
  createWorkspaceChat,
  deleteWorkspaceChat,
  getWorkspace,
  listWorkspaceChats,
  type WorkspaceChat,
  type WorkspaceDetail
} from "../lib/workspaces-api.js";

function sortByActivity(chats: WorkspaceChat[]): WorkspaceChat[] {
  return [...chats].sort((a, b) => {
    const aTs = parseTimestamp(a.lastActivityAt) ?? 0;
    const bTs = parseTimestamp(b.lastActivityAt) ?? 0;
    return bTs - aTs;
  });
}

function useWorkspaceChatActions(options: {
  workspaceId: string;
  hasMembers: boolean;
  busy: boolean;
  deletingId: string | null;
  executionTarget: "local" | "cloud";
  setBusy: (v: boolean) => void;
  setDeletingId: (v: string | null) => void;
  setError: (v: string | null) => void;
  setChats: React.Dispatch<React.SetStateAction<WorkspaceChat[]>>;
  openChat: (chatId: string) => void;
}) {
  const {
    workspaceId,
    hasMembers,
    busy,
    deletingId,
    executionTarget,
    setBusy,
    setDeletingId,
    setError,
    setChats,
    openChat
  } = options;
  const onNewChat = () => {
    if (!hasMembers || busy) return;
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const chat = await createWorkspaceChat({
          workspaceId,
          executionTarget
        });
        setChats(await listWorkspaceChats(workspaceId));
        openChat(chat.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    })();
  };
  const onDelete = (chat: WorkspaceChat) => {
    if (deletingId) return;
    const label = chat.title || "this chat";
    if (!window.confirm(`Delete “${label}”? This cannot be undone.`)) return;
    void (async () => {
      setDeletingId(chat.id);
      setError(null);
      try {
        await deleteWorkspaceChat(workspaceId, chat.id);
        setChats((prev) => prev.filter((c) => c.id !== chat.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setDeletingId(null);
      }
    })();
  };
  return { onNewChat, onDelete };
}

export function useWorkspaceChatsPage(workspaceId: string) {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [chats, setChats] = useState<WorkspaceChat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [executionTarget, setExecutionTarget] = useState<"local" | "cloud">(
    "local"
  );

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [ws, chatRows] = await Promise.all([
          getWorkspace(workspaceId),
          listWorkspaceChats(workspaceId)
        ]);
        if (cancelled) return;
        setWorkspace(ws);
        setChats(chatRows);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const sorted = useMemo(() => sortByActivity(chats), [chats]);
  const mostRecent = sorted[0] ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((chat) => {
      const title = chat.title?.toLowerCase() ?? "";
      const branch = chat.branchName?.toLowerCase() ?? "";
      return title.includes(q) || branch.includes(q);
    });
  }, [sorted, query]);

  const hasMembers = (workspace?.members.length ?? 0) > 0;
  const openChat = (chatId: string) => {
    void navigate(`/workspaces/${workspaceId}/chats/${chatId}`);
  };
  const { onNewChat, onDelete } = useWorkspaceChatActions({
    workspaceId,
    hasMembers,
    busy,
    deletingId,
    executionTarget,
    setBusy,
    setDeletingId,
    setError,
    setChats,
    openChat
  });

  return {
    workspace,
    chats,
    error,
    busy,
    deletingId,
    query,
    setQuery,
    executionTarget,
    setExecutionTarget,
    filtered,
    mostRecent,
    hasMembers,
    openChat,
    onNewChat,
    onDelete
  };
}
