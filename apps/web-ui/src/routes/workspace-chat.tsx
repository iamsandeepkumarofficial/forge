import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { startSession } from "../lib/projects-api.js";
import { fetchWorkspaceChat } from "../lib/workspaces-api.js";
import { Workbench } from "./chat-workbench/workbench-layout.js";

/**
 * Workspace-scoped chat workbench. Session tools (files, apps, terminal)
 * work against this chat’s own multi-repo sandbox (session-scoped apps;
 * local members share ~/.forge/projects/{id} across sessions).
 * Project-only board APIs no-op when projectId is empty.
 */
export function WorkspaceChatWorkbench() {
  const params = useParams();
  const navigate = useNavigate();
  const workspaceId = params.workspaceId ?? "";
  const chatId = params.chatId ?? "";
  const [chat, setChat] = useState<{
    sessionId?: string;
    title?: string;
    kind?: "ticket" | "workbench";
  } | null>(null);
  const [loadingChat, setLoadingChat] = useState(true);
  const [activeKey, setActiveKey] = useState(`${workspaceId}:${chatId}`);
  if (activeKey !== `${workspaceId}:${chatId}`) {
    setActiveKey(`${workspaceId}:${chatId}`);
    setLoadingChat(true);
  }

  useEffect(() => {
    let cancelled = false;
    void fetchWorkspaceChat(workspaceId, chatId)
      .then((data) => {
        if (!cancelled) setChat(data);
      })
      .catch((err) => console.error("Failed to load workspace chat:", err))
      .finally(() => {
        if (!cancelled) setLoadingChat(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, chatId]);

  const sessionId: string | undefined = chat?.sessionId;
  useEffect(() => {
    if (!sessionId) return;
    void startSession(sessionId).catch((err) =>
      console.error("Failed to start session sandbox:", err)
    );
  }, [sessionId]);

  return (
    <div className="flex h-screen flex-col">
      <div className="flex min-w-0 shrink-0 items-center gap-3 border-b px-4 py-2">
        <button
          type="button"
          onClick={() => navigate(`/workspaces/${workspaceId}/chats`)}
          className="shrink-0 text-sm text-muted-foreground hover:underline"
        >
          ← Chats
        </button>
        <h1 className="truncate font-semibold">
          {loadingChat ? "Loading…" : (chat?.title ?? "Workspace chat")}
        </h1>
      </div>
      <div className="min-h-0 flex-1">
        {sessionId ? (
          <Workbench
            sessionId={sessionId}
            projectId=""
            chatId={chatId}
            sessionKind={chat?.kind ?? "workbench"}
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            {loadingChat ? "Loading session…" : "Session not ready yet."}
          </div>
        )}
      </div>
    </div>
  );
}
