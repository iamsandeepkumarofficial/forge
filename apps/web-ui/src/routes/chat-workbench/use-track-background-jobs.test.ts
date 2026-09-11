import { beforeEach, describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTrackBackgroundJobs } from "./use-track-background-jobs";
import {
  listTrackedApps,
  listTrackedBackgroundJobs,
  resetTrackedTerminalsForTests
} from "./tracked-terminals";

const listTerminalJobs = vi.fn(async (_sessionId?: string) => [
  { name: "old", running: true }
]);
const fetchApps = vi.fn(async (_sessionId?: string) => ({
  exists: true,
  apps: [] as Array<{ name: string; running: boolean }>
}));

vi.mock("../../lib/session-terminal.js", () => ({
  listTerminalJobs: (sessionId: string) => listTerminalJobs(sessionId)
}));

vi.mock("../../lib/tool-runner.js", () => ({
  fetchApps: (sessionId: string) => fetchApps(sessionId)
}));

vi.mock("../../lib/terminal-session-client.js", () => ({
  streamIdForJobTab: (name: string) => `job:${name}`,
  streamIdForAppTab: (tabId: string) => tabId,
  TerminalSessionClient: class {
    connect() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
    subscribe() {
      return () => undefined;
    }
  }
}));

const historyMessages = [
  {
    id: "m1",
    role: "assistant" as const,
    parts: [
      {
        type: "tool-invocation",
        toolName: "run_terminal",
        args: { background: true, jobName: "old" },
        metadata: { jobName: "old", running: true },
        output: "running"
      }
    ]
  }
];

describe("useTrackBackgroundJobs", () => {
  beforeEach(() => {
    resetTrackedTerminalsForTests();
    listTerminalJobs.mockReset();
    listTerminalJobs.mockResolvedValue([{ name: "old", running: true }]);
    fetchApps.mockReset();
    fetchApps.mockResolvedValue({ exists: true, apps: [] });
  });
  it("waits for historyLoaded before scanning messages", async () => {
    resetTrackedTerminalsForTests();
    const { rerender } = renderHook(
      ({ historyLoaded, messages }) =>
        useTrackBackgroundJobs({
          sessionId: "s1",
          messages,
          historyLoaded,
          liveToolParts: []
        }),
      {
        initialProps: {
          historyLoaded: false,
          messages: [] as typeof historyMessages
        }
      }
    );
    expect(listTrackedBackgroundJobs("s1")).toEqual([]);
    rerender({ historyLoaded: false, messages: historyMessages });
    expect(listTrackedBackgroundJobs("s1")).toEqual([]);
    rerender({ historyLoaded: true, messages: historyMessages });
    await waitFor(() => {
      expect(listTrackedBackgroundJobs("s1")).toEqual(["old"]);
    });
  });

  it("does not re-scan history on later message updates", async () => {
    resetTrackedTerminalsForTests();
    const { rerender } = renderHook(
      ({ historyLoaded, messages }) =>
        useTrackBackgroundJobs({
          sessionId: "s1",
          messages,
          historyLoaded,
          liveToolParts: []
        }),
      {
        initialProps: {
          historyLoaded: true,
          messages: historyMessages
        }
      }
    );
    await waitFor(() => {
      expect(listTrackedBackgroundJobs("s1")).toEqual(["old"]);
    });
    rerender({
      historyLoaded: true,
      messages: [
        ...historyMessages,
        {
          id: "m2",
          role: "assistant" as const,
          parts: [
            {
              type: "tool-invocation",
              toolName: "run_terminal",
              args: { background: true, jobName: "new" },
              metadata: { jobName: "new", running: true },
              output: "running"
            }
          ]
        }
      ]
    });
    expect(listTrackedBackgroundJobs("s1")).toEqual(["old"]);
  });

  it("does not restore completed historical jobs", async () => {
    listTerminalJobs.mockResolvedValue([]);
    renderHook(() =>
      useTrackBackgroundJobs({
        sessionId: "s1",
        messages: historyMessages,
        historyLoaded: true,
        liveToolParts: []
      })
    );
    await waitFor(() => {
      expect(listTerminalJobs).toHaveBeenCalled();
    });
    expect(listTrackedBackgroundJobs("s1")).toEqual([]);
  });

  it("does not restore historical preview_start apps that are not running", async () => {
    fetchApps.mockResolvedValue({
      exists: true,
      apps: [
        { name: "web", running: false },
        { name: "api", running: false }
      ]
    });
    renderHook(() =>
      useTrackBackgroundJobs({
        sessionId: "fork",
        messages: [
          {
            id: "m1",
            role: "assistant",
            parts: [
              {
                type: "tool-invocation",
                toolName: "preview_start",
                metadata: { app: { name: "web", running: true } },
                output: "Started web"
              },
              {
                type: "tool-invocation",
                toolName: "preview_start",
                metadata: { app: { name: "api", running: true } },
                output: "Started api"
              }
            ]
          }
        ],
        historyLoaded: true,
        liveToolParts: []
      })
    );
    await waitFor(() => {
      expect(fetchApps).toHaveBeenCalledWith("fork");
    });
    expect(listTrackedApps("fork")).toEqual([]);
  });

  it("restores historical preview_start apps that are still running", async () => {
    fetchApps.mockResolvedValue({
      exists: true,
      apps: [
        { name: "web", running: true },
        { name: "api", running: false }
      ]
    });
    renderHook(() =>
      useTrackBackgroundJobs({
        sessionId: "s1",
        messages: [
          {
            id: "m1",
            role: "assistant",
            parts: [
              {
                type: "tool-invocation",
                toolName: "preview_start",
                metadata: { app: { name: "web", running: true } },
                output: "Started web"
              },
              {
                type: "tool-invocation",
                toolName: "preview_start",
                metadata: { app: { name: "api", running: true } },
                output: "Started api"
              }
            ]
          }
        ],
        historyLoaded: true,
        liveToolParts: []
      })
    );
    await waitFor(() => {
      expect(listTrackedApps("s1")).toEqual(["web"]);
    });
  });
});
