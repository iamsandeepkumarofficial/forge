import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlanCard, planCardFromSnapshot } from "./plan-card";

describe("PlanCard", () => {
  it("renders goal and task statuses", () => {
    const plan = planCardFromSnapshot({
      id: "p1",
      goal: "Ship login",
      status: "running",
      version: 1,
      tasks: [
        {
          id: "inspect",
          description: "Inspect auth",
          status: "completed"
        },
        {
          id: "implement",
          description: "Implement form",
          status: "running"
        }
      ]
    });
    expect(plan).not.toBeNull();
    render(<PlanCard plan={plan!} />);
    expect(screen.getByLabelText("Execution plan")).toBeTruthy();
    expect(screen.getByText("Ship login")).toBeTruthy();
    expect(screen.getByText("Inspect auth")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.getByText("Running")).toBeTruthy();
  });

  it("shows queue banner and Send now", () => {
    const plan = planCardFromSnapshot({
      goal: "Ship login",
      status: "running",
      version: 1,
      queuedFollowUp: { text: "also fix logout" },
      tasks: []
    });
    const onForceSend = vi.fn();
    render(<PlanCard plan={plan!} onForceSend={onForceSend} />);
    expect(screen.getByText(/Queued: also fix logout/)).toBeTruthy();
    screen.getByRole("button", { name: "Send now" }).click();
    expect(onForceSend).toHaveBeenCalled();
  });
});
