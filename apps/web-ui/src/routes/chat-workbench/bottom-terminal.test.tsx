import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { BottomTerminal } from "./bottom-terminal";

vi.mock("./terminal-pane.js", () => ({
  TerminalPane: () => <div>terminal-output</div>
}));

describe("BottomTerminal", () => {
  beforeEach(() => {
    localStorage.clear();
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  });

  it("starts collapsed and expands like a bottom panel", () => {
    render(<BottomTerminal sessionId="s1" />);
    expect(
      screen
        .getByRole("button", { name: /terminal/i })
        .getAttribute("aria-expanded")
    ).toBe("false");
    expect(screen.queryByText("terminal-output")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /terminal/i }));
    expect(
      screen
        .getByRole("button", { name: /terminal/i })
        .getAttribute("aria-expanded")
    ).toBe("true");
    expect(screen.getByText("terminal-output")).toBeTruthy();
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
