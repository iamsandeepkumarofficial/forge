import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isBackgroundTerminalToolPart,
  listTrackedBackgroundJobs,
  resetBackgroundJobsForTests,
  shouldTrackBackgroundToolPart,
  shouldTrackPreviewStartToolPart,
  terminalAppNameFromToolPart,
  terminalJobNameFromToolPart,
  trackBackgroundJobsFromToolParts
} from "./background-jobs";
import { resetTerminalSessionRegistryForTests } from "../../lib/terminal-session-registry";

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

describe("background-jobs", () => {
  beforeEach(() => {
    resetBackgroundJobsForTests();
    resetTerminalSessionRegistryForTests();
  });

  it("extracts job and app names from tool parts", () => {
    expect(
      terminalJobNameFromToolPart({
        type: "tool-invocation",
        toolName: "run_terminal",
        args: { jobName: "build" },
        metadata: { jobName: "build" }
      })
    ).toBe("build");
    expect(
      terminalAppNameFromToolPart({
        type: "tool-invocation",
        toolName: "preview_start",
        args: { name: "web" },
        metadata: { app: { name: "web" } }
      })
    ).toBe("web");
  });

  it("tracks background jobs from tool parts", () => {
    expect(
      isBackgroundTerminalToolPart({
        type: "tool-invocation",
        toolName: "run_terminal",
        args: { background: true, jobName: "install" },
        metadata: { jobName: "install", running: true }
      })
    ).toBe(true);
    expect(
      shouldTrackBackgroundToolPart({
        type: "tool-invocation",
        toolName: "run_terminal",
        args: { background: true, jobName: "install" },
        metadata: { jobName: "install", running: true }
      })
    ).toBe(true);
    expect(
      shouldTrackPreviewStartToolPart({
        type: "tool-invocation",
        toolName: "preview_start",
        args: { name: "api" },
        metadata: { app: { name: "api", running: true } }
      })
    ).toBe(true);
    trackBackgroundJobsFromToolParts({
      sessionId: "s1",
      parts: [
        {
          type: "tool-invocation",
          toolName: "run_terminal",
          args: { background: true, jobName: "install" },
          metadata: { jobName: "install", running: true },
          output: "ok"
        }
      ]
    });
    expect(listTrackedBackgroundJobs("s1")).toEqual(["install"]);
  });
});
