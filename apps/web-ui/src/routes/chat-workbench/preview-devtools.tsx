import { useId, type FormEvent } from "react";
import { postToPreviewInspect } from "./preview-devtools-model.js";
import {
  ConsolePanel,
  DevtoolsTabBar,
  ElementsPanel,
  NetworkPanel
} from "./preview-devtools-panels.js";
import { usePreviewDevtools } from "./use-preview-devtools.js";

export function PreviewDevtools() {
  const state = usePreviewDevtools();
  const evalId = useId();

  const onEval = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const field = e.currentTarget.elements.namedItem("expr");
    if (!(field instanceof HTMLInputElement)) return;
    const expr = field.value.trim();
    if (!expr) return;
    postToPreviewInspect({ type: "forge-devtools-eval", expr });
    field.value = "";
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background"
      data-testid="preview-devtools"
    >
      <DevtoolsTabBar
        tab={state.tab}
        onTab={state.setTab}
        onClear={state.clearActive}
      />
      {state.tab === "console" ? (
        <ConsolePanel
          logs={state.logs}
          logEnd={state.logEnd}
          evalId={evalId}
          onEval={onEval}
        />
      ) : null}
      {state.tab === "elements" ? (
        <ElementsPanel
          selecting={state.selecting}
          pick={state.pick}
          tree={state.tree}
          treeError={state.treeError}
          onToggleSelect={state.toggleSelect}
        />
      ) : null}
      {state.tab === "network" ? (
        <NetworkPanel requests={state.requests} />
      ) : null}
    </div>
  );
}
