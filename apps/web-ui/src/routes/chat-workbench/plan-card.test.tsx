import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

  it("maps and renders fluid sections plus task rationale", () => {
    const plan = planCardFromSnapshot({
      goal: "Ship login",
      sections: [
        { title: "Problem", body: "No session boundary" },
        { title: "Risks", body: "Breaking existing sessions" }
      ],
      status: "planned",
      version: 1,
      tasks: [
        {
          id: "inspect",
          description: "Inspect auth",
          rationale: "Map what exists first",
          isolation: "child",
          status: "pending"
        }
      ]
    });
    expect(plan?.sections).toEqual([
      { title: "Problem", body: "No session boundary" },
      { title: "Risks", body: "Breaking existing sessions" }
    ]);
    expect(plan?.tasks[0]?.rationale).toBe("Map what exists first");
    expect(plan?.tasks[0]?.isolation).toBe("child");
    render(<PlanCard plan={plan!} />);
    expect(screen.getByText(/No session boundary/)).toBeTruthy();
    expect(screen.getByText(/Breaking existing sessions/)).toBeTruthy();
    expect(screen.getByText("Map what exists first")).toBeTruthy();
    expect(screen.getByText("parallel")).toBeTruthy();
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

  it("shows Build when planned and calls onBuild", () => {
    const plan = planCardFromSnapshot({
      goal: "Ship login",
      status: "planned",
      version: 1,
      tasks: [{ id: "a", description: "Inspect", status: "pending" }]
    });
    const onBuild = vi.fn();
    render(<PlanCard plan={plan!} onBuild={onBuild} />);
    screen.getByRole("button", { name: "Build" }).click();
    expect(onBuild).toHaveBeenCalled();
  });

  it("hides Build when plan is already running", () => {
    const plan = planCardFromSnapshot({
      goal: "Ship login",
      status: "running",
      version: 1,
      tasks: []
    });
    render(<PlanCard plan={plan!} onBuild={() => undefined} />);
    expect(screen.queryByRole("button", { name: "Build" })).toBeNull();
  });

  it("renders a human output form from outputSchema", async () => {
    const onHumanAnswer = vi.fn();
    const plan = planCardFromSnapshot({
      goal: "Approve deploy",
      status: "waiting",
      version: 1,
      tasks: [
        {
          id: "gate",
          description: "Approve?",
          status: "waiting",
          executor: "human",
          outputSchema: {
            schemaVersion: 1,
            type: "object",
            additionalProperties: false,
            properties: {
              approved: { type: "boolean" }
            },
            required: ["approved"]
          }
        }
      ]
    });
    render(<PlanCard plan={plan!} onHumanAnswer={onHumanAnswer} />);
    await act(async () => {
      screen.getByRole("button", { name: "Submit" }).click();
    });
    expect(onHumanAnswer).not.toHaveBeenCalled();
    expect(screen.getByText("Choose yes or no for approved")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "true" }
    });
    await act(async () => {
      screen.getByRole("button", { name: "Submit" }).click();
    });
    expect(onHumanAnswer).toHaveBeenCalledWith({
      taskId: "gate",
      decision: "approve",
      payload: { approved: true }
    });
    await act(async () => {
      screen.getByRole("button", { name: "Reject" }).click();
    });
    expect(onHumanAnswer).toHaveBeenCalledWith({
      taskId: "gate",
      decision: "reject"
    });
  });

  it("seeds a nested human form from the output schema", () => {
    const plan = planCardFromSnapshot({
      goal: "Collect",
      status: "waiting",
      version: 1,
      tasks: [
        {
          id: "form",
          description: "Details",
          status: "waiting",
          executor: "human",
          outputSchema: {
            schemaVersion: 1,
            type: "object",
            additionalProperties: false,
            properties: {
              company: {
                type: "object",
                properties: { name: { type: "string" } }
              }
            }
          }
        }
      ]
    });
    render(<PlanCard plan={plan!} onHumanAnswer={() => undefined} />);
    const area = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(area.value).toContain('"company"');
    expect(area.value).toContain('"name"');
  });
});
