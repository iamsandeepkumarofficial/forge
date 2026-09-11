import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getSessionStatus, startSession } from "../lib/projects-api.js";
import { fetchWorkspaceChat } from "../lib/workspaces-api.js";
import { Workbench } from "./chat-workbench/workbench-layout.js";
import { SessionHeader } from "./chat-workbench/session-header.js";
import {
  bootExistingOrStartSession,
  SessionBootScreen
} from "./chat-workbench/session-boot.js";
import type {
  LeftPaneMode,
  SandboxStatus,
  WorkbenchChrome
} from "./chat-workbench/types.js";

function readInitialPrompt(state: unknown): string | undefined {
  if (
    state &&
    typeof state === "object" &&
    "initialPrompt" in state &&
    typeof (state as { initialPrompt: unknown }).initialPrompt === "string"
  ) {
    return (state as { initialPrompt: string }).initialPrompt;
  }
  return undefined;
}

function useWorkspaceChatSession(options: {
  workspaceId: string;
  chatId: string;
}) {
  const { workspaceId, chatId } = options;
  const [chat, setChat] = useState<{
    sessionId?: string;
    title?: string;
    kind?: "ticket" | "workbench";
    branchName?: string;
  } | null>(null);
  const [loadingChat, setLoadingChat] = useState(true);
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatus>("starting");
  const [chrome, setChrome] = useState<WorkbenchChrome>({
    turnStatus: "idle"
  });
  const [leftMode, setLeftMode] = useState<LeftPaneMode>("chat");
  const [activeKey, setActiveKey] = useState(`${workspaceId}:${chatId}`);
  if (activeKey !== `${workspaceId}:${chatId}`) {
    setActiveKey(`${workspaceId}:${chatId}`);
    setLoadingChat(true);
    setLeftMode("chat");
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
  const startSandbox = useCallback(() => {
    if (!sessionId) return;
    void bootExistingOrStartSession({
      sessionId,
      getStatus: getSessionStatus,
      start: startSession,
      setStatus: setSandboxStatus
    });
  }, [sessionId]);
  useEffect(() => {
    if (!sessionId) return;
    void Promise.resolve().then(() => {
      startSandbox();
    });
  }, [sessionId, startSandbox]);
  return {
    chat,
    loadingChat,
    sandboxStatus,
    chrome,
    setChrome,
    leftMode,
    setLeftMode,
    sessionId,
    startSandbox,
    booting: loadingChat || Boolean(sessionId && sandboxStatus === "starting")
  };
}

export function WorkspaceChatWorkbench() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const workspaceId = params.workspaceId ?? "";
  const chatId = params.chatId ?? "";
  const initialPrompt = readInitialPrompt(location.state);
  const wb = useWorkspaceChatSession({ workspaceId, chatId });
  return (
    <div className="flex h-screen flex-col">
      <SessionHeader
        onBack={() => navigate(`/workspaces/${workspaceId}/chats`)}
        title={
          wb.loadingChat ? "Loading…" : (wb.chat?.title ?? "Workspace chat")
        }
        turnStatus={wb.chrome.turnStatus}
        sandboxStatus={wb.sessionId ? wb.sandboxStatus : "starting"}
        leftMode={wb.leftMode}
        onLeftMode={wb.setLeftMode}
      />
      <div className="min-h-0 flex-1">
        {wb.booting || wb.sandboxStatus === "error" ? (
          <SessionBootScreen
            sandboxStatus={wb.sandboxStatus === "error" ? "error" : "starting"}
            onRetry={wb.sandboxStatus === "error" ? wb.startSandbox : undefined}
          />
        ) : wb.sessionId ? (
          <Workbench
            sessionId={wb.sessionId}
            projectId=""
            chatId={chatId}
            workspaceId={workspaceId}
            sessionKind={wb.chat?.kind ?? "workbench"}
            branchName={wb.chat?.branchName}
            initialPrompt={initialPrompt}
            leftMode={wb.leftMode}
            onLeftModeChange={wb.setLeftMode}
            onChromeChange={wb.setChrome}
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Session not ready yet.
          </div>
        )}
      </div>
    </div>
  );
}
