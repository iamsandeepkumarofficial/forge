import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SessionBootScreen } from "./session-boot";

describe("SessionBootScreen", () => {
  it("shows initializing copy while provisioning", () => {
    render(<SessionBootScreen sandboxStatus="starting" />);
    expect(screen.getByText("Initializing workspace…")).toBeTruthy();
    expect(screen.getByText(/Provisioning the sandbox/i)).toBeTruthy();
  });

  it("shows error state and retries", () => {
    const onRetry = vi.fn();
    render(<SessionBootScreen sandboxStatus="error" onRetry={onRetry} />);
    expect(screen.getByText("Workspace failed to start")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
