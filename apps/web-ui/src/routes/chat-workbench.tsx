import { useState, useEffect } from "react";
import { Download, UploadCloud } from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { fetchChat, startSession } from "../lib/projects-api.js";
import { downloadRepoArchive, promoteToCanonical } from "../lib/tool-runner.js";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
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

export function ChatWorkbench() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = params.projectId ?? "";
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
        onBack={() => navigate(`/projects/${projectId}/chats`)}
        title={loadingChat ? "Loading…" : (chat?.title ?? "Chat")}
        turnStatus={chrome.turnStatus}
        sandboxStatus={sessionId ? sandboxStatus : "starting"}
        leftMode={leftMode}
        onLeftMode={setLeftMode}
        actions={
          sessionId ? <SessionActions sessionId={sessionId} /> : undefined
        }
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
            projectId={projectId}
            chatId={chatId}
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

function SessionActions({ sessionId }: { sessionId: string }) {
  const [busy, setBusy] = useState<"download" | "promote" | null>(null);
  const download = async () => {
    setBusy("download");
    try {
      await downloadRepoArchive(sessionId);
    } catch (e) {
      alert(`Download failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };
  const promote = async () => {
    if (
      !window.confirm(
        "Promote the current working code to canonical? For GitHub this pushes to the chat's branch; for uploads it overwrites the stored project."
      )
    ) {
      return;
    }
    setBusy("promote");
    try {
      const r = await promoteToCanonical(sessionId);
      alert(
        r.target === "github"
          ? `Pushed to branch "${r.branch}".`
          : `Canonical updated (${r.files} files stored).`
      );
    } catch (e) {
      alert(`Promote failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <DropdownMenuItem
        disabled={busy !== null}
        onClick={() => void download()}
      >
        <Download className="size-4" />
        {busy === "download" ? "Downloading…" : "Download"}
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={busy !== null}
        onClick={() => void promote()}
      >
        <UploadCloud className="size-4" />
        {busy === "promote" ? "Promoting…" : "Promote"}
      </DropdownMenuItem>
    </>
  );
}
