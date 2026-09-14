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
  trackTerminalsFromToolParts,
  untrackApp
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
    trackTerminalsFromToolParts({
      sessionId: "s1",
      parts: [
        {
          type: "tool-invocation",
          toolName: "run_terminal",
          args: { command: "pnpm i", background: true, jobName: "install" },
          metadata: { jobName: "install", running: true },
          output: "started"
        }
      ]
    });
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
    trackTerminalsFromToolParts({
      sessionId: "s1",
      parts: [
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
      ]
    });
    expect(listTrackedBackgroundJobs("s1")).toEqual([]);
  });

  it("tracks preview_start apps including soft-fail", () => {
    expect(
      shouldTrackPreviewStartToolPart({
        type: "tool-invocation",
        toolName: "preview_start",
        metadata: { app: { name: "web", running: true } },
        output: "Started web"
      })
    ).toBe(true);
    expect(
      shouldTrackPreviewStartToolPart({
        type: "tool-invocation",
        toolName: "preview_start",
        metadata: { app: { name: "api", running: false } },
        output: "Failed to start api. Port 3001 is not listening."
      })
    ).toBe(true);
    trackTerminalsFromToolParts({
      sessionId: "s1",
      parts: [
        {
          type: "tool-invocation",
          toolName: "preview_start",
          metadata: { app: { name: "web", running: true } },
          output: "Started web"
        }
      ]
    });
    expect(listTrackedApps("s1")).toEqual(["web"]);
  });

  it("skips historical preview_start apps that are not live", () => {
    trackTerminalsFromToolParts({
      sessionId: "s1",
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
      ],
      liveAppNames: new Set()
    });
    expect(listTrackedApps("s1")).toEqual([]);
  });

  it("re-tracks a preview_start app when live status says it is running", () => {
    trackApp("s1", "web");
    untrackApp("s1", "web");
    trackTerminalsFromToolParts({
      sessionId: "s1",
      parts: [
        {
          type: "tool-invocation",
          toolName: "preview_start",
          metadata: { app: { name: "web", running: true } },
          output: "Started web"
        }
      ],
      liveAppNames: new Set(["web"])
    });
    expect(listTrackedApps("s1")).toEqual(["web"]);
  });

  it("opens terminal tab for live preview_start", () => {
    const opened: Array<{ id: string; kind: string }> = [];
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; kind: string }>)
        .detail;
      opened.push(detail);
    };
    window.addEventListener("forge-open-terminal-tab", onOpen);
    try {
      trackTerminalsFromToolParts({
        sessionId: "s1",
        parts: [
          {
            type: "tool-invocation",
            toolName: "preview_start",
            metadata: { app: { name: "api", running: false } },
            output: "Failed to start"
          }
        ],
        openTabs: true
      });
      expect(listTrackedApps("s1")).toEqual(["api"]);
      expect(opened.some((d) => d.id === "app:api" && d.kind === "app")).toBe(
        true
      );
    } finally {
      window.removeEventListener("forge-open-terminal-tab", onOpen);
    }
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
    trackTerminalsFromToolParts({
      sessionId: "s1",
      parts: [
        {
          type: "tool-invocation",
          toolName: "run_terminal",
          metadata: { jobName: "build", running: true },
          output: "still running in chat metadata"
        }
      ]
    });
    expect(listTrackedBackgroundJobs("s1")).toEqual([]);
  });

  it("does not restart finished jobs from historical background args", () => {
    trackBackgroundJob("s1", "install");
    subscribed.get("job:install")?.onExited?.();
    trackTerminalsFromToolParts({
      sessionId: "s1",
      parts: [
        {
          type: "tool-invocation",
          toolName: "run_terminal",
          args: { background: true, jobName: "install" },
          metadata: { jobName: "install", running: true },
          output: "started"
        }
      ]
    });
    expect(listTrackedBackgroundJobs("s1")).toEqual([]);
  });

  it("re-tracks a job when live status says it is running", () => {
    trackBackgroundJob("s1", "install");
    subscribed.get("job:install")?.onExited?.();
    trackTerminalsFromToolParts({
      sessionId: "s1",
      parts: [
        {
          type: "tool-invocation",
          toolName: "run_terminal",
          args: { background: true, jobName: "install" },
          metadata: { jobName: "install", running: true },
          output: "started"
        }
      ],
      liveJobNames: new Set(["install"])
    });
    expect(listTrackedBackgroundJobs("s1")).toEqual(["install"]);
  });

  it("skips historical jobs that are not live", () => {
    trackTerminalsFromToolParts({
      sessionId: "s1",
      parts: [
        {
          type: "tool-invocation",
          toolName: "run_terminal",
          args: { background: true, jobName: "install" },
          metadata: { jobName: "install", running: true },
          output: "started"
        }
      ],
      liveJobNames: new Set()
    });
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

  it("untracks jobs when the socket reports exited, keeps app tabs", () => {
    trackBackgroundJob("s1", "build");
    trackApp("s1", "api");
    subscribed.get("job:build")?.onExited?.();
    subscribed.get("app:api")?.onExited?.();
    expect(listTrackedBackgroundJobs("s1")).toEqual([]);
    expect(listTrackedApps("s1")).toEqual(["api"]);
  });

  it("rebinds a preview alias tab to the canonical app name", () => {
    trackTerminalsFromToolParts({
      sessionId: "s1",
      parts: [
        {
          type: "tool-invocation",
          toolName: "preview_start",
          args: { name: "bp-backend" },
          state: "call"
        }
      ]
    });
    expect(listTrackedApps("s1")).toEqual(["bp-backend"]);
    trackTerminalsFromToolParts({
      sessionId: "s1",
      parts: [
        {
          type: "tool-invocation",
          toolName: "preview_start",
          args: { name: "bp-backend" },
          metadata: { app: { name: "bp-backend/bp-backend" } },
          state: "result",
          output: "Started"
        }
      ]
    });
    expect(listTrackedApps("s1")).toEqual(["bp-backend/bp-backend"]);
  });
});
