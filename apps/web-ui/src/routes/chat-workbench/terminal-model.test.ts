import { describe, it, expect } from "vitest";
import {
  appLogsByStream,
  applyTrackedRunningState,
  countRunningTabs,
  mergeApiTabsWithPinnedJobs,
  pickActiveTab,
  pinnedJobTab,
  pruneHiddenTabs,
  visibleTabs
} from "./terminal-model";

describe("terminal-model", () => {
  it("maps app logs by stream id", () => {
    expect(appLogsByStream({ web: "ok" })).toEqual({ "app:web": "ok" });
  });

  it("picks active tab and prunes hidden ids", () => {
    const tabs = [
      {
        id: "main",
        kind: "shell" as const,
        label: "Shell",
        running: false,
        closable: false
      },
      {
        id: "app:web",
        kind: "app" as const,
        label: "web",
        running: true,
        closable: true
      }
    ];
    expect(
      pickActiveTab({ tabs, preferredId: "app:web", hidden: new Set() })
    ).toBe("app:web");
    expect(
      pickActiveTab({ tabs, preferredId: "missing", hidden: new Set() })
    ).toBe("main");
    const hidden = new Set(["app:web"]);
    expect(visibleTabs(tabs, hidden).map((tab) => tab.id)).toEqual(["main"]);
    expect(pruneHiddenTabs(hidden, [{ ...tabs[0]! }]).has("app:web")).toBe(
      false
    );
  });

  it("counts running app and job tabs", () => {
    expect(
      countRunningTabs([
        {
          id: "main",
          kind: "shell",
          label: "Shell",
          running: false,
          closable: false
        },
        {
          id: "app:web",
          kind: "app",
          label: "web",
          running: true,
          closable: true
        },
        pinnedJobTab("install", true)
      ])
    ).toBe(2);
  });

  it("keeps pinned jobs when merging API tabs", () => {
    const merged = mergeApiTabsWithPinnedJobs({
      apiTabs: [
        {
          id: "main",
          kind: "shell",
          label: "Shell",
          running: false,
          closable: false
        }
      ],
      previous: [pinnedJobTab("install", true)],
      jobRunning: { install: false }
    });
    expect(merged.map((tab) => tab.id)).toEqual(["main", "job:install"]);
    expect(merged[1]?.running).toBe(false);
  });

  it("applies tracked app/job running state without HTTP", () => {
    const next = applyTrackedRunningState(
      [
        {
          id: "main",
          kind: "shell",
          label: "Shell",
          running: false,
          closable: false
        },
        pinnedJobTab("install", true)
      ],
      { trackedApps: ["web"], trackedJobs: [] }
    );
    expect(next.map((tab) => tab.id).sort()).toEqual([
      "app:web",
      "job:install",
      "main"
    ]);
    expect(next.find((tab) => tab.id === "app:web")?.running).toBe(true);
    expect(next.find((tab) => tab.id === "job:install")?.running).toBe(false);
  });
});
