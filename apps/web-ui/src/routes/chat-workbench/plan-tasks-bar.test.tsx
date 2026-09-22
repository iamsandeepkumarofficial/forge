import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlanTasksBar } from "./plan-tasks-bar";
import type { PlanCardModel } from "./plan-card.js";

const plan: PlanCardModel = {
  goal: "Ship login",
  status: "running",
  version: 1,
  tasks: [
    {
      id: "inspect",
      description: "Inspect auth",
      status: "completed",
      dependencies: []
    },
    {
      id: "implement",
      description: "Implement form",
      status: "running",
      dependencies: ["inspect"]
    }
  ]
};

describe("PlanTasksBar", () => {
  it("shows collapsed progress and expands the task list", () => {
    render(<PlanTasksBar plan={plan} />);
    expect(screen.getByTestId("plan-tasks-bar")).toBeTruthy();
    expect(screen.getByText(/1\/2 tasks · Implement form/)).toBeTruthy();
    expect(screen.queryByText("Inspect auth")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /1\/2 tasks/i }));
    expect(screen.getByText("Inspect auth")).toBeTruthy();
    expect(screen.getByText("Implement form")).toBeTruthy();
  });

  it("opens the plan panel when requested", () => {
    const onOpenPlan = vi.fn();
    render(<PlanTasksBar plan={plan} onOpenPlan={onOpenPlan} />);
    fireEvent.click(screen.getByRole("button", { name: "Panel" }));
    expect(onOpenPlan).toHaveBeenCalled();
  });
});
