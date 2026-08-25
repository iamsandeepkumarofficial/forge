import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listWorkflows,
  getWorkflowDefinition,
  saveWorkflow,
  deleteWorkflow,
  listAgents,
  getAgentDefinition,
  saveAgent,
  deleteAgent
} from "./definitions-api";

describe("definitions-api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("listWorkflows GETs workflow catalog", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: "w1",
          name: "Default",
          version: 1,
          stageCount: 2,
          source: "system",
          finalColumn: "done"
        }
      ]
    } as Response);
    const rows = await listWorkflows();
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/workflows",
      expect.any(Object)
    );
    expect(rows[0]?.id).toBe("w1");
  });

  it("get/save/delete workflow definitions", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "w1",
          source: "user",
          definition: {
            name: "W",
            version: 1,
            stages: [],
            finalColumn: "done"
          },
          yaml: ""
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "w1",
          source: "user",
          definition: {
            name: "W",
            version: 2,
            stages: [],
            finalColumn: "done"
          },
          yaml: "name: W"
        })
      } as Response)
      .mockResolvedValueOnce({ ok: true, status: 204 } as Response);
    await getWorkflowDefinition("w1");
    await saveWorkflow("w1", { yaml: "name: W" });
    await deleteWorkflow("w1");
    expect(
      vi.mocked(fetch).mock.calls.map((c) => c[1]?.method ?? "GET")
    ).toEqual(["GET", "PUT", "DELETE"]);
  });

  it("list/get/save/delete agents", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: "a1", name: "Agent", version: 1, source: "system" }
        ]
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "a1",
          source: "user",
          definition: { name: "Agent" },
          yaml: ""
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "a1",
          source: "user",
          definition: { name: "Agent" },
          yaml: "name: Agent"
        })
      } as Response)
      .mockResolvedValueOnce({ ok: true, status: 204 } as Response);
    expect((await listAgents())[0]?.id).toBe("a1");
    await getAgentDefinition("a1");
    await saveAgent("a1", { yaml: "name: Agent" });
    await deleteAgent("a1");
    expect(vi.mocked(fetch).mock.calls[3]?.[0]).toContain("/api/agents/a1");
  });
});
