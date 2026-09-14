import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TabButton } from "./terminal-tab-button";
import type { TerminalTab } from "../../lib/session-terminal.js";

const shellTab: TerminalTab = {
  id: "shell-1",
  kind: "shell",
  label: "Shell",
  running: false,
  closable: true
};

const runningApp: TerminalTab = {
  id: "app:web",
  kind: "app",
  label: "web",
  running: true,
  closable: true
};

describe("TabButton", () => {
  it("selects and closes a shell tab", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <TabButton tab={shellTab} active onSelect={onSelect} onClose={onClose} />
    );
    fireEvent.click(screen.getByText("Shell"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close Shell" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows a running indicator for app tabs", () => {
    render(
      <TabButton
        tab={runningApp}
        active={false}
        onSelect={() => undefined}
        onClose={() => undefined}
      />
    );
    expect(screen.getByLabelText("Running")).toBeTruthy();
    expect(screen.getByText("web")).toBeTruthy();
  });
});
