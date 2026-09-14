import { describe, it, expect, vi } from "vitest";
import { MessageSquare } from "lucide-react";
import { fireEvent, render, screen } from "@testing-library/react";
import { LeftPaneRail, ResizableSplit } from "./workbench-split-view";

describe("workbench-split-view", () => {
  it("expands from the left rail", () => {
    const onToggle = vi.fn();
    render(<LeftPaneRail modeIcon={MessageSquare} onToggle={onToggle} />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Expand panel" })[0]!
    );
    expect(onToggle).toHaveBeenCalled();
  });

  it("renders split panes and collapses", () => {
    const onCollapse = vi.fn();
    render(
      <ResizableSplit
        left={<div>left-pane</div>}
        right={<div>right-pane</div>}
        leftCollapsed={false}
        leftRailIcon={MessageSquare}
        leftPct={40}
        onDragStart={() => undefined}
        onLeftPct={() => undefined}
        onCollapse={onCollapse}
        onExpand={() => undefined}
      />
    );
    expect(screen.getByText("left-pane")).toBeTruthy();
    expect(screen.getByText("right-pane")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Collapse panel" }));
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it("shows the rail when left is collapsed", () => {
    render(
      <ResizableSplit
        left={<div>hidden-left</div>}
        right={<div>right-only</div>}
        leftCollapsed
        leftRailIcon={MessageSquare}
        leftPct={40}
        onDragStart={() => undefined}
        onLeftPct={() => undefined}
        onCollapse={() => undefined}
        onExpand={() => undefined}
      />
    );
    expect(screen.getByText("right-only")).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "Expand panel" }).length
    ).toBeGreaterThan(0);
  });
});
