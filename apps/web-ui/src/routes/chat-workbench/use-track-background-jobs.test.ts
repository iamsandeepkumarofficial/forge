import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTrackBackgroundJobs } from "./use-track-background-jobs";
import {
  listTrackedBackgroundJobs,
  resetTrackedTerminalsForTests
} from "./tracked-terminals";

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
});
