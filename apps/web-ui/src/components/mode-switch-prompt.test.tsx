import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModeSwitchPrompt } from "./mode-switch-prompt";

describe("ModeSwitchPrompt", () => {
  it("confirms and dismisses", () => {
    const onConfirm = vi.fn();
    const onDismiss = vi.fn();
    render(
      <ModeSwitchPrompt
        target="ask"
        remainingSeconds={45}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />
    );
    expect(screen.getByTestId("mode-switch-prompt")).toBeTruthy();
    expect(screen.getByTestId("mode-switch-countdown").textContent).toBe("45s");
    fireEvent.click(screen.getByRole("button", { name: "Switch to Ask" }));
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("renders remaining seconds", () => {
    render(
      <ModeSwitchPrompt
        target="plan"
        remainingSeconds={12}
        onConfirm={() => undefined}
        onDismiss={() => undefined}
      />
    );
    expect(screen.getByTestId("mode-switch-countdown").textContent).toBe("12s");
  });
});
