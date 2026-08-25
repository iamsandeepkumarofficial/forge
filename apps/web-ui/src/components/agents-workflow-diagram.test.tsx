import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AgentsWorkflowDiagram } from "./agents-workflow-diagram";
import type { WorkflowGraph } from "@/lib/projects-api";
vi.mock("@/lib/projects-api", () => ({
  getWorkflow: vi.fn(),
  retryStage: vi.fn(),
  stopWorkflow: vi.fn()
}));
import { getWorkflow, retryStage, stopWorkflow } from "@/lib/projects-api";
const nodes = [
  {
    stageId: "a",
    agentId: "requirement-gatherer",
    column: "planning",
    action: "generate",
    state: "done" as const,
    manual: false
  },
  {
    stageId: "b",
    agentId: "architecture-planning",
    column: "planning",
    action: "generate",
    state: "executing" as const,
    manual: true
  },
  {
    stageId: "c",
    agentId: "data-modeler",
    column: "planning",
    action: "generate",
    state: "idle" as const,
    manual: false
  }
];
const runningGraph: WorkflowGraph = {
  finished: false,
  workflow: { status: "running" },
  edges: [
    { from: "a", to: "b" },
    { from: "b", to: "c" }
  ],
  nodes
};
const stoppedGraph: WorkflowGraph = {
  ...runningGraph,
  workflow: { status: "terminated" }
};
function renderDiagram(graph: WorkflowGraph = runningGraph) {
  return render(
    <MemoryRouter>
      <AgentsWorkflowDiagram
        projectId="project-1"
        chatId="chat-1"
        initialGraph={graph}
      />
    </MemoryRouter>
  );
}
describe("AgentsWorkflowDiagram", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWorkflow).mockResolvedValue(runningGraph);
    vi.mocked(retryStage).mockResolvedValue();
    vi.mocked(stopWorkflow).mockResolvedValue();
  });
  it("renders agent names without status text and the Enter Workbench link", () => {
    renderDiagram();
    expect(screen.getByText("requirement-gatherer")).toBeTruthy();
    expect(screen.getByText("architecture-planning")).toBeTruthy();
    expect(screen.queryByText(/^done$/i)).toBeNull();
    expect(screen.queryByText(/^idle$/i)).toBeNull();
    expect(screen.queryByText(/^executing$/i)).toBeNull();
    const workbench = screen.getByRole("link", { name: /Enter Workbench/i });
    expect(workbench.getAttribute("href")).toBe(
      "/projects/project-1/chats/chat-1"
    );
  });
  it("shows a banner when the workflow is not running", () => {
    renderDiagram(stoppedGraph);
    expect(screen.getByText(/Pipeline stopped/i)).toBeTruthy();
  });
  it("shows Stop on the active stage and Retry only on stages that already ran", () => {
    renderDiagram();
    expect(
      screen.getByRole("button", { name: "Stop architecture-planning" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Retry requirement-gatherer" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Retry data-modeler" })
    ).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
  it("hides Stop when not running and offers Retry on executed and interrupted stages", () => {
    renderDiagram(stoppedGraph);
    expect(screen.queryByRole("button", { name: /^Stop / })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Retry requirement-gatherer" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Retry architecture-planning" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Retry data-modeler" })
    ).toBeNull();
    expect(screen.queryByText(/^stopped$/i)).toBeNull();
    expect(screen.queryByText(/^idle$/i)).toBeNull();
    expect(screen.queryByText(/^done$/i)).toBeNull();
  });
  it("calls retryStage for an already-executed stage", async () => {
    renderDiagram(stoppedGraph);
    fireEvent.click(
      screen.getByRole("button", { name: "Retry architecture-planning" })
    );
    await waitFor(() => {
      expect(retryStage).toHaveBeenCalledWith({
        projectId: "project-1",
        chatId: "chat-1",
        stageId: "b"
      });
    });
  });
  it("calls stopWorkflow when Stop is clicked on the active stage", async () => {
    renderDiagram();
    fireEvent.click(
      screen.getByRole("button", { name: "Stop architecture-planning" })
    );
    await waitFor(() => {
      expect(stopWorkflow).toHaveBeenCalledWith("project-1", "chat-1");
    });
  });
});
