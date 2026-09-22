import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlanPanel } from "./plan-panel";
import { planCardFromSnapshot } from "./plan-card";

describe("PlanPanel", () => {
  it("shows an empty state when there is no plan", () => {
    render(<PlanPanel plan={null} />);
    expect(screen.getByText("No active plan for this session.")).toBeTruthy();
  });

  it("renders the plan card when a plan exists", () => {
    const plan = planCardFromSnapshot({
      goal: "Ship login",
      status: "running",
      version: 1,
      tasks: [{ id: "t1", description: "Inspect", status: "pending" }]
    });
    render(<PlanPanel plan={plan} />);
    expect(screen.getByText("Ship login")).toBeTruthy();
    expect(screen.getByText("Inspect")).toBeTruthy();
  });
});
