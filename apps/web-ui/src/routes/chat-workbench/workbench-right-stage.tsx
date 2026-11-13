import { Globe, ListTree, X } from "lucide-react";
import { FileTabPane } from "./files-panels.js";
import { AppPreviewPane } from "./run-panels.js";
import { BottomTerminal } from "./bottom-terminal.js";
import { PlanPanel } from "./plan-panel.js";
import { cn } from "@/lib/utils";
import type { FileTab } from "./types.js";
import type { PlanCardModel } from "./plan-card.js";
import { PREVIEW_TAB_ID, PLAN_TAB_ID, tabLabel } from "./right-tabs.js";

function RightDocTabs(options: {
  docs: FileTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const { docs, activeId, onSelect, onClose } = options;
  return (
    <>
      <button
        type="button"
        aria-pressed={activeId === PREVIEW_TAB_ID}
        onClick={() => onSelect(PREVIEW_TAB_ID)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-t-md px-2.5 py-1.5 text-xs",
          activeId === PREVIEW_TAB_ID
            ? "bg-background font-medium text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Globe className="size-3.5" />
        Preview
      </button>
      {docs.map((tab) => (
        <div
          key={tab.id}
          className={cn(
            "inline-flex max-w-[12rem] items-center rounded-t-md",
            activeId === tab.id
              ? "bg-background text-foreground"
              : "text-muted-foreground"
          )}
        >
          <button
            type="button"
            aria-pressed={activeId === tab.id}
            title={tab.path}
            onClick={() => onSelect(tab.id)}
            className={cn(
              "inline-flex min-w-0 items-center gap-1 truncate px-2 py-1.5 text-xs",
              activeId === tab.id && "font-medium"
            )}
          >
            {tab.kind === "plan" ? (
              <ListTree className="size-3.5 shrink-0" />
            ) : null}
            {tab.kind === "diff" ? "Δ " : ""}
            {tabLabel(tab)}
          </button>
          <button
            type="button"
            aria-label={`Close ${tabLabel(tab)}`}
            onClick={() => onClose(tab.id)}
            className="mr-1 inline-flex size-5 items-center justify-center rounded-sm hover:bg-muted hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </>
  );
}

function planBuildAction(
  sessionId: string,
  activeTurnId: string | null | undefined
): (() => Promise<void>) | undefined {
  if (!activeTurnId) return undefined;
  return async () => {
    const { startChatPlan } = await import("../../lib/chat-agent.js");
    await startChatPlan({ sessionId, turnId: activeTurnId });
  };
}

function planHumanAnswer(
  sessionId: string,
  activeTurnId: string | null | undefined
) {
  if (!activeTurnId) return undefined;
  return async ({
    taskId,
    decision,
    payload
  }: {
    taskId: string;
    decision: "approve" | "reject" | "skip";
    payload?: unknown;
  }) => {
    const { answerChatTurn } = await import("../../lib/chat-agent.js");
    await answerChatTurn({
      sessionId,
      turnId: activeTurnId,
      taskId,
      decision,
      ...(payload !== undefined
        ? { payload }
        : { text: decision === "skip" ? "Skipped" : "Rejected" })
    });
  };
}

export function RightStage(options: {
  sessionId: string;
  activeTurnId?: string | null;
  docs: FileTab[];
  activeId: string;
  activeDoc: FileTab | null;
  plan?: PlanCardModel | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onOpenRun: () => void;
  onCommentSent: () => void;
}) {
  const {
    sessionId,
    activeTurnId,
    docs,
    activeId,
    activeDoc,
    plan,
    onSelect,
    onClose,
    onOpenRun,
    onCommentSent
  } = options;
  const showPlan = activeId === PLAN_TAB_ID;
  const fileDoc =
    activeDoc && (activeDoc.kind === "file" || activeDoc.kind === "diff")
      ? activeDoc
      : null;
  const showFile = Boolean(fileDoc) && !showPlan;
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-w-0 shrink-0 items-center gap-0.5 overflow-x-auto border-b bg-muted/40 px-1">
        <RightDocTabs
          docs={docs}
          activeId={activeId}
          onSelect={onSelect}
          onClose={onClose}
        />
      </div>
      <div className="relative min-h-0 flex-1">
        <div className={cn("h-full", (showFile || showPlan) && "hidden")}>
          <AppPreviewPane
            sessionId={sessionId}
            onOpenRun={onOpenRun}
            onCommentSent={onCommentSent}
          />
        </div>
        {showPlan ? (
          <div className="absolute inset-0 bg-background">
            <PlanPanel
              plan={plan ?? null}
              sessionId={sessionId}
              onBuild={planBuildAction(sessionId, activeTurnId)}
              onHumanAnswer={planHumanAnswer(sessionId, activeTurnId)}
            />
          </div>
        ) : null}
        {showFile && fileDoc ? (
          <div className="absolute inset-0 bg-background">
            <FileTabPane sessionId={sessionId} tab={fileDoc} />
          </div>
        ) : null}
      </div>
      <BottomTerminal sessionId={sessionId} />
    </div>
  );
}
