import { describe, it, expect } from "vitest";
import {
  dockEnsureFromEvent,
  dockExtrasAfterClose,
  dockExtrasAfterOpen,
  dockModeAfterClose,
  dockModeFromEvent,
  jobNameFromOpenEvent,
  OPEN_TERMINAL_JOB_EVENT,
  OPEN_TERMINAL_TAB_EVENT,
  PREVIEW_DOCK_EVENT,
  requestDevtoolsToggle,
  requestOpenTerminalJob,
  requestOpenTerminalTab,
  requestTerminalToggle,
  terminalTabFromOpenEvent
} from "./terminal-toggle";

describe("terminal-toggle", () => {
  it("dispatches dock mode events for toolbar CTAs", () => {
    const seen: string[] = [];
    const ensureFlags: boolean[] = [];
    const onDock = (e: Event) => {
      seen.push(dockModeFromEvent(e));
      ensureFlags.push(dockEnsureFromEvent(e));
    };
    window.addEventListener(PREVIEW_DOCK_EVENT, onDock);
    requestTerminalToggle();
    requestDevtoolsToggle();
    window.removeEventListener(PREVIEW_DOCK_EVENT, onDock);
    expect(seen).toEqual(["terminal", "devtools"]);
    expect(ensureFlags).toEqual([false, false]);
  });

  it("defaults unknown dock events to terminal", () => {
    expect(dockModeFromEvent(new Event("x"))).toBe("terminal");
    expect(dockEnsureFromEvent(new Event("x"))).toBe(false);
  });

  it("keeps extra dock tabs until they are closed", () => {
    expect(dockExtrasAfterOpen([], "terminal")).toEqual([]);
    expect(dockExtrasAfterOpen([], "devtools")).toEqual(["devtools"]);
    expect(dockExtrasAfterOpen(["devtools"], "devtools")).toEqual(["devtools"]);
    expect(dockExtrasAfterClose(["devtools"], "devtools")).toEqual([]);
    expect(dockModeAfterClose("devtools", "devtools")).toBe("terminal");
    expect(dockModeAfterClose("terminal", "devtools")).toBe("terminal");
  });

  it("opens terminal dock and emits tab for jobs", () => {
    const modes: string[] = [];
    const tabs: Array<{ id: string; kind: string }> = [];
    const ensureFlags: boolean[] = [];
    const onDock = (e: Event) => {
      modes.push(dockModeFromEvent(e));
      ensureFlags.push(dockEnsureFromEvent(e));
    };
    const onTab = (e: Event) => {
      const detail = terminalTabFromOpenEvent(e);
      if (detail) tabs.push(detail);
    };
    window.addEventListener(PREVIEW_DOCK_EVENT, onDock);
    window.addEventListener(OPEN_TERMINAL_TAB_EVENT, onTab);
    requestOpenTerminalJob("install");
    window.removeEventListener(PREVIEW_DOCK_EVENT, onDock);
    window.removeEventListener(OPEN_TERMINAL_TAB_EVENT, onTab);
    expect(modes).toEqual(["terminal"]);
    expect(ensureFlags).toEqual([true]);
    expect(tabs).toEqual([{ id: "job:install", kind: "job" }]);
  });

  it("opens a specific app tab", () => {
    const tabs: Array<{ id: string; kind: string }> = [];
    const onTab = (e: Event) => {
      const detail = terminalTabFromOpenEvent(e);
      if (detail) tabs.push(detail);
    };
    window.addEventListener(OPEN_TERMINAL_TAB_EVENT, onTab);
    requestOpenTerminalTab({ id: "app:web", kind: "app" });
    window.removeEventListener(OPEN_TERMINAL_TAB_EVENT, onTab);
    expect(tabs).toEqual([{ id: "app:web", kind: "app" }]);
  });

  it("parses legacy job open events", () => {
    expect(
      jobNameFromOpenEvent(
        new CustomEvent(OPEN_TERMINAL_JOB_EVENT, {
          detail: { jobName: "build" }
        })
      )
    ).toBe("build");
  });
});
