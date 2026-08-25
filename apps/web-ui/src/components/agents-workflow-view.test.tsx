import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  AgentsWorkflowView,
  canRetry,
  resolveDisplayState
} from "./agents-workflow-view";

describe("agents-workflow-view", () => {
  it("canRetry allows terminal states", () => {
    expect(canRetry("done")).toBe(true);
    expect(canRetry("executing")).toBe(false);
  });

  it("resolveDisplayState maps executing to stopped when idle", () => {
    expect(
      resolveDisplayState(
        {
          stageId: "s",
          agentId: "a",
          state: "executing",
          manual: false,
          column: "dev",
          action: "generate"
        },
        false
      )
    ).toBe("stopped");
  });

  it("renders stage agents", () => {
    render(
      <MemoryRouter>
        <AgentsWorkflowView
          projectId="p1"
          chatId="c1"
          graph={{
            nodes: [
              {
                stageId: "s1",
                agentId: "builder",
                state: "done",
                manual: false,
                column: "dev",
                action: "generate"
              }
            ],
            edges: [],
            finished: false,
            workflow: { status: "completed" }
          }}
          error={null}
          busyStageId={null}
          stopping={false}
          onRetry={vi.fn()}
          onStop={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(screen.getByText("builder")).toBeTruthy();
  });
});
