import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StagePipelineTranscript } from "./stage-pipeline-transcript";
vi.mock("@/lib/projects-api", () => ({
  getWorkflowTranscript: vi.fn()
}));
import { getWorkflowTranscript } from "@/lib/projects-api";
describe("StagePipelineTranscript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("renders prompt, tool steps, model metadata, and output for executed stages", async () => {
    vi.mocked(getWorkflowTranscript).mockResolvedValue({
      stages: [
        {
          stageId: "requirement",
          agentId: "requirement-gatherer",
          action: "generate",
          state: "done",
          executed: true,
          model: {
            provider: "openai",
            name: "gpt-4o-mini",
            source: "env"
          },
          outputPreview: "## Requirement\n\nShip login.",
          source: "session",
          messages: [
            {
              role: "system",
              parts: [
                {
                  type: "stage-meta",
                  stageId: "requirement",
                  agentId: "requirement-gatherer",
                  action: "generate",
                  model: {
                    provider: "openai",
                    name: "gpt-4o-mini",
                    source: "env"
                  }
                },
                {
                  type: "text",
                  text: "Stage `requirement` · agent `requirement-gatherer` · generate"
                }
              ]
            },
            {
              role: "user",
              parts: [{ type: "text", text: "Produce your deliverable…" }]
            },
            {
              role: "assistant",
              parts: [
                {
                  type: "tool-invocation",
                  toolName: "read_file",
                  args: { path: "README.md" },
                  output: "# Hello",
                  state: "result"
                },
                { type: "text", text: "## Requirement\n\nShip login." }
              ]
            }
          ]
        }
      ]
    });
    render(<StagePipelineTranscript projectId="p1" chatId="c1" />);
    await waitFor(() => {
      expect(screen.getByText("requirement-gatherer")).toBeTruthy();
    });
    expect(screen.getByText("openai/gpt-4o-mini")).toBeTruthy();
    expect(screen.getByText("Prompt")).toBeTruthy();
    expect(screen.getByText(/Produce your deliverable/)).toBeTruthy();
    expect(screen.getByText("read_file")).toBeTruthy();
    expect(screen.getByText(/Ship login/)).toBeTruthy();
    expect(screen.queryByText("Not run yet")).toBeNull();
  });
  it("shows historical output-only fallback without fabricating prompt or model", async () => {
    vi.mocked(getWorkflowTranscript).mockResolvedValue({
      stages: [
        {
          stageId: "requirement",
          agentId: "requirement-gatherer",
          action: "generate",
          state: "done",
          executed: true,
          model: null,
          outputPreview: "Legacy stage summary from card comment.",
          source: "comment",
          messages: []
        }
      ]
    });
    render(<StagePipelineTranscript projectId="p1" chatId="c1" />);
    await waitFor(() => {
      expect(screen.getByText("historical output only")).toBeTruthy();
    });
    expect(screen.getByText(/Legacy stage summary/)).toBeTruthy();
    expect(screen.queryByText("Prompt")).toBeNull();
    expect(screen.queryByText("openai/")).toBeNull();
  });
});
