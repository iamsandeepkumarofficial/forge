import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  fetchRunningTurn,
  fetchSessionMessages,
  type UiChatMessage
} from "../lib/chat-agent.js";
import { startSession } from "../lib/projects-api.js";
import {
  analyzeWorkspace,
  createWorkspaceChat,
  fetchWorkspaceChat,
  getWorkspaceHealth,
  listWorkspaceChats,
  type WorkspaceHealthFinding
} from "../lib/workspaces-api.js";
import { ChatPane } from "./chat-workbench/chat-pane.js";

const SETUP_CHAT_TITLE = "Workspace setup";
const HEALTH_POLL_ATTEMPTS = 60;
const HEALTH_POLL_MS = 500;

export const WORKSPACE_SETUP_ANALYZE_PROMPT = [
  "Run a workspace setup turn.",
  "Refresh is collecting evidence/shadows in the background — wait until ## Workspace health",
  "is not computing (re-read health/shadows if needed), then inventory + ## Workspace setup SOP.",
  "1) Emit a numbered task list of blockers (stack/skill, install, env params, infra, launch/preview).",
  "2) Execute those tasks one by one in order: invoke_skill, run_terminal for installs",
  "(ask_user before toolchain install), ask_user (mcq/form with value defaults) for env/infra,",
  "then upsert_workspace_parameter / provision_app_engine with userApproved after consent,",
  "upsert_launch_app, preview_start backends before frontends when dependsOn says so.",
  "Do not stop after the task list — start fixing immediately."
].join(" ");

export const WORKSPACE_SETUP_FIX_PROMPT = [
  "Analyze this workspace and fix setup blockers.",
  "If health is still computing, wait/re-read until shadows are ready.",
  "Emit a short numbered task list, then execute one by one.",
  "Follow ## Workspace setup SOP: identify each member stack from shadows/inventory,",
  "invoke_skill for that stack, install via run_terminal (ask_user before toolchain install if missing),",
  "ask_user (mcq/form widget with value defaults) for missing env and infra consent — then upsert_workspace_parameter",
  "and provision_app_engine with userApproved only after that answer.",
  "Then upsert_launch_app and preview_start backends before frontends when dependsOn says so."
].join(" ");

export type WorkspaceSetupDrawerMode = "analyze" | "fix";

export function setupCtaModeFromFindings(
  findings: WorkspaceHealthFinding[],
  healthStatus?: string | null
): WorkspaceSetupDrawerMode {
  if (healthStatus === "computing") return "fix";
  return findings.some(
    (f) => f.severity === "warning" || f.severity === "error"
  )
    ? "fix"
    : "analyze";
}

export function initialPromptForSetupMode(
  mode: WorkspaceSetupDrawerMode
): string {
  return mode === "fix"
    ? WORKSPACE_SETUP_FIX_PROMPT
    : WORKSPACE_SETUP_ANALYZE_PROMPT;
}

function messageText(message: UiChatMessage): string {
  return message.parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim();
}

function lastUserText(messages: UiChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user") return messageText(m) || null;
  }
  return null;
}

export function shouldSeedSetupPrompt(options: {
  mode: WorkspaceSetupDrawerMode;
  turnRunning: boolean;
  lastUserText: string | null;
}): boolean {
  if (options.turnRunning) return false;
  const last = (options.lastUserText ?? "").trim();
  if (!last) return true;
  const alreadyForMode =
    options.mode === "fix"
      ? last.startsWith("Analyze this workspace and fix setup blockers.")
      : last.startsWith("Run a workspace setup turn.");
  return !alreadyForMode;
}

async function ensureSetupChat(workspaceId: string): Promise<{
  chatId: string;
  sessionId: string;
}> {
  const chats = await listWorkspaceChats(workspaceId);
  const existing = chats.find(
    (c) => (c.title ?? "").trim().toLowerCase() === "workspace setup"
  );
  const chat =
    existing ?? (await createWorkspaceChat(workspaceId, SETUP_CHAT_TITLE));
  const detail = await fetchWorkspaceChat(workspaceId, chat.id);
  if (!detail.sessionId) {
    throw new Error("Setup chat has no session yet.");
  }
  try {
    await startSession(detail.sessionId);
  } catch {
    void 0;
  }
  return { chatId: chat.id, sessionId: detail.sessionId };
}

export async function runShadowAnalyzeWithProgress(options: {
  workspaceId: string;
  onProgress?: (message: string) => void;
  signal?: { cancelled: boolean };
}): Promise<{
  status: string;
  findings: WorkspaceHealthFinding[];
}> {
  const { workspaceId, onProgress, signal } = options;
  onProgress?.("Collecting ecosystem evidence…");
  await analyzeWorkspace(workspaceId);
  if (signal?.cancelled) {
    return { status: "computing", findings: [] };
  }
  onProgress?.("Writing health shadows…");
  for (let i = 0; i < HEALTH_POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, HEALTH_POLL_MS));
    if (signal?.cancelled) {
      return { status: "computing", findings: [] };
    }
    const h = await getWorkspaceHealth(workspaceId);
    if (h.status === "computing") {
      onProgress?.(
        i < 4 ? "Collecting ecosystem evidence…" : "Writing health shadows…"
      );
      continue;
    }
    const report = h.report as { findings?: WorkspaceHealthFinding[] };
    return { status: h.status, findings: report.findings ?? [] };
  }
  return { status: "computing", findings: [] };
}

type SetupSession = {
  chatId: string;
  sessionId: string;
  initialPrompt?: string;
};

function SetupDrawerChrome(options: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { title, subtitle, onClose, children } = options;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      data-testid="workspace-setup-drawer"
    >
      <button
        type="button"
        aria-label="Close setup drawer"
        className="absolute inset-0 bg-background/60"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-2xl flex-col border-l bg-background shadow-xl"
        role="dialog"
        aria-label={title}
      >
        <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <button
            type="button"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </aside>
    </div>
  );
}

function useSetupDrawerSession(options: {
  workspaceId: string;
  mode: WorkspaceSetupDrawerMode;
  open: boolean;
  onHealthUpdated?: (
    status: string,
    findings: WorkspaceHealthFinding[]
  ) => void;
}) {
  const { workspaceId, mode, open, onHealthUpdated } = options;
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SetupSession | null>(null);
  const [chatReady, setChatReady] = useState(false);
  const onHealthUpdatedRef = useRef(onHealthUpdated);
  useEffect(() => {
    onHealthUpdatedRef.current = onHealthUpdated;
  }, [onHealthUpdated]);

  useEffect(() => {
    if (!open) {
      void Promise.resolve().then(() => {
        setProgress(null);
        setError(null);
        setSession(null);
        setChatReady(false);
      });
      return;
    }
    const signal = { cancelled: false };
    void (async () => {
      setProgress("Opening Workspace setup…");
      setChatReady(false);
      setSession(null);
      setError(null);
      try {
        const shadowsPromise = runShadowAnalyzeWithProgress({
          workspaceId,
          onProgress: (msg) => {
            if (!signal.cancelled) setProgress(msg);
          },
          signal
        }).then((result) => {
          if (signal.cancelled) return;
          onHealthUpdatedRef.current?.(result.status, result.findings);
        });
        const setup = await ensureSetupChat(workspaceId);
        if (signal.cancelled) return;
        const [messages, running] = await Promise.all([
          fetchSessionMessages(setup.sessionId),
          fetchRunningTurn(setup.sessionId)
        ]);
        if (signal.cancelled) return;
        const seed = shouldSeedSetupPrompt({
          mode,
          turnRunning: Boolean(running),
          lastUserText: lastUserText(messages)
        });
        setSession({
          ...setup,
          initialPrompt: seed ? initialPromptForSetupMode(mode) : undefined
        });
        setProgress(null);
        setChatReady(true);
        void shadowsPromise;
      } catch (e) {
        if (!signal.cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setProgress(null);
        }
      }
    })();
    return () => {
      signal.cancelled = true;
    };
  }, [open, mode, workspaceId]);

  return { progress, error, session, chatReady };
}

export function WorkspaceSetupDrawer(options: {
  workspaceId: string;
  mode: WorkspaceSetupDrawerMode;
  open: boolean;
  onClose: () => void;
  onHealthUpdated?: (
    status: string,
    findings: WorkspaceHealthFinding[]
  ) => void;
}) {
  const { workspaceId, mode, open, onClose, onHealthUpdated } = options;
  const { progress, error, session, chatReady } = useSetupDrawerSession({
    workspaceId,
    mode,
    open,
    onHealthUpdated
  });
  if (!open) return null;
  const title = mode === "analyze" ? "Analyze workspace" : "Fix workspace";
  const subtitle =
    mode === "analyze"
      ? "Setup chat — list blockers as tasks, then fix them one by one."
      : "Setup chat — invoke skills, install, and provision only after you approve.";
  return (
    <SetupDrawerChrome title={title} subtitle={subtitle} onClose={onClose}>
      {error && <p className="m-4 text-sm text-destructive">{error}</p>}
      {!chatReady && progress && (
        <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {progress}
        </p>
      )}
      {chatReady && session && (
        <div className="h-full min-h-0">
          <ChatPane
            key={`${session.chatId}-${mode}-${session.initialPrompt ? "seed" : "resume"}`}
            sessionId={session.sessionId}
            projectId=""
            chatId={session.chatId}
            workspaceId={workspaceId}
            sessionKind="workbench"
            skipInitialPromptNavigate
            initialPrompt={session.initialPrompt}
          />
        </div>
      )}
    </SetupDrawerChrome>
  );
}
