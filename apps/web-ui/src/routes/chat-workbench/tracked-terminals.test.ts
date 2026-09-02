import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isBackgroundJobTracked,
  listTrackedApps,
  listTrackedBackgroundJobs,
  resetTrackedTerminalsForTests,
  shouldTrackBackgroundToolPart,
  shouldUntrackBackgroundToolPart,
  shouldTrackPreviewStartToolPart,
  trackApp,
  trackBackgroundJob,
  trackTerminalsFromToolParts
} from "./tracked-terminals";
import { resetTerminalSessionRegistryForTests } from "../../lib/terminal-session-registry";

type Handlers = { onExited?: () => void; onError?: () => void };

const subscribed = new Map<string, Handlers>();

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
    subscribe(stream: string, handlers: Handlers) {
      subscribed.set(stream, handlers);
      return () => {
        subscribed.delete(stream);
      };
    }
  }
}));

describe("tracked-terminals", () => {
  beforeEach(() => {
    resetTrackedTerminalsForTests();
    resetTerminalSessionRegistryForTests();
    subscribed.clear();
  });

  it("tracks background run starts only", () => {
    trackTerminalsFromToolParts("s1", [
      {
        type: "tool-invocation",
        toolName: "run_terminal",
        args: { command: "pnpm i", background: true, jobName: "install" },
        metadata: { jobName: "install", running: true },
        output: "started"
      }
    ]);
    expect(listTrackedBackgroundJobs("s1")).toEqual(["install"]);
    expect(isBackgroundJobTracked("s1", "install")).toBe(true);
  });

  it("does not track run_terminal logs or stop actions", () => {
    expect(
      shouldTrackBackgroundToolPart({
        type: "tool-invocation",
        toolName: "run_terminal",
        args: { action: "logs", jobName: "install" },
        metadata: { jobName: "install" },
        output: "log line"
      })
    ).toBe(false);
    trackTerminalsFromToolParts("s1", [
      {
        type: "tool-invocation",
        toolName: "run_terminal",
        args: { action: "logs", jobName: "install" },
        metadata: { jobName: "install" }
      },
      {
        type: "tool-invocation",
        toolName: "run_terminal",
        args: { action: "stop", jobName: "install" },
        metadata: { jobName: "install" },
        output: "stopped"
      }
    ]);
    expect(listTrackedBackgroundJobs("s1")).toEqual([]);
  });

  it("tracks preview_start apps", () => {
    expect(
      shouldTrackPreviewStartToolPart({
        type: "tool-invocation",
        toolName: "preview_start",
        metadata: { app: { name: "web", running: true } },
        output: "Started web"
      })
    ).toBe(true);
    trackTerminalsFromToolParts("s1", [
      {
        type: "tool-invocation",
        toolName: "preview_start",
        metadata: { app: { name: "web", running: true } },
        output: "Started web"
      }
    ]);
    expect(listTrackedApps("s1")).toEqual(["web"]);
  });

  it("does not track finished jobs", () => {
    expect(
      shouldTrackBackgroundToolPart({
        type: "tool-invocation",
        toolName: "run_terminal",
        args: { background: true, jobName: "install" },
        metadata: { jobName: "install", running: false },
        output: "done"
      })
    ).toBe(false);
    expect(
      shouldUntrackBackgroundToolPart({
        type: "tool-invocation",
        toolName: "run_terminal",
        args: { background: true, jobName: "install" },
        metadata: { jobName: "install", running: false },
        output: "done"
      })
    ).toBe(true);
  });

  it("does not re-track after socket exited", () => {
    trackBackgroundJob("s1", "build");
    subscribed.get("job:build")?.onExited?.();
    expect(listTrackedBackgroundJobs("s1")).toEqual([]);
    trackTerminalsFromToolParts("s1", [
      {
        type: "tool-invocation",
        toolName: "run_terminal",
        metadata: { jobName: "build", running: true },
        output: "still running in chat metadata"
      }
    ]);
    expect(listTrackedBackgroundJobs("s1")).toEqual([]);
  });

  it("re-tracks after explicit restart via trackBackgroundJob", () => {
    trackBackgroundJob("s1", "build");
    subscribed.get("job:build")?.onExited?.();
    trackBackgroundJob("s1", "build");
    expect(listTrackedBackgroundJobs("s1")).toEqual(["build"]);
  });

  it("allows retry after transient socket error", () => {
    trackBackgroundJob("s1", "build");
    subscribed.get("job:build")?.onError?.();
    expect(listTrackedBackgroundJobs("s1")).toEqual([]);
    trackBackgroundJob("s1", "build");
    expect(listTrackedBackgroundJobs("s1")).toEqual(["build"]);
  });

  it("untracks when the socket reports exited", () => {
    trackBackgroundJob("s1", "build");
    trackApp("s1", "api");
    subscribed.get("job:build")?.onExited?.();
    subscribed.get("app:api")?.onExited?.();
    expect(listTrackedBackgroundJobs("s1")).toEqual([]);
    expect(listTrackedApps("s1")).toEqual([]);
  });
});
