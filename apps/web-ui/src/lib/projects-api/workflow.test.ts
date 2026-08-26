import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getWorkflow,
  getStageMessages,
  retryStage,
  stopWorkflow,
  getWorkflowTranscript,
  enterManualMode,
  completeManualStage
} from "./workflow";
import { ConnectProjectError } from "./shared";

describe("workflow API", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("getWorkflow GETs the workflow graph", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nodes: [],
        edges: [],
        finished: false,
        workflow: { status: "running" }
      })
    } as Response);
    const graph = await getWorkflow("p1", "c1");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/chats/c1/workflow"
    );
    expect(graph.workflow.status).toBe("running");
  });

  it("getStageMessages uses an options object", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        stageId: "s1",
        agentId: "a1",
        mode: "auto",
        messages: []
      })
    } as Response);
    await getStageMessages({ projectId: "p1", chatId: "c1", stageId: "s1" });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/chats/c1/workflow/stages/s1/messages"
    );
  });

  it("retryStage POSTs with an options object", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);
    await retryStage({ projectId: "p1", chatId: "c1", stageId: "s1" });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/chats/c1/workflow/stages/s1/retry",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("stopWorkflow POSTs the stop endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);
    await stopWorkflow("p1", "c1");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/chats/c1/workflow/stop",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("getWorkflowTranscript GETs transcript", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ stages: [] })
    } as Response);
    const t = await getWorkflowTranscript("p1", "c1");
    expect(t.stages).toEqual([]);
  });

  it("enterManualMode and completeManualStage POST stage actions", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    await enterManualMode({ projectId: "p1", chatId: "c1", stageId: "s1" });
    await completeManualStage({
      projectId: "p1",
      chatId: "c1",
      stageId: "s1"
    });
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain("/manual");
    expect(vi.mocked(fetch).mock.calls[1]?.[0]).toContain("/complete");
  });

  it("throws ConnectProjectError on failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    await expect(getWorkflow("p1", "c1")).rejects.toBeInstanceOf(
      ConnectProjectError
    );
  });
});
