import {
  CircleHelp,
  FileText,
  GitCompareArrows,
  MessageSquare,
  Play
} from "lucide-react";
import { ChangesTab, FilesTab } from "./files-panels.js";
import { RunSidebar } from "./run-sidebar.js";
import { HelpSidebar } from "./help-sidebar.js";
import { ChatPane } from "./chat-pane.js";
import { cn } from "@/lib/utils";
import type { LeftPaneMode, WorkbenchTurnStatus } from "./types.js";

export { RightStage } from "./workbench-right-stage.js";

export function WorkbenchLeft(options: {
  sessionId: string;
  projectId: string;
  chatId: string;
  sessionKind: "ticket" | "workbench";
  workspaceId?: string;
  branchName?: string;
  initialPrompt?: string;
  leftMode: LeftPaneMode;
  onLeftModeChange: (mode: LeftPaneMode) => void;
  onOpenFile: (path: string) => void;
  onOpenDiff: (repo: string, path: string) => void;
  onShowPreview: () => void;
  onTurnStatus: (status: WorkbenchTurnStatus) => void;
}) {
  const o = options;
  return (
    <div className="flex h-full flex-col">
      <div className={cn("min-h-0 flex-1", o.leftMode !== "chat" && "hidden")}>
        <ChatPane
          sessionId={o.sessionId}
          projectId={o.projectId}
          chatId={o.chatId}
          sessionKind={o.sessionKind}
          workspaceId={o.workspaceId}
          branchName={o.branchName}
          initialPrompt={o.initialPrompt}
          onOpenFile={o.onOpenFile}
          onTurnStatus={o.onTurnStatus}
          onOpenHelp={() => o.onLeftModeChange("help")}
        />
      </div>
      <div className={cn("min-h-0 flex-1", o.leftMode !== "files" && "hidden")}>
        <FilesTab sessionId={o.sessionId} onOpen={o.onOpenFile} />
      </div>
      {o.leftMode === "changes" ? (
        <div className="min-h-0 flex-1">
          <ChangesTab
            sessionId={o.sessionId}
            onRepo={() => undefined}
            onOpen={o.onOpenDiff}
          />
        </div>
      ) : null}
      {o.leftMode === "run" ? (
        <div className="min-h-0 flex-1">
          <RunSidebar sessionId={o.sessionId} onShowPreview={o.onShowPreview} />
        </div>
      ) : null}
      {o.leftMode === "help" ? (
        <div className="min-h-0 flex-1">
          <HelpSidebar
            sessionId={o.sessionId}
            onSwitchToChat={() => o.onLeftModeChange("chat")}
          />
        </div>
      ) : null}
    </div>
  );
}

export const MODE_ICON = {
  chat: MessageSquare,
  files: FileText,
  changes: GitCompareArrows,
  run: Play,
  help: CircleHelp
} as const;
