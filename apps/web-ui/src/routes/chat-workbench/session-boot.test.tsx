import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SessionBootScreen, bootExistingOrStartSession } from "./session-boot";

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

  it("skips the starting state when the sandbox is already ready", async () => {
    const setStatus = vi.fn();
    const start = vi.fn().mockResolvedValue({ sessionId: "s1" });
    await bootExistingOrStartSession({
      sessionId: "s1",
      getStatus: async () => ({ status: "ready" }),
      start,
      setStatus
    });
    expect(setStatus.mock.calls[0]?.[0]).toBe("ready");
    expect(setStatus.mock.calls.some((c) => c[0] === "starting")).toBe(false);
    expect(start).toHaveBeenCalledWith("s1");
    expect(setStatus).toHaveBeenLastCalledWith("ready");
  });

  it("shows starting then ready on a cold boot", async () => {
    const setStatus = vi.fn();
    await bootExistingOrStartSession({
      sessionId: "s1",
      getStatus: async () => ({ status: "absent" }),
      start: async () => ({ sessionId: "s1" }),
      setStatus
    });
    expect(setStatus.mock.calls.map((c) => c[0])).toEqual([
      "starting",
      "ready"
    ]);
  });
});
