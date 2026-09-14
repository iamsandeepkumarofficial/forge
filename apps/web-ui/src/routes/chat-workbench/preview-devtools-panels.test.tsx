import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  ConsolePanel,
  DevtoolsTabBar,
  ElementsPanel,
  NetworkPanel
} from "./preview-devtools-panels";

describe("preview-devtools-panels", () => {
  it("switches tabs and clears", () => {
    const onTab = vi.fn();
    const onClear = vi.fn();
    render(<DevtoolsTabBar tab="console" onTab={onTab} onClear={onClear} />);
    fireEvent.click(screen.getByRole("button", { name: "Network" }));
    expect(onTab).toHaveBeenCalledWith("network");
    fireEvent.click(screen.getByRole("button", { name: "Clear console" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("renders console logs and eval form", () => {
    const onEval = vi.fn((e) => e.preventDefault());
    const logEnd = createRef<HTMLDivElement>();
    render(
      <ConsolePanel
        logs={[
          { id: "1", level: "log", args: ["hello"], ts: 1 },
          { id: "2", level: "error", args: ["boom"], ts: 2 }
        ]}
        logEnd={logEnd}
        evalId="eval-1"
        onEval={onEval}
      />
    );
    expect(screen.getByText("hello")).toBeTruthy();
    expect(screen.getByText("boom")).toBeTruthy();
    fireEvent.submit(screen.getByPlaceholderText("Evaluate in the preview"));
    expect(onEval).toHaveBeenCalled();
  });

  it("toggles element select and shows tree error", () => {
    const onToggleSelect = vi.fn();
    render(
      <ElementsPanel
        selecting={false}
        pick={null}
        tree={null}
        treeError="DOM unavailable"
        onToggleSelect={onToggleSelect}
      />
    );
    expect(screen.getByText("DOM unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Select element/i }));
    expect(onToggleSelect).toHaveBeenCalledTimes(1);
  });

  it("renders network requests", () => {
    render(
      <NetworkPanel
        requests={[
          {
            id: "r1",
            method: "GET",
            url: "/health",
            status: 200,
            duration: 12,
            ts: 1
          }
        ]}
      />
    );
    expect(screen.getByText("GET")).toBeTruthy();
    expect(screen.getByText("/health")).toBeTruthy();
    expect(screen.getByText("200")).toBeTruthy();
  });
});
