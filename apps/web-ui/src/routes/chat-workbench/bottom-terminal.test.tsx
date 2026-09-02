import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { BottomTerminal } from "./bottom-terminal";
import { requestDevtoolsToggle } from "./terminal-toggle";

vi.mock("./terminal-pane.js", () => ({
  TerminalPane: () => <div>terminal-output</div>
}));

vi.mock("../../lib/terminal-session-registry.js", () => ({
  retainTerminalSessionClient: () => ({
    connect() {
      return undefined;
    },
    disconnect() {
      return undefined;
    },
    subscribe() {
      return () => undefined;
    }
  }),
  releaseTerminalSessionClient: () => undefined
}));

describe("BottomTerminal", () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as { forgeDesktop?: unknown }).forgeDesktop;
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  });

  it("starts collapsed and expands like a bottom panel", () => {
    render(<BottomTerminal sessionId="s1" />);
    expect(
      screen.getByRole("button", { name: "Expand panel" }).getAttribute("aria-expanded")
    ).toBe("false");
    expect(screen.getByTestId("terminal-body").hasAttribute("hidden")).toBe(
      true
    );
    fireEvent.click(screen.getByRole("button", { name: "Terminal" }));
    expect(
      screen.getByRole("button", { name: "Collapse panel" }).getAttribute("aria-expanded")
    ).toBe("true");
    expect(screen.getByTestId("terminal-body").hasAttribute("hidden")).toBe(
      false
    );
    expect(screen.getByText("terminal-output")).toBeTruthy();
  });

  it("uses an Electron hole for official DevTools when the preview bridge exists", () => {
    window.forgeDesktop = {
      pickFolder: async () => null,
      preview: {
        setDevtoolsBounds: async () => undefined,
        setDevtoolsVisible: async () => undefined
      } as never
    };
    render(<BottomTerminal sessionId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: "DevTools" }));
    expect(screen.getByTestId("electron-devtools-hole")).toBeTruthy();
    expect(screen.queryByTestId("preview-devtools")).toBeNull();
  });

  it("opens DevTools in place of the terminal", () => {
    render(<BottomTerminal sessionId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: "DevTools" }));
    expect(screen.getByTestId("devtools-body").hasAttribute("hidden")).toBe(
      false
    );
    expect(screen.getByTestId("terminal-body").hasAttribute("hidden")).toBe(
      true
    );
    expect(screen.getByTestId("preview-devtools")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Console" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Terminal" }));
    expect(screen.getByTestId("terminal-body").hasAttribute("hidden")).toBe(
      false
    );
    expect(screen.getByTestId("devtools-body").hasAttribute("hidden")).toBe(
      true
    );
  });

  it("opens DevTools from the preview toolbar event", () => {
    render(<BottomTerminal sessionId="s1" />);
    act(() => {
      requestDevtoolsToggle();
    });
    expect(screen.getByTestId("devtools-body").hasAttribute("hidden")).toBe(
      false
    );
    expect(screen.getByTestId("terminal-body").hasAttribute("hidden")).toBe(
      true
    );
  });

  it("keeps the terminal open when opening a job tab ensures the dock", async () => {
    const { requestOpenTerminalJob } = await import("./terminal-toggle");
    render(<BottomTerminal sessionId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: "Terminal" }));
    expect(screen.getByTestId("terminal-body").hasAttribute("hidden")).toBe(
      false
    );
    act(() => {
      requestOpenTerminalJob("install");
    });
    expect(screen.getByTestId("terminal-body").hasAttribute("hidden")).toBe(
      false
    );
    expect(
      screen.getByRole("button", { name: "Collapse panel" }).getAttribute("aria-expanded")
    ).toBe("true");
  });

  it("keeps resizing after the pointer leaves the drag edge", () => {
    const shellHeight = 800;
    const pointerY = 400;
    const barHeight = 32;
    render(
      <div data-testid="shell">
        <BottomTerminal sessionId="s1" />
      </div>
    );
    fireEvent.click(screen.getByRole("button", { name: /terminal/i }));
    const shell = screen.getByTestId("shell");
    vi.spyOn(shell, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 400,
      bottom: shellHeight,
      width: 400,
      height: shellHeight,
      toJSON: () => ({})
    });
    const handle = screen.getByTitle("Drag to resize");
    fireEvent.pointerDown(handle, {
      pointerId: 1,
      button: 0,
      buttons: 1
    });
    act(() => {
      document.dispatchEvent(
        new MouseEvent("pointermove", {
          bubbles: true,
          cancelable: true,
          buttons: 1,
          clientY: pointerY
        })
      );
    });
    expect(
      screen.getByText("terminal-output").parentElement?.style.height
    ).toBe(`${shellHeight - pointerY - barHeight}px`);
  });
});
