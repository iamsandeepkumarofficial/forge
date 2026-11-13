import { useState } from "react";
import { useApps } from "./use-apps.js";
import { useCollapsibleSidebar } from "../../hooks/use-collapsible-sidebar.js";
import type { LeftPaneMode, WorkbenchChrome } from "./types.js";
import type { PlanCardModel } from "./plan-card.js";
import { PREVIEW_TAB_ID } from "./right-tabs.js";
import { ResizableSplit } from "./workbench-split-view.js";
import { MODE_ICON, RightStage, WorkbenchLeft } from "./workbench-panes.js";
import {
  useWorkbenchChrome,
  useWorkbenchDocs,
  useWorkbenchSplit
} from "./use-workbench-state.js";

function hasRunningPreviewUrl(
  apps: { type: string; running: boolean; url?: string }[]
): boolean {
  return apps.some((a) => a.type === "web" && a.running && Boolean(a.url));
}

const WORKBENCH_LEFT_KEY = "forge:workbench-left-collapsed";

export function Workbench(options: {
  sessionId: string;
  projectId: string;
  chatId: string;
  sessionKind: "ticket" | "workbench";
  workspaceId?: string;
  branchName?: string;
  initialPrompt?: string;
  leftMode: LeftPaneMode;
  onLeftModeChange: (mode: LeftPaneMode) => void;
  onChromeChange?: (chrome: WorkbenchChrome) => void;
}) {
  const o = options;
  const { collapsed, setCollapsed } = useCollapsibleSidebar(WORKBENCH_LEFT_KEY);
  const { apps } = useApps(o.sessionId);
  const previewLive = hasRunningPreviewUrl(apps);
  const split = useWorkbenchSplit({ previewLive });
  const docs = useWorkbenchDocs();
  const chrome = useWorkbenchChrome({ onChromeChange: o.onChromeChange });
  const [plan, setPlan] = useState<PlanCardModel | null>(null);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);

  return (
    <ResizableSplit
      leftCollapsed={collapsed}
      leftRailIcon={MODE_ICON[o.leftMode]}
      leftPct={split.leftPct}
      onLeftPct={split.setLeftPct}
      onDragStart={split.markUserOverride}
      onCollapse={() => setCollapsed(true)}
      onExpand={() => setCollapsed(false)}
      left={
        <WorkbenchLeft
          sessionId={o.sessionId}
          projectId={o.projectId}
          chatId={o.chatId}
          sessionKind={o.sessionKind}
          workspaceId={o.workspaceId}
          branchName={o.branchName}
          initialPrompt={o.initialPrompt}
          leftMode={o.leftMode}
          onLeftModeChange={o.onLeftModeChange}
          onOpenFile={docs.openFile}
          onOpenDiff={docs.openDiff}
          onShowPreview={() => docs.setActiveRight(PREVIEW_TAB_ID)}
          onOpenPlan={docs.openPlan}
          onPlanChange={setPlan}
          onActiveTurnIdChange={setActiveTurnId}
          onTurnStatus={chrome.setTurnStatus}
        />
      }
      right={
        <RightStage
          sessionId={o.sessionId}
          activeTurnId={activeTurnId}
          docs={docs.docs}
          activeId={docs.activeRight}
          activeDoc={docs.activeDoc}
          plan={plan}
          onSelect={docs.setActiveRight}
          onClose={docs.closeTab}
          onOpenRun={() => o.onLeftModeChange("run")}
          onCommentSent={() => o.onLeftModeChange("chat")}
        />
      }
    />
  );
}
