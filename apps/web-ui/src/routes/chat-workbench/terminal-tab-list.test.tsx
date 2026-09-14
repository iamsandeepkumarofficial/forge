import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TerminalTabList } from "./terminal-tab-list";
import type { TerminalTab } from "../../lib/session-terminal.js";

const shell: TerminalTab = {
  id: "shell-1",
  kind: "shell",
  label: "main",
  running: false,
  closable: true
};

describe("TerminalTabList", () => {
  it("lists tabs and creates a shell", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const onCreate = vi.fn();
    render(
      <TerminalTabList
        width={120}
        shells={[shell]}
        apps={[]}
        jobs={[]}
        activeTabId="shell-1"
        busy={false}
        error={null}
        onSelect={onSelect}
        onClose={onClose}
        onCreate={onCreate}
        onResizePointerDown={() => undefined}
      />
    );
    expect(screen.getByTestId("terminal-tab-list")).toBeTruthy();
    expect(screen.getByText("main")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "New shell tab" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("main"));
    expect(onSelect).toHaveBeenCalledWith("shell-1");
  });

  it("shows busy and error states", () => {
    render(
      <TerminalTabList
        width={100}
        shells={[]}
        apps={[]}
        jobs={[]}
        activeTabId={null}
        busy
        error="create failed"
        onSelect={() => undefined}
        onClose={() => undefined}
        onCreate={() => undefined}
        onResizePointerDown={() => undefined}
      />
    );
    expect(screen.getByText("Creating…")).toBeTruthy();
    expect(screen.getByText("create failed")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "New shell tab"
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });
});
