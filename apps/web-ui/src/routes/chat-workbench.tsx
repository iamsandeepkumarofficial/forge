import { useState, useEffect } from "react";
import { Download, UploadCloud } from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { fetchChat, startSession } from "../lib/projects-api.js";
import { downloadRepoArchive, promoteToCanonical } from "../lib/tool-runner.js";
import { Workbench } from "./chat-workbench/workbench-layout.js";

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
  } | null>(null);
  const [loadingChat, setLoadingChat] = useState(true);
  const [activeKey, setActiveKey] = useState(`${projectId}:${chatId}`);
  if (activeKey !== `${projectId}:${chatId}`) {
    setActiveKey(`${projectId}:${chatId}`);
    setLoadingChat(true);
  }
  useEffect(() => {
    let cancelled = false;
    void fetchChat(projectId, chatId)
      .then((data) => {
        if (!cancelled) setChat(data);
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
  useEffect(() => {
    if (!sessionId) return;
    void startSession(sessionId).catch((err) =>
      console.error("Failed to start session sandbox:", err)
    );
  }, [sessionId]);
  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-2 shrink-0 min-w-0">
        <button
          onClick={() => navigate(`/projects/${projectId}/chats`)}
          className="text-sm text-muted-foreground hover:underline shrink-0"
        >
          ← Chats
        </button>
        <h1 className="font-semibold truncate">
          {loadingChat ? "Loading…" : (chat?.title ?? "Chat")}
        </h1>
        <div className="flex-1" />
        {sessionId && <SessionActions sessionId={sessionId} />}
      </div>
      <div className="flex-1 min-h-0">
        {sessionId ? (
          <Workbench
            sessionId={sessionId}
            projectId={projectId}
            chatId={chatId}
            sessionKind={chat?.kind ?? "workbench"}
            initialPrompt={initialPrompt}
          />
        ) : (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">
            {loadingChat ? "Loading session…" : "Session not ready yet."}
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
  const btn =
    "flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50";
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy !== null}
        className={btn}
        title="Download working code as .tar.gz"
      >
        <Download className="size-3.5" />
        {busy === "download" ? "…" : "Download"}
      </button>
      <button
        type="button"
        onClick={() => void promote()}
        disabled={busy !== null}
        className={btn}
        title="Promote working code to canonical"
      >
        <UploadCloud className="size-3.5" />
        {busy === "promote" ? "…" : "Promote"}
      </button>
    </div>
  );
}
