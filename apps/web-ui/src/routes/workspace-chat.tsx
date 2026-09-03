import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { startSession } from "../lib/projects-api.js";
import { fetchWorkspaceChat } from "../lib/workspaces-api.js";
import { Workbench } from "./chat-workbench/workbench-layout.js";
import { SessionHeader } from "./chat-workbench/session-header.js";
import { SessionBootScreen } from "./chat-workbench/session-boot.js";
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

/**
 * Workspace-scoped chat workbench. Session tools (files, apps, terminal)
 * work against this chat’s own multi-repo sandbox.
 */
export function WorkspaceChatWorkbench() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const workspaceId = params.workspaceId ?? "";
  const chatId = params.chatId ?? "";
  const initialPrompt = readInitialPrompt(location.state);
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
  const startSandbox = () => {
    if (!sessionId) return;
    setSandboxStatus("starting");
    void startSession(sessionId)
      .then(() => setSandboxStatus("ready"))
      .catch((err) => {
        console.error("Failed to start session sandbox:", err);
        setSandboxStatus("error");
      });
  };
  useEffect(() => {
    if (!sessionId) return;
    startSandbox();
  }, [sessionId]);
  const booting =
    loadingChat || Boolean(sessionId && sandboxStatus === "starting");

  return (
    <div className="flex h-screen flex-col">
      <SessionHeader
        onBack={() => navigate(`/workspaces/${workspaceId}/chats`)}
        title={loadingChat ? "Loading…" : (chat?.title ?? "Workspace chat")}
        turnStatus={chrome.turnStatus}
        sandboxStatus={sessionId ? sandboxStatus : "starting"}
        leftMode={leftMode}
        onLeftMode={setLeftMode}
      />
      <div className="min-h-0 flex-1">
        {booting || sandboxStatus === "error" ? (
          <SessionBootScreen
            sandboxStatus={sandboxStatus === "error" ? "error" : "starting"}
            onRetry={sandboxStatus === "error" ? startSandbox : undefined}
          />
        ) : sessionId ? (
          <Workbench
            sessionId={sessionId}
            projectId=""
            chatId={chatId}
            workspaceId={workspaceId}
            sessionKind={chat?.kind ?? "workbench"}
            branchName={chat?.branchName}
            initialPrompt={initialPrompt}
            leftMode={leftMode}
            onLeftModeChange={setLeftMode}
            onChromeChange={setChrome}
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
