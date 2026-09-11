import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  fetchChat,
  getSessionStatus,
  startSession
} from "../lib/projects-api.js";
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

function useChatWorkbenchSession(options: {
  projectId: string;
  chatId: string;
}) {
  const { projectId, chatId } = options;
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
  const [activeKey, setActiveKey] = useState(`${projectId}:${chatId}`);
  if (activeKey !== `${projectId}:${chatId}`) {
    setActiveKey(`${projectId}:${chatId}`);
    setLoadingChat(true);
    setLeftMode("chat");
  }
  useEffect(() => {
    let cancelled = false;
    void fetchChat(projectId, chatId)
      .then((data) => {
        if (!cancelled) {
          setChat({
            sessionId: data.sessionId,
            title: data.title,
            kind: data.kind,
            branchName:
              typeof data.branchName === "string" ? data.branchName : undefined
          });
        }
      })
      .catch((err) => console.error("Failed to load chat:", err))
      .finally(() => {
        if (!cancelled) setLoadingChat(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, chatId]);
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

export function ChatWorkbench() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = params.projectId ?? "";
  const chatId = params.chatId ?? "";
  const initialPrompt = readInitialPrompt(location.state);
  const wb = useChatWorkbenchSession({ projectId, chatId });
  return (
    <div className="flex h-screen flex-col">
      <SessionHeader
        onBack={() => navigate(`/projects/${projectId}/chats`)}
        title={wb.loadingChat ? "Loading…" : (wb.chat?.title ?? "Chat")}
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
            projectId={projectId}
            chatId={chatId}
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
